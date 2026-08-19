import { Link } from 'react-router-dom'

// Positionnement : rouXperf est un coach IA de performance, pas une app
// gratuite avec des options payantes. Les piliers ci-dessous décrivent donc ce
// que fait le coach dans la durée — en particulier le fait que le programme
// évolue avec l'utilisateur — plutôt qu'une liste de fonctionnalités.
const PILLARS = [
  {
    icon: '🎯',
    title: 'Il part de ta situation',
    text: "Objectif, niveau, matériel, blessure ou situation particulière : ton programme se construit sur ce que tu lui dis. Pas un modèle qu'on ressort à tout le monde.",
  },
  {
    icon: '🔄',
    title: 'Il évolue avec toi',
    text: "Ton objectif change, une douleur apparaît, tu n'as plus la même salle ? Tu mets ton profil à jour et ton programme est refait en conséquence. Un plan figé ne sert que les premières semaines.",
  },
  {
    icon: '💬',
    title: 'Tu lui parles normalement',
    text: "« J'ai mal à l'épaule au développé », « je veux plus de cardio » : tu écris ce que tu veux changer, il reconstruit les séances autour. Une demande par semaine.",
  },
  {
    icon: '🥗',
    title: 'La nutrition suit',
    text: "Photo d'un repas pour en tirer les macros, plans de repas calés sur tes cibles, journal complet avec recherche et code-barres.",
  },
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
        <p className="eyebrow">Coach IA de performance · Suisse</p>
        <h1 className="landing-title">
          rou<span className="landing-x">X</span>perf
        </h1>
        <p className="landing-tagline">
          Un coach qui construit ton programme d’entraînement, comprend ta situation et le fait évoluer avec toi.
          7 jours en Premium complet à l’inscription, sans carte bancaire.
        </p>
        <div className="landing-cta">
          <Link to="/signup" className="btn-primary">
            Essayer 7 jours
          </Link>
          <Link to="/login" className="btn-secondary">
            Se connecter
          </Link>
        </div>
      </header>

      <section className="landing-section">
        <h2>Ce que fait ton coach</h2>
        <div className="landing-features">
          {PILLARS.map((p) => (
            <div key={p.title} className="landing-feature">
              <span className="landing-feature-icon">{p.icon}</span>
              <strong>{p.title}</strong>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>7 jours en Premium complet, puis tu décides</h2>
        <p className="landing-free-note">
          Dès l’inscription, tu as accès à tout pendant 7 jours — <strong>sans carte bancaire</strong>. De quoi te
          faire un vrai avis : les ajustements, l’analyse de ta charge d’entraînement, la photo repas, les plans
          de repas.
        </p>
        <p className="landing-free-note">
          Ensuite, le gratuit te laisse continuer tes séances, ton journal alimentaire et ton suivi — mesures,
          montre connectée, graphes. Mais <strong>faire évoluer ton programme</strong> — modifier ton profil, demander
          un ajustement, le régénérer — fait partie du Premium. C’est là que le coach travaille vraiment.
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
        {/* Secondaire : le primaire de l'écran est le CTA du hero. */}
        <Link to="/signup" className="btn-secondary landing-plans-cta">
          Créer mon compte
        </Link>
        <p className="eyebrow landing-reassure">
          Sans engagement · annulable à tout moment · paiement sécurisé Stripe.
        </p>
      </section>

      <footer className="landing-foot">
        <span>rouxperf.ch</span>
        <Link to="/login">Déjà un compte ?</Link>
      </footer>
    </main>
  )
}
