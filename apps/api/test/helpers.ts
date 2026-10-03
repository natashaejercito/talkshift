import type { Role } from '../src/generated/prisma/client.js'
import { prisma } from '../src/db.js'
import { newToken, hashToken, LINK_TTL_MS } from '../src/auth/session.js'

export async function resetDb() {
  await prisma.session.deleteMany()
  await prisma.loginToken.deleteMany()
  await prisma.staff.deleteMany()
}

let n = 0
export function createStaff(overrides: { role?: Role; active?: boolean; email?: string } = {}) {
  n += 1
  return prisma.staff.create({
    data: { name: `Test Staff ${n}`, email: `staff${n}@example.com`, ...overrides },
  })
}

export async function createLoginLink(staffId: string, expiresInMs = LINK_TTL_MS) {
  const token = newToken()
  await prisma.loginToken.create({
    data: { tokenHash: hashToken(token), staffId, expiresAt: new Date(Date.now() + expiresInMs) },
  })
  return token
}