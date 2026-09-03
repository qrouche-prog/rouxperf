import { useEffect, useState } from 'react'
import { getMusclewikiToken, pickMusclewikiVideo } from '../lib/musclewikiMedia'

// Vidéo MuscleWiki (branded, licence commerciale) — remplace ExerciseLoop
// quand l'exercice a une correspondance vérifiée (exercises.musclewiki_videos).
//
// Chargement en 2 temps, volontairement PAS automatique pour la vidéo :
// - la miniature (og_image) se charge par défaut — leurs conditions autorisent
//   sa mise en cache 24h côté navigateur, donc les rechargements répétés du
//   composant (ex. l'écran de repos qui démonte/remonte l'exercice à chaque
//   série) ne recoûtent quasi rien une fois la première image en cache ;
// - la vidéo elle-même (4 appels mesurés par chargement, jamais cacheable —
//   "Cache-Control: no-store" côté MuscleWiki) ne se charge que si
//   l'utilisateur appuie sur lecture, pas à chaque affichage de l'exercice.
export default function ExerciseVideo({ videos, label }) {
  const video = pickMusclewikiVideo(videos)
  const [token, setToken] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setToken(null)
    setPlaying(false)
    setFailed(false)
    if (!video) return undefined
    getMusclewikiToken().then((t) => {
      if (cancelled) return
      if (!t) setFailed(true)
      else setToken(t)
    })
    return () => {
      cancelled = true
    }
  }, [video])

  async function handlePlay() {
    let t = token
    if (!t) {
      t = await getMusclewikiToken({ force: true })
      if (!t) {
        setFailed(true)
        return
      }
      setToken(t)
    }
    setPlaying(true)
  }

  async function retryVideoWithFreshToken() {
    const t = await getMusclewikiToken({ force: true })
    if (t) setToken(t)
    else setFailed(true)
  }

  if (!video || failed || !token) return null

  const videoSrc = `${video.url}?token=${token}`
  const thumbSrc = video.og_image ? `${video.og_image}?token=${token}` : null

  if (playing) {
    return (
      <div className="exercise-video" role="img" aria-label={`Démonstration : ${label}`}>
        <video
          key={videoSrc}
          src={videoSrc}
          className="exercise-video-el"
          muted
          loop
          playsInline
          autoPlay
          controls
          preload="metadata"
          onError={retryVideoWithFreshToken}
        />
      </div>
    )
  }

  return (
    <button type="button" className="exercise-video exercise-video-thumb-btn" onClick={handlePlay}>
      {thumbSrc && <img src={thumbSrc} alt="" loading="lazy" className="exercise-video-el" />}
      <span className="exercise-video-play-icon" aria-hidden="true">
        ▶
      </span>
    </button>
  )
}
