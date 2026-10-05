import { Navigate } from 'react-router'
import { useMe, isManager } from '../auth/useMe'

export function RoleHome() {
  const { data: me } = useMe()
  if (!me) return null
  return <Navigate to={isManager(me) ? '/manager/schedule' : '/schedule'} replace />
}