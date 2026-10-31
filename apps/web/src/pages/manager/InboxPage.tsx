import { useState } from 'react'
import { useInbox, useDecide, describeRequest, KIND_LABEL, type InboxItem } from '../../features/requests/useRequests'
import { LatePill } from '../../features/requests/StatusPill'
import { describeDay, DAY_SHORT } from '../../features/availability/useAvailability'

function availabilityDiff(item: Extract<InboxItem, { type: 'AVAILABILITY' }>) {
  return item.change.days
    .map((d, i) => {
      const before = describeDay(item.current[i])
      const after = describeDay(d)
      return before === after ? null : `${DAY_SHORT[i]}: ${before} → ${after}`
    })
    .filter((x): x is string => x !== null)
}

function InboxCard({ item }: { item: InboxItem }) {
  const decide = useDecide()
  const [declining, setDeclining] = useState(false)
  const [note, setNote] = useState('')

  const title = item.type === 'REQUEST' ? KIND_LABEL[item.request.kind] : 'Availability change'
  const details = item.type === 'REQUEST' ? [describeRequest(item.request)] : availabilityDiff(item)
  const staffNote = item.type === 'REQUEST' ? item.request.note : item.change.note
  const late = item.type === 'REQUEST' && item.request.late

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold">{item.staff.name} · {title}</span>
            {late && <LatePill />}
          </div>
          <ul className="mt-1 text-muted">
            {details.length ? details.map((d) => <li key={d}>{d}</li>) : <li>No changes to their days</li>}
          </ul>
          {staffNote && <p className="mt-1">“{staffNote}”</p>}
        </div>

        {!declining && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={decide.isPending}
              onClick={() => setDeclining(true)}
              className="min-h-11 rounded-[10px] border border-line px-4 font-medium"
            >
              Decline
            </button>
            <button
              type="button"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ item, decision: 'APPROVED' })}
              className="min-h-11 rounded-[10px] bg-brand px-4 font-bold text-white hover:bg-brand-dark"
            >
              Approve
            </button>
          </div>
        )}
      </div>

      {declining && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`note-${item.staff.id}-${item.submittedAt}`} className="text-sm font-bold">
            Reason for {item.staff.name} <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id={`note-${item.staff.id}-${item.submittedAt}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            className="min-h-16 rounded-[10px] border border-line p-2.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ item, decision: 'DECLINED', managerNote: note || undefined })}
              className="min-h-11 rounded-[10px] bg-alert px-4 font-bold text-white hover:bg-alert-dark"
            >
              Decline request
            </button>
            <button type="button" onClick={() => setDeclining(false)} className="min-h-11 rounded-[10px] border border-line px-4">
              Cancel
            </button>
          </div>
        </div>
      )}

      {decide.error && <p className="text-sm text-alert">{decide.error.message}</p>}
    </li>
  )
}

export function InboxPage() {
  const { data, isLoading, error } = useInbox()
  if (isLoading) return <p className="text-muted">Loading…</p>
  if (error || !data) return <p className="text-alert">Couldn't load the inbox.</p>

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Inbox</h1>
        <p className="text-sm text-muted">
          {data.items.length ? `${data.items.length} to review` : 'All caught up.'}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {data.items.map((item) => (
          <InboxCard
            key={item.type === 'REQUEST' ? item.request.id : item.change.id}
            item={item}
          />
        ))}
      </ul>
    </div>
  )
}