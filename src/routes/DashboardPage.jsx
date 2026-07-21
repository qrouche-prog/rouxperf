import { Link, useNavigate } from 'react-router-dom'
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
      <p>
        <Link to="/program">Voir mon programme</Link>
      </p>
      <button onClick={handleSignOut}>Se déconnecter</button>
    </main>
  )
}
