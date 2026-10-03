import { useCallback } from 'react'
import { useAuth0 } from '@auth0/auth0-react'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.error ?? 'Something went wrong. Try again.')
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export function useApi() {
  const { getAccessTokenSilently } = useAuth0()
  return useCallback(
    async <T = unknown>(path: string, options: RequestInit = {}) => {
      const token = await getAccessTokenSilently()
      return api<T>(path, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
      })
    },
    [getAccessTokenSilently],
  )
}