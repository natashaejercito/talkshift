import { useState } from 'react'
import { Navigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '../lib/api'
import { useMe } from '../auth/useMe'

const schema = z.object({ email: z.string().email('Enter a valid email') })
type Form = z.infer<typeof schema>

export function LoginPage() {
  const { data: me } = useMe()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) })

  if (me) return <Navigate to="/" replace />

  const onSubmit = async (values: Form) => {
    setError(null)
    try {
      await api('/auth/request-link', { method: 'POST', body: JSON.stringify(values) })
      setSentTo(values.email)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-5">
      <h1 className="font-display text-3xl font-semibold">TalkShift</h1>

      {sentTo ? (
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="font-semibold">Check your email</p>
          <p className="mt-1 text-sm text-muted">
            If {sentTo} is on the staff list, a sign-in link is on its way. It works for 15 minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <label htmlFor="email" className="text-sm font-semibold">Work email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="min-h-11 rounded-xl border border-line bg-white px-3"
            {...register('email')}
          />
          {errors.email && <p className="text-sm text-open">{errors.email.message}</p>}
          {error && <p className="text-sm text-open">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 rounded-xl bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {isSubmitting ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </form>
      )}
    </main>
  )
}