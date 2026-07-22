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
      <p className="eyebrow">{user?.email}</p>
      <h1>Tableau de bord</h1>

      <div className="dashboard-links">
        <Link to="/program" className="card dashboard-link">
          <h3>Ton programme</h3>
          <p>Semaines, jours, exercices — ce que tu dois faire aujourd'hui.</p>
        </Link>
        <Link to="/progress" className="card dashboard-link">
          <h3>Ta progression</h3>
          <p>Mesures dans le temps, séances loggées.</p>
        </Link>
      </div>

      <button onClick={handleSignOut}>Se déconnecter</button>
    </main>
  )
}
