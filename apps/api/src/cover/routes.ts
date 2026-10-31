import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import type { Prisma } from '../generated/prisma/client.js'
import { isIsoDate, toDbDate, fromDbDate, weekStartOf, storeNow } from '../requests/dates.js'
import { readSnapshot } from '../schedule/routes.js'
import { eligibleStaff, type Slot } from './eligible.js'
import { audit } from '../audit/log.js'
import { queueScheduleEmails, queueCoverRequested, queueOfferMade, queueCoverFilled } from '../email/notify.js'

const managerOnly = requireRole('STORE_MANAGER', 'ASSISTANT_STORE_MANAGER')

const include = {
  shift: true,
  requester: true,
  coveredBy: true,
  offers: { include: { staff: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.CoverRequestInclude
type Cover = Prisma.CoverRequestGetPayload<{ include: typeof include }>

const slotOf = (c: Cover): Slot => ({ date: fromDbDate(c.shift.date), startMin: c.shift.startMin, endMin: c.shift.endMin })

// What any staff member may see: the shift, not who called in or why.
const slotJson = (c: Cover) => ({ id: c.id, ...slotOf(c), note: c.shift.note })

// The manager's view.
const coverJson = (c: Cover) => ({
  ...slotJson(c),
  status: c.status,
  reason: c.reason,
  requester: { id: c.requester.id, name: c.requester.name },
  coveredBy: c.coveredBy && { id: c.coveredBy.id, name: c.coveredBy.name },
  offers: c.offers
    .filter((o) => o.status === 'PENDING' || o.status === 'ACCEPTED')
    .map((o) => ({ staffId: o.staff.id, name: o.staff.name, status: o.status, offeredAt: o.createdAt })),
  reportedAt: c.createdAt,
  closedAt: c.closedAt,
})

async function storeToday() {
  const settings = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } })
  return storeNow(new Date(), settings.timeZone).date
}

const isEligible = async (c: Cover, staffId: string) =>
  (await eligibleStaff(slotOf(c))).some((s) => s.id === staffId)

export const coverRouter = Router()
coverRouter.use(requireAuth)

// ---- Staff ----

// My "can't make it" requests, and open shifts I could take.
coverRouter.get('/me', async (req, res) => {
  const me = req.staff!
  const today = toDbDate(await storeToday())
  const [mine, open] = await Promise.all([
    prisma.coverRequest.findMany({
      where: { requesterId: me.id, status: { in: ['OPEN', 'COVERED'] }, shift: { date: { gte: today } } },
      include,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.coverRequest.findMany({
      where: { status: 'OPEN', requesterId: { not: me.id }, shift: { date: { gte: today } } },
      include,
      orderBy: { shift: { date: 'asc' } },
    }),
  ])

  const available = []
  for (const c of open) {
    const offered = c.offers.some((o) => o.staffId === me.id && o.status === 'PENDING')
    if (offered || (await isEligible(c, me.id))) available.push({ ...slotJson(c), offered })
  }

  res.json({
    mine: mine.map((c) => ({ ...slotJson(c), status: c.status, coveredBy: c.coveredBy && { name: c.coveredBy.name } })),
    available,
  })
})

const reportSchema = z.object({
  date: z.string().refine(isIsoDate, 'Use a date like 2026-11-16'),
  reason: z.string().trim().max(200).optional(),
})

// "I can't make it."
coverRouter.post('/me', async (req, res) => {
  const parsed = reportSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message })
    return
  }
  const { date, reason } = parsed.data
  const me = req.staff!

  if (date < (await storeToday())) {
    res.status(400).json({ error: 'That shift has already passed.' })
    return
  }
  const [shift, week] = await Promise.all([
    prisma.shift.findUnique({ where: { staffId_date: { staffId: me.id, date: toDbDate(date) } } }),
    prisma.week.findUnique({ where: { startDate: toDbDate(weekStartOf(date)) } }),
  ])
  const published = readSnapshot(week?.published).some((s) => s.staffId === me.id && s.date === date)
  if (!shift || !published) {
    res.status(404).json({ error: "You don't have a published shift that day." })
    return
  }
  if (await prisma.coverRequest.findFirst({ where: { shiftId: shift.id, status: 'OPEN' } })) {
    res.status(409).json({ error: "You've already said you can't make this shift." })
    return
  }

  const cover = await prisma.$transaction(async (tx) => {
    const c = await tx.coverRequest.create({ data: { shiftId: shift.id, requesterId: me.id, reason: reason || null }, include })
    await audit(tx, me.id, 'cover.requested', 'CoverRequest', c.id, { date, reason: reason || null })
    return c
  })

  const eligible = await eligibleStaff(slotOf(cover), [me.id])
  const emailed = await queueCoverRequested({ requester: me, slot: slotOf(cover), reason: cover.reason, eligible })
  res.status(201).json({ ...slotJson(cover), status: cover.status, emailed })
})

// "I can make it after all."
coverRouter.delete('/me/:id', async (req, res) => {
  const id = String(req.params.id)
  const me = req.staff!
  const { count } = await prisma.coverRequest.updateMany({
    where: { id, requesterId: me.id, status: 'OPEN' },
    data: { status: 'CANCELLED', closedAt: new Date() },
  })
  if (count === 0) {
    res.status(404).json({ error: 'No open request to withdraw.' })
    return
  }
  await prisma.pickupOffer.updateMany({ where: { coverRequestId: id, status: 'PENDING' }, data: { status: 'DECLINED' } })
  await audit(prisma, me.id, 'cover.cancelled', 'CoverRequest', id)
  res.status(204).end()
})

