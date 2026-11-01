import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../lib/api'

type Slot = { id: string; date: string; startMin: number; endMin: number; note: string | null }

export type MyCover = Slot & { status: 'OPEN' | 'COVERED'; coveredBy: { name: string } | null }
export type OpenShift = Slot & { offered: boolean }
export type CoverItem = Slot & {
  status: 'OPEN' | 'COVERED' | 'CANCELLED'
  reason: string | null
  requester: { id: string; name: string }
  offers: { staffId: string; name: string; status: 'PENDING' | 'ACCEPTED'; offeredAt: string }[]
  eligible: { id: string; name: string }[]
  reportedAt: string
}

export function useMyCover() {
  const callApi = useApi()
  return useQuery({
    queryKey: ['cover', 'me'],
    queryFn: () => callApi<{ mine: MyCover[]; available: OpenShift[] }>('/cover/me'),
  })
}

export function useCoverList() {
  const callApi = useApi()
  return useQuery({ queryKey: ['cover', 'list'], queryFn: () => callApi<{ items: CoverItem[] }>('/cover') })
}

function useCoverMutation<TVars>(fn: (callApi: ReturnType<typeof useApi>, vars: TVars) => Promise<unknown>) {
  const callApi = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: TVars) => fn(callApi, vars),
    onSuccess: () =>
      Promise.all(['cover', 'schedule'].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  })
}

export const useCantMakeIt = () =>
  useCoverMutation((callApi, body: { date: string; reason?: string }) =>
    callApi('/cover/me', { method: 'POST', body: JSON.stringify(body) }),
  )

export const useWithdrawCover = () =>
  useCoverMutation((callApi, id: string) => callApi(`/cover/me/${id}`, { method: 'DELETE' }))

export const useOffer = () =>
  useCoverMutation((callApi, id: string) => callApi(`/cover/${id}/offer`, { method: 'POST' }))

export const useWithdrawOffer = () =>
  useCoverMutation((callApi, id: string) => callApi(`/cover/${id}/offer`, { method: 'DELETE' }))

export const useAssignCover = () =>
  useCoverMutation((callApi, { id, staffId }: { id: string; staffId: string }) =>
    callApi(`/cover/${id}/assign`, { method: 'POST', body: JSON.stringify({ staffId }) }),
  )