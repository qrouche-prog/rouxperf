import { useState } from 'react'
import ExerciseLoop from './ExerciseLoop'
import ExerciseAttribution from './ExerciseAttribution'
import ExerciseVideo from './ExerciseVideo'

// Aperçu épuré d'un exercice : une petite image fixe et gratuite par défaut
// (illustration OpenTraining déjà en local — jamais d'appel réseau), et un
// lien texte qui révèle les aides supplémentaires (étapes détaillées, vidéo
// MuscleWiki) seulement si l'utilisateur les demande — la vidéo n'est donc
// JAMAIS chargée sans action explicite, y compris sa miniature (qui coûte un
// appel API chez MuscleWiki, contrairement à notre illustration).
export default function ExerciseInfoPanel({ media, name, instructions, steps, videos }) {
  const [open, setOpen] = useState(false)
  const hasSteps = Array.isArray(steps) && steps.length > 0
  const hasVideos = Array.isArray(videos) && videos.length > 0
  const hasExtra = hasSteps || hasVideos || Boolean(instructions)
  if (!media && !hasExtra) return null

  const toggleLabel = open
    ? 'Masquer'
    : hasVideos
      ? 'ⓘ Consignes détaillées + vidéo de démonstration'
      : hasSteps || instructions
        ? 'ⓘ Voir les consignes détaillées'
        : "ⓘ Plus d'infos sur cet exercice"

  return (
    <div className="exercise-preview">
      {media && (
        <>
          <div className="exercise-preview-media">
            <ExerciseLoop media={media} label={name} />
          </div>
          <ExerciseAttribution media={media} />
        </>
      )}

      {hasExtra && (
        <button type="button" className="link-button exercise-info-toggle" onClick={() => setOpen((v) => !v)}>
          {toggleLabel}
        </button>
      )}

      {open && (
        <div className="exercise-info-panel">
          {hasSteps ? (
            <ol className="exercise-info-steps">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          ) : instructions ? (
            <p className="exercise-info-text">{instructions}</p>
          ) : null}
          {hasVideos && <ExerciseVideo videos={videos} label={name} />}
        </div>
      )}
    </div>
  )
}
