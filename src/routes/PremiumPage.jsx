import { Fragment, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TopNav from '../components/TopNav'
import BottomNav from '../components/BottomNav'

// Le gratuit est un vrai produit : programme structuré, séances, journal,
// suivi. Premium ne « débloque » donc pas l'app — il l'emmène plus loin, sur
// trois axes. C'est cette structure qui est montrée, plutôt qu'une liste plate
// où tout se vaut.
const BENEFIT_GROUPS = [
  {
    title: 'Plus loin',
    lead: 'Ton programme ne reste pas figé.',
    items: [
      { icon: '🔄', text: 'Modifie ton profil, ton objectif ou ta situation — le programme est refait en conséquence' },
      { icon: '💬', text: 'Demande un ajustement en langage libre, une fois par semaine' },
      { icon: '♻️', text: 'Régénère entièrement ton programme quand tu repars sur autre chose' },
    ],
  },
  {
    title: 'Plus personnel',
    lead: 'Il tient compte de ce qui te concerne, toi.',
    items: [
      { icon: '🩹', text: 'Blessure, grossesse, reprise : tu mets ta situation à jour et les séances suivent' },
      { icon: '📊', text: 'Analyse IA de ta charge d’entraînement, séances et montre comprises' },
      { icon: '↔️', text: 'Jusqu’à 3 alternatives par exercice, resserrées sur la vraie similarité' },
    ],
  },
  {
    title: 'Plus simple au quotidien',
    lead: 'Moins de saisie, moins de décisions à prendre.',
    items: [
      { icon: '📷', text: 'Photo d’un repas → macros automatiques' },
      { icon: '🍽️', text: 'Plans de repas générés sur tes cibles' },
      { icon: '🧭', text: 'Tu te laisses guider — l’entretien du programme ne repose plus sur toi' },
    ],
  },
]

// Mêmes lignes et mêmes groupes que le comparatif de rouxperf.ch : un
// visiteur qui arrive du site doit retrouver exactement le même tableau.
const COMPARE_GROUPS = [
  {
    title: 'Programme',
    rows: [
      { label: 'Programme personnalisé et séances guidées', free: 'Inclus', prem: 'Inclus' },
      { label: 'Chrono de repos, suivi série par série, notes', free: 'Inclus', prem: 'Inclus' },
      { label: 'Alternatives d’exercice', free: '1×/sem.', prem: 'Jusqu’à 3' },
      { label: 'Modifier ton profil, ton objectif, ta situation', free: '—', prem: 'Inclus' },
      { label: 'Ajustement du programme en langage libre', free: '—', prem: '1×/sem.' },
      { label: 'Régénérer entièrement ton programme', free: '—', prem: '1×/sem.' },
    ],
  },
  {
    title: 'Nutrition',
    rows: [
      { label: 'Journal, recherche d’aliments, code-barres', free: 'Inclus', prem: 'Inclus' },
      { label: 'Cibles de macros modifiables à la main', free: 'Inclus', prem: 'Inclus' },
      { label: 'Photo d’un repas → macros automatiques', free: '—', prem: 'Inclus' },
      { label: 'Plans de repas générés sur tes cibles', free: '—', prem: 'Inclus' },
    ],
  },
  {
    title: 'Suivi',
    rows: [
      { label: 'Mesures corporelles et graphes de progression', free: 'Inclus', prem: 'Inclus' },
      { label: 'Import de ta montre connectée', free: 'Inclus', prem: 'Inclus' },
      { label: 'Analyse IA de ta charge d’entraînement', free: '—', prem: 'Inclus' },
    ],
  },
]

export default function PremiumPage() {
  const { isSubscribed, isTrialing, trialDaysLeft, subscription, refreshProfile } = useAuth()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(null) // 'monthly' | 'quarterly' | 'portal'
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
        <p className="generation-ready-banner">
          🎉 Bienvenue dans Premium — ton coach peut maintenant faire évoluer ton programme avec toi.
        </p>
      )}
      {returnStatus === 'cancel' && <p className="eyebrow">Paiement annulé — tu peux réessayer quand tu veux.</p>}

      {isTrialing && !isSubscribed && (
        <p className="generation-ready-banner">
          ⏳ Ton essai Premium se termine dans {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} — choisis un plan
          ci-dessous pour que ton programme continue d’évoluer avec toi.
        </p>
      )}

      <div className="card">
        <p className="eyebrow">Ce que Premium change</p>
        <p className="premium-lead">
          Le gratuit te donne un programme structuré et personnalisé, les séances guidées, le journal alimentaire
          et ton suivi — pour de bon. Premium emmène tout ça nettement plus loin.
        </p>

        {BENEFIT_GROUPS.map((g) => (
          <div key={g.title} className="premium-group">
            <h3 className="premium-group-title">{g.title}</h3>
            <p className="premium-group-lead">{g.lead}</p>
            <ul className="premium-benefits">
              {g.items.map((b) => (
                <li key={b.text}>
                  <span className="premium-benefit-icon">{b.icon}</span>
                  <span>{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
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

          {/* Le trimestriel devient le meilleur tarif, donc le plan mis en
              avant — et le seul bouton plein de l'écran. */}
          <div className="premium-plan premium-plan-featured">
            <span className="premium-plan-badge">Meilleur prix</span>
            <div className="premium-plan-head">
              <span className="premium-plan-name">3 mois</span>
              <span className="premium-plan-price">
                CHF 30<span className="premium-plan-per">/3 mois</span>
              </span>
            </div>
            <p className="eyebrow">Soit ≈ CHF 10/mois</p>
            <button type="button" className="btn-primary" onClick={() => startCheckout('quarterly')} disabled={busy}>
              {busy === 'quarterly' ? 'Redirection…' : 'Choisir les 3 mois'}
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
        <ul className="premium-table">
          <li className="premium-table-head">
            <span>Fonction</span>
            <span className="premium-table-free">Gratuit</span>
            <span className="premium-table-prem">Premium</span>
          </li>
          {COMPARE_GROUPS.map((g) => (
            <Fragment key={g.title}>
              <li className="premium-table-group">{g.title}</li>
              {g.rows.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <span className="premium-table-free">{row.free}</span>
                  <span className="premium-table-prem">{row.prem}</span>
                </li>
              ))}
            </Fragment>
          ))}
        </ul>
        <p className="premium-table-note">
          L’ajustement et la régénération partagent le même quota : une demande tous les 7 jours. Pendant l’essai,
          tout est au niveau Premium.
        </p>
      </div>

      <div className="card">
        <h2>Questions fréquentes</h2>
        <details className="premium-faq">
          <summary>Que se passe-t-il au bout des 7 jours si je ne choisis rien ?</summary>
          <p>
            Rien n’est débité — tu n’as donné aucune carte. Ton compte repasse simplement en gratuit. Tu gardes
            l’accès à ton programme en cours, à tes séances guidées, à ton journal alimentaire et à ton suivi. Ce
            que tu perds, c’est la capacité à faire évoluer ce programme : modifier ton profil ou ton objectif,
            demander un ajustement, le régénérer — ainsi que l’analyse de charge et les fonctions nutrition par
            l’IA.
          </p>
        </details>
        <details className="premium-faq">
          <summary>Faut-il une carte bancaire pour l’essai ?</summary>
          <p>Non. L’essai démarre à la création de ton compte et s’arrête tout seul. Aucun moyen de paiement n’est demandé.</p>
        </details>
        <details className="premium-faq">
          <summary>Pourquoi un seul ajustement par semaine ?</summary>
          <p>
            L’ajustement en langage libre et la régénération complète partagent le même quota : une demande tous
            les 7 jours. Modifier ton profil, lui, n’est pas limité — c’est la sollicitation de l’IA qui l’est.
            C’est volontaire : un programme qu’on refait tous les jours n’est plus un programme, et la progression
            se juge sur des semaines.
          </p>
        </details>
        <details className="premium-faq">
          <summary>Et les alternatives d’exercice ?</summary>
          <p>
            En gratuit, tu peux essayer une alternative vraiment proche d’un exercice, une fois par semaine — de
            quoi voir à quoi ça ressemble. En Premium, tu as jusqu’à 3 propositions par exercice, resserrées sur la
            vraie similarité, sans limite de fréquence.
          </p>
        </details>
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
