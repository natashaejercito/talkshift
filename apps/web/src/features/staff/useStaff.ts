import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import type { Role } from '../../auth/useMe'

export type EmploymentType = 'FULL_TIME' | 'PART_TIME'

export type StaffMember = {
  id: string
  name: string
  email: string
  role: Role
  employmentType: EmploymentType
  targetDaysPerWeek: number | null
  active: boolean
  hasSignedIn: boolean
  invitedAt: string | null
}

type SaveInput = Partial<Omit<StaffMember, 'id' | 'hasSignedIn'>> & { id?: string }

export function useStaffList() {
  const callApi = useApi()
  return useQuery({ queryKey: ['staff'], queryFn: () => callApi<StaffMember[]>('/staff') })
}

export function useSaveStaff() {
  const callApi = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: SaveInput): Promise<StaffMember & { invite?: InviteResult }> =>
      id
        ? callApi<StaffMember>(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
        : callApi<StaffMember & { invite?: InviteResult }>('/staff', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  })
}

export type InviteResult = { status: 'sent' | 'skipped' | 'failed'; message: string }

export function useResendInvite() {
  const callApi = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => callApi<InviteResult>(`/staff/${id}/invite`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  })
}