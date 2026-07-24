import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const PROGRESS_TICK_MS = 150
const PROGRESS_STEP = 4
const PROGRESS_CAP = 95

export default function GenerationStep({ onBack }) {
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const progressTimer = useRef(null)

  function stopProgressAnimation() {
    if (progressTimer.current) {
      clearInterval(progressTimer.current)
      progressTimer.current = null
    }
  }

  function resetToIdle(message) {
    stopProgressAnimation()
    setProgress(0)
    setStatus('idle')
    setError(message)
  }

  async function proceedToDashboard() {
    stopProgressAnimation()
    await refreshProfile()
    navigate('/dashboard', { replace: true })
  }

  function startProgressAnimation() {
    progressTimer.current = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(PROGRESS_CAP, p + PROGRESS_STEP)
        if (next >= PROGRESS_CAP) {
          // Ne pas attendre la fin réelle de la génération (30-90s) : on
          // relâche l'utilisateur sur le tableau de bord dès que la barre
          // atteint 95%, pour qu'il ne reste pas bloqué sur cet écran et ne
          // soit pas tenté de rafraîchir/relancer une génération en double
          // pendant que celle-ci tourne encore en arrière-plan. Le tableau
          // de bord prend le relais pour prévenir quand c'est vraiment prêt.
          stopProgressAnimation()
          proceedToDashboard()
        }
        return next
      })
    }, PROGRESS_TICK_MS)
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
      // Mode mock : déjà prêt, pas besoin d'attendre l'animation.
      stopProgressAnimation()
      setProgress(100)
      setTimeout(() => proceedToDashboard(), 400)
    }
    // Sinon (status "generating"), l'animation déjà lancée continue seule
    // jusqu'à 95% puis redirige — la génération se termine en arrière-plan.
  }

  const isLoading = status === 'loading'

  return (
    <div>
      <h2>Ton profil est complet</h2>
      <p>
        Génère maintenant ton programme d'entraînement personnalisé. Tu seras redirigé vers ton tableau de bord dans
        quelques secondes — un message t'avertira là-bas dès que ton programme sera prêt.
      </p>

      {isLoading && (
        <div>
          <div className="generation-progress-bar">
            <div className="generation-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <p className="eyebrow">Génération en cours...</p>
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
