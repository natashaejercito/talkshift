import { useQuery } from '@tanstack/react-query'
import { useAuth0 } from '@auth0/auth0-react'
import { useApi } from '../lib/api'

export type Role = 'STAFF' | 'STORE_MANAGER' | 'ASSISTANT_STORE_MANAGER'
export type Me = { id: string; name: string; email: string; role: Role }

export function useMe() {
  const { isAuthenticated } = useAuth0()
  const callApi = useApi()
  return useQuery({
    queryKey: ['me'],
    queryFn: () => callApi<Me>('/me'),
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export const isManager = (me: Me) => me.role !== 'STAFF'