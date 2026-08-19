import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Bannière d'incitation à l'abonnement : masquée pour les abonnés payants,
// décompte de l'essai gratuit pendant les 7 premiers jours, pitch complet
// une fois l'essai terminé sans abonnement.
export default function PremiumBanner() {
  const { isSubscribed, isTrialing, trialDaysLeft } = useAuth()
  if (isSubscribed) return null

  if (isTrialing) {
    return (
      <Link to="/premium" className="premium-upsell-banner premium-upsell-banner-trial">
        <span>
          <strong>
            ⏳ Essai Premium — {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} restant{trialDaysLeft > 1 ? 's' : ''}
          </strong>{' '}
          — abonne-toi pour ne rien perdre : photo repas, plans repas, analyses et ajustements de programme.
        </span>
        <span aria-hidden="true">→</span>
      </Link>
    )
  }

  return (
    <Link to="/premium" className="premium-upsell-banner">
      <span>
        <strong>⭐ Passe à Premium</strong> — débloque le coach IA : photo repas, plans repas, analyses et
        ajustements de programme.
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  )
}
