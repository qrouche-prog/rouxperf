import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Tally from '../components/Tally'
import Icon from '../components/onboarding/icons/Icon'

const STEPS = [
  {
    n: 1,
    title: 'Ton profil',
    body: 'Mesures, objectif, expérience, matériel disponible — quelques minutes, sauvegardées au fur et à mesure.',
  },
  {
    n: 2,
    title: 'Ton programme',
    body: "Généré pour toi, ancré sur une vraie bibliothèque d'exercices — jamais inventé, toujours adapté à tes limites.",
  },
  {
    n: 3,
    title: 'Ta progression',
    body: 'Chaque séance loggée, chaque mesure trackée — pour voir noir sur blanc ce qui avance.',
  },
]

const VALUE_PROPS = [
  {
    icon: 'dumbbell',
    title: "Ancré, pas halluciné",
    body: "L'IA choisit exclusivement dans une bibliothèque d'exercices réels et validés — jamais un mouvement inventé, jamais quelque chose qui ignore tes blessures.",
  },
  {
    icon: 'hyrox',
    title: 'Construit pour ton objectif',
    body: 'Hyrox, marathon, un sport co, ou juste progresser : le programme se construit autour de ce que tu vises réellement, pas un template générique.',
  },
  {
    icon: 'run',
    title: 'Ta progression, noir sur blanc',
    body: 'Chaque séance loggée, chaque mesure trackée dans le temps — pour voir concrètement ce qui avance.',
  },
  {
    icon: 'bolt',
    title: 'Rien à ressaisir',
    body: 'Un seul profil, mis à jour au fil des séances. Ton programme évolue avec toi, tu ne repars jamais de zéro.',
  },
]

const EMBERS = [
  { left: '8%', delay: '0s', size: 4 },
  { left: '22%', delay: '1.4s', size: 3 },
  { left: '38%', delay: '0.6s', size: 5 },
  { left: '55%', delay: '2.1s', size: 3 },
  { left: '68%', delay: '0.9s', size: 4 },
  { left: '82%', delay: '1.8s', size: 3 },
  { left: '92%', delay: '0.3s', size: 4 },
]

export default function HomePage() {
  const { user } = useAuth()

  return (
    <>
      <header className="site-nav">
        <span className="site-nav-brand">rouxperf</span>
        <nav>
          {user ? (
            <Link to="/dashboard" className="btn-primary">
              Tableau de bord
            </Link>
          ) : (
            <>
              <Link to="/login">Se connecter</Link>
              <Link to="/signup" className="btn-primary">
                Créer un compte
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="hero">
        <div className="hero-embers" aria-hidden="true">
          {EMBERS.map((ember, i) => (
            <span
              key={i}
              className="ember-particle"
              style={{ left: ember.left, animationDelay: ember.delay, width: ember.size, height: ember.size }}
            />
          ))}
        </div>
        <div className="hero-inner">
          <p className="eyebrow">Programme généré par IA</p>
          <h1>
            <span className="flame-text">Forge</span>-toi.
          </h1>
          <p className="hero-sub">
            Un programme d'entraînement généré pour toi, ancré sur une vraie bibliothèque d'exercices.
            Pas de blabla motivationnel — juste ce qu'il faut pour progresser, séance après séance.
          </p>
          <div className="hero-actions">
            {user ? (
              <Link to="/dashboard" className="btn-primary">
                Aller au tableau de bord
              </Link>
            ) : (
              <>
                <Link to="/signup" className="btn-primary">
                  Créer mon programme
                </Link>
                <Link to="/login">Se connecter</Link>
              </>
            )}
          </div>
          <div className="hero-tally" aria-hidden="true">
            <Tally count={12} />
          </div>
        </div>
      </section>

      <main>
        <section className="value-props">
          {VALUE_PROPS.map((item) => (
            <div className="value-prop" key={item.title}>
              <Icon name={item.icon} size={26} />
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </section>

        <section className="steps">
          {STEPS.map((step) => (
            <div className="step" key={step.n}>
              <span className="step-number">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </section>

        {!user && (
          <section className="final-cta card">
            <h2>
              <span className="flame-text">Prêt</span> ?
            </h2>
            <p>Crée ton compte, réponds à quelques questions, ton programme est généré dans la foulée.</p>
            <Link to="/signup" className="btn-primary">
              Créer mon programme
            </Link>
          </section>
        )}
      </main>
    </>
  )
}
