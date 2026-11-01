import { useState } from 'react'
import { useMe } from '../../auth/useMe'
import { useMySchedule, hoursOf } from '../../features/schedule/useSchedule'
import { formatTime } from '../../features/availability/useAvailability'
import { addDays, weekStartOf, todayLocal, formatDate, formatWeek, formatHours } from '../../lib/dates'
import { OpenShifts } from '../../features/cover/OpenShifts'
import { ShiftCoverActions } from '../../features/cover/ShiftCoverActions'

export function SchedulePage() {
  const { data: me } = useMe()
  const thisWeek = weekStartOf(todayLocal())
  const [start, setStart] = useState(thisWeek)
  const { data, isLoading, error } = useMySchedule(start)
  const today = todayLocal()

  const total = data?.shifts.reduce((t, s) => t + hoursOf(s), 0) ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Hi {me?.name.split(' ')[0]}, here's your week</h1>
        <p className="text-sm text-muted">{formatWeek(start)}</p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-wash p-1" role="group" aria-label="Week">
        {[
          { label: 'This week', value: thisWeek },
          { label: 'Next week', value: addDays(thisWeek, 7) },
        ].map((w) => (
          <button
            key={w.value}
            type="button"
            aria-pressed={start === w.value}
            onClick={() => setStart(w.value)}
            className={`min-h-10 rounded-lg text-sm ${start === w.value ? 'bg-surface font-bold shadow-sm' : 'text-muted'}`}
          >
            {w.label}
          </button>
        ))}
      </div>
      <OpenShifts />

      {isLoading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-alert">Couldn't load your schedule.</p>}

      {data && !data.publishedAt && (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <p className="font-bold">Not published yet</p>
          <p className="mt-1 text-sm text-muted">Your shifts will show up here once your manager publishes this week.</p>
        </div>
      )}

      {data?.publishedAt && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-muted">Shifts</div>
              <div className="font-display text-3xl font-extrabold">{data.shifts.length}</div>
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-muted">Hours</div>
              <div className="font-display text-3xl font-extrabold">{formatHours(total)}</div>
            </div>
          </div>

          {data.shifts.length === 0 && <p className="text-muted">No shifts this week.</p>}

          <ul className="flex flex-col gap-2">
            {data.shifts.map((s) => (
              <li 
                key={s.date}
                  className={`flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border p-4 ${
                  s.date === today ? 'border-brand bg-brand-tint' : 'border-line bg-surface'
                }`}
              >
                <div className="w-12 text-center">
                  <div className="text-xs font-bold text-muted">
                    {s.date === today ? 'TODAY' : formatDate(s.date, { weekday: 'short' }).toUpperCase()}
                  </div>
                  <div className="font-display text-2xl font-extrabold">{formatDate(s.date, { day: 'numeric' })}</div>
                </div>
                <div className="flex-1">
                    <ShiftCoverActions date={s.date} />
                  <div className="font-bold">
                    {formatTime(s.startMin)} – {formatTime(s.endMin)}
                  </div>
                  <div className="text-sm text-muted">
                    {formatHours(hoursOf(s))}
                    {s.note && ` · ${s.note}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}