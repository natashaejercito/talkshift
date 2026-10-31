import { useState } from 'react'
import { useWeekGrid, usePublishWeek, hoursOf, type GridDay, type WeekGrid } from '../../features/schedule/useSchedule'
import { ShiftEditor } from '../../features/schedule/ShiftEditor'
import { formatTime } from '../../features/availability/useAvailability'
import { addDays, weekStartOf, todayLocal, formatDate, formatWeek, formatHours } from '../../lib/dates'

const WARNING_LABEL = {
  TIME_OFF: 'Has time off',
  UNAVAILABLE: 'Unavailable',
  OUTSIDE_AVAILABILITY: 'Outside availability',
} as const

function availabilityText(d: GridDay) {
  const e = d.effective
  if (!e) return d.request?.status === 'PENDING' ? 'Request pending' : 'Not set'
  if (e.status === 'TIME_OFF') return 'Time off'
  if (e.status === 'UNAVAILABLE') return 'Unavailable'
  if (e.status === 'WINDOW') return `${formatTime(e.start)}–${formatTime(e.end)}`
  return 'Available'
}

function cellBg(d: GridDay) {
  const s = d.effective?.status
  if (s === 'TIME_OFF') return 'bg-alert-tint'
  if (s === 'UNAVAILABLE') return 'bg-wash'
  if (s === 'ALL_DAY' || s === 'WINDOW') return 'bg-brand-tint/60'
  return 'bg-surface'
}

function PublishBar({ data }: { data: WeekGrid }) {
  const publish = usePublishWeek(data.startDate)
  const pending = data.unpublishedStaffIds.length
  const hasShifts = data.staff.some((s) => s.days.some((d) => d.shift))

  let line: string
  if (!data.publishedAt) line = hasShifts ? 'Draft · staff can’t see this week yet' : 'Draft · add shifts, then publish'
  else if (pending) line = `Changes for ${pending} ${pending === 1 ? 'person' : 'people'} not published`
  else line = 'Published · staff are up to date'

  const canPublish = data.publishedAt ? pending > 0 : hasShifts

  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div>
        <div className="font-bold">{line}</div>
        {data.publishedAt && (
          <div className="text-sm text-muted">
            Last published {new Date(data.publishedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
            {' · '}version {data.version}
          </div>
        )}
        {publish.isSuccess && (
          <div className="text-sm font-bold text-brand">
            Published. {publish.data.changedStaffIds.length} staff will see changes.
          </div>
        )}
        {publish.error && <div className="text-sm text-alert">{publish.error.message}</div>}
      </div>
      <button
        type="button"
        disabled={!canPublish || publish.isPending}
        onClick={() => publish.mutate()}
        className="min-h-11 rounded-[10px] bg-brand px-5 font-bold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {publish.isPending ? 'Publishing…' : data.publishedAt ? 'Publish changes' : 'Publish week'}
      </button>
    </div>
  )
}

export function ManagerSchedulePage() {
  const [start, setStart] = useState(() => weekStartOf(addDays(todayLocal(), 7))) // next week
  const [editing, setEditing] = useState<{ staffId: string; dayIndex: number } | null>(null)
  const { data, isLoading, error } = useWeekGrid(start)

  const editStaff = editing && data?.staff.find((s) => s.id === editing.staffId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setStart(addDays(start, -7))}
            className="size-11 rounded-[10px] border border-line bg-surface font-bold"
          >
            ‹
          </button>
          <h1 className="font-display text-3xl font-extrabold">Week of {formatWeek(start)}</h1>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => setStart(addDays(start, 7))}
            className="size-11 rounded-[10px] border border-line bg-surface font-bold"
          >
            ›
          </button>
        </div>
      </div>

      {isLoading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-alert">Couldn't load this week: {error.message}</p>}

      {data && (
        <>
          <PublishBar data={data} />

          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface p-3">
            <table className="w-full border-separate border-spacing-1.5 text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-2 font-bold">Staff</th>
                  {data.days.map((d) => (
                    <th key={d.date} className="px-2 font-bold">
                      {formatDate(d.date)}
                      <div className="font-normal">
                        Open {formatTime(d.openMin)}–{formatTime(d.closeMin)}
                      </div>
                    </th>
                  ))}
                  <th className="px-2 font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.staff.map((s) => {
                  const shifts = s.days.flatMap((d) => (d.shift ? [d.shift] : []))
                  const hours = shifts.reduce((t, x) => t + hoursOf(x), 0)
                  const over = s.targetDaysPerWeek !== null && shifts.length > s.targetDaysPerWeek
                  const unpublished = data.unpublishedStaffIds.includes(s.id)
                  return (
                    <tr key={s.id}>
                      <td className="px-2">
                        <div className="font-bold">{s.name}</div>
                        <div className="text-xs text-muted">
                          {s.employmentType === 'FULL_TIME' ? `Full-time · ${s.targetDaysPerWeek}/7` : 'Part-time'}
                          {unpublished && data.publishedAt && <span className="ml-1 font-bold text-pending">· changed</span>}
                        </div>
                      </td>
                      {s.days.map((d, i) => (
                        <td key={d.date} className="p-0">
                          <button
                            type="button"
                            onClick={() => setEditing({ staffId: s.id, dayIndex: i })}
                            aria-label={`${s.name}, ${formatDate(d.date)}: ${
                              d.shift ? `${formatTime(d.shift.startMin)} to ${formatTime(d.shift.endMin)}` : 'add shift'
                            }`}
                            className={`flex h-16 w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-xs hover:ring-2 hover:ring-brand/40 ${cellBg(d)}`}
                          >
                            {d.shift ? (
                              <>
                                <span
                                  className={`rounded-md px-2 py-0.5 font-bold ${
                                    d.shift.warning ? 'border-2 border-alert bg-surface text-alert-dark' : 'bg-brand text-white'
                                  }`}
                                >
                                  {formatTime(d.shift.startMin)}–{formatTime(d.shift.endMin)}
                                </span>
                                <span className={d.shift.warning ? 'font-bold text-alert-dark' : 'text-muted'}>
                                  {d.shift.warning ? WARNING_LABEL[d.shift.warning] : d.shift.note ?? ''}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted">{availabilityText(d)}</span>
                            )}
                          </button>
                        </td>
                      ))}
                      <td className="px-2">
                        <div className="font-bold">{formatHours(hours)}</div>
                        <div className={`text-xs ${over ? 'font-bold text-alert' : 'text-muted'}`}>
                          {s.targetDaysPerWeek !== null ? `${shifts.length} of ${s.targetDaysPerWeek} days` : `${shifts.length} days`}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data && editing && editStaff && (
        <ShiftEditor
          key={`${editing.staffId}-${editing.dayIndex}`}
          weekStart={start}
          staff={editStaff}
          day={editStaff.days[editing.dayIndex]}
          hours={data.days[editing.dayIndex]}
          onDone={() => setEditing(null)}
        />
      )}
    </div>
  )
}