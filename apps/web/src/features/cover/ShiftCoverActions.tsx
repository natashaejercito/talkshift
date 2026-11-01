import { useState } from 'react'
import { useMyCover, useCantMakeIt, useWithdrawCover } from './useCover'
import { todayLocal } from '../../lib/dates'

export function ShiftCoverActions({ date }: { date: string }) {
  const { data } = useMyCover()
  const report = useCantMakeIt()
  const cancel = useWithdrawCover()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  const pending = data?.mine.find((c) => c.date === date && c.status === 'OPEN')
  const error = report.error ?? cancel.error

  if (date < todayLocal()) return null

  if (pending) {
    return (
      <div className="flex basis-full flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
        <span className="rounded-full bg-pending-tint px-2.5 py-0.5 text-xs font-bold text-pending">
          Can't make it · finding cover
        </span>
        <button
          type="button"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate(pending.id)}
          className="min-h-11 font-bold text-brand"
        >
          I can make it after all
        </button>
        {error && <p className="basis-full text-alert">{error.message}</p>}
      </div>
    )
  }

  if (!open) {
    return (
      <div className="basis-full border-t border-line pt-1">
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-sm font-bold text-alert">
          Can't make it
        </button>
      </div>
    )
  }

  return (
    <div className="flex basis-full flex-col gap-2 border-t border-line pt-3">
      <label htmlFor={`reason-${date}`} className="text-sm font-bold">
        What's happening? <span className="font-normal text-muted">(optional, only managers see this)</span>
      </label>
      <textarea
        id={`reason-${date}`}
        value={reason}
        maxLength={200}
        onChange={(e) => setReason(e.target.value)}
        className="min-h-16 rounded-[10px] border border-line p-2.5 text-sm"
      />
      <p className="text-xs text-muted">
        Your manager is told right away, and staff who are free that day can offer to cover. You're still on this
        shift until someone is confirmed.
      </p>
      {error && <p className="text-sm text-alert">{error.message}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={report.isPending}
          onClick={() => report.mutate({ date, reason: reason || undefined }, { onSuccess: () => setOpen(false) })}
          className="min-h-11 rounded-[10px] bg-alert px-4 font-bold text-white hover:bg-alert-dark"
        >
          {report.isPending ? 'Sending…' : 'Tell my manager'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-[10px] border border-line px-4">
          Cancel
        </button>
      </div>
    </div>
  )
}