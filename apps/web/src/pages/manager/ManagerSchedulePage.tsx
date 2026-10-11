import {
  useTeamAvailability, useDecideAvailability, describeDay, formatTime,
  DAY_SHORT, type Day, type TeamMember,
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

function PendingChange({ member }: { member: TeamMember }) {
  const decide = useDecideAvailability()
  const change = member.pending!
  const diffs = change.days
    .map((d, i) => {
      const before = describeDay(member.current[i])
      const after = describeDay(d)
      return before === after ? null : `${DAY_SHORT[i]}: ${before} → ${after}`
    })
    .filter(Boolean)

  return (
    <li className="flex items-start justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="text-sm">
        <div className="font-bold">{member.name} · availability change</div>
        <ul className="mt-1 text-muted">
          {diffs.length ? diffs.map((d) => <li key={d}>{d}</li>) : <li>No changes to their days</li>}
        </ul>
        {change.note && <p className="mt-1">“{change.note}”</p>}
        {decide.error && <p className="mt-1 text-alert">{decide.error.message}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ id: change.id, decision: 'DECLINED' })}
          className="min-h-11 rounded-[10px] border border-line px-4 font-medium"
        >
          Decline
        </button>
        <button
          type="button"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ id: change.id, decision: 'APPROVED' })}
          className="min-h-11 rounded-[10px] bg-brand px-4 font-bold text-white hover:bg-brand-dark"
        >
          Approve
        </button>
      </div>
    </li>
  )
}

export function ManagerSchedulePage() {
  const { data, isLoading, error } = useTeamAvailability()
  if (isLoading) return <p className="text-muted">Loading…</p>
  if (error || !data) return <p className="text-alert">Couldn't load availability.</p>

  const pending = data.staff.filter((s) => s.pending)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-extrabold">Team availability</h1>

      {pending.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold">{pending.length} to review</h2>
          <ul className="flex flex-col gap-2">
            {pending.map((m) => <PendingChange key={m.id} member={m} />)}
          </ul>
        </section>
      )}

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