import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import type { TimeOffRequest } from '../generated/prisma/client.js'
import { isIsoDate, toDbDate, fromDbDate, weekdayOf, daysBetween, storeNow, isLate } from './dates.js'

const managerOnly = requireRole('STORE_MANAGER', 'ASSISTANT_STORE_MANAGER')
const MAX_DAYS = 30

export function requestJson(r: TimeOffRequest) {
  return {
    id: r.id,
    kind: r.kind,
    startDate: fromDbDate(r.startDate),
    endDate: fromDbDate(r.endDate),
    startMin: r.startMin,
    endMin: r.endMin,
    note: r.note,
    late: r.late,
    status: r.status,
    managerNote: r.managerNote,
    submittedAt: r.createdAt,
    decidedAt: r.decidedAt,
  }
}

const isoDate = z.string().refine(isIsoDate, 'Use a date like 2026-11-16')
const note = z.string().trim().max(200).optional()

const createSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('TIME_OFF'), startDate: isoDate, endDate: isoDate, note }),
  z.object({
    kind: z.literal('PARTIAL_DAY'),
    date: isoDate,
    startMin: z.number().int().min(0).max(1440),
    endMin: z.number().int().min(0).max(1440),
    note,
  }),
])

const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'DECLINED']),
  managerNote: z.string().trim().max(200).optional(),
})

const storeSettings = () => prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } })

export const requestsRouter = Router()
requestsRouter.use(requireAuth)

// ---- Staff: my requests ----

requestsRouter.get('/me', async (req, res) => {
  const requests = await prisma.timeOffRequest.findMany({
    where: { staffId: req.staff!.id },
    orderBy: { startDate: 'desc' },
    take: 50,
  })
  res.json(requests.map(requestJson))
})

requestsRouter.post('/me', async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }
  const body = parsed.data
  const start = body.kind === 'TIME_OFF' ? body.startDate : body.date
  const end = body.kind === 'TIME_OFF' ? body.endDate : body.date
  const settings = await storeSettings()
  const now = new Date()

  if (start < storeNow(now, settings.timeZone).date) {
    res.status(400).json({ error: 'Pick a date from today onward.' })
    return
  }
  if (end < start) {
    res.status(400).json({ error: "The end date can't be before the start date." })
    return
  }
  if (daysBetween(start, end) + 1 > MAX_DAYS) {
    res.status(400).json({ error: `Time off can be at most ${MAX_DAYS} days per request.` })
    return
  }
  if (body.kind === 'PARTIAL_DAY') {
    if (body.startMin >= body.endMin) {
      res.status(400).json({ error: 'The start time must be before the end time.' })
      return
    }
    const hours = await prisma.storeHours.findUnique({ where: { weekday: weekdayOf(start) } })
    if (hours && (body.startMin < hours.openMin || body.endMin > hours.closeMin)) {
      res.status(400).json({ error: 'Times must be within store hours.' })
      return
    }
  }

  const staffId = req.staff!.id
  const overlap = await prisma.timeOffRequest.findFirst({
    where: {
      staffId,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: toDbDate(end) },
      endDate: { gte: toDbDate(start) },
    },
  })
  if (overlap) {
    res.status(409).json({ error: 'You already have a request for some of these dates.' })
    return
  }

  const created = await prisma.timeOffRequest.create({
    data: {
      staffId,
      kind: body.kind,
      startDate: toDbDate(start),
      endDate: toDbDate(end),
      startMin: body.kind === 'PARTIAL_DAY' ? body.startMin : null,
      endMin: body.kind === 'PARTIAL_DAY' ? body.endMin : null,
      note: body.note || null,
      late: isLate(start, now, settings),
    },
  })
  res.status(201).json(requestJson(created))
})

// Withdraw one of my own requests while it's still pending.
requestsRouter.delete('/me/:id', async (req, res) => {
  const { count } = await prisma.timeOffRequest.deleteMany({
    where: { id: String(req.params.id), staffId: req.staff!.id, status: 'PENDING' },
  })
  if (count === 0) {
    res.status(404).json({ error: 'No pending request to withdraw.' })
    return
  }
  res.status(204).end()
})

// ---- Manager: decide ----

requestsRouter.post('/:id/decision', managerOnly, async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Choose approve or decline.' })
    return
  }
  const id = String(req.params.id)
  const request = await prisma.timeOffRequest.findUnique({ where: { id } })
  if (!request) {
    res.status(404).json({ error: 'Request not found.' })
    return
  }
  if (request.status !== 'PENDING') {
    res.status(409).json({ error: 'This request was already decided.' })
    return
  }

  const updated = await prisma.timeOffRequest.update({
    where: { id },
    data: {
      status: parsed.data.decision,
      managerNote: parsed.data.managerNote || null,
      decidedById: req.staff!.id,
      decidedAt: new Date(),
    },
  })
  res.json(requestJson(updated))
})