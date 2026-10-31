import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'
import { resetDb, createStaff, tokenFor } from './helpers.js'
import { weekStartOf } from '../src/requests/dates.js'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

const day = (offset: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
const WEEK = weekStartOf(day(21))

type Who = { id: string; email: string }
const auth = (who: Who) => ({ Authorization: tokenFor(who) })

const putShift = (boss: Who, staffId: string) =>
  request(app)
    .put(`/api/schedule/weeks/${WEEK}/shifts`)
    .set(auth(boss))
    .send({ staffId, date: WEEK, startMin: 600, endMin: 1080 })
    .expect(200)

// Maya works Monday, Leo is free, and the week is published.
async function setup() {
  const boss = await createStaff({ role: 'STORE_MANAGER', email: 'boss@example.com' })
  const maya = await createStaff()
  const leo = await createStaff()
  await putShift(boss, maya.id)
  await request(app).post(`/api/schedule/weeks/${WEEK}/publish`).set(auth(boss)).expect(200)
  return { boss, maya, leo }
}

const cantMakeIt = (who: Who, date = WEEK) =>
  request(app).post('/api/cover/me').set(auth(who)).send({ date, reason: 'Sick' })
const offer = (who: Who, id: string) => request(app).post(`/api/cover/${id}/offer`).set(auth(who))
const assign = (who: Who, id: string, staffId: string) =>
  request(app).post(`/api/cover/${id}/assign`).set(auth(who)).send({ staffId })
const myShifts = async (who: Who) =>
  (await request(app).get(`/api/schedule/me?week=${WEEK}`).set(auth(who)).expect(200)).body.shifts

describe("can't make it", () => {
  it('opens the shift and emails the manager and free staff', async () => {
    const { boss, maya, leo } = await setup()
    const res = await cantMakeIt(maya).expect(201)
    expect(res.body.status).toBe('OPEN')

    const toBoss = await prisma.notification.findFirstOrThrow({ where: { template: 'cover_requested' } })
    expect(toBoss.toEmail).toBe(boss.email)
    expect(toBoss.text).toContain('Sick')

    const open = await prisma.notification.findMany({ where: { template: 'shift_available' } })
    expect(open.map((n) => n.toEmail)).toEqual([leo.email]) // not Maya, and the manager only gets one email

    expect(await myShifts(maya)).toHaveLength(1) // still hers until someone is confirmed
  })

  it("only works for your own published shift, once", async () => {
    const { maya, leo } = await setup()
    await cantMakeIt(leo).expect(404)
    await cantMakeIt(maya).expect(201)
    await cantMakeIt(maya).expect(409)
  })

  it('can be withdrawn', async () => {
    const { boss, maya } = await setup()
    const { body } = await cantMakeIt(maya).expect(201)
    await request(app).delete(`/api/cover/me/${body.id}`).set(auth(maya)).expect(204)
    const list = await request(app).get('/api/cover').set(auth(boss)).expect(200)
    expect(list.body.items).toHaveLength(0)
  })
})

describe('pickup', () => {
  it('free staff see the open shift and can offer', async () => {
    const { boss, maya, leo } = await setup()
    const { body } = await cantMakeIt(maya).expect(201)

    const mine = await request(app).get('/api/cover/me').set(auth(leo)).expect(200)
    expect(mine.body.available).toMatchObject([{ id: body.id, date: WEEK, offered: false }])

    await offer(leo, body.id).expect(201)
    const list = await request(app).get('/api/cover').set(auth(boss)).expect(200)
    expect(list.body.items[0].offers).toMatchObject([{ staffId: leo.id, status: 'PENDING' }])
    expect(await prisma.notification.count({ where: { template: 'pickup_offered' } })).toBe(1)
  })

  it("someone already working that day can't offer", async () => {
    const { boss, maya, leo } = await setup()
    const { body } = await cantMakeIt(maya).expect(201)
    await putShift(boss, leo.id)
    await offer(leo, body.id).expect(409)
  })
})

describe('assigning cover', () => {
  it('moves the shift, emails both people, and logs it', async () => {
    const { boss, maya, leo } = await setup()
    const { body } = await cantMakeIt(maya).expect(201)
    await offer(leo, body.id).expect(201)

    const res = await assign(boss, body.id, leo.id).expect(200)
    expect(res.body).toMatchObject({ status: 'COVERED', coveredBy: { id: leo.id } })

    expect(await myShifts(maya)).toHaveLength(0)
    expect(await myShifts(leo)).toMatchObject([{ date: WEEK, startMin: 600, endMin: 1080 }])

    const updates = await prisma.notification.findMany({ where: { template: 'schedule_updated' } })
    expect(updates.map((n) => n.toEmail).sort()).toEqual([maya.email, leo.email].sort())

    const grid = await request(app).get(`/api/schedule/weeks/${WEEK}`).set(auth(boss)).expect(200)
    expect(grid.body.unpublishedStaffIds).toEqual([]) // nothing left to publish

    const log = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } })
    expect(log.map((l) => l.action)).toEqual(['schedule.published', 'cover.requested', 'pickup.offered', 'cover.assigned'])
  })

  it('only happens once', async () => {
    const { boss, maya, leo } = await setup()
    const { body } = await cantMakeIt(maya).expect(201)
    await assign(boss, body.id, leo.id).expect(200)
    await assign(boss, body.id, leo.id).expect(409)
  })

  it('is manager-only', async () => {
    const { maya, leo } = await setup()
    const { body } = await cantMakeIt(maya).expect(201)
    await assign(leo, body.id, leo.id).expect(403)
  })
})