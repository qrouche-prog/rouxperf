import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 3 * 60 * 1000

export default function GenerationStep({ onBack }) {
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const pollTimer = useRef(null)

  function stopPolling() {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current)
      pollTimer.current = null
    }
  }

  async function finishSuccess() {
    stopPolling()
    await refreshProfile()
    navigate('/program', { replace: true })
  }

  function pollProgram(programId, startedAt) {
    pollTimer.current = setTimeout(async () => {
      const { data: program } = await supabase
        .from('user_programs')
        .select('status, error_message')
        .eq('id', programId)
        .maybeSingle()

      if (program?.status === 'active') {
        await finishSuccess()
        return
      }

      if (program?.status === 'failed') {
        stopPolling()
        setStatus('idle')
        setError(program.error_message ?? 'La génération a échoué. Réessaie.')
        return
      }

      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        stopPolling()
        setStatus('idle')
        setError(
          "La génération prend plus longtemps que prévu. Retourne sur la page Programme dans quelques instants, elle devrait apparaître."
        )
        return
      }

      pollProgram(programId, startedAt)
    }, POLL_INTERVAL_MS)
  }

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

    const body = await response.json()

    if (body.program?.status === 'active') {
      await finishSuccess()
      return
    }

    pollProgram(body.program.id, Date.now())
  }

  return (
    <div>
      <h2>Ton profil est complet</h2>
      <p>
        Génère maintenant ton programme d'entraînement personnalisé. Ça prend généralement moins d'une minute
        (le temps que l'IA construise un programme complet et cohérent).
      </p>

      {status === 'loading' && <p className="eyebrow">Génération en cours, ne quitte pas cette page...</p>}
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
