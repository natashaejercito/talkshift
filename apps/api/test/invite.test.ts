import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'

vi.mock('../src/auth0/management.js', () => ({
  managementConfigured: () => true,
  ensureAuth0User: vi.fn(async (email: string) => `auth0|${email}`),
  passwordSetupLink: vi.fn(async () => 'https://example.auth0.com/lo/reset?ticket=abc'),
}))

import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'
import { resetDb, createStaff, tokenFor } from './helpers.js'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

const manager = () => createStaff({ role: 'STORE_MANAGER', email: 'boss@example.com' })

describe('staff invites', () => {
  it('adding someone creates their Auth0 account and queues an invite', async () => {
    const boss = await manager()
    const res = await request(app)
      .post('/api/staff')
      .set('Authorization', tokenFor(boss))
      .send({ name: 'Maya Lee', email: 'maya@example.com', employmentType: 'PART_TIME' })
      .expect(201)

    expect(res.body.invite.status).toBe('sent')
    expect(res.body.hasSignedIn).toBe(false)
    expect(res.body.invitedAt).not.toBeNull()

    const staff = await prisma.staff.findUniqueOrThrow({ where: { email: 'maya@example.com' } })
    expect(staff.auth0Id).toBe('auth0|maya@example.com')

    const email = await prisma.notification.findFirstOrThrow({ where: { template: 'invite' } })
    expect(email.toEmail).toBe('maya@example.com')
    expect(email.text).toContain('ticket=abc')
  })

  it('can resend an invite', async () => {
    const boss = await manager()
    const maya = await createStaff({ email: 'maya@example.com' })
    await request(app).post(`/api/staff/${maya.id}/invite`).set('Authorization', tokenFor(boss)).expect(200)
    expect(await prisma.notification.count({ where: { template: 'invite' } })).toBe(1)
  })

  it("doesn't invite someone who has already signed in", async () => {
    const boss = await manager()
    const maya = await createStaff({ email: 'maya@example.com' })
    await prisma.staff.update({ where: { id: maya.id }, data: { firstSignInAt: new Date() } })

    const res = await request(app)
      .post(`/api/staff/${maya.id}/invite`)
      .set('Authorization', tokenFor(boss))
      .expect(200)
    expect(res.body.status).toBe('skipped')
  })
})