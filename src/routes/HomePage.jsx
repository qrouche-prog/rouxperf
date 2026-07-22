import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Tally from '../components/Tally'

const STEPS = [
  {
    n: 1,
    title: 'Ton profil',
    body: "Mesures, objectif, expérience, matériel disponible — quelques minutes, sauvegardées au fur et à mesure.",
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

export default function HomePage() {
  const { user } = useAuth()

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <p className="eyebrow">Programme généré par IA</p>
          <h1>Chaque série compte.</h1>
          <p className="hero-sub">
            Réponds à quelques questions sur ton niveau, ton matériel et tes objectifs. Rouxperf génère
            ton programme d'entraînement complet — et compte avec toi à chaque séance.
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
