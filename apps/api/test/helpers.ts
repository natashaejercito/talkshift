import type { Role } from '../src/generated/prisma/client.js'
import { prisma } from '../src/db.js'
import { DEFAULT_STORE_HOURS } from '../src/availability/storeHours.js'
import { defaultStoreSettings } from '../src/requests/settings.js'

export async function resetDb() {
  await prisma.notification.deleteMany()
  await prisma.timeOffRequest.deleteMany()
  await prisma.availabilityChange.deleteMany()
  await prisma.availabilityRule.deleteMany()
  await prisma.staff.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.pickupOffer.deleteMany()
  await prisma.coverRequest.deleteMany()
  await prisma.storeHours.createMany({ data: DEFAULT_STORE_HOURS, skipDuplicates: true })
  await prisma.storeSettings.upsert({ where: { id: 1 }, update: {}, create: defaultStoreSettings() })
  await prisma.shift.deleteMany()
  await prisma.week.deleteMany()
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
