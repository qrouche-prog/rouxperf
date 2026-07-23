import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GoogleButton from '../components/GoogleButton'

export default function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!isValidEmail(email)) {
      setError('Adresse email invalide.')
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    setStatus('loading')
    const { error: signUpError } = await signUp(email, password)
    setStatus('idle')

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    navigate('/login', { state: { justSignedUp: true } })
  }

  return (
    <main>
      <h1>Créer un compte</h1>
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
          minLength={8}
          required
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Création...' : 'Créer mon compte'}
        </button>
      </form>
      <p>
        Déjà un compte ? <Link to="/login">Se connecter</Link>
      </p>
    </main>
  )
}
