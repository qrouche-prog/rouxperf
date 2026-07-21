import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function GenerationStep({ onBack }) {
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function handleGenerate() {
    setError(null)
    setStatus('loading')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    let response
    try {
      response = await fetch('/api/generate-program', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    } catch {
      setStatus('idle')
      setError('Impossible de contacter le serveur. Vérifie ta connexion et réessaie.')
      return
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setStatus('idle')
      setError(body.error ?? 'La génération a échoué. Réessaie.')
      return
    }

    await refreshProfile()
    navigate('/program', { replace: true })
  }

  return (
    <div>
      <h2>Ton profil est complet</h2>
      <p>Génère maintenant ton programme d'entraînement personnalisé. Ça prend environ 30 secondes.</p>

      {error && <p role="alert">{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onBack} disabled={status === 'loading'}>
          Retour
        </button>
        <button type="button" onClick={handleGenerate} disabled={status === 'loading'}>
          {status === 'loading' ? 'Génération en cours...' : 'Générer mon programme'}
        </button>
      </div>
    </div>
  )
}
