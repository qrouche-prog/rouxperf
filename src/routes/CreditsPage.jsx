import { Link } from 'react-router-dom'

export default function CreditsPage() {
  return (
    <main>
      <h1>Crédits &amp; licences</h1>

      <h2>Illustrations d'exercices</h2>
      <p>
        Les illustrations proviennent d'<strong>Everkinetic</strong>, diffusées sous licence{' '}
        <a
          href="https://creativecommons.org/licenses/by-sa/3.0/deed.fr"
          target="_blank"
          rel="noreferrer license"
        >
          Creative Commons Attribution — Partage dans les Mêmes Conditions 3.0
        </a>
        , via le projet{' '}
        <a href="https://github.com/chaosbastler/opentraining-exercises" target="_blank" rel="noreferrer">
          OpenTraining
        </a>{' '}
        qui les a converties au format vectoriel.
      </p>
      <p>
        Certaines images ont été redimensionnées, nettoyées de leurs métadonnées d'édition et adaptées à la palette
        du site. Ces modifications sont elles-mêmes diffusées sous CC BY-SA 3.0.
      </p>

      <h2>Données d'exercices</h2>
      <p>
        Métadonnées, catégories et instructions issues de{' '}
        <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer">
          free-exercise-db
        </a>
        , publié dans le domaine public. Les traductions et réécritures françaises sont propres à rouxperf.
      </p>

      <h2>Portée de la licence</h2>
      <p>
        Le partage dans les mêmes conditions s'applique aux œuvres dérivées des images. Il ne s'étend pas au code de
        l'application ni aux contenus rédactionnels originaux publiés sur ce site.
      </p>

      <p>
        <Link to="/dashboard">Retour au tableau de bord</Link>
      </p>
    </main>
  )
}
