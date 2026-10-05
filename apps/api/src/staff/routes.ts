import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import type { Staff } from '../generated/prisma/client.js'

const roles = ['STAFF', 'ASSISTANT_STORE_MANAGER', 'STORE_MANAGER'] as const
const employmentTypes = ['FULL_TIME', 'PART_TIME'] as const

const fields = {
  name: z.string().trim().min(1, 'Enter a name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  role: z.enum(roles),
  employmentType: z.enum(employmentTypes),
  targetDaysPerWeek: z.number().int().min(1).max(7).nullable(),
}
const createSchema = z.object({
  ...fields,
  role: fields.role.default('STAFF'),
  targetDaysPerWeek: fields.targetDaysPerWeek.optional(),
})
const updateSchema = z.object(fields).partial().extend({ active: z.boolean().optional() })

// What the front end sees: never the auth0Id itself, only whether they've signed in.
function toJson(s: Staff) {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    employmentType: s.employmentType,
    targetDaysPerWeek: s.targetDaysPerWeek,
    active: s.active,
    hasSignedIn: s.auth0Id !== null,
  }
}

const FULL_TIME_NEEDS_TARGET = 'Full-time staff need a days-per-week target.'

export const staffRouter = Router()
staffRouter.use(requireAuth, requireRole('STORE_MANAGER', 'ASSISTANT_STORE_MANAGER'))

staffRouter.get('/', async (_req, res) => {
  const staff = await prisma.staff.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] })
  res.json(staff.map(toJson))
})

staffRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }
  const { targetDaysPerWeek, ...data } = parsed.data
  const target = data.employmentType === 'PART_TIME' ? null : (targetDaysPerWeek ?? null)
  if (data.employmentType === 'FULL_TIME' && target === null) {
    res.status(400).json({ error: FULL_TIME_NEEDS_TARGET })
    return
  }
  if (await prisma.staff.findUnique({ where: { email: data.email } })) {
    res.status(409).json({ error: 'Someone on staff already uses that email.' })
    return
  }

  const staff = await prisma.staff.create({ data: { ...data, targetDaysPerWeek: target } })
  res.status(201).json(toJson(staff))
})

staffRouter.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }
  const existing = await prisma.staff.findUnique({ where: { id: req.params.id } })
  if (!existing) {
    res.status(404).json({ error: 'Staff member not found.' })
    return
  }

  const { active, targetDaysPerWeek, ...changes } = parsed.data

  // A manager can't lock themselves out.
  const isSelf = existing.id === req.staff!.id
  if (isSelf && (active === false || (changes.role && changes.role !== existing.role))) {
    res.status(400).json({ error: "You can't remove your own manager access." })
    return
  }

  if (changes.email && changes.email !== existing.email) {
    if (await prisma.staff.findUnique({ where: { email: changes.email } })) {
      res.status(409).json({ error: 'Someone on staff already uses that email.' })
      return
    }
  }

  const employmentType = changes.employmentType ?? existing.employmentType
  const requested = targetDaysPerWeek !== undefined ? targetDaysPerWeek : existing.targetDaysPerWeek
  const target = employmentType === 'PART_TIME' ? null : requested
  if (employmentType === 'FULL_TIME' && target === null) {
    res.status(400).json({ error: FULL_TIME_NEEDS_TARGET })
    return
  }

  const staff = await prisma.staff.update({
    where: { id: existing.id },
    data: { ...changes, targetDaysPerWeek: target, ...(active !== undefined && { active }) },
  })
  res.json(toJson(staff))
})