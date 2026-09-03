import { useEffect, useState } from 'react'
import { getMusclewikiToken, getMusclewikiThumbnail, pickMusclewikiVideos } from '../lib/musclewikiMedia'
import ExerciseLoop from './ExerciseLoop'

const ANGLE_LABEL = { front: 'Face', side: 'Profil' }

// Une vignette (une vue) : miniature par défaut (cache mémoire, quasi
// gratuite aux remontages répétés), vidéo chargée seulement au tap — le
// flux vidéo lui-même coûte un appel API à chaque lecture, jamais cacheable
// (voir musclewikiMedia.js), donc jamais chargé sans action explicite.
function VideoTile({ video, label, caption }) {
  const [token, setToken] = useState(null)
  const [thumbSrc, setThumbSrc] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
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

  async function retryWithFreshToken() {
    const t = await getMusclewikiToken({ force: true })
    if (t) setToken(t)
    else setFailed(true)
  }

  if (failed) return null

  if (playing && token) {
    const videoSrc = `${video.url}?token=${token}`
    return (
      <div className="exercise-video-tile" role="img" aria-label={`Démonstration : ${label}`}>
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
          onError={retryWithFreshToken}
        />
      </div>
    )
  }

  return (
    <button type="button" className="exercise-video-tile exercise-video-thumb-btn" onClick={handlePlay}>
      {thumbSrc && <img src={thumbSrc} alt="" loading="lazy" className="exercise-video-el" />}
      <span className="exercise-video-play-icon" aria-hidden="true">
        ▶
      </span>
      {caption && <span className="exercise-video-caption">{caption}</span>}
    </button>
  )
}

// Vignette statique de repli (illustration OpenTraining) quand un exercice
// n'a pas de vidéo MuscleWiki mappée — même gabarit que les vignettes vidéo,
// pour rester cohérent dans le bandeau.
function FallbackTile({ media, label, caption }) {
  if (!media) return null
  return (
    <div className="exercise-video-tile exercise-video-fallback">
      <ExerciseLoop media={media} label={label} />
      {caption && <span className="exercise-video-caption">{caption}</span>}
    </div>
  )
}

// Bandeau défilant horizontal des vues disponibles (face, profil) d'UN
// exercice — vidéo MuscleWiki, branded, licence commerciale.
export default function ExerciseVideo({ videos, label }) {
  const items = pickMusclewikiVideos(videos)
  if (items.length === 0) return null

  return (
    <div className="exercise-video-strip">
      {items.map((video, i) => (
        <VideoTile key={video.url ?? i} video={video} label={label} caption={ANGLE_LABEL[video.angle]} />
      ))}
    </div>
  )
}

// Même bandeau, mais pour PLUSIEURS exercices à la fois (superset/triset) :
// toutes les vues de tous les membres à la suite, chacune sous-titrée par le
// nom de l'exercice — et repli sur l'illustration statique pour un membre
// sans vidéo MuscleWiki mappée, plutôt que de le faire disparaître du bandeau.
export function ExerciseVideoGroup({ groups }) {
  const tiles = groups.flatMap(({ label, videos, fallbackMedia }) => {
    const angles = pickMusclewikiVideos(videos)
    if (angles.length > 0) {
      return angles.map((video) => (
        <VideoTile
          key={video.url}
          video={video}
          label={label}
          caption={`${label} · ${ANGLE_LABEL[video.angle] ?? ''}`.trim()}
        />
      ))
    }
    if (fallbackMedia) {
      return [<FallbackTile key={`${label}-fallback`} media={fallbackMedia} label={label} caption={label} />]
    }
    return []
  })
  if (tiles.length === 0) return null

  return <div className="exercise-video-strip">{tiles}</div>
}
