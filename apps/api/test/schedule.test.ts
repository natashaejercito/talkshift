import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'
import { resetDb, createStaff, tokenFor } from './helpers.js'
import { addDays, weekStartOf, toDbDate } from '../src/requests/dates.js'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

const day = (offset: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
const WEEK = weekStartOf(day(21)) // a Monday a few weeks ahead

type Who = { id: string; email: string }
const manager = () => createStaff({ role: 'STORE_MANAGER', email: 'boss@example.com' })

const putShift = (who: Who, staffId: string, date = WEEK, startMin = 600, endMin = 1080) =>
  request(app)
    .put(`/api/schedule/weeks/${WEEK}/shifts`)
    .set('Authorization', tokenFor(who))
    .send({ staffId, date, startMin, endMin })

const grid = (who: Who) =>
  request(app).get(`/api/schedule/weeks/${WEEK}`).set('Authorization', tokenFor(who))

const publish = (who: Who) =>
  request(app).post(`/api/schedule/weeks/${WEEK}/publish`).set('Authorization', tokenFor(who))

const mine = (who: Who) =>
  request(app).get(`/api/schedule/me?week=${WEEK}`).set('Authorization', tokenFor(who))

describe('building the week', () => {
  it('adds a shift and shows it on the grid as unpublished', async () => {
    const boss = await manager()
    const maya = await createStaff()
    await putShift(boss, maya.id).expect(200)

    const res = await grid(boss).expect(200)
    const row = res.body.staff.find((s: { id: string }) => s.id === maya.id)
    expect(row.days[0].shift).toMatchObject({ startMin: 600, endMin: 1080 })
    expect(res.body.unpublishedStaffIds).toEqual([maya.id])
  })

  it('is manager-only', async () => {
    const maya = await createStaff()
    await putShift(maya, maya.id).expect(403)
    await grid(maya).expect(403)
  })

  it('keeps one shift per person per day', async () => {
    const boss = await manager()
    const maya = await createStaff()
    await putShift(boss, maya.id).expect(200)
    await putShift(boss, maya.id, WEEK, 780, 1260).expect(200)
    expect(await prisma.shift.count()).toBe(1)
  })

  it('rejects bad shifts', async () => {
    const boss = await manager()
    const maya = await createStaff()
    await putShift(boss, maya.id, WEEK, 480, 1080).expect(400) // before opening
    await putShift(boss, maya.id, addDays(WEEK, 7)).expect(400) // next week
    await request(app)
      .get(`/api/schedule/weeks/${addDays(WEEK, 1)}`) // not a Monday
      .set('Authorization', tokenFor(boss))
      .expect(400)
  })

  it('warns when someone has approved time off', async () => {
    const boss = await manager()
    const maya = await createStaff()
    await prisma.timeOffRequest.create({
      data: {
        staffId: maya.id,
        kind: 'TIME_OFF',
        startDate: toDbDate(WEEK),
        endDate: toDbDate(WEEK),
        status: 'APPROVED',
      },
    })
    await putShift(boss, maya.id).expect(200)

    const res = await grid(boss).expect(200)
    const row = res.body.staff.find((s: { id: string }) => s.id === maya.id)
    expect(row.days[0].shift.warning).toBe('TIME_OFF')
  })

  it('removes a shift', async () => {
    const boss = await manager()
    const maya = await createStaff()
    const { body } = await putShift(boss, maya.id).expect(200)
    await request(app)
      .delete(`/api/schedule/weeks/${WEEK}/shifts/${body.id}`)
      .set('Authorization', tokenFor(boss))
      .expect(204)
    expect(await prisma.shift.count()).toBe(0)
  })
})

describe('publishing', () => {
  it('needs at least one shift', async () => {
    const boss = await manager()
    await publish(boss).expect(400)
  })

  it('staff only see shifts once published', async () => {
    const boss = await manager()
    const maya = await createStaff()
    await putShift(boss, maya.id).expect(200)

    expect((await mine(maya).expect(200)).body.shifts).toHaveLength(0)
    await publish(boss).expect(200)
    expect((await mine(maya).expect(200)).body.shifts).toEqual([
      { date: WEEK, startMin: 600, endMin: 1080, note: null },
    ])
  })

  it('hides later edits until republished, and reports who changed', async () => {
    const boss = await manager()
    const maya = await createStaff()
    const leo = await createStaff()
    await putShift(boss, maya.id).expect(200)
    await putShift(boss, leo.id).expect(200)
    const first = await publish(boss).expect(200)
    expect(first.body.changedStaffIds.sort()).toEqual([maya.id, leo.id].sort())

    await putShift(boss, maya.id, WEEK, 780, 1260).expect(200)
    expect((await mine(maya)).body.shifts[0].startMin).toBe(600) // still the published one

    const second = await publish(boss).expect(200)
    expect(second.body.changedStaffIds).toEqual([maya.id]) // Leo is untouched
    expect(second.body.version).toBe(2)
    expect((await mine(maya)).body.shifts[0].startMin).toBe(780)
  })
})