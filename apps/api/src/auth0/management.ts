import { randomBytes } from 'node:crypto'

const domain = () => new URL(process.env.AUTH0_ISSUER_BASE_URL!).host
const connection = () => process.env.AUTH0_DB_CONNECTION ?? 'Username-Password-Authentication'

export const managementConfigured = () =>
  Boolean(process.env.AUTH0_M2M_CLIENT_ID && process.env.AUTH0_M2M_CLIENT_SECRET)

let cached: { token: string; expiresAt: number } | null = null

// A machine-to-machine token, reused until shortly before it expires.
async function managementToken() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const res = await fetch(`https://${domain()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.AUTH0_M2M_CLIENT_ID,
      client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
      audience: `https://${domain()}/api/v2/`,
    }),
  })
  if (!res.ok) throw new Error(`Auth0 token request failed: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as { access_token: string; expires_in: number }
  cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
  return cached.token
}

async function auth0<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://${domain()}/api/v2${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await managementToken()}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Auth0 ${init.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

// The Auth0 user for this email, created if needed. Returns their user_id.
export async function ensureAuth0User(email: string, name: string) {
  const existing = await auth0<{ user_id: string }[]>(`/users-by-email?email=${encodeURIComponent(email)}`)
  const match = existing.find((u) => u.user_id.startsWith('auth0|'))
  if (match) return match.user_id

  const user = await auth0<{ user_id: string }>('/users', {
    method: 'POST',
    body: JSON.stringify({
      connection: connection(),
      email,
      name,
      password: `${randomBytes(24).toString('base64url')}Aa1!`, // never used: they set their own
      email_verified: false,
      verify_email: false,
    }),
  })
  return user.user_id
}

// A one-time "set your password" link. Using it also verifies their email.
export async function passwordSetupLink(userId: string) {
  const { ticket } = await auth0<{ ticket: string }>('/tickets/password-change', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      result_url: `${process.env.WEB_URL}/login`,
      ttl_sec: 7 * 24 * 60 * 60,
      mark_email_as_verified: true,
    }),
  })
  return ticket
}