import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LandingPage from './LandingPage'

export default function RootRedirect() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <LandingPage />
}
