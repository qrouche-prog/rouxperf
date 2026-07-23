import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Tally from '../components/Tally'

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
        <section className="steps">
          {STEPS.map((step) => (
            <div className="step" key={step.n}>
              <span className="step-number">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </section>
      </main>
    </>
  )
}
