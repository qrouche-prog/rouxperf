import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function UpdatePasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    setStatus('loading')
    const { error: updateError } = await updatePassword(password)
    setStatus('idle')

    if (updateError) {
      setError(updateError.message)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <main>
      <h1>Nouveau mot de passe</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="password">Nouveau mot de passe</label>
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
          {status === 'loading' ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
        </button>
      </form>
    </main>
  )
}
