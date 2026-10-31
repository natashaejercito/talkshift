import { useState } from 'react'
import {
  useMyRequests, useCreateRequest, useWithdrawRequest,
  describeRequest, KIND_LABEL, type NewRequest,
} from '../../features/requests/useRequests'
import { StatusPill, LatePill } from '../../features/requests/StatusPill'
import { useMyAvailability, formatTime } from '../../features/availability/useAvailability'

const input = 'min-h-11 w-full rounded-[10px] border border-line bg-surface px-3'
const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in the browser's time zone
const weekdayOf = (d: string) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7

function NewRequestForm({ onDone }: { onDone: () => void }) {
  const create = useCreateRequest()
  const { data: availability } = useMyAvailability()
  const [kind, setKind] = useState<NewRequest['kind']>('TIME_OFF')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startMin, setStartMin] = useState<number | null>(null)
  const [endMin, setEndMin] = useState<number | null>(null)
  const [note, setNote] = useState('')

  // Half-hour times within that day's store hours.
  const hours = startDate ? availability?.storeHours.find((h) => h.weekday === weekdayOf(startDate)) : undefined
  const times: number[] = []
  if (hours) for (let m = hours.openMin; m <= hours.closeMin; m += 30) times.push(m)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const body: NewRequest =
      kind === 'TIME_OFF'
        ? { kind, startDate, endDate: endDate || startDate, note: note || undefined }
        : {
            kind,
            date: startDate,
            startMin: startMin ?? hours!.openMin,
            endMin: endMin ?? hours!.closeMin,
            note: note || undefined,
          }
    create.mutate(body, { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <h2 className="font-display text-xl font-extrabold">New request</h2>

      <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-wash p-1" role="group" aria-label="Request type">
        {(['TIME_OFF', 'PARTIAL_DAY'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`min-h-10 rounded-lg text-sm ${kind === k ? 'bg-surface font-bold shadow-sm' : 'text-muted'}`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="start" className="text-sm font-bold">{kind === 'TIME_OFF' ? 'From' : 'Date'}</label>
          <input
            id="start"
            type="date"
            required
            min={today()}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setStartMin(null)
              setEndMin(null)
            }}
            className={input}
          />
        </div>
        {kind === 'TIME_OFF' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="end" className="text-sm font-bold">To</label>
            <input
              id="end"
              type="date"
              min={startDate || today()}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={input}
            />
          </div>
        )}
      </div>

      {kind === 'PARTIAL_DAY' && hours && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Available</span>
          <label htmlFor="from" className="sr-only">From</label>
          <select
            id="from"
            value={startMin ?? hours.openMin}
            onChange={(e) => setStartMin(Number(e.target.value))}
            className={input}
          >
            {times.slice(0, -1).map((m) => <option key={m} value={m}>{formatTime(m)}</option>)}
          </select>
          <span className="text-muted">to</span>
          <label htmlFor="to" className="sr-only">To</label>
          <select
            id="to"
            value={endMin ?? hours.closeMin}
            onChange={(e) => setEndMin(Number(e.target.value))}
            className={input}
          >
            {times.slice(1).map((m) => <option key={m} value={m}>{formatTime(m)}</option>)}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="text-sm font-bold">
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          className="min-h-20 rounded-[10px] border border-line bg-surface p-3"
        />
      </div>

      {create.error && <p className="text-sm text-alert">{create.error.message}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending || !startDate}
          className="min-h-11 flex-1 rounded-[10px] bg-brand font-bold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {create.isPending ? 'Sending…' : 'Send request'}
        </button>
        <button type="button" onClick={onDone} className="min-h-11 rounded-[10px] border border-line px-4 font-medium">
          Cancel
        </button>
      </div>
    </form>
  )
}

export function RequestsPage() {
  const { data: requests, isLoading, error } = useMyRequests()
  const withdraw = useWithdrawRequest()
  const [formOpen, setFormOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">Time off and changes</p>
          <h1 className="font-display text-3xl font-extrabold">Requests</h1>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="min-h-11 rounded-[10px] bg-brand px-4 font-bold text-white hover:bg-brand-dark"
          >
            Request time off
          </button>
        )}
      </div>

      {formOpen && <NewRequestForm onDone={() => setFormOpen(false)} />}

      {isLoading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-alert">Couldn't load your requests.</p>}
      {requests?.length === 0 && !formOpen && <p className="text-muted">No requests yet.</p>}

      <ul className="flex flex-col gap-2">
        {requests?.map((r) => (
          <li key={r.id} className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{KIND_LABEL[r.kind]}</span>
              <div className="flex gap-1.5">
                {r.late && r.status === 'PENDING' && <LatePill />}
                <StatusPill status={r.status} />
              </div>
            </div>
            <div className="text-sm">{describeRequest(r)}</div>
            {r.note && <div className="text-sm text-muted">“{r.note}”</div>}
            {r.managerNote && (
              <div className="mt-1 rounded-[10px] bg-wash p-2.5 text-sm">Manager: {r.managerNote}</div>
            )}
            {r.status === 'PENDING' && (
              <button
                type="button"
                onClick={() => withdraw.mutate(r.id)}
                className="mt-1 min-h-11 self-start text-sm font-bold text-alert"
              >
                Withdraw
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}