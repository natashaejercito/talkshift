import {
  useTeamAvailability, describeDay, formatTime,
  DAY_SHORT, type Day,
} from '../../features/availability/useAvailability'

function cellStyle(d: Day | null) {
  if (!d) return 'border border-dashed border-line text-muted'
  if (d.status === 'ALL_DAY') return 'bg-brand-tint text-brand'
  if (d.status === 'WINDOW') return 'border border-brand/40 bg-surface text-brand'
  return 'bg-wash text-muted'
}

function shortDay(d: Day | null) {
  if (d?.status === 'WINDOW') return `${formatTime(d.start)}–${formatTime(d.end)}`
  if (d?.status === 'UNAVAILABLE') return 'Off'
  return describeDay(d)
}

export function ManagerSchedulePage() {
  const { data, isLoading, error } = useTeamAvailability()
  if (isLoading) return <p className="text-muted">Loading…</p>
  if (error || !data) return <p className="text-alert">Couldn't load availability.</p>

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-extrabold">Team availability</h1>

      <section className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface p-3">
        <table className="w-full border-separate border-spacing-1.5 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-2 font-bold">Staff</th>
              {DAY_SHORT.map((d, i) => (
                <th key={d} className="px-2 font-bold">
                  {d}
                  <div className="font-normal">
                    {formatTime(data.storeHours[i].openMin)}–{formatTime(data.storeHours[i].closeMin)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.staff.map((m) => (
              <tr key={m.id}>
                <td className="px-2">
                  <div className="font-bold">{m.name}</div>
                  <div className="text-xs text-muted">
                    {m.employmentType === 'FULL_TIME' ? `Full-time · ${m.targetDaysPerWeek}/7` : 'Part-time'}
                    {m.pending && <span className="ml-1 font-bold text-pending">· change pending</span>}
                  </div>
                </td>
                {m.current.map((d, i) => (
                  <td key={i} className={`h-12 rounded-lg px-2 text-center text-xs font-bold ${cellStyle(d)}`}>
                    {shortDay(d)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}