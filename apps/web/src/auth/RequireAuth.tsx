import { Navigate, Outlet } from 'react-router'
import { useMe } from './useMe'

export function RequireAuth() {
  const { data: me, isLoading } = useMe()
  if (isLoading) return <p className="p-6 text-muted">Loading…</p>
  if (!me) return <Navigate to="/login" replace />
  return <Outlet />
}