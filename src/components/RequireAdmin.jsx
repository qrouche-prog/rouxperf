import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RequireAdmin({ children }) {
  const { profile, profileLoading } = useAuth()

  if (profileLoading) return null

  if (!profile?.is_admin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
