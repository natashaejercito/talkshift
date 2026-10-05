import { Navigate, Outlet } from 'react-router'
import { useMe, isManager } from './useMe'

export function RequireManager() {
  const { data: me } = useMe()
  if (!me) return null
  if (!isManager(me)) return <Navigate to="/schedule" replace />
  return <Outlet />
}