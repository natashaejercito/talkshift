import type { Role } from '../src/generated/prisma/client.js'
import { prisma } from '../src/db.js'

export async function resetDb() {
  await prisma.staff.deleteMany()
}

export function bearer(claims: Record<string, unknown>) {
  return `Bearer ${Buffer.from(JSON.stringify(claims)).toString('base64url')}`
}

let n = 0
export function createStaff(overrides: { role?: Role; active?: boolean; email?: string } = {}) {
  n += 1
  return prisma.staff.create({
    data: { name: `Test Staff ${n}`, email: `staff${n}@example.com`, ...overrides },
  })
}

const NS = 'https://talkshift.app'

// A fake Auth0 token for this staff member.
export function tokenFor(staff: { id: string; email: string }, verified = true) {
  return bearer({
    sub: `auth0|${staff.id}`,
    [`${NS}/email`]: staff.email,
    [`${NS}/email_verified`]: verified,
  })
}
