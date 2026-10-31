import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { requestJson } from '../requests/routes.js'
import { changeJson } from '../availability/routes.js'
import { rulesToDays } from '../availability/days.js'

export const inboxRouter = Router()
inboxRouter.use(requireAuth, requireRole('STORE_MANAGER', 'ASSISTANT_STORE_MANAGER'))

// Everything waiting for a manager, newest first.
inboxRouter.get('/', async (_req, res) => {
  const [requests, changes] = await Promise.all([
    prisma.timeOffRequest.findMany({
      where: { status: 'PENDING', staff: { active: true } },
      include: { staff: true },
    }),
    prisma.availabilityChange.findMany({
      where: { status: 'PENDING', staff: { active: true } },
      include: { staff: { include: { availability: true } } },
    }),
  ])

  const items = [
    ...requests.map((r) => ({
      type: 'REQUEST' as const,
      staff: { id: r.staff.id, name: r.staff.name },
      request: requestJson(r),
      submittedAt: r.createdAt,
    })),
    ...changes.map((c) => ({
      type: 'AVAILABILITY' as const,
      staff: { id: c.staff.id, name: c.staff.name },
      change: changeJson(c),
      current: rulesToDays(c.staff.availability),
      submittedAt: c.updatedAt,
    })),
  ].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())

  res.json({ items })
})