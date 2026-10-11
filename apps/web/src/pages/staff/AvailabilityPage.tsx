import { useState } from 'react'
import {
  useMyAvailability, useSubmitAvailability, useWithdrawAvailability,
  DAY_NAMES, formatTime, type Day, type MyAvailability,
} from '../../features/availability/useAvailability'

const MODES = [
  { status: 'ALL_DAY', label: 'All day' },
  { status: 'WINDOW', label: 'Between' },
  { status: 'UNAVAILABLE', label: 'Off' },
] as const

export function AvailabilityPage() {
  const { data, isLoading, error } = useMyAvailability()
  if (isLoading) return <p className="text-muted">Loading…</p>
  if (error || !data) return <p className="text-alert">Couldn't load your availability.</p>
  // key: start the form fresh whenever a different pending change comes back
  return <AvailabilityForm key={data.pending?.id ?? 'saved'} data={data} />
}

function AvailabilityForm({ data }: { data: MyAvailability }) {
  const submit = useSubmitAvailability()
  const withdraw = useWithdrawAvailability()
  const [days, setDays] = useState<Day[]>(
    data.pending?.days ?? data.current.map((d) => d ?? { status: 'ALL_DAY' }),
  )
  const [note, setNote] = useState(data.pending?.note ?? '')

  const hoursFor = (i: number) => data.storeHours.find((h) => h.weekday === i)!

  const setMode = (i: number, status: Day['status']) => {
    const h = hoursFor(i)
    const next: Day = status === 'WINDOW' ? { status, start: h.openMin, end: h.closeMin } : { status }
    setDays(days.map((d, j) => (j === i ? next : d)))
  }

  const setTime = (i: number, field: 'start' | 'end', value: number) =>
    setDays(days.map((d, j) => (j === i && d.status === 'WINDOW' ? { ...d, [field]: value } : d)))

  const neverSet = data.current.every((d) => d === null)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold">My availability</h1>
        <p className="mt-1 text-sm text-muted">
          {neverSet
            ? 'Set your usual week. Your manager approves it before it’s used for scheduling.'
            : 'Your usual week. It repeats every week, so only update it when something changes.'}
        </p>
      </div>

      {data.pending && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-pending-tint p-4 text-sm text-pending">
          <span>
            <strong>Sent to your manager</strong> · waiting for approval. You can still edit it.
          </span>
          <button
            type="button"
            onClick={() => withdraw.mutate()}
            className="min-h-11 shrink-0 font-bold underline"
          >
            Withdraw
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit.mutate({ days, note: note || undefined })
        }}
        className="flex flex-col gap-3"
      >
        {days.map((d, i) => {
          const h = hoursFor(i)
          const options: number[] = []
          for (let m = h.openMin; m <= h.closeMin; m += 30) options.push(m)

          return (
            <fieldset key={i} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <legend className="sr-only">{DAY_NAMES[i]}</legend>
              <div className="mb-3 flex items-baseline justify-between">
                <span className="font-bold">{DAY_NAMES[i]}</span>
                <span className="text-xs text-muted">
                  Store {formatTime(h.openMin)} – {formatTime(h.closeMin)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-wash p-1">
                {MODES.map((m) => (
                  <button
                    key={m.status}
                    type="button"
                    aria-pressed={d.status === m.status}
                    onClick={() => setMode(i, m.status)}
                    className={`min-h-10 rounded-lg text-sm ${
                      d.status === m.status ? 'bg-surface font-bold shadow-sm' : 'text-muted'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {d.status === 'WINDOW' && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <label htmlFor={`from-${i}`} className="text-muted">From</label>
                  <select
                    id={`from-${i}`}
                    value={d.start}
                    onChange={(e) => setTime(i, 'start', Number(e.target.value))}
                    className="min-h-11 flex-1 rounded-[10px] border border-line bg-surface px-2"
                  >
                    {options.slice(0, -1).map((m) => <option key={m} value={m}>{formatTime(m)}</option>)}
                  </select>
                  <label htmlFor={`to-${i}`} className="text-muted">to</label>
                  <select
                    id={`to-${i}`}
                    value={d.end}
                    onChange={(e) => setTime(i, 'end', Number(e.target.value))}
                    className="min-h-11 flex-1 rounded-[10px] border border-line bg-surface px-2"
                  >
                    {options.slice(1).map((m) => <option key={m} value={m}>{formatTime(m)}</option>)}
                  </select>
                </div>
              )}
            </fieldset>
          )
        })}

        <label htmlFor="note" className="text-sm font-bold">
          Note for your manager <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="e.g. New class schedule, free after 3 PM"
          className="min-h-20 rounded-[10px] border border-line bg-surface p-3"
        />

        {submit.error && <p className="text-sm text-alert">{submit.error.message}</p>}
        {submit.isSuccess && <p className="text-sm font-bold text-brand">Sent. Your manager will review it.</p>}

        <button
          type="submit"
          disabled={submit.isPending}
          className="min-h-11 rounded-[10px] bg-brand font-bold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {submit.isPending ? 'Sending…' : data.pending ? 'Update request' : 'Send to manager'}
        </button>
      </form>
    </div>
  )
}