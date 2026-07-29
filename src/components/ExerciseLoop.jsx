import { useEffect, useRef, useState } from 'react'

/**
 * Deux poses en fondu croisé = un mouvement lisible.
 *
 * Le fondu fait tout le travail : en coupe franche, deux dessins clignotent ;
 * en fondu, le cerveau interpole la trajectoire. Même principe que les GIFs
 * payants, avec deux images au lieu de trente.
 *
 * Adapté du composant Next/Tailwind fourni dans le pipeline : ici en JSX + CSS
 * rouxperf. Les SVG héritent de la couleur du texte parent (currentColor), donc
 * s'affichent à la couleur d'accent lime ; les rasters restent tels quels.
 */
export default function ExerciseLoop({ media, label, holdStart = 900, holdEnd = 1200 }) {
  const [frame, setFrame] = useState(0)
  const [animated, setAnimated] = useState(true)
  const timer = useRef(null)

  const frames = media?.frames ?? []
  const isVector = frames[0]?.endsWith('.svg')

  useEffect(() => {
    if (frames.length === 0) return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      setAnimated(!mq.matches)
      if (mq.matches) setFrame(frames.length - 1)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [frames.length])

  useEffect(() => {
    if (!animated || frames.length < 2) return undefined
    const tick = () => {
      setFrame((f) => {
        const next = (f + 1) % frames.length
        timer.current = setTimeout(tick, next === 0 ? holdStart : holdEnd)
        return next
      })
    }
    timer.current = setTimeout(tick, holdStart)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [animated, frames.length, holdStart, holdEnd])

  if (frames.length === 0) return null

  return (
    <div className="exercise-loop" role="img" aria-label={`Démonstration : ${label}`}>
      {frames.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className={`exercise-loop-frame${isVector ? ' exercise-loop-vector' : ''}`}
          style={{ opacity: i === frame ? 1 : 0 }}
        />
      ))}
    </div>
  )
}
