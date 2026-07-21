import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function ResetPasswordPage() {
  const { resetPasswordForEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setStatus('loading')

    const { error: resetError } = await resetPasswordForEmail(email)
    setStatus(resetError ? 'idle' : 'sent')

    if (resetError) setError(resetError.message)
  }

  if (status === 'sent') {
    return (
      <main>
        <h1>Email envoyé</h1>
        <p>Si un compte existe pour {email}, un lien de réinitialisation vient d'être envoyé.</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Réinitialiser le mot de passe</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Envoi...' : 'Envoyer le lien'}
        </button>
      </form>
    </main>
  )
}
