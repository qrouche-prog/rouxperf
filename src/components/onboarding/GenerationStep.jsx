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

  // Anime jusqu'à 95% pendant que la requête est en vol, sans jamais
  // déclencher la redirection toute seule : la navigation n'a lieu qu'une
  // fois la réponse serveur effectivement reçue (voir handleGenerate), pour
  // ne jamais partir vers /dashboard avant que onboarding_completed_at soit
  // réellement écrit en base (sinon RequireOnboarding renvoie en boucle sur
  // la première étape).
  function startProgressAnimation() {
    progressTimer.current = setInterval(() => {
      setProgress((p) => Math.min(PROGRESS_CAP, p + PROGRESS_STEP))
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

    // La requête a réussi (mock déjà "active", ou réel "pending_approval") :
    // onboarding_completed_at est déjà écrit côté serveur à ce stade, on peut
    // rafraîchir le profil et naviguer en toute sécurité.
    stopProgressAnimation()
    setProgress(100)
    setTimeout(() => proceedToDashboard(), 400)
  }

  const isLoading = status === 'loading'

  return (
    <div>
      <h2>Ton profil est complet</h2>
      <p>
        Génère maintenant ton programme d'entraînement personnalisé. Tu seras redirigé vers ton tableau de bord dans
        quelques secondes — un message t'avertira là-bas dès que ton programme sera prêt.
      </p>

      {!isLoading && (
        <p className="onboarding-premium-note">
          💡 Ton programme, tes séances et le journal alimentaire sont <strong>gratuits, sans limite de durée</strong>.
          Et tu démarres avec <strong>7 jours en Premium complet</strong>, sans carte bancaire : ajustements par
          l'IA, analyse de ta charge, photo des repas, plans de repas. Ensuite, tu décides si tu continues.
        </p>
      )}

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
