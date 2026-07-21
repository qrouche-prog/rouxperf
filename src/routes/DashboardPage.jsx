import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <main>
      <h1>Tableau de bord</h1>
      <p>Connecté en tant que {user?.email}.</p>
      <p>L'onboarding et le programme d'entraînement arrivent dans une prochaine étape.</p>
      <button onClick={handleSignOut}>Se déconnecter</button>
    </main>
  )
}