// "I can take it."
coverRouter.post('/:id/offer', async (req, res) => {
  const me = req.staff!
  const cover = await prisma.coverRequest.findUnique({ where: { id: String(req.params.id) }, include })
  if (!cover || cover.status !== 'OPEN') {
    res.status(409).json({ error: 'This shift is no longer open.' })
    return
  }
  if (cover.requesterId === me.id) {
    res.status(400).json({ error: "You can't cover your own shift." })
    return
  }
  if (!(await isEligible(cover, me.id))) {
    res.status(409).json({ error: "You can't take this one: you're already working that day, or it's outside your availability." })
    return
  }

  await prisma.pickupOffer.upsert({
    where: { coverRequestId_staffId: { coverRequestId: cover.id, staffId: me.id } },
    update: { status: 'PENDING' },
    create: { coverRequestId: cover.id, staffId: me.id },
  })
  await audit(prisma, me.id, 'pickup.offered', 'CoverRequest', cover.id)
  await queueOfferMade({ offerer: me, requester: cover.requester, slot: slotOf(cover) })
  res.status(201).json({ offered: true })
})

coverRouter.delete('/:id/offer', async (req, res) => {
  const me = req.staff!
  const id = String(req.params.id)
  const { count } = await prisma.pickupOffer.updateMany({
    where: { coverRequestId: id, staffId: me.id, status: 'PENDING' },
    data: { status: 'WITHDRAWN' },
  })
  if (count) await audit(prisma, me.id, 'pickup.withdrawn', 'CoverRequest', id)
  res.status(204).end()
})

// ---- Manager ----

// Shifts that still need cover, with who offered and who else is free.
coverRouter.get('/', managerOnly, async (_req, res) => {
  const today = toDbDate(await storeToday())
  const covers = await prisma.coverRequest.findMany({
    where: { status: 'OPEN', shift: { date: { gte: today } } },
    include,
    orderBy: { shift: { date: 'asc' } },
  })
  const items = await Promise.all(
    covers.map(async (c) => ({
      ...coverJson(c),
      eligible: (await eligibleStaff(slotOf(c))).map((s) => ({ id: s.id, name: s.name })),
    })),
  )
  res.json({ items })
})

// Give the shift to someone. Usually a person who offered, but the manager may have arranged it in person.
coverRouter.post('/:id/assign', managerOnly, async (req, res) => {
  const parsed = z.object({ staffId: z.string().min(1) }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Choose who is covering.' })
    return
  }
  const { staffId } = parsed.data
  const cover = await prisma.coverRequest.findUnique({ where: { id: String(req.params.id) }, include })
  if (!cover) {
    res.status(404).json({ error: 'Not found.' })
    return
  }
  if (cover.status !== 'OPEN') {
    res.status(409).json({ error: 'This shift has already been covered or withdrawn.' })
    return
  }
  if (!(await isEligible(cover, staffId))) {
    res.status(409).json({ error: "They're no longer free or available for this shift." })
    return
  }

  const date = fromDbDate(cover.shift.date)
  const offered = cover.offers.some((o) => o.staffId === staffId && o.status === 'PENDING')

  const result = await prisma.$transaction(async (tx) => {
    // Claim it first, so two managers can't both assign it.
    const claimed = await tx.coverRequest.updateMany({
      where: { id: cover.id, status: 'OPEN' },
      data: { status: 'COVERED', coveredById: staffId, closedAt: new Date() },
    })
    if (claimed.count === 0) return null

    await tx.shift.update({ where: { id: cover.shiftId }, data: { staffId } })

    // Move it in the published snapshot too, so staff see it now and it isn't an "unpublished change".
    const week = await tx.week.findUniqueOrThrow({ where: { id: cover.shift.weekId } })
    const before = readSnapshot(week.published)
    const after = before.map((s) => (s.staffId === cover.requesterId && s.date === date ? { ...s, staffId } : s))
    const updated = await tx.week.update({
      where: { id: week.id },
      data: { published: after, version: { increment: 1 } },
    })

    await tx.pickupOffer.updateMany({
      where: { coverRequestId: cover.id, status: 'PENDING', staffId: { not: staffId } },
      data: { status: 'DECLINED' },
    })
    await tx.pickupOffer.upsert({
      where: { coverRequestId_staffId: { coverRequestId: cover.id, staffId } },
      update: { status: 'ACCEPTED' },
      create: { coverRequestId: cover.id, staffId, status: 'ACCEPTED' },
    })
    await audit(tx, req.staff!.id, 'cover.assigned', 'CoverRequest', cover.id, {
      date,
      from: cover.requesterId,
      to: staffId,
      offered,
    })
    return { before, after, version: updated.version, weekStart: fromDbDate(week.startDate) }
  })

  if (!result) {
    res.status(409).json({ error: 'This shift has already been covered or withdrawn.' })
    return
  }

  await queueScheduleEmails({
    weekStart: result.weekStart,
    version: result.version,
    before: result.before,
    after: result.after,
    staffIds: [cover.requesterId, staffId],
  })
  await queueCoverFilled({
    slot: slotOf(cover),
    declined: cover.offers.filter((o) => o.status === 'PENDING' && o.staffId !== staffId).map((o) => o.staff),
  })

  const full = await prisma.coverRequest.findUniqueOrThrow({ where: { id: cover.id }, include })
  res.json(coverJson(full))
})