import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'

export type Role = 'STAFF' | 'STORE_MANAGER' | 'ASSISTANT_STORE_MANAGER'
export type Me = { id: string; name: string; email: string; role: Role }

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<Me>('/me')
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export const isManager = (me: Me) => me.role !== 'STAFF'