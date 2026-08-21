import { useEffect, useRef, useState } from 'react'

function fmtCountdown(sec) {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`
}

function readStored(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

function clearStored(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

// Calcule l'état à reprendre à partir du stockage persisté, plutôt que de
// faire confiance à un compteur figé au moment de la fermeture — deux cas :
// un décompte en cours (recalculé depuis l'heure de démarrage), ou un bloc
// déjà terminé mais pas encore validé (l'utilisateur a fermé l'app pendant
// qu'il ajustait le nombre de tours/rounds sur l'écran de confirmation).
function loadResume(storageKey, format, timeCapSeconds, intervalSeconds, rounds) {
  if (!storageKey) return null
  const stored = readStored(storageKey)
  if (!stored) return null
  if (stored.finished) {
    return { kind: 'finished', roundsDone: stored.roundsDone ?? 0 }
  }
  if (!stored.startedAt) return null
  if (format === 'amrap') {
    const left = timeCapSeconds - Math.floor((Date.now() - stored.startedAt) / 1000)
    if (left <= 0) return { kind: 'finished', roundsDone: stored.amrapRounds ?? 0 }
    return { kind: 'running', remaining: left, roundIndex: 0, startedAt: stored.startedAt, amrapRounds: stored.amrapRounds ?? 0 }
  }
  const elapsedS = Math.floor((Date.now() - stored.startedAt) / 1000)
  const computedRound = Math.floor(elapsedS / intervalSeconds)
  if (computedRound >= rounds) return { kind: 'finished', roundsDone: rounds }
  return {
    kind: 'running',
    remaining: intervalSeconds - (elapsedS % intervalSeconds),
    roundIndex: computedRound,
    startedAt: stored.startedAt,
    amrapRounds: 0,
  }
}

// Minuteur autonome pour un bloc de conditionnement AMRAP ou EMOM. Tout se
// recalcule à partir de l'heure de démarrage (startedAt, persistée dans
// localStorage sous storageKey) plutôt que d'un compteur décrémenté : une
// fermeture de l'app ou une mise en arrière-plan reprend au bon endroit —
// round EMOM courant et temps restant recalculés depuis l'heure réelle, pas
// juste "gelés" au moment de la fermeture.
export default function BlockRunner({
  format,
  timeCapSeconds,
  intervalSeconds,
  rounds,
  members,
  storageKey,
  onComplete,
  onCancel,
}) {
  const resume = loadResume(storageKey, format, timeCapSeconds, intervalSeconds, rounds)
  const resumeRunning = resume?.kind === 'running'
  const resumeFinished = resume?.kind === 'finished'

  const [running, setRunning] = useState(resumeRunning)
  const [remaining, setRemaining] = useState(
    resumeRunning ? resume.remaining : format === 'amrap' ? timeCapSeconds : intervalSeconds
  )
  const [roundIndex, setRoundIndex] = useState(resumeRunning ? resume.roundIndex : 0)
  const [amrapRounds, setAmrapRounds] = useState(resumeRunning ? resume.amrapRounds : 0)
  const [finishing, setFinishing] = useState(resumeFinished)
  const [finalRounds, setFinalRounds] = useState(resumeFinished ? resume.roundsDone : 0)
  const startedAtRef = useRef(resumeRunning ? resume.startedAt : null)
  const firedRef = useRef(false)
  // Lu depuis le tick() ci-dessous : l'effet ne dépend pas de amrapRounds
  // (pour ne pas relancer l'intervalle à chaque tour tapé), donc la valeur
  // fermée par la closure de tick() serait figée au démarrage sans ce ref.
  const amrapRoundsRef = useRef(resumeRunning ? resume.amrapRounds : 0)

  // Le temps/les rounds se sont écoulés pendant la fermeture sans que le
  // bloc ait encore été marqué "finished" en stock : le fige maintenant,
  // pour rester cohérent si l'app est refermée à nouveau avant validation.
  useEffect(() => {
    if (resumeFinished && storageKey) writeStored(storageKey, { finished: true, roundsDone: resume.roundsDone })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function buzz() {
    try {
      navigator.vibrate?.([200, 100, 200])
    } catch {
      // ignore
    }
  }

  // Marque le bloc terminé et EN ATTENTE DE VALIDATION — reste persisté
  // (pas effacé) tant que l'utilisateur n'a pas appuyé sur "Valider", pour
  // survivre à une fermeture de l'app pendant l'ajustement du compteur.
  function finishNow(roundsDone) {
    setRunning(false)
    setFinalRounds(roundsDone)
    setFinishing(true)
    if (storageKey) writeStored(storageKey, { finished: true, roundsDone })
  }

  function validate() {
    if (storageKey) clearStored(storageKey)
    onComplete(finalRounds)
  }

  function start() {
    const now = Date.now()
    startedAtRef.current = now
    firedRef.current = false
    amrapRoundsRef.current = 0
    setAmrapRounds(0)
    setRoundIndex(0)
    setRemaining(format === 'amrap' ? timeCapSeconds : intervalSeconds)
    setRunning(true)
    if (storageKey) writeStored(storageKey, { startedAt: now, amrapRounds: 0 })
  }

  useEffect(() => {
    if (!running) return undefined
    function tick() {
      const startedAt = startedAtRef.current
      if (!startedAt) return
      if (format === 'amrap') {
        const left = timeCapSeconds - Math.floor((Date.now() - startedAt) / 1000)
        setRemaining(Math.max(0, left))
        if (left <= 0 && !firedRef.current) {
          firedRef.current = true
          finishNow(amrapRoundsRef.current)
        }
        return
      }
      const elapsedS = Math.floor((Date.now() - startedAt) / 1000)
      const computedRound = Math.floor(elapsedS / intervalSeconds)
      if (computedRound >= rounds) {
        if (!firedRef.current) {
          firedRef.current = true
          finishNow(rounds)
        }
        return
      }
      if (computedRound !== roundIndex) {
        buzz()
        setRoundIndex(computedRound)
      }
      setRemaining(intervalSeconds - (elapsedS % intervalSeconds))
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

  function tapRound() {
    setAmrapRounds((r) => {
      const next = r + 1
      amrapRoundsRef.current = next
      if (storageKey && startedAtRef.current) {
        writeStored(storageKey, { startedAt: startedAtRef.current, amrapRounds: next })
      }
      return next
    })
  }

  function stopEarly() {
    finishNow(format === 'amrap' ? amrapRounds : roundIndex)
  }

  function cancel() {
    if (storageKey) clearStored(storageKey)
    onCancel()
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
          onChange={(e) => {
            const next = Number(e.target.value) || 0
            setFinalRounds(next)
            if (storageKey) writeStored(storageKey, { finished: true, roundsDone: next })
          }}
        />
        <button type="button" className="btn-primary" onClick={validate}>
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
          <button type="button" className="link-button" onClick={cancel}>
            ‹ Retour aux exercices
          </button>
        </>
      ) : (
        <>
          {format === 'amrap' && (
            <button type="button" className="btn-primary" onClick={tapRound}>
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
