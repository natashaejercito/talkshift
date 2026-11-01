import { useAssignCover, type CoverItem } from './useCover'
import { formatTime } from '../availability/useAvailability'
import { formatDate } from '../../lib/dates'

export function CoverCard({ item }: { item: CoverItem }) {
  const assign = useAssignCover()
  const offerIds = new Set(item.offers.map((o) => o.staffId))
  const others = item.eligible.filter((e) => !offerIds.has(e.id))
  const when = `${formatDate(item.date)}, ${formatTime(item.startMin)} – ${formatTime(item.endMin)}`

  const give = (p: { id: string; name: string }) => {
    if (confirm(`Give ${p.name} the shift on ${when}? ${item.requester.name} and ${p.name} will both be emailed.`)) {
      assign.mutate({ id: item.id, staffId: p.id })
    }
  }

  const row = (p: { id: string; name: string }, primary: boolean) => (
    <li key={p.id} className="flex items-center justify-between gap-2 py-1">
      <span>{p.name}</span>
      <button
        type="button"
        disabled={assign.isPending}
        onClick={() => give(p)}
        className={
          primary
            ? 'min-h-11 rounded-[10px] bg-brand px-4 font-bold text-white hover:bg-brand-dark'
            : 'min-h-11 rounded-[10px] border border-line px-4 font-medium'
        }
      >
        {primary ? 'Give them the shift' : 'Assign'}
      </button>
    </li>
  )

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-card)] border-2 border-alert bg-surface p-4 text-sm">
      <div>
        <div className="font-bold">
          {item.requester.name} can't make it · {when}
        </div>
        <div className="text-muted">
          Reported {new Date(item.reportedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
        </div>
        {item.reason && <p className="mt-1">“{item.reason}”</p>}
      </div>

      <div>
        <div className="font-bold">Offered to cover</div>
        {item.offers.length === 0 ? (
          <p className="text-muted">No one yet. Staff who are free were emailed.</p>
        ) : (
          <ul>{item.offers.map((o) => row({ id: o.staffId, name: o.name }, true))}</ul>
        )}
      </div>

      {others.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer content-center font-bold text-brand">
            Assign someone else ({others.length} free and available)
          </summary>
          <ul>{others.map((p) => row(p, false))}</ul>
        </details>
      )}

      {assign.error && <p className="text-alert">{assign.error.message}</p>}
    </li>
  )
}