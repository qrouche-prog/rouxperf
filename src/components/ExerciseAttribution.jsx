import { Link } from 'react-router-dom'

/**
 * Crédit obligatoire pour les illustrations sous CC BY-SA 3.0.
 *
 * Ce n'est pas décoratif : sans ce crédit, l'usage des images est en infraction.
 * Présent partout où une illustration s'affiche, avec un lien vers /credits.
 */
export default function ExerciseAttribution({ media }) {
  if (!media || media.provider === 'rouxperf') return null

  return (
    <p className="exercise-attribution">
      {media.attribution} · <Link to="/credits">Crédits &amp; licence</Link>
    </p>
  )
}
