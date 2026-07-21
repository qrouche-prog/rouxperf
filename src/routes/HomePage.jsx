import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function HomePage() {
  const { user } = useAuth()

  return (
    <main>
      <h1>rouxperf.ch</h1>
      <p>Ton programme d'entraînement, généré pour toi.</p>
      {user ? (
        <Link to="/dashboard">Aller au tableau de bord</Link>
      ) : (
        <>
          <Link to="/signup">Créer un compte</Link>
          <Link to="/login">Se connecter</Link>
        </>
      )}
    </main>
  )
}
