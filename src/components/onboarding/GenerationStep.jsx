import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 3 * 60 * 1000
const PROGRESS_TICK_MS = 400
const PROGRESS_CAP = 95

export default function GenerationStep({ onBack }) {
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const pollTimer = useRef(null)
  const progressTimer = useRef(null)

  function stopPolling() {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current)
      pollTimer.current = null
    }
  }

  function startProgressAnimation() {
    progressTimer.current = setInterval(() => {
      setProgress((p) => p + (PROGRESS_CAP - p) * 0.03)
    }, PROGRESS_TICK_MS)
  }

  function stopProgressAnimation() {
    if (progressTimer.current) {
      clearInterval(progressTimer.current)
      progressTimer.current = null
    }
  }

  function resetToIdle(message) {
    stopPolling()
    stopProgressAnimation()
    setProgress(0)
    setStatus('idle')
    setError(message)
  }

  async function finishSuccess() {
    stopPolling()
    stopProgressAnimation()
    setProgress(100)
    await refreshProfile()
    setTimeout(() => navigate('/dashboard', { replace: true }), 400)
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
        resetToIdle(program.error_message ?? 'La génération a échoué. Réessaie.')
        return
      }

      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        resetToIdle(
          "La génération prend plus longtemps que prévu. Retourne sur la page Programme dans quelques instants, elle devrait apparaître."
        )
        return
      }

      pollProgram(programId, startedAt)
    }, POLL_INTERVAL_MS)
  }

  async function handleGenerate() {
    if (status === 'loading') return

    setError(null)
    setStatus('loading')
    setProgress(0)
    startProgressAnimation()

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
      resetToIdle('Impossible de contacter le serveur. Vérifie ta connexion et réessaie.')
      return
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      resetToIdle(body.error ?? 'La génération a échoué. Réessaie.')
      return
    }

    const body = await response.json()

    if (body.program?.status === 'active') {
      await finishSuccess()
      return
    }

    pollProgram(body.program.id, Date.now())
  }

  const isLoading = status === 'loading'

  return (
    <div>
      <h2>Ton profil est complet</h2>
      <p>
        Génère maintenant ton programme d'entraînement personnalisé. Ça prend généralement moins d'une minute
        (le temps que l'IA construise un programme complet et cohérent).
      </p>

      {isLoading && (
        <div>
          <div className="generation-progress-bar">
            <div className="generation-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <p className="eyebrow">Génération en cours, ne quitte pas cette page...</p>
        </div>
      )}

      {error && <p role="alert">{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        {!isLoading && (
          <button type="button" onClick={onBack} disabled={isLoading}>
            Retour
          </button>
        )}
        <button type="button" onClick={handleGenerate} disabled={isLoading}>
          {isLoading ? 'Génération en cours...' : 'Générer mon programme'}
        </button>
      </div>
    </div>
  )
}
