import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'
import { resetDb, createStaff, tokenFor } from './helpers.js'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

// A date `offset` days from today, as YYYY-MM-DD.
const day = (offset: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

const manager = () => createStaff({ role: 'STORE_MANAGER', email: 'boss@example.com' })

const timeOff = (staff: { id: string; email: string }, startDate: string, endDate = startDate) =>
  request(app)
    .post('/api/requests/me')
    .set('Authorization', tokenFor(staff))
    .send({ kind: 'TIME_OFF', startDate, endDate, note: 'Family trip' })

describe('staff requests', () => {
  it('creates a time-off request that is on time', async () => {
    const maya = await createStaff()
    // 3+ weeks ahead: that week's cutoff hasn't passed yet
    const res = await timeOff(maya, day(21), day(23)).expect(201)
    expect(res.body).toMatchObject({ kind: 'TIME_OFF', status: 'PENDING', late: false, note: 'Family trip' })
  })

  it('flags a request for this week as late', async () => {
    const maya = await createStaff()
    // 2 days ahead: the Thursday cutoff before that week has always passed
    const res = await timeOff(maya, day(2)).expect(201)
    expect(res.body.late).toBe(true)
  })

  it('creates a partial-day request within store hours', async () => {
    const maya = await createStaff()
    const res = await request(app)
      .post('/api/requests/me')
      .set('Authorization', tokenFor(maya))
      .send({ kind: 'PARTIAL_DAY', date: day(21), startMin: 840, endMin: 1140 }) // 2 PM – 7 PM
      .expect(201)
    expect(res.body).toMatchObject({ startDate: day(21), endDate: day(21), startMin: 840 })
  })

  it('rejects partial-day times outside store hours', async () => {
    const maya = await createStaff()
    await request(app)
      .post('/api/requests/me')
      .set('Authorization', tokenFor(maya))
      .send({ kind: 'PARTIAL_DAY', date: day(21), startMin: 480, endMin: 720 }) // 8 AM start
      .expect(400)
  })

  it('rejects past dates', async () => {
    const maya = await createStaff()
    await timeOff(maya, day(-3)).expect(400)
  })

  it('rejects an end date before the start date', async () => {
    const maya = await createStaff()
    await timeOff(maya, day(25), day(21)).expect(400)
  })

  it('rejects overlapping requests', async () => {
    const maya = await createStaff()
    await timeOff(maya, day(21), day(25)).expect(201)
    await timeOff(maya, day(24), day(27)).expect(409)
  })

  it('allows asking again after a decline', async () => {
    const boss = await manager()
    const maya = await createStaff()
    const { body } = await timeOff(maya, day(21)).expect(201)
    await request(app)
      .post(`/api/requests/${body.id}/decision`)
      .set('Authorization', tokenFor(boss))
      .send({ decision: 'DECLINED' })
      .expect(200)
    await timeOff(maya, day(21)).expect(201)
  })

  it('lets staff withdraw only their own pending request', async () => {
    const maya = await createStaff()
    const leo = await createStaff()
    const { body } = await timeOff(maya, day(21)).expect(201)

    await request(app).delete(`/api/requests/me/${body.id}`).set('Authorization', tokenFor(leo)).expect(404)
    await request(app).delete(`/api/requests/me/${body.id}`).set('Authorization', tokenFor(maya)).expect(204)
  })
})

describe('manager inbox', () => {
  it('is manager-only', async () => {
    const maya = await createStaff()
    await request(app).get('/api/inbox').set('Authorization', tokenFor(maya)).expect(403)
  })

  it('lists time-off requests and availability changes together', async () => {
    const boss = await manager()
    const maya = await createStaff()
    await timeOff(maya, day(21)).expect(201)
    await request(app)
      .put('/api/availability/me')
      .set('Authorization', tokenFor(maya))
      .send({ days: Array(7).fill({ status: 'ALL_DAY' }) })
      .expect(200)

    const res = await request(app).get('/api/inbox').set('Authorization', tokenFor(boss)).expect(200)
    expect(res.body.items.map((i: { type: string }) => i.type).sort()).toEqual(['AVAILABILITY', 'REQUEST'])
  })

  it('approves a request and removes it from the inbox', async () => {
    const boss = await manager()
    const maya = await createStaff()
    const { body } = await timeOff(maya, day(21)).expect(201)

    const res = await request(app)
      .post(`/api/requests/${body.id}/decision`)
      .set('Authorization', tokenFor(boss))
      .send({ decision: 'APPROVED', managerNote: 'Have a good trip!' })
      .expect(200)
    expect(res.body).toMatchObject({ status: 'APPROVED', managerNote: 'Have a good trip!' })

    const inbox = await request(app).get('/api/inbox').set('Authorization', tokenFor(boss)).expect(200)
    expect(inbox.body.items).toHaveLength(0)
  })

  it("can't decide twice, and staff can't decide", async () => {
    const boss = await manager()
    const maya = await createStaff()
    const { body } = await timeOff(maya, day(21)).expect(201)
    const decide = (who: { id: string; email: string }) =>
      request(app)
        .post(`/api/requests/${body.id}/decision`)
        .set('Authorization', tokenFor(who))
        .send({ decision: 'APPROVED' })

    await decide(maya).expect(403)
    await decide(boss).expect(200)
    await decide(boss).expect(409)
  })
})