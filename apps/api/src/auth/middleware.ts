import type { Request, Response, NextFunction } from 'express'
import type { Role, Staff } from '../generated/prisma/client.js'
import { prisma } from '../db.js'
import { SESSION_COOKIE, hashToken } from './session.js'

declare global {
  namespace Express {
    interface Request {
      staff?: Staff
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE]
  const session = token
    ? await prisma.session.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { staff: true },
      })
    : null

  if (!session || session.expiresAt < new Date() || !session.staff.active) {
    res.status(401).json({ error: 'Not signed in' })
    return
  }
  req.staff = session.staff
  next()
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.staff || !roles.includes(req.staff.role)) {
      res.status(403).json({ error: 'Not allowed' })
      return
    }
    next()
  }