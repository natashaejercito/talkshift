import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'
import { resetDb, createStaff, tokenFor } from './helpers.js'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

const manager = () => createStaff({ role: 'STORE_MANAGER', email: 'boss@example.com' })

describe('staff management', () => {
  it('is manager-only', async () => {
    const staff = await createStaff({ role: 'STAFF' })
    await request(app).get('/api/staff').set('Authorization', tokenFor(staff)).expect(403)
  })

  it('lists staff for a manager', async () => {
    const boss = await manager()
    await createStaff({ email: 'maya@example.com' })
    const res = await request(app).get('/api/staff').set('Authorization', tokenFor(boss)).expect(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).not.toHaveProperty('auth0Id')
  })

  it('adds a staff member with a clean email', async () => {
    const boss = await manager()
    const res = await request(app)
      .post('/api/staff')
      .set('Authorization', tokenFor(boss))
      .send({ name: 'Maya', email: ' Maya@Example.com ', employmentType: 'FULL_TIME', targetDaysPerWeek: 5 })
      .expect(201)
    expect(res.body).toMatchObject({
      email: 'maya@example.com',
      role: 'STAFF',
      targetDaysPerWeek: 5,
      hasSignedIn: false,
    })
  })

  it('rejects a duplicate email', async () => {
    const boss = await manager()
    await createStaff({ email: 'maya@example.com' })
    await request(app)
      .post('/api/staff')
      .set('Authorization', tokenFor(boss))
      .send({ name: 'Maya again', email: 'maya@example.com', employmentType: 'PART_TIME' })
      .expect(409)
  })

  it('requires a target for full-time staff', async () => {
    const boss = await manager()
    await request(app)
      .post('/api/staff')
      .set('Authorization', tokenFor(boss))
      .send({ name: 'Jordan', email: 'jordan@example.com', employmentType: 'FULL_TIME' })
      .expect(400)
  })

  it('clears the target when someone becomes part-time', async () => {
    const boss = await manager()
    const jordan = await createStaff({ email: 'jordan@example.com' })
    await prisma.staff.update({
      where: { id: jordan.id },
      data: { employmentType: 'FULL_TIME', targetDaysPerWeek: 5 },
    })

    const res = await request(app)
      .patch(`/api/staff/${jordan.id}`)
      .set('Authorization', tokenFor(boss))
      .send({ employmentType: 'PART_TIME' })
      .expect(200)
    expect(res.body.targetDaysPerWeek).toBeNull()
  })

  it('deactivates someone, who then loses access', async () => {
    const boss = await manager()
    const leo = await createStaff({ email: 'leo@example.com' })

    await request(app)
      .patch(`/api/staff/${leo.id}`)
      .set('Authorization', tokenFor(boss))
      .send({ active: false })
      .expect(200)
    await request(app).get('/api/me').set('Authorization', tokenFor(leo)).expect(403)
  })

  it("won't let a manager remove their own access", async () => {
    const boss = await manager()
    await request(app)
      .patch(`/api/staff/${boss.id}`)
      .set('Authorization', tokenFor(boss))
      .send({ active: false })
      .expect(400)
  })
})