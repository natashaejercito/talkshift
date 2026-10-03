import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'
import { resetDb, createStaff, bearer } from './helpers.js'

// Replace Auth0's token check: read the claims straight from the fake bearer token.
vi.mock('express-oauth2-jwt-bearer', () => ({
  auth: () => (req: any, res: any, next: any) => {
    const header: string | undefined = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Not signed in' })
      return
    }
    req.auth = { payload: JSON.parse(Buffer.from(header.slice(7), 'base64url').toString()) }
    next()
  },
}))


const NS = 'https://talkshift.app'
const claimsFor = (sub: string, email: string, verified = true) => ({
  sub,
  [`${NS}/email`]: email,
  [`${NS}/email_verified`]: verified,
})

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

describe('GET /api/me', () => {
  it('returns 401 without a token', async () => {
    await request(app).get('/api/me').expect(401)
  })

  it('links a staff member by verified email on first sign-in', async () => {
    const staff = await createStaff({ email: 'maya@example.com' })

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', bearer(claimsFor('auth0|maya', 'Maya@Example.com')))
      .expect(200)

    expect(res.body).toMatchObject({ id: staff.id, role: 'STAFF' })
    const linked = await prisma.staff.findUnique({ where: { id: staff.id } })
    expect(linked?.auth0Id).toBe('auth0|maya')
  })

  it('does not link an unverified email', async () => {
    await createStaff({ email: 'maya@example.com' })
    await request(app)
      .get('/api/me')
      .set('Authorization', bearer(claimsFor('auth0|maya', 'maya@example.com', false)))
      .expect(403)
  })

  it('returns 403 for someone not on the staff list', async () => {
    await request(app)
      .get('/api/me')
      .set('Authorization', bearer(claimsFor('auth0|stranger', 'stranger@example.com')))
      .expect(403)
  })

  it('returns 403 for a deactivated staff member', async () => {
    await createStaff({ email: 'leo@example.com', active: false })
    await request(app)
      .get('/api/me')
      .set('Authorization', bearer(claimsFor('auth0|leo', 'leo@example.com')))
      .expect(403)
  })
})

describe('manager routes', () => {
  it('blocks staff', async () => {
    await createStaff({ email: 'sam@example.com', role: 'STAFF' })
    await request(app)
      .get('/api/manager/ping')
      .set('Authorization', bearer(claimsFor('auth0|sam', 'sam@example.com')))
      .expect(403)
  })

  it('allows store and assistant managers', async () => {
    for (const role of ['STORE_MANAGER', 'ASSISTANT_STORE_MANAGER'] as const) {
      const email = `${role.toLowerCase()}@example.com`
      await createStaff({ email, role })
      await request(app)
        .get('/api/manager/ping')
        .set('Authorization', bearer(claimsFor(`auth0|${role}`, email)))
        .expect(200)
    }
  })
})