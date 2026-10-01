import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useMe, isManager } from '../auth/useMe'

export function HomePage() {
  const { data: me } = useMe()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' })
    queryClient.setQueryData(['me'], null)
    navigate('/login', { replace: true })
  }

  if (!me) return null
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-5">
      <h1 className="font-display text-3xl font-semibold">Hi {me.name}</h1>
      <p className="text-muted">
        Signed in as {me.email} · {isManager(me) ? 'Manager view' : 'Staff view'}
      </p>
      <button
        type="button"
        onClick={logout}
        className="min-h-11 self-start rounded-xl border border-line bg-white px-4 font-semibold"
      >
        Sign out
      </button>
    </main>
  )
}