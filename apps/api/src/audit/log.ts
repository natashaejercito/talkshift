import type { Prisma, PrismaClient } from '../generated/prisma/client.js'

type Db = PrismaClient | Prisma.TransactionClient

// Works both inside and outside a transaction.
export function audit(
  db: Db,
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string,
  details?: Prisma.InputJsonValue,
) {
  return db.auditLog.create({ data: { actorId, action, entity, entityId, details } })
}