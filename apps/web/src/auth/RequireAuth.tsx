import { Navigate, Outlet } from 'react-router'
import { useAuth0 } from '@auth0/auth0-react'
import { useMe } from './useMe'
import { ApiError } from '../lib/api'

export function RequireAuth() {
  const { isLoading, isAuthenticated, logout } = useAuth0()
  const me = useMe()

  if (isLoading) return <p className="p-6 text-muted">Loading…</p>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (me.isLoading) return <p className="p-6 text-muted">Loading…</p>

  if (me.error instanceof ApiError && me.error.message === 'email_not_verified') {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-3 p-6">
      <h1 className="font-display text-2xl font-semibold">Verify your email</h1>
      <p className="text-muted">
        We sent you a verification email. Click the link in it, then sign in again.
      </p>
      <button
        type="button"
        onClick={() => logout({ logoutParams: { returnTo: `${window.location.origin}/login` } })}
        className="min-h-11 self-start rounded-xl bg-brand px-4 font-semibold text-white"
      >
        Back to sign in
      </button>
    </main>
  )
}

  if (me.error instanceof ApiError && me.error.status === 403) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-3 p-6">
        <h1 className="font-display text-2xl font-semibold">You're not on the staff list</h1>
        <p className="text-muted">Ask your manager to add your email to TalkShift, then sign in again.</p>
        <button
          type="button"
          onClick={() => logout({ logoutParams: { returnTo: `${window.location.origin}/login` } })}
          className="min-h-11 self-start rounded-xl border border-line bg-white px-4 font-semibold"
        >
          Sign out
        </button>
      </main>
    )
  }
  if (me.error) return <p className="p-6 text-open">Couldn't load your account. Refresh to try again.</p>

  return <Outlet />
}