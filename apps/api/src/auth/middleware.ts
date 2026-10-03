import type { Request, Response, NextFunction } from 'express'
import { auth } from 'express-oauth2-jwt-bearer'
import type { Role, Staff } from '../generated/prisma/client.js'
import { prisma } from '../db.js'

declare global {
  namespace Express {
    interface Request {
      staff?: Staff
    }
  }
}

const NS = 'https://talkshift.app'

// Checks the token's signature, expiry, issuer and audience against Auth0.
const checkJwt = auth({
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  audience: process.env.AUTH0_AUDIENCE,
  tokenSigningAlg: 'RS256',
})

// Finds the Staff row for this Auth0 user, linking by verified email on first sign-in.
async function loadStaff(req: Request, res: Response, next: NextFunction) {
  const claims = req.auth?.payload
  const sub = claims?.sub

  if (!claims || !sub) {
    res.status(401).json({ error: 'Not signed in' })
    return
  }

  let staff = await prisma.staff.findUnique({ where: { auth0Id: sub } })

  if (!staff) {
    const email = claims[`${NS}/email`]
    const verified = claims[`${NS}/email_verified`]
    if (typeof email === 'string') {
      const match = await prisma.staff.findUnique({ where: { email: email.toLowerCase() } })
      if (match && !match.auth0Id) {
        if (verified !== true) {
          res.status(403).json({ error: 'email_not_verified' })
          return
        }
        staff = await prisma.staff.update({ where: { id: match.id }, data: { auth0Id: sub } })
      }
    }
  }

  if (!staff || !staff.active) {
    res.status(403).json({ error: 'not_on_staff_list' })
    return
  }

  req.staff = staff
  next()
}

export const requireAuth = [checkJwt, loadStaff]

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.staff || !roles.includes(req.staff.role)) {
      res.status(403).json({ error: 'Not allowed' })
      return
    }
    next()
  }