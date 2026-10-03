import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'
import { resetDb, createStaff, createLoginLink } from './helpers.js'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

async function signedInAgent(staffId: string) {
  const agent = request.agent(app) // keeps cookies between requests, like a browser
  const token = await createLoginLink(staffId)
  await agent.post('/api/auth/verify').send({ token }).expect(200)
  return agent
}

describe('POST /api/auth/request-link', () => {
  it('gives the same answer for an unknown email and creates no link', async () => {
    const res = await request(app)
      .post('/api/auth/request-link')
      .send({ email: 'nobody@example.com' })
      .expect(200)

    expect(res.body.message).toMatch(/sign-in link/)
    expect(await prisma.loginToken.count()).toBe(0)
  })

  it('creates a link for an active staff member', async () => {
    await createStaff({ email: 'maya@example.com' })
    await request(app).post('/api/auth/request-link').send({ email: 'Maya@Example.com' }).expect(200)
    expect(await prisma.loginToken.count()).toBe(1)
  })
})

describe('POST /api/auth/verify', () => {
  it('signs in with a valid link and sets an httpOnly cookie', async () => {
    const staff = await createStaff()
    const token = await createLoginLink(staff.id)

    const res = await request(app).post('/api/auth/verify').send({ token }).expect(200)
    expect(res.headers['set-cookie']?.[0]).toMatch(/HttpOnly/)
  })

  it('rejects a link that was already used', async () => {
    const staff = await createStaff()
    const token = await createLoginLink(staff.id)

    await request(app).post('/api/auth/verify').send({ token }).expect(200)
    await request(app).post('/api/auth/verify').send({ token }).expect(400)
  })

  it('rejects an expired link', async () => {
    const staff = await createStaff()
    const token = await createLoginLink(staff.id, -1000)
    await request(app).post('/api/auth/verify').send({ token }).expect(400)
  })

  it('rejects a link for an inactive staff member', async () => {
    const staff = await createStaff({ active: false })
    const token = await createLoginLink(staff.id)
    await request(app).post('/api/auth/verify').send({ token }).expect(400)
  })
})

describe('sessions and roles', () => {
  it('returns 401 from /api/me when signed out', async () => {
    await request(app).get('/api/me').expect(401)
  })

  it('returns the signed-in staff member from /api/me', async () => {
    const staff = await createStaff()
    const agent = await signedInAgent(staff.id)

    const res = await agent.get('/api/me').expect(200)
    expect(res.body).toMatchObject({ id: staff.id, role: 'STAFF' })
  })

  it('signs out', async () => {
    const staff = await createStaff()
    const agent = await signedInAgent(staff.id)

    await agent.post('/api/auth/logout').expect(204)
    await agent.get('/api/me').expect(401)
  })

  it('cuts off someone deactivated after signing in', async () => {
    const staff = await createStaff()
    const agent = await signedInAgent(staff.id)

    await prisma.staff.update({ where: { id: staff.id }, data: { active: false } })
    await agent.get('/api/me').expect(401)
  })

  it('blocks staff from manager routes', async () => {
    const staff = await createStaff({ role: 'STAFF' })
    const agent = await signedInAgent(staff.id)
    await agent.get('/api/manager/ping').expect(403)
  })

  it('lets store and assistant managers into manager routes', async () => {
    for (const role of ['STORE_MANAGER', 'ASSISTANT_STORE_MANAGER'] as const) {
      const manager = await createStaff({ role })
      const agent = await signedInAgent(manager.id)
      await agent.get('/api/manager/ping').expect(200)
    }
  })
})