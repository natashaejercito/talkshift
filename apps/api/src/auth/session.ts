import { randomBytes, createHash } from 'node:crypto'

export const SESSION_COOKIE = 'ss_session'
export const LINK_TTL_MS = 15 * 60 * 1000             // 15 minutes
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export const newToken = () => randomBytes(32).toString('base64url')
export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')