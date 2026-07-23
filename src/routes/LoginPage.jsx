import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GoogleButton from '../components/GoogleButton'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setStatus('loading')

    const { error: signInError } = await signIn(email, password)
    setStatus('idle')

    if (signInError) {
      setError(signInError.message)
      return
    }

    const redirectTo = location.state?.from?.pathname ?? '/dashboard'
    navigate(redirectTo, { replace: true })
  }

  return (
    <main>
      <h1>Se connecter</h1>
      {location.state?.justSignedUp && (
        <p>Compte créé. Vérifie tes emails pour confirmer ton adresse, puis connecte-toi.</p>
      )}
      <GoogleButton />
      <p className="auth-divider">ou avec ton email</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
      <p>
        <Link to="/reset-password">Mot de passe oublié ?</Link>
      </p>
      <p>
        Pas encore de compte ? <Link to="/signup">S'inscrire</Link>
      </p>
    </main>
  )
}
