import { Navigate } from 'react-router'
import { useAuth0 } from '@auth0/auth0-react'

export function LoginPage() {
  const { isAuthenticated, isLoading, loginWithRedirect, error } = useAuth0()

  if (isAuthenticated) return <Navigate to="/" replace />

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-5">
      <h1 className="font-display text-3xl font-semibold">TalkShift</h1>
      <p className="text-muted">Sign in with your work email to see your shifts.</p>
      {error && <p className="text-sm text-open">Sign-in failed: {error.message}</p>}
      <button
        type="button"
        disabled={isLoading}
        onClick={() => loginWithRedirect()}
        className="min-h-11 rounded-xl bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        Sign in
      </button>
    </main>
  )
}
