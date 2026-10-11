import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import type { AvailabilityChange } from '../generated/prisma/client.js'
import { weekSchema, checkStoreHours, rulesToDays } from './days.js'

const managerOnly = requireRole('STORE_MANAGER', 'ASSISTANT_STORE_MANAGER')

function changeJson(c: AvailabilityChange) {
  return {
    id: c.id,
    days: c.days,
    note: c.note,
    status: c.status,
    managerNote: c.managerNote,
    submittedAt: c.updatedAt,
  }
}

const storeHours = () => prisma.storeHours.findMany({ orderBy: { weekday: 'asc' } })

export const availabilityRouter = Router()
availabilityRouter.use(requireAuth)

// ---- Staff: my own availability ----

availabilityRouter.get('/me', async (req, res) => {
  const staffId = req.staff!.id
  const [rules, pending, hours] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { staffId } }),
    prisma.availabilityChange.findFirst({ where: { staffId, status: 'PENDING' } }),
    storeHours(),
  ])
  res.json({
    current: rulesToDays(rules),
    pending: pending ? changeJson(pending) : null,
    storeHours: hours,
  })
})

const submitSchema = z.object({
  days: weekSchema,
  note: z.string().trim().max(200).optional(),
})

// Send a new pattern for approval. Replaces any change still waiting.
availabilityRouter.put('/me', async (req, res) => {
  const parsed = submitSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid availability' })
    return
  }
  const problem = checkStoreHours(parsed.data.days, await storeHours())
  if (problem) {
    res.status(400).json({ error: problem })
    return
  }

  const staffId = req.staff!.id
  const data = { days: parsed.data.days, note: parsed.data.note || null }
  const existing = await prisma.availabilityChange.findFirst({ where: { staffId, status: 'PENDING' } })
  const change = existing
    ? await prisma.availabilityChange.update({ where: { id: existing.id }, data })
    : await prisma.availabilityChange.create({ data: { ...data, staffId } })

  res.json(changeJson(change))
})

// Take back a change the manager hasn't decided yet.
availabilityRouter.delete('/me/pending', async (req, res) => {
  await prisma.availabilityChange.deleteMany({ where: { staffId: req.staff!.id, status: 'PENDING' } })
  res.status(204).end()
})

// ---- Manager: everyone's availability, and decisions ----

availabilityRouter.get('/team', managerOnly, async (_req, res) => {
  const [staff, hours] = await Promise.all([
    prisma.staff.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: {
        availability: true,
        availabilityChanges: { where: { status: 'PENDING' }, take: 1 },
      },
    }),
    storeHours(),
  ])

  res.json({
    storeHours: hours,
    staff: staff.map((s) => ({
      id: s.id,
      name: s.name,
      employmentType: s.employmentType,
      targetDaysPerWeek: s.targetDaysPerWeek,
      current: rulesToDays(s.availability),
      pending: s.availabilityChanges[0] ? changeJson(s.availabilityChanges[0]) : null,
    })),
  })
})

const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'DECLINED']),
  managerNote: z.string().trim().max(200).optional(),
})

availabilityRouter.post('/changes/:id/decision', managerOnly, async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Choose approve or decline.' })
    return
  }
  const change = await prisma.availabilityChange.findUnique({ where: { id: req.params.id as string } })

  if (!change) {
    res.status(404).json({ error: 'Request not found.' })
    return
  }
  if (change.status !== 'PENDING') {
    res.status(409).json({ error: 'This request was already decided.' })
    return
  }

  const decided = {
    status: parsed.data.decision,
    managerNote: parsed.data.managerNote || null,
    decidedById: req.staff!.id,
    decidedAt: new Date(),
  }

  if (parsed.data.decision === 'DECLINED') {
    const updated = await prisma.availabilityChange.update({ where: { id: change.id }, data: decided })
    res.json(changeJson(updated))
    return
  }

  // Approve: swap the old pattern for the new one, all or nothing.
  const days = weekSchema.parse(change.days)
  const [, , updated] = await prisma.$transaction([
    prisma.availabilityRule.deleteMany({ where: { staffId: change.staffId } }),
    prisma.availabilityRule.createMany({
      data: days.map((d, weekday) => ({
        staffId: change.staffId,
        weekday,
        status: d.status,
        startMin: d.status === 'WINDOW' ? d.start : null,
        endMin: d.status === 'WINDOW' ? d.end : null,
      })),
    }),
    prisma.availabilityChange.update({ where: { id: change.id }, data: decided }),
  ])
  res.json(changeJson(updated))
})