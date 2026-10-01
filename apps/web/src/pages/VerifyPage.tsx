import { useNavigate, useSearchParams, Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function VerifyPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const verify = useMutation({
    mutationFn: () => api('/auth/verify', { method: 'POST', body: JSON.stringify({ token }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      navigate('/', { replace: true })
    },
  })

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-5">
      <h1 className="font-display text-3xl font-semibold">Sign in to TalkShift</h1>
      {verify.isError ? (
        <>
          <p className="text-open">{verify.error.message}</p>
          <Link to="/login" className="font-semibold text-brand">Send a new link</Link>
        </>
      ) : (
        <button
          type="button"
          onClick={() => verify.mutate()}
          disabled={!token || verify.isPending}
          className="min-h-11 rounded-xl bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {verify.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      )}
    </main>
  )
}