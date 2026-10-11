import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import type { EmploymentType } from '../staff/useStaff'

export type Day =
  | { status: 'ALL_DAY' }
  | { status: 'UNAVAILABLE' }
  | { status: 'WINDOW'; start: number; end: number }

export type StoreHours = { weekday: number; openMin: number; closeMin: number }

export type AvailabilityChange = {
  id: string
  days: Day[]
  note: string | null
  status: 'PENDING' | 'APPROVED' | 'DECLINED'
  managerNote: string | null
  submittedAt: string
}

export type MyAvailability = {
  current: (Day | null)[]
  pending: AvailabilityChange | null
  storeHours: StoreHours[]
}

export type TeamMember = {
  id: string
  name: string
  employmentType: EmploymentType
  targetDaysPerWeek: number | null
  current: (Day | null)[]
  pending: AvailabilityChange | null
}

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function formatTime(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
}

export function describeDay(d: Day | null) {
  if (!d) return 'Not set'
  if (d.status === 'ALL_DAY') return 'All day'
  if (d.status === 'UNAVAILABLE') return 'Unavailable'
  return `${formatTime(d.start)} – ${formatTime(d.end)}`
}

export function useMyAvailability() {
  const callApi = useApi()
  return useQuery({
    queryKey: ['availability', 'me'],
    queryFn: () => callApi<MyAvailability>('/availability/me'),
  })
}

export function useTeamAvailability() {
  const callApi = useApi()
  return useQuery({
    queryKey: ['availability', 'team'],
    queryFn: () => callApi<{ staff: TeamMember[]; storeHours: StoreHours[] }>('/availability/team'),
  })
}

function useAvailabilityMutation<TVars>(fn: (callApi: ReturnType<typeof useApi>, vars: TVars) => Promise<unknown>) {
  const callApi = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: TVars) => fn(callApi, vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['availability'] }),
  })
}

export const useSubmitAvailability = () =>
  useAvailabilityMutation((callApi, body: { days: Day[]; note?: string }) =>
    callApi('/availability/me', { method: 'PUT', body: JSON.stringify(body) }),
  )

export const useWithdrawAvailability = () =>
  useAvailabilityMutation<void>((callApi) => callApi('/availability/me/pending', { method: 'DELETE' }))

export const useDecideAvailability = () =>
  useAvailabilityMutation(
    (callApi, { id, ...body }: { id: string; decision: 'APPROVED' | 'DECLINED'; managerNote?: string }) =>
      callApi(`/availability/changes/${id}/decision`, { method: 'POST', body: JSON.stringify(body) }),
  )