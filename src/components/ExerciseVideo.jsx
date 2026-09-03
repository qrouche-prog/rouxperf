import { useEffect, useState } from 'react'
import { getMusclewikiToken, getMusclewikiThumbnail, pickMusclewikiVideo } from '../lib/musclewikiMedia'

// Vidéo MuscleWiki (branded, licence commerciale) — remplace ExerciseLoop
// quand l'exercice a une correspondance vérifiée (exercises.musclewiki_videos).
//
// Chargement en 2 temps, volontairement PAS automatique pour la vidéo :
// - la miniature (og_image) se charge par défaut, via un cache mémoire
//   (voir getMusclewikiThumbnail) plutôt que le cache HTTP du navigateur —
//   constaté peu fiable sur les remontages répétés (l'écran de repos
//   démonte/remonte l'exercice à chaque série) : avec le cache mémoire, un
//   seul appel API sert la miniature pour toute la session, quel que soit
//   le nombre de fois où le composant remonte ;
// - la vidéo elle-même (plusieurs appels par chargement, jamais cacheable —
//   "Cache-Control: no-store" côté MuscleWiki) ne se charge que si
//   l'utilisateur appuie sur lecture, pas à chaque affichage de l'exercice.
export default function ExerciseVideo({ videos, label }) {
  const video = pickMusclewikiVideo(videos)
  const [token, setToken] = useState(null)
  const [thumbSrc, setThumbSrc] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setToken(null)
    setThumbSrc(null)
    setPlaying(false)
    setFailed(false)
    if (!video) return undefined
    getMusclewikiThumbnail(video.og_image).then((src) => {
      if (!cancelled) setThumbSrc(src)
    })
    return () => {
      cancelled = true
    }
  }, [video])

  async function handlePlay() {
    let t = token
    if (!t) {
      t = await getMusclewikiToken()
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

  if (!video || failed) return null

  if (playing && token) {
    const videoSrc = `${video.url}?token=${token}`
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
