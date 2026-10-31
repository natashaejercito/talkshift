import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import type { Shift, TimeOffRequest } from '../generated/prisma/client.js'
import { isIsoDate, toDbDate, fromDbDate, addDays, weekdayOf, weekStartOf, storeNow } from '../requests/dates.js'
import { rulesToDays, type Day } from '../availability/days.js'

const managerOnly = requireRole('STORE_MANAGER', 'ASSISTANT_STORE_MANAGER')

export type PublishedShift = { staffId: string; date: string; startMin: number; endMin: number; note: string | null }
type Effective = Day | { status: 'TIME_OFF' } | null
type Warning = 'TIME_OFF' | 'UNAVAILABLE' | 'OUTSIDE_AVAILABILITY'

const toPublished = (s: Shift): PublishedShift => ({
  staffId: s.staffId,
  date: fromDbDate(s.date),
  startMin: s.startMin,
  endMin: s.endMin,
  note: s.note,
})
const readSnapshot = (json: unknown) => (json ?? []) as PublishedShift[]

// Staff whose shifts differ between two versions of a week.
export function diffByStaff(before: PublishedShift[], after: PublishedShift[]) {
  const key = (s: PublishedShift) => `${s.staffId}|${s.date}`
  const old = new Map(before.map((s) => [key(s), s]))
  const now = new Map(after.map((s) => [key(s), s]))
  const changed = new Set<string>()
  for (const [k, s] of now) {
    const o = old.get(k)
    if (!o || o.startMin !== s.startMin || o.endMin !== s.endMin || o.note !== s.note) changed.add(s.staffId)
  }
  for (const [k, s] of old) if (!now.has(k)) changed.add(s.staffId)
  return [...changed]
}

// Approved requests override the weekly pattern for that date.
function effectiveFor(rule: Day | null, request: TimeOffRequest | null): Effective {
  if (request?.status === 'APPROVED') {
    if (request.kind === 'TIME_OFF') return { status: 'TIME_OFF' }
    return { status: 'WINDOW', start: request.startMin!, end: request.endMin! }
  }
  return rule
}

function warningFor(s: { startMin: number; endMin: number }, e: Effective): Warning | null {
  if (!e) return null
  if (e.status === 'TIME_OFF') return 'TIME_OFF'
  if (e.status === 'UNAVAILABLE') return 'UNAVAILABLE'
  if (e.status === 'WINDOW' && (s.startMin < e.start || s.endMin > e.end)) return 'OUTSIDE_AVAILABILITY'
  return null
}

const mondayOf = (v: unknown) => {
  const s = String(v)
  return isIsoDate(s) && weekdayOf(s) === 0 ? s : null
}

export const scheduleRouter = Router()
scheduleRouter.use(requireAuth)

// ---- Manager: the week grid ----

scheduleRouter.get('/weeks/:start', managerOnly, async (req, res) => {
  const start = mondayOf(req.params.start)
  if (!start) {
    res.status(400).json({ error: 'Weeks start on a Monday (YYYY-MM-DD).' })
    return
  }
  const end = addDays(start, 6)
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  const [week, hours, staff] = await Promise.all([
    prisma.week.findUnique({ where: { startDate: toDbDate(start) }, include: { shifts: true } }),
    prisma.storeHours.findMany({ orderBy: { weekday: 'asc' } }),
    prisma.staff.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: {
        availability: true,
        timeOffRequests: {
          where: {
            status: { in: ['PENDING', 'APPROVED'] },
            startDate: { lte: toDbDate(end) },
            endDate: { gte: toDbDate(start) },
          },
        },
      },
    }),
  ])

  const shifts = week?.shifts ?? []

  res.json({
    startDate: start,
    version: week?.version ?? 0,
    publishedAt: week?.publishedAt ?? null,
    unpublishedStaffIds: diffByStaff(readSnapshot(week?.published), shifts.map(toPublished)),
    days: dates.map((date, i) => ({ date, openMin: hours[i].openMin, closeMin: hours[i].closeMin })),
    staff: staff.map((s) => {
      const rules = rulesToDays(s.availability)
      return {
        id: s.id,
        name: s.name,
        employmentType: s.employmentType,
        targetDaysPerWeek: s.targetDaysPerWeek,
        days: dates.map((date, i) => {
          // Approved beats pending when both cover the date.
          const request =
            s.timeOffRequests
              .filter((r) => fromDbDate(r.startDate) <= date && fromDbDate(r.endDate) >= date)
              .sort((a) => (a.status === 'APPROVED' ? -1 : 1))[0] ?? null
          const effective = effectiveFor(rules[i], request)
          const shift = shifts.find((x) => x.staffId === s.id && fromDbDate(x.date) === date)
          return {
            date,
            availability: rules[i],
            request: request && {
              kind: request.kind,
              status: request.status,
              startMin: request.startMin,
              endMin: request.endMin,
            },
            effective,
            shift: shift ? { id: shift.id, ...toPublished(shift), warning: warningFor(shift, effective) } : null,
          }
        }),
      }
    }),
  })
})

