import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'
import { resetDb, createStaff, tokenFor } from './helpers.js'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

const ALL = { status: 'ALL_DAY' }
const OFF = { status: 'UNAVAILABLE' }
const window = (start: number, end: number) => ({ status: 'WINDOW', start, end })
// Mon all day, Tue off, Wed 3–9 PM, rest all day
const week = [ALL, OFF, window(900, 1260), ALL, ALL, ALL, ALL]

const manager = () => createStaff({ role: 'STORE_MANAGER', email: 'boss@example.com' })

function submit(staff: { id: string; email: string }, days: unknown[] = week) {
  return request(app).put('/api/availability/me').set('Authorization', tokenFor(staff)).send({ days })
}

describe('staff availability', () => {
  it('sends a change for approval without changing the saved pattern', async () => {
    const maya = await createStaff()
    await submit(maya).expect(200)

    const res = await request(app).get('/api/availability/me').set('Authorization', tokenFor(maya)).expect(200)
    expect(res.body.pending.status).toBe('PENDING')
    expect(res.body.current).toEqual([null, null, null, null, null, null, null])
  })

  it('replaces a change that is still pending', async () => {
    const maya = await createStaff()
    await submit(maya).expect(200)
    await submit(maya, [OFF, OFF, OFF, ALL, ALL, ALL, ALL]).expect(200)
    expect(await prisma.availabilityChange.count()).toBe(1)
  })

  it('rejects times outside store hours', async () => {
    const maya = await createStaff()
    // Sunday closes at 7 PM (1140)
    await submit(maya, [ALL, ALL, ALL, ALL, ALL, ALL, window(660, 1260)]).expect(400)
  })

  it('rejects a start time after the end time', async () => {
    const maya = await createStaff()
    await submit(maya, [window(1200, 900), ALL, ALL, ALL, ALL, ALL, ALL]).expect(400)
  })

  it('needs all 7 days', async () => {
    const maya = await createStaff()
    await submit(maya, [ALL, ALL]).expect(400)
  })

  it('lets staff withdraw a pending change', async () => {
    const maya = await createStaff()
    await submit(maya).expect(200)
    await request(app).delete('/api/availability/me/pending').set('Authorization', tokenFor(maya)).expect(204)
    expect(await prisma.availabilityChange.count()).toBe(0)
  })
})

describe('manager decisions', () => {
  it('only managers can decide', async () => {
    const maya = await createStaff()
    const { body } = await submit(maya).expect(200)
    await request(app)
      .post(`/api/availability/changes/${body.id}/decision`)
      .set('Authorization', tokenFor(maya))
      .send({ decision: 'APPROVED' })
      .expect(403)
  })

  it('approving replaces the saved pattern', async () => {
    const boss = await manager()
    const maya = await createStaff()
    const { body } = await submit(maya).expect(200)

    await request(app)
      .post(`/api/availability/changes/${body.id}/decision`)
      .set('Authorization', tokenFor(boss))
      .send({ decision: 'APPROVED' })
      .expect(200)

    const res = await request(app).get('/api/availability/me').set('Authorization', tokenFor(maya)).expect(200)
    expect(res.body.current).toEqual(week)
    expect(res.body.pending).toBeNull()
  })

  it('declining keeps the old pattern and passes on the note', async () => {
    const boss = await manager()
    const maya = await createStaff()
    const { body } = await submit(maya).expect(200)

    const res = await request(app)
      .post(`/api/availability/changes/${body.id}/decision`)
      .set('Authorization', tokenFor(boss))
      .send({ decision: 'DECLINED', managerNote: 'We need you on Tuesdays.' })
      .expect(200)

    expect(res.body).toMatchObject({ status: 'DECLINED', managerNote: 'We need you on Tuesdays.' })
    expect(await prisma.availabilityRule.count()).toBe(0)
  })

  it("can't decide the same change twice", async () => {
    const boss = await manager()
    const maya = await createStaff()
    const { body } = await submit(maya).expect(200)
    const decide = () =>
      request(app)
        .post(`/api/availability/changes/${body.id}/decision`)
        .set('Authorization', tokenFor(boss))
        .send({ decision: 'APPROVED' })

    await decide().expect(200)
    await decide().expect(409)
  })

  it('shows the team with pending changes', async () => {
    const boss = await manager()
    const maya = await createStaff()
    await submit(maya).expect(200)

    const res = await request(app).get('/api/availability/team').set('Authorization', tokenFor(boss)).expect(200)
    const row = res.body.staff.find((s: { id: string }) => s.id === maya.id)
    expect(row.pending.days).toEqual(week)
    expect(res.body.storeHours).toHaveLength(7)
  })
})