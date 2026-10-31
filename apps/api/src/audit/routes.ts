import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'

export const auditRouter = Router()
auditRouter.use(requireAuth, requireRole('STORE_MANAGER', 'ASSISTANT_STORE_MANAGER'))

// The latest 100 actions, newest first.
auditRouter.get('/', async (_req, res) => {
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { actor: true } })
  res.json(
    rows.map((r) => ({
      id: r.id,
      at: r.createdAt,
      actor: r.actor?.name ?? null,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      details: r.details,
    })),
  )
})