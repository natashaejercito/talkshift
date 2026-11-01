import { useMyCover, useOffer, useWithdrawOffer, type OpenShift } from './useCover'
import { formatTime } from '../availability/useAvailability'
import { formatDate } from '../../lib/dates'

function OpenShiftCard({ shift }: { shift: OpenShift }) {
  const offer = useOffer()
  const withdraw = useWithdrawOffer()
  const error = offer.error ?? withdraw.error

  return (
    <li className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div>
        <div className="font-bold">
          {formatDate(shift.date)} · {formatTime(shift.startMin)} – {formatTime(shift.endMin)}
        </div>
        <div className="text-sm text-muted">
          {shift.offered ? 'Offer sent. Your manager will confirm.' : 'Needs cover'}
          {shift.note && ` · ${shift.note}`}
        </div>
        {error && <p className="text-sm text-alert">{error.message}</p>}
      </div>
      {shift.offered ? (
        <button
          type="button"
          disabled={withdraw.isPending}
          onClick={() => withdraw.mutate(shift.id)}
          className="min-h-11 shrink-0 rounded-[10px] border border-line px-4 text-sm font-medium"
        >
          Withdraw
        </button>
      ) : (
        <button
          type="button"
          disabled={offer.isPending}
          onClick={() => offer.mutate(shift.id)}
          className="min-h-11 shrink-0 rounded-[10px] bg-brand px-4 text-sm font-bold text-white hover:bg-brand-dark"
        >
          I can take it
        </button>
      )}
    </li>
  )
}

export function OpenShifts() {
  const { data } = useMyCover()
  const covered = data?.mine.filter((c) => c.status === 'COVERED') ?? []
  if (!data || (data.available.length === 0 && covered.length === 0)) return null

  return (
    <section className="flex flex-col gap-2">
      {covered.map((c) => (
        <p key={c.id} className="rounded-[10px] bg-brand-tint p-3 text-sm text-brand">
          <strong>{c.coveredBy?.name ?? 'Someone'}</strong> is covering your shift on {formatDate(c.date)}.
        </p>
      ))}
      {data.available.length > 0 && (
        <>
          <h2 className="font-display text-xl font-extrabold">Open shifts</h2>
          <ul className="flex flex-col gap-2">
            {data.available.map((s) => (
              <OpenShiftCard key={s.id} shift={s} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}