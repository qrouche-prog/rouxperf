import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RootRedirect() {
  const { user, loading } = useAuth()

  if (loading) return null

  return <Navigate to={user ? '/dashboard' : '/login'} replace />
}
