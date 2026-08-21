import { useEffect, useRef, useState } from 'react'

function fmtCountdown(sec) {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`
}

// Minuteur autonome pour un bloc de conditionnement AMRAP ou EMOM : gère son
// propre décompte (basé sur une heure de fin, pas un compteur décrémenté, pour
// rester correct si l'app repasse en arrière-plan), les rounds EMOM qui
// s'enchaînent automatiquement, et un compteur de tours pour l'AMRAP.
export default function BlockRunner({ format, timeCapSeconds, intervalSeconds, rounds, members, onComplete, onCancel }) {
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(format === 'amrap' ? timeCapSeconds : intervalSeconds)
  const [roundIndex, setRoundIndex] = useState(0)
  const [amrapRounds, setAmrapRounds] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [finalRounds, setFinalRounds] = useState(0)
  const endAtRef = useRef(null)
  const firedRef = useRef(false)

  function buzz() {
    try {
      navigator.vibrate?.([200, 100, 200])
    } catch {
      // ignore
    }
  }

  function start() {
    setRunning(true)
    setRoundIndex(0)
    setAmrapRounds(0)
    firedRef.current = false
    const dur = format === 'amrap' ? timeCapSeconds : intervalSeconds
    endAtRef.current = Date.now() + dur * 1000
    setRemaining(dur)
  }

  useEffect(() => {
    if (!running) return undefined
    function tick() {
      const left = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true
        if (format === 'emom') {
          buzz()
          const nextRound = roundIndex + 1
          if (nextRound < rounds) {
            setRoundIndex(nextRound)
            endAtRef.current = Date.now() + intervalSeconds * 1000
            firedRef.current = false
          } else {
            setRunning(false)
            setFinalRounds(rounds)
            setFinishing(true)
          }
        } else {
          setRunning(false)
          setFinalRounds(amrapRounds)
          setFinishing(true)
        }
      }
    }
    function onVisible() {
      if (document.visibilityState === 'visible') tick()
    }
    tick()
    const id = setInterval(tick, 500)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, roundIndex])

  function stopEarly() {
    setRunning(false)
    setFinalRounds(format === 'amrap' ? amrapRounds : roundIndex)
    setFinishing(true)
  }

  if (finishing) {
    return (
      <div className="card block-runner">
        <p className="eyebrow">{format === 'amrap' ? 'AMRAP terminé' : 'EMOM terminé'}</p>
        <label htmlFor="block-rounds">{format === 'amrap' ? 'Tours complétés' : 'Rounds effectués'}</label>
        <input
          id="block-rounds"
          type="number"
          min="0"
          inputMode="numeric"
          value={finalRounds}
          onChange={(e) => setFinalRounds(Number(e.target.value) || 0)}
        />
        <button type="button" className="btn-primary" onClick={() => onComplete(finalRounds)}>
          Valider
        </button>
      </div>
    )
  }

  return (
    <div className="card block-runner">
      <p className="eyebrow">
        {format === 'amrap' ? `AMRAP · ${Math.round(timeCapSeconds / 60)} min` : `EMOM · ${rounds} × ${intervalSeconds}s`}
      </p>

      {format === 'emom' && running && (
        <p className="block-runner-round">
          Round {roundIndex + 1} / {rounds}
        </p>
      )}

      <span className="block-runner-countdown">{fmtCountdown(remaining)}</span>

      <ul className="block-runner-movements">
        {members.map(({ name, reps }, i) => (
          <li key={i}>
            <strong>{name}</strong> <span className="eyebrow">{reps}</span>
          </li>
        ))}
      </ul>

      {!running ? (
        <>
          <button type="button" className="btn-primary" onClick={start}>
            Démarrer
          </button>
          <button type="button" className="link-button" onClick={onCancel}>
            ‹ Retour aux exercices
          </button>
        </>
      ) : (
        <>
          {format === 'amrap' && (
            <button type="button" className="btn-primary" onClick={() => setAmrapRounds((r) => r + 1)}>
              +1 tour ({amrapRounds})
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={stopEarly}>
            Terminer maintenant
          </button>
        </>
      )}
    </div>
  )
}