const shiftSchema = z.object({
  staffId: z.string().min(1),
  date: z.string().refine(isIsoDate, 'Use a date like 2026-11-16'),
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
  note: z.string().trim().max(60).optional(),
})

// Add or change one person's shift for one day.
scheduleRouter.put('/weeks/:start/shifts', managerOnly, async (req, res) => {
  const start = mondayOf(req.params.start)
  const parsed = shiftSchema.safeParse(req.body)
  if (!start || !parsed.success) {
    res.status(400).json({ error: parsed.success ? 'Weeks start on a Monday.' : parsed.error.issues[0]?.message })
    return
  }
  const { staffId, date, startMin, endMin, note } = parsed.data

  if (date < start || date > addDays(start, 6)) {
    res.status(400).json({ error: 'That date is not in this week.' })
    return
  }
  if (startMin >= endMin) {
    res.status(400).json({ error: 'The start time must be before the end time.' })
    return
  }
  const hours = await prisma.storeHours.findUnique({ where: { weekday: weekdayOf(date) } })
  if (hours && (startMin < hours.openMin || endMin > hours.closeMin)) {
    res.status(400).json({ error: 'Shifts must be within store hours.' })
    return
  }
  const staff = await prisma.staff.findUnique({ where: { id: staffId } })
  if (!staff?.active) {
    res.status(404).json({ error: 'Staff member not found.' })
    return
  }

  const week = await prisma.week.upsert({
    where: { startDate: toDbDate(start) },
    update: {},
    create: { startDate: toDbDate(start) },
  })
  const fields = { startMin, endMin, note: note || null, weekId: week.id }
  const shift = await prisma.shift.upsert({
    where: { staffId_date: { staffId, date: toDbDate(date) } },
    update: fields,
    create: { ...fields, staffId, date: toDbDate(date) },
  })
  res.json({ id: shift.id, ...toPublished(shift) })
})

scheduleRouter.delete('/weeks/:start/shifts/:id', managerOnly, async (req, res) => {
  const start = mondayOf(req.params.start)
  const { count } = start
    ? await prisma.shift.deleteMany({
        where: { id: String(req.params.id), week: { startDate: toDbDate(start) } },
      })
    : { count: 0 }
  if (count === 0) {
    res.status(404).json({ error: 'Shift not found.' })
    return
  }
  res.status(204).end()
})

// Make the current shifts visible to staff.
scheduleRouter.post('/weeks/:start/publish', managerOnly, async (req, res) => {
  const start = mondayOf(req.params.start)
  const week = start
    ? await prisma.week.findUnique({ where: { startDate: toDbDate(start) }, include: { shifts: true } })
    : null
  if (!week || (week.shifts.length === 0 && !week.publishedAt)) {
    res.status(400).json({ error: 'Add at least one shift before publishing.' })
    return
  }

  const snapshot = week.shifts.map(toPublished)
  const changedStaffIds = diffByStaff(readSnapshot(week.published), snapshot)
  if (week.publishedAt && changedStaffIds.length === 0) {
    res.json({ version: week.version, publishedAt: week.publishedAt, changedStaffIds })
    return
  }

  const updated = await prisma.week.update({
    where: { id: week.id },
    data: { published: snapshot, publishedAt: new Date(), version: { increment: 1 } },
  })
  // Next step: email each person in changedStaffIds.
  res.json({ version: updated.version, publishedAt: updated.publishedAt, changedStaffIds })
})

// ---- Staff: my published shifts ----

scheduleRouter.get('/me', async (req, res) => {
  const settings = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } })
  const start = req.query.week
    ? mondayOf(req.query.week)
    : weekStartOf(storeNow(new Date(), settings.timeZone).date)
  if (!start) {
    res.status(400).json({ error: 'Weeks start on a Monday (YYYY-MM-DD).' })
    return
  }
  const week = await prisma.week.findUnique({ where: { startDate: toDbDate(start) } })
  const shifts = readSnapshot(week?.published)
    .filter((s) => s.staffId === req.staff!.id)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, startMin, endMin, note }) => ({ date, startMin, endMin, note }))

  res.json({ startDate: start, publishedAt: week?.publishedAt ?? null, shifts })
})