import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TopNav from '../components/TopNav'
import BottomNav from '../components/BottomNav'

const BENEFITS = [
  { icon: '📷', text: 'Analyse photo de tes repas → macros automatiques' },
  { icon: '🍽️', text: 'Génération de plans repas calés sur tes cibles' },
  { icon: '📊', text: 'Analyse IA de ta charge d’entraînement' },
  { icon: '⌚', text: 'Lecture intelligente de tes données de montre' },
]

export default function PremiumPage() {
  const { isSubscribed, isTrialing, trialDaysLeft, subscription, refreshProfile } = useAuth()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(null) // 'monthly' | 'annual' | 'portal'
  const [error, setError] = useState(null)

  const returnStatus = params.get('status')

  useEffect(() => {
    // Au retour de Stripe, on rafraîchit le statut (le webhook a pu passer).
    if (returnStatus === 'success') refreshProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnStatus])

  async function startCheckout(plan) {
    setBusy(plan)
    setError(null)
    const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
      body: { plan, origin: window.location.origin },
    })
    if (fnError || data?.error || !data?.url) {
      let msg = data?.error
      if (!msg && fnError?.context?.json) {
        try {
          const b = await fnError.context.json()
          msg = b?.error
        } catch {
          // ignore
        }
      }
      setBusy(null)
      setError(msg || 'Impossible de démarrer le paiement.')
      return
    }
    window.location.href = data.url
  }

  async function openPortal() {
    setBusy('portal')
    setError(null)
    const { data, error: fnError } = await supabase.functions.invoke('stripe-portal', {
      body: { origin: window.location.origin },
    })
    if (fnError || data?.error || !data?.url) {
      setBusy(null)
      setError(data?.error || 'Impossible d’ouvrir la gestion de l’abonnement.')
      return
    }
    window.location.href = data.url
  }

  return (
    <main>
      <TopNav />
      <h1>Premium</h1>

      {returnStatus === 'success' && (
        <p className="generation-ready-banner">🎉 Bienvenue dans Premium ! Tes fonctions IA sont débloquées.</p>
      )}
      {returnStatus === 'cancel' && <p className="eyebrow">Paiement annulé — tu peux réessayer quand tu veux.</p>}

      {isTrialing && !isSubscribed && (
        <p className="generation-ready-banner">
          ⏳ Ton essai Premium se termine dans {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} — choisis un plan
          ci-dessous pour garder l'accès sans interruption.
        </p>
      )}

      <div className="card">
        <p className="eyebrow">Ce que débloque Premium</p>
        <ul className="premium-benefits">
          {BENEFITS.map((b) => (
            <li key={b.text}>
              <span className="premium-benefit-icon">{b.icon}</span>
              <span>{b.text}</span>
            </li>
          ))}
        </ul>
        <p className="nutrition-disclaimer">
          Tout le reste (journal, recherche d’aliments, code-barres, programme, séances, graphes) reste gratuit.
        </p>
      </div>

      {isSubscribed ? (
        <div className="card">
          <p>
            <strong>Tu es membre Premium.</strong>
            {subscription?.current_period_end
              ? ` Renouvellement le ${new Date(subscription.current_period_end).toLocaleDateString('fr-CH')}.`
              : ''}
          </p>
          <button type="button" className="btn-secondary" onClick={openPortal} disabled={busy === 'portal'}>
            {busy === 'portal' ? 'Ouverture…' : 'Gérer mon abonnement'}
          </button>
        </div>
      ) : (
        <div className="card premium-plans">
          <div className="premium-plan">
            <div className="premium-plan-head">
              <span className="premium-plan-name">Mensuel</span>
              <span className="premium-plan-price">
                CHF 12<span className="premium-plan-per">/mois</span>
              </span>
            </div>
            <button type="button" className="btn-secondary" onClick={() => startCheckout('monthly')} disabled={busy}>
              {busy === 'monthly' ? 'Redirection…' : 'Choisir le mensuel'}
            </button>
          </div>

          <div className="premium-plan">
            <div className="premium-plan-head">
              <span className="premium-plan-name">3 mois</span>
              <span className="premium-plan-price">
                CHF 30<span className="premium-plan-per">/3 mois</span>
              </span>
            </div>
            <p className="eyebrow">Soit ≈ CHF 10/mois</p>
            <button type="button" className="btn-secondary" onClick={() => startCheckout('quarterly')} disabled={busy}>
              {busy === 'quarterly' ? 'Redirection…' : 'Choisir les 3 mois'}
            </button>
          </div>

          <div className="premium-plan premium-plan-featured">
            <span className="premium-plan-badge">Meilleur prix</span>
            <div className="premium-plan-head">
              <span className="premium-plan-name">Annuel</span>
              <span className="premium-plan-price">
                CHF 100<span className="premium-plan-per">/an</span>
              </span>
            </div>
            <p className="eyebrow">Soit ≈ CHF 8.30/mois</p>
            <button type="button" className="btn-primary" onClick={() => startCheckout('annual')} disabled={busy}>
              {busy === 'annual' ? 'Redirection…' : 'Choisir l’annuel'}
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert">{error}</p>}

      {!isSubscribed && (
        <p className="eyebrow premium-reassure">
          Sans engagement · annulable à tout moment · paiement sécurisé par Stripe.
        </p>
      )}

      <div className="card">
        <h2>Gratuit vs Premium</h2>
        <ul className="premium-compare">
          <li>
            <span>Journal alimentaire, recherche &amp; code-barres</span>
            <span className="premium-compare-free">Gratuit</span>
          </li>
          <li>
            <span>Programme &amp; séances guidées</span>
            <span className="premium-compare-free">Gratuit</span>
          </li>
          <li>
            <span>Import montre &amp; graphes de progression</span>
            <span className="premium-compare-free">Gratuit</span>
          </li>
          <li>
            <span>Analyse photo d’un repas → macros</span>
            <span className="premium-compare-prem">Premium</span>
          </li>
          <li>
            <span>Plans repas générés par l’IA</span>
            <span className="premium-compare-prem">Premium</span>
          </li>
          <li>
            <span>Analyse IA de ta charge d’entraînement</span>
            <span className="premium-compare-prem">Premium</span>
          </li>
          <li>
            <span>Ajustement du programme par l’IA</span>
            <span className="premium-compare-prem">Premium</span>
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Questions fréquentes</h2>
        <details className="premium-faq">
          <summary>Puis-je annuler quand je veux ?</summary>
          <p>Oui, depuis « Gérer mon abonnement ». Tu gardes l’accès jusqu’à la fin de la période déjà payée.</p>
        </details>
        <details className="premium-faq">
          <summary>Le renouvellement est-il automatique ?</summary>
          <p>Oui : ta carte est débitée automatiquement à chaque échéance (mois / 3 mois / an) jusqu’à annulation.</p>
        </details>
        <details className="premium-faq">
          <summary>Le paiement est-il sécurisé ?</summary>
          <p>Oui, tout est géré par Stripe. Tes données de carte ne sont jamais stockées chez nous.</p>
        </details>
      </div>

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
