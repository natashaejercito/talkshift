import { useMe, isManager } from '../auth/useMe'
import { useAuth0 } from '@auth0/auth0-react'

export function HomePage() {
  const { data: me } = useMe()
  const { logout } = useAuth0()
  const signOut = () => logout({ logoutParams: { returnTo: `${window.location.origin}/login` } })

  if (!me) return null
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-5">
      <h1 className="font-display text-3xl font-semibold">Hi {me.name}</h1>
      <p className="text-muted">
        Signed in as {me.email} · {isManager(me) ? 'Manager view' : 'Staff view'}
      </p>
      <button
        type="button"
        onClick={signOut}
        className="min-h-11 self-start rounded-xl border border-line bg-white px-4 font-semibold"
      >
        Sign out
      </button>
    </main>
  )
}