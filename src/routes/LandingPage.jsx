import { Link } from 'react-router-dom'

const FEATURES = [
  { icon: '🏋️', title: 'Programme sur-mesure', text: "Un plan d'entraînement généré par l'IA selon ton objectif, ton matériel et ton niveau — musculation, perte de poids, course…" },
  { icon: '🥗', title: 'Nutrition complète', text: 'Journal par repas, recherche d’aliments, scan code-barres, cibles de macros, et plans repas générés par l’IA.' },
  { icon: '📲', title: 'Séances guidées', text: 'Chrono de repos et d’effort, suivi série par série, alternatives d’exercices, notes personnelles.' },
  { icon: '⌚', title: 'Montre connectée', text: 'Importe tes séances (intervals.icu), visualise ta charge et laisse l’IA analyser tes tendances.' },
]

const PLANS = [
  { name: 'Mensuel', price: 'CHF 12', per: '/mois' },
  { name: '3 mois', price: 'CHF 30', per: '/3 mois', hint: '≈ CHF 10/mois' },
  { name: 'Annuel', price: 'CHF 100', per: '/an', hint: '≈ CHF 8.30/mois', featured: true },
]

export default function LandingPage() {
  return (
    <main className="landing">
      <header className="landing-hero">
        <p className="eyebrow">Coach sportif &amp; nutrition · IA · Suisse</p>
        <h1 className="landing-title">
          rou<span className="landing-x">X</span>perf
        </h1>
        <p className="landing-tagline">
          Ton coach sportif et nutrition, personnalisé par l’intelligence artificielle. 7 jours d’essai Premium
          offerts, sans carte bancaire.
        </p>
        <div className="landing-cta">
          <Link to="/signup" className="btn-primary">
            Commencer gratuitement
          </Link>
          <Link to="/login" className="btn-secondary">
            Se connecter
          </Link>
        </div>
      </header>

      <section className="landing-section">
        <h2>Tout pour progresser, au même endroit</h2>
        <div className="landing-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing-feature">
              <span className="landing-feature-icon">{f.icon}</span>
              <strong>{f.title}</strong>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>7 jours d’essai Premium, puis à toi de choisir</h2>
        <p className="landing-free-note">
          Dès l’inscription, profite de <strong>7 jours d’essai Premium complet</strong> — sans carte bancaire :
          analyse photo, plans repas, analyses et ajustements par l’IA. Le journal, la recherche d’aliments, ton
          programme et les séances guidées restent <strong>gratuits</strong> ensuite ; abonne-toi quand tu veux pour
          garder les fonctions IA.
        </p>
        <div className="landing-plans">
          {PLANS.map((p) => (
            <div key={p.name} className={`landing-plan${p.featured ? ' landing-plan-featured' : ''}`}>
              {p.featured && <span className="landing-plan-badge">Meilleur prix</span>}
              <span className="landing-plan-name">{p.name}</span>
              <span className="landing-plan-price">
                {p.price}
                <span className="landing-plan-per">{p.per}</span>
              </span>
              {p.hint && <span className="eyebrow">{p.hint}</span>}
            </div>
          ))}
        </div>
        <Link to="/signup" className="btn-primary landing-plans-cta">
          Créer mon compte
        </Link>
        <p className="eyebrow landing-reassure">Sans engagement · annulable à tout moment · paiement sécurisé Stripe.</p>
      </section>

      <footer className="landing-foot">
        <span>rouxperf.ch</span>
        <Link to="/login">Déjà un compte ?</Link>
      </footer>
    </main>
  )
}
