import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import { formatTime, type AvailabilityChange, type Day } from '../availability/useAvailability'

export type RequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED'

export type TimeOffRequest = {
  id: string
  kind: 'TIME_OFF' | 'PARTIAL_DAY'
  startDate: string
  endDate: string
  startMin: number | null
  endMin: number | null
  note: string | null
  late: boolean
  status: RequestStatus
  managerNote: string | null
  submittedAt: string
  decidedAt: string | null
}

export type NewRequest =
  | { kind: 'TIME_OFF'; startDate: string; endDate: string; note?: string }
  | { kind: 'PARTIAL_DAY'; date: string; startMin: number; endMin: number; note?: string }

export type InboxItem =
  | { type: 'REQUEST'; staff: { id: string; name: string }; request: TimeOffRequest; submittedAt: string }
  | {
      type: 'AVAILABILITY'
      staff: { id: string; name: string }
      change: AvailabilityChange
      current: (Day | null)[]
      submittedAt: string
    }

export function formatDate(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function describeRequest(r: TimeOffRequest) {
  if (r.kind === 'PARTIAL_DAY') {
    return `${formatDate(r.startDate)} · available ${formatTime(r.startMin!)} – ${formatTime(r.endMin!)}`
  }
  return r.startDate === r.endDate ? formatDate(r.startDate) : `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`
}

export const KIND_LABEL = { TIME_OFF: 'Time off', PARTIAL_DAY: 'Partial day' } as const

export function useMyRequests() {
  const callApi = useApi()
  return useQuery({ queryKey: ['requests', 'me'], queryFn: () => callApi<TimeOffRequest[]>('/requests/me') })
}

export function useInbox() {
  const callApi = useApi()
  return useQuery({ queryKey: ['inbox'], queryFn: () => callApi<{ items: InboxItem[] }>('/inbox') })
}

function useInvalidatingMutation<TVars>(fn: (callApi: ReturnType<typeof useApi>, vars: TVars) => Promise<unknown>) {
  const callApi = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: TVars) => fn(callApi, vars),
    onSuccess: () =>
      Promise.all(
        ['requests', 'inbox', 'availability'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      ),
  })
}

export const useCreateRequest = () =>
  useInvalidatingMutation((callApi, body: NewRequest) =>
    callApi('/requests/me', { method: 'POST', body: JSON.stringify(body) }),
  )

export const useWithdrawRequest = () =>
  useInvalidatingMutation((callApi, id: string) => callApi(`/requests/me/${id}`, { method: 'DELETE' }))

// One hook for both kinds of inbox item.
export const useDecide = () =>
  useInvalidatingMutation(
    (callApi, { item, decision, managerNote }: { item: InboxItem; decision: 'APPROVED' | 'DECLINED'; managerNote?: string }) =>
      callApi(
        item.type === 'REQUEST'
          ? `/requests/${item.request.id}/decision`
          : `/availability/changes/${item.change.id}/decision`,
        { method: 'POST', body: JSON.stringify({ decision, managerNote }) },
      ),
  )
  