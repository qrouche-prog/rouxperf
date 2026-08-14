import { useState } from 'react'

// Grise une action réservée au Premium (fonctions qui consomment de l'IA).
// Les membres Premium voient l'action normale ; les autres voient le contenu
// grisé, un badge cadenas, et une explication au clic.
export default function PremiumGate({ isPremium, label = 'Cette fonctionnalité', children }) {
  const [show, setShow] = useState(false)

  if (isPremium) return children

  return (
    <div className="premium-gate">
      <div
        className="premium-gate-body"
        role="button"
        tabIndex={0}
        aria-label={`${label} — réservé au Premium`}
        onClick={() => setShow(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setShow(true)
          }
        }}
      >
        <div className="premium-gate-content" aria-hidden="true">
          {children}
        </div>
        <span className="premium-gate-tag">🔒 Premium</span>
      </div>
      {show && (
        <p className="premium-gate-note">
          {label} est réservé aux membres Premium (elle utilise l'IA). L'abonnement arrive bientôt.
        </p>
      )}
    </div>
  )
}
