import { useState } from 'react'
import { useSaveShift, useDeleteShift, type GridDay, type GridStaff, type Effective } from './useSchedule'
import { formatTime } from '../availability/useAvailability'
import { formatDate } from '../../lib/dates'

type Props = {
  weekStart: string
  staff: GridStaff
  day: GridDay
  hours: { openMin: number; closeMin: number }
  onDone: () => void
}

function availabilityLine(e: Effective) {
  if (!e) return 'Availability not set'
  if (e.status === 'TIME_OFF') return 'Approved time off'
  if (e.status === 'UNAVAILABLE') return 'Unavailable'
  if (e.status === 'WINDOW') return `Available ${formatTime(e.start)} – ${formatTime(e.end)}`
  return 'Available all day'
}

function warningFor(e: Effective, start: number, end: number) {
  if (!e) return null
  if (e.status === 'TIME_OFF') return 'They have approved time off this day.'
  if (e.status === 'UNAVAILABLE') return "They're unavailable this day."
  if (e.status === 'WINDOW' && (start < e.start || end > e.end)) return 'This is outside their availability.'
  return null
}

export function ShiftEditor({ weekStart, staff, day, hours, onDone }: Props) {
  const save = useSaveShift(weekStart)
  const remove = useDeleteShift(weekStart)
  const [startMin, setStartMin] = useState(day.shift?.startMin ?? hours.openMin)
  const [endMin, setEndMin] = useState(day.shift?.endMin ?? Math.min(hours.openMin + 480, hours.closeMin))
  const [note, setNote] = useState(day.shift?.note ?? '')

  const times: number[] = []
  for (let m = hours.openMin; m <= hours.closeMin; m += 30) times.push(m)

  const presets = [
    { label: 'Opening', start: hours.openMin, end: Math.min(hours.openMin + 480, hours.closeMin) },
    { label: 'Closing', start: Math.max(hours.closeMin - 480, hours.openMin), end: hours.closeMin },
    { label: 'Full day', start: hours.openMin, end: hours.closeMin },
  ]

  const warning = warningFor(day.effective, startMin, endMin)
  const select = 'min-h-11 flex-1 rounded-[10px] border border-line bg-surface px-2'
  const error = save.error ?? remove.error

  return (
    <aside
      aria-label="Edit shift"
      className="fixed inset-y-0 right-0 z-10 flex w-[360px] flex-col gap-4 overflow-y-auto border-l border-line bg-surface p-6 shadow-xl"
    >
      <div>
        <p className="text-sm text-muted">{formatDate(day.date, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        <h2 className="font-display text-2xl font-extrabold">{staff.name}</h2>
        <p className="mt-1 text-sm text-muted">{availabilityLine(day.effective)}</p>
        {day.request?.status === 'PENDING' && (
          <p className="mt-1 text-sm font-bold text-pending">They have a pending request for this day.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold">Quick pick</span>
        <div className="grid grid-cols-3 gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setStartMin(p.start)
                setEndMin(p.end)
              }}
              className={`min-h-11 rounded-[10px] border text-sm ${
                startMin === p.start && endMin === p.end ? 'border-brand bg-brand-tint font-bold text-brand' : 'border-line'
              }`}
            >
              {p.label}
              <span className="block text-xs font-normal text-muted">
                {formatTime(p.start)}–{formatTime(p.end)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="shift-start" className="font-bold">Start</label>
        <select id="shift-start" value={startMin} onChange={(e) => setStartMin(Number(e.target.value))} className={select}>
          {times.slice(0, -1).map((m) => <option key={m} value={m}>{formatTime(m)}</option>)}
        </select>
        <label htmlFor="shift-end" className="font-bold">End</label>
        <select id="shift-end" value={endMin} onChange={(e) => setEndMin(Number(e.target.value))} className={select}>
          {times.slice(1).map((m) => <option key={m} value={m}>{formatTime(m)}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="shift-note" className="text-sm font-bold">
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="shift-note"
          value={note}
          maxLength={60}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Training, meeting, store transfer…"
          className="min-h-11 rounded-[10px] border border-line px-3"
        />
      </div>

      {warning && (
        <p className="rounded-[10px] bg-alert-tint p-3 text-sm font-bold text-alert-dark">{warning} You can still save it.</p>
      )}
      {error && <p className="text-sm text-alert">{error.message}</p>}

      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() =>
            save.mutate(
              { staffId: staff.id, date: day.date, startMin, endMin, note: note || undefined },
              { onSuccess: onDone },
            )
          }
          className="min-h-11 rounded-[10px] bg-brand font-bold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {save.isPending ? 'Saving…' : 'Save shift'}
        </button>
        <div className="flex gap-2">
          {day.shift && (
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate(day.shift!.id, { onSuccess: onDone })}
              className="min-h-11 flex-1 rounded-[10px] border border-line font-bold text-alert"
            >
              Remove
            </button>
          )}
          <button type="button" onClick={onDone} className="min-h-11 flex-1 rounded-[10px] border border-line">
            Cancel
          </button>
        </div>
      </div>
    </aside>
  )
}