import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RequireOnboarding({ children }) {
  const { profile, profileLoading } = useAuth()

  if (profileLoading) return null

  if (!profile?.onboarding_completed_at) {
    return <Navigate to="/onboarding/infos" replace />
  }

  return children
}
