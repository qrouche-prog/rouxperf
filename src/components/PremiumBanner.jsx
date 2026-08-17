import { Link } from 'react-router-dom'

// Bannière d'incitation à l'abonnement, à afficher aux non-Premium.
export default function PremiumBanner() {
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
