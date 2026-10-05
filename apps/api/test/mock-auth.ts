import { vi } from 'vitest'

// Replace Auth0's token check: read the claims straight from the fake bearer token.
vi.mock('express-oauth2-jwt-bearer', () => ({
  auth: () => (req: any, res: any, next: any) => {
    const header: string | undefined = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Not signed in' })
      return
    }
    req.auth = { payload: JSON.parse(Buffer.from(header.slice(7), 'base64url').toString()) }
    next()
  },
}))