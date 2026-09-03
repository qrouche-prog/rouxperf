import { useEffect, useState } from 'react'
import { getMusclewikiToken, pickMusclewikiVideo } from '../lib/musclewikiMedia'

// Vidéo MuscleWiki (branded, licence commerciale) — remplace ExerciseLoop
// quand l'exercice a une correspondance vérifiée (exercises.musclewiki_videos).
// Le flux nécessite un jeton média de courte durée (voir musclewikiMedia.js) :
// jamais la clé API côté client, jamais de mise en cache de la vidéo elle-même
// (interdit par leurs conditions — seul le jeton est retenté en cas d'échec).
export default function ExerciseVideo({ videos, label }) {
  const video = pickMusclewikiVideo(videos)
  const [src, setSrc] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSrc(null)
    setFailed(false)
    if (!video) return undefined
    getMusclewikiToken().then((token) => {
      if (cancelled) return
      if (!token) {
        setFailed(true)
        return
      }
      setSrc(`${video.url}?token=${token}`)
    })
    return () => {
      cancelled = true
    }
  }, [video])

  async function retryWithFreshToken() {
    if (!video) return
    const token = await getMusclewikiToken({ force: true })
    if (token) setSrc(`${video.url}?token=${token}`)
    else setFailed(true)
  }

  if (!video || failed || !src) return null

  return (
    <div className="exercise-video" role="img" aria-label={`Démonstration : ${label}`}>
      <video
        key={src}
        src={src}
        className="exercise-video-el"
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        onError={retryWithFreshToken}
      />
    </div>
  )
}
