import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import {
  SESSION_COOKIE, LINK_TTL_MS, SESSION_TTL_MS, newToken, hashToken,
} from './session.js'

export const authRouter = Router()

const linkLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 })

authRouter.post('/request-link', linkLimiter, async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter a valid email' })
    return
  }
  const email = parsed.data.email.toLowerCase().trim()
  const staff = await prisma.staff.findUnique({ where: { email } })

  if (staff?.active) {
    const token = newToken()
    await prisma.loginToken.create({
      data: {
        tokenHash: hashToken(token),
        staffId: staff.id,
        expiresAt: new Date(Date.now() + LINK_TTL_MS),
      },
    })
    // Dev only: print the link. Swapped for a real email later (Resend).
    console.log(`\nSign-in link for ${email}:\n${process.env.WEB_URL}/login/verify?token=${token}\n`)
  }

  // Same answer either way, so nobody can probe which emails are staff.
  res.json({ message: 'If that email is on the staff list, a sign-in link is on its way.' })
})

authRouter.post('/verify', async (req, res) => {
  const parsed = z.object({ token: z.string().min(1) }).safeParse(req.body)
  const token = parsed.success ? parsed.data.token : ''
  const expired = () =>
    res.status(400).json({ error: 'This sign-in link has expired or was already used.' })

  const record = token
    ? await prisma.loginToken.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { staff: true },
      })
    : null

  if (!record || record.usedAt || record.expiresAt < new Date() || !record.staff.active) {
    expired()
    return
  }

  const { count } = await prisma.loginToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  if (count === 0) {
    expired()
    return
  }

  const sessionToken = newToken()
  await prisma.session.create({
    data: {
      tokenHash: hashToken(sessionToken),
      staffId: record.staffId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  })

  res.cookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
    path: '/',
  })
  res.json({ ok: true })
})

authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE]
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' })
  res.status(204).end()
})