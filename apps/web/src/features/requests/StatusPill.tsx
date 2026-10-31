import type { RequestStatus } from './useRequests'

const STYLES: Record<RequestStatus, string> = {
  PENDING: 'bg-pending-tint text-pending',
  APPROVED: 'bg-brand-tint text-brand',
  DECLINED: 'bg-wash text-muted',
}
const LABELS: Record<RequestStatus, string> = { PENDING: 'Pending', APPROVED: 'Approved', DECLINED: 'Declined' }

export function StatusPill({ status }: { status: RequestStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STYLES[status]}`}>{LABELS[status]}</span>
}

export function LatePill() {
  return <span className="rounded-full bg-alert-tint px-2.5 py-0.5 text-xs font-bold text-alert-dark">After cutoff</span>
}