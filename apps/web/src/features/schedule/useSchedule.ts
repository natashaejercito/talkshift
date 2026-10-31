import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import type { Day } from '../availability/useAvailability'
import type { EmploymentType } from '../staff/useStaff'

export type Warning = 'TIME_OFF' | 'UNAVAILABLE' | 'OUTSIDE_AVAILABILITY'
export type Effective = Day | { status: 'TIME_OFF' } | null

export type ShiftInfo = {
  id: string
  staffId: string
  date: string
  startMin: number
  endMin: number
  note: string | null
  warning: Warning | null
}

export type GridDay = {
  date: string
  availability: Day | null
  request: { kind: 'TIME_OFF' | 'PARTIAL_DAY'; status: 'PENDING' | 'APPROVED'; startMin: number | null; endMin: number | null } | null
  effective: Effective
  shift: ShiftInfo | null
}

export type GridStaff = {
  id: string
  name: string
  employmentType: EmploymentType
  targetDaysPerWeek: number | null
  days: GridDay[]
}

export type WeekGrid = {
  startDate: string
  version: number
  publishedAt: string | null
  unpublishedStaffIds: string[]
  days: { date: string; openMin: number; closeMin: number }[]
  staff: GridStaff[]
}

export type MySchedule = {
  startDate: string
  publishedAt: string | null
  shifts: { date: string; startMin: number; endMin: number; note: string | null }[]
}

export const hoursOf = (s: { startMin: number; endMin: number }) => (s.endMin - s.startMin) / 60

export function useWeekGrid(start: string) {
  const callApi = useApi()
  return useQuery({
    queryKey: ['schedule', 'week', start],
    queryFn: () => callApi<WeekGrid>(`/schedule/weeks/${start}`),
  })
}

export function useMySchedule(start: string) {
  const callApi = useApi()
  return useQuery({
    queryKey: ['schedule', 'me', start],
    queryFn: () => callApi<MySchedule>(`/schedule/me?week=${start}`),
  })
}

function useScheduleMutation<TVars, TResult = unknown>(
  fn: (callApi: ReturnType<typeof useApi>, vars: TVars) => Promise<TResult>,
) {
  const callApi = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: TVars) => fn(callApi, vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule'] }),
  })
}

export const useSaveShift = (start: string) =>
  useScheduleMutation(
    (callApi, body: { staffId: string; date: string; startMin: number; endMin: number; note?: string }) =>
      callApi(`/schedule/weeks/${start}/shifts`, { method: 'PUT', body: JSON.stringify(body) }),
  )

export const useDeleteShift = (start: string) =>
  useScheduleMutation((callApi, id: string) =>
    callApi(`/schedule/weeks/${start}/shifts/${id}`, { method: 'DELETE' }),
  )

export const usePublishWeek = (start: string) =>
  useScheduleMutation((callApi, _: void) =>
    callApi<{ version: number; changedStaffIds: string[] }>(`/schedule/weeks/${start}/publish`, { method: 'POST' }),
  )