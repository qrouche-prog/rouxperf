import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { withStableDayNumbers, programSchedule } from '../lib/programDays'
import { mediaForSlug } from '../lib/exerciseMedia'
import ExerciseLoop from '../components/ExerciseLoop'
import ExerciseAttribution from '../components/ExerciseAttribution'
import Icon from '../components/onboarding/icons/Icon'

const RPE_SCALE = Array.from({ length: 10 }, (_, i) => i + 1)

function rpeColor(value) {
  const hue = 120 - (value - 1) * (120 / 9)
  return `hsl(${hue}, 70%, 45%)`
}

function parseTargetReps(repsText) {
  const match = String(repsText ?? '').match(/\d+/)
  return match ? Number(match[0]) : null
}

function countCompleted(entries, exerciseIndex, totalSets) {
  let n = 0
  for (let i = 0; i < totalSets; i += 1) {
    if (entries[`${exerciseIndex}-${i}`]) n += 1
  }
  return n
}

function restLabelFor(seconds) {
  if (!seconds) return '—'
  return seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds}s`
}

// Reconstruit les séries déjà enregistrées → entrées locales + id de ligne
// (pour pouvoir mettre à jour une série au lieu d'en réinsérer une).
function buildFromLoggedSets(day, loggedSets) {
  const entries = {}
  const rowIds = {}
  for (const set of loggedSets) {
    const setIndex = set.set_number - 1
    const exerciseIndex = day.exercises.findIndex(
      (exercise, i) => exercise.exercise_id === set.exercise_id && !entries[`${i}-${setIndex}`]
    )
    if (exerciseIndex !== -1) {
      const key = `${exerciseIndex}-${setIndex}`
      entries[key] = {
        reps: set.reps ?? '',
        weight_kg: set.weight_kg ?? '',
        rpe: set.rpe ?? '',
      }
      if (set.id != null) rowIds[key] = set.id
    }
  }
  return { entries, rowIds }
}

export default function SessionRunnerPage() {
  const { weekNumber, dayNumber } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [program, setProgram] = useState(null)
  const [exercisesById, setExercisesById] = useState({})
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState(null)

  const [entries, setEntries] = useState({})
  const [carryoverByExercise, setCarryoverByExercise] = useState({})

  const [phase, setPhase] = useState('exercise') // exercise | list | resting | summary
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(null)
  const [activeSetIndex, setActiveSetIndex] = useState(0)
  const [editingDoneSet, setEditingDoneSet] = useState(false)
  const [restRemaining, setRestRemaining] = useState(0)
  const [restEndAt, setRestEndAt] = useState(null)
  const [restNext, setRestNext] = useState('')

  const [weight, setWeight] = useState('')
  const [rpe, setRpe] = useState('')
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [, setFinalPercent] = useState(null)

  // Refs pour éviter les closures périmées dans les timers / callbacks async.
  const entriesRef = useRef({})
  const logIdRef = useRef(null)
  const rowIdsRef = useRef({})
  const selectedExRef = useRef(null)
  const wakeLockRef = useRef(null)
  const audioCtxRef = useRef(null)
  const restFiredRef = useRef(false)

  const REST_KEY = `rouxperf-rest-${weekNumber}-${dayNumber}`

  const week = program?.structure?.weeks?.find((w) => w.week_number === Number(weekNumber))
  const days = withStableDayNumbers(week?.days ?? [])
  const day = days.find((d) => d.day_number === Number(dayNumber))

  function syncEntries(next) {
    entriesRef.current = next
    setEntries(next)
  }

  function carryoverFor(exerciseId, setIndex0) {
    const w = carryoverByExercise[exerciseId]?.[setIndex0 + 1]
    return w != null ? String(w) : ''
  }

  // Charge les valeurs du champ (poids/RPE) pour une série donnée.
  function loadFieldsFor(dayArg, exIdx, setIdx, { sameExercise } = {}) {
    const ex = dayArg.exercises[exIdx]
    const existing = entriesRef.current[`${exIdx}-${setIdx}`]
    if (existing) {
      setWeight(existing.weight_kg != null ? String(existing.weight_kg) : '')
      setRpe(existing.rpe != null && existing.rpe !== '' ? String(existing.rpe) : '')
      return
    }
    const carry = carryoverFor(ex.exercise_id, setIdx)
    if (carry) setWeight(carry)
    else if (!sameExercise) setWeight('') // nouvel exercice sans reprise : on repart vide
    // même exercice sans reprise : on garde le poids déjà saisi
    setRpe('')
  }

  // Ouvre la série à faire courante (1er exercice, 1re série non complétés).
  // Renvoie true si une série reste à faire, false si la séance est terminée.
  function openCurrent(dayArg) {
    const target = dayArg || day
    if (!target) return false
    for (let e = 0; e < target.exercises.length; e += 1) {
      const ex = target.exercises[e]
      for (let s = 0; s < ex.sets; s += 1) {
        if (!entriesRef.current[`${e}-${s}`]) {
          const sameExercise = e === selectedExRef.current
          selectedExRef.current = e
          setSelectedExerciseIndex(e)
          setActiveSetIndex(s)
          setEditingDoneSet(false)
          loadFieldsFor(target, e, s, { sameExercise })
          setPhase('exercise')
          return true
        }
      }
    }
    // Tout est fait
    setFinalPercent(100)
    setPhase('summary')
    return false
  }

  function openExercise(dayArg, exIdx) {
    const target = dayArg || day
    const ex = target.exercises[exIdx]
    let setIdx = 0
    for (let s = 0; s < ex.sets; s += 1) {
      if (!entriesRef.current[`${exIdx}-${s}`]) {
        setIdx = s
        break
      }
      setIdx = s // tout fait : on pointe la dernière
    }
    selectedExRef.current = exIdx
    setSelectedExerciseIndex(exIdx)
    setActiveSetIndex(setIdx)
    setEditingDoneSet(false)
    loadFieldsFor(target, exIdx, setIdx, { sameExercise: false })
    setPhase('exercise')
  }

  useEffect(() => {
    async function load() {
      const [{ data: programData, error }, { data: exercises }] = await Promise.all([
        supabase
          .from('user_programs')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('exercises').select('id, name, instructions, illustration_slug'),
      ])
      if (error) {
        setLoadError(error.message)
        setStatus('idle')
        return
      }
      setProgram(programData)
      setExercisesById(Object.fromEntries((exercises ?? []).map((exercise) => [exercise.id, exercise])))

      if (programData) {
        const wk = programData.structure.weeks.find((w) => w.week_number === Number(weekNumber))
        const normalizedDays = withStableDayNumbers(wk?.days ?? [])
        const theDay = normalizedDays.find((d) => d.day_number === Number(dayNumber))

        if (theDay) {
          const { data: existingLog } = await supabase
            .from('workout_logs')
            .select('id, performed_at, workout_log_sets(id, exercise_id, set_number, reps, weight_kg, rpe)')
            .eq('user_id', user.id)
            .eq('program_id', programData.id)
            .eq('week_number', Number(weekNumber))
            .eq('day_number', Number(dayNumber))
            .order('performed_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (existingLog && existingLog.workout_log_sets.length > 0) {
            const built = buildFromLoggedSets(theDay, existingLog.workout_log_sets)
            entriesRef.current = built.entries
            rowIdsRef.current = built.rowIds
            logIdRef.current = existingLog.id
            setEntries(built.entries)
          }

          // Reprise des poids : dernière séance complétée d'une semaine
          // antérieure pour le même jour, pour pré-remplir série par série.
          const { data: priorLog } = await supabase
            .from('workout_logs')
            .select('week_number, workout_log_sets(exercise_id, set_number, weight_kg)')
            .eq('user_id', user.id)
            .eq('program_id', programData.id)
            .eq('day_number', Number(dayNumber))
            .lt('week_number', Number(weekNumber))
            .order('week_number', { ascending: false })
            .order('performed_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (priorLog) {
            const map = {}
            for (const set of priorLog.workout_log_sets) {
              if (set.weight_kg == null) continue
              map[set.exercise_id] = map[set.exercise_id] ?? {}
              map[set.exercise_id][set.set_number] = set.weight_kg
            }
            setCarryoverByExercise(map)
          }

          let storedRest = null
          try {
            storedRest = JSON.parse(localStorage.getItem(REST_KEY) || 'null')
          } catch {
            storedRest = null
          }
          const hasProgress = Object.keys(entriesRef.current).length > 0
          setStatus('idle')
          if (hasProgress && storedRest && typeof storedRest.end === 'number' && storedRest.end > Date.now()) {
            // Un repos était en cours (app fermée entre-temps) : on le reprend.
            restFiredRef.current = false
            setRestNext(storedRest.label || '')
            setRestRemaining(Math.max(0, Math.round((storedRest.end - Date.now()) / 1000)))
            setRestEndAt(storedRest.end)
            setPhase('resting')
          } else if (hasProgress) {
            try {
              localStorage.removeItem(REST_KEY)
            } catch {
              // ignore
            }
            openCurrent(theDay)
          } else {
            setPhase('list')
          }
          return
        }
      }

      setStatus('idle')
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, weekNumber, dayNumber])

  // Décompte du repos, basé sur l'heure de fin (restEndAt) plutôt qu'un
  // compteur décrémenté : les timers sont gelés en arrière-plan, mais recalculer
  // depuis un timestamp donne toujours la bonne valeur au retour dans l'app.
  useEffect(() => {
    if (phase !== 'resting' || restEndAt == null) return undefined
    function tick() {
      const remaining = Math.max(0, Math.round((restEndAt - Date.now()) / 1000))
      setRestRemaining(remaining)
      if (remaining <= 0) finishRest()
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
  }, [phase, restEndAt])

  // Garde l'écran allumé pendant la séance (Wake Lock, si supporté)
  useEffect(() => {
    const active = phase === 'exercise' || phase === 'resting' || phase === 'list'
    async function acquire() {
      if (!active || !('wakeLock' in navigator)) return
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      } catch {
        wakeLockRef.current = null
      }
    }
    function onVisible() {
      if (document.visibilityState === 'visible') acquire()
    }
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
    }
  }, [phase])

  if (status === 'loading') return null

  if (loadError) {
    return (
      <main>
        <p role="alert">{loadError}</p>
      </main>
    )
  }

  if (!program) {
    return (
      <main>
        <p>Aucun programme actif.</p>
        <Link to="/program">Retour au programme</Link>
      </main>
    )
  }

  if (!day) {
    return (
      <main>
        <p>Séance introuvable.</p>
        <Link to="/program">Retour au programme</Link>
      </main>
    )
  }

  if (programSchedule(program)?.expired) {
    return (
      <main>
        <p>Ce programme est arrivé à échéance et n'est plus disponible.</p>
        <Link to="/program">Retour au programme</Link>
      </main>
    )
  }

  const slotLabel = day.slot === 'morning' ? ' · matin' : day.slot === 'evening' ? ' · soir' : ''
  const totalSets = day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
  const doneSets = day.exercises.reduce((sum, exercise, i) => sum + countCompleted(entries, i, exercise.sets), 0)
  const overallPercent = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0

  // Écrit une série en base immédiatement (création du log au besoin).
  async function persistSet(exIdx, setIdx, entry) {
    setSaveState('saving')
    let id = logIdRef.current
    if (!id) {
      const { data, error } = await supabase
        .from('workout_logs')
        .insert({
          user_id: user.id,
          program_id: program.id,
          week_number: Number(weekNumber),
          day_number: Number(dayNumber),
        })
        .select('id')
        .single()
      if (error) {
        setSaveState('error')
        return
      }
      id = data.id
      logIdRef.current = id
    }

    const exercise = day.exercises[exIdx]
    const key = `${exIdx}-${setIdx}`
    const row = {
      workout_log_id: id,
      user_id: user.id,
      exercise_id: exercise.exercise_id,
      set_number: setIdx + 1,
      reps: entry.reps ? Number(entry.reps) : null,
      weight_kg: entry.weight_kg ? Number(entry.weight_kg) : null,
      rpe: entry.rpe ? Number(entry.rpe) : null,
    }

    const existingId = rowIdsRef.current[key]
    if (existingId) {
      const { error } = await supabase.from('workout_log_sets').update(row).eq('id', existingId)
      if (error) {
        setSaveState('error')
        return
      }
    } else {
      const { data, error } = await supabase.from('workout_log_sets').insert(row).select('id').single()
      if (error) {
        setSaveState('error')
        return
      }
      rowIdsRef.current[key] = data.id
    }
    setSaveState('saved')
  }

  function submitSet(idx) {
    const exercise = day.exercises[selectedExerciseIndex]
    const entry = {
      reps: parseTargetReps(exercise.reps),
      weight_kg: weight,
      rpe,
    }
    const key = `${selectedExerciseIndex}-${idx}`
    const wasDone = Boolean(entriesRef.current[key])
    const updated = { ...entriesRef.current, [key]: entry }
    syncEntries(updated)
    persistSet(selectedExerciseIndex, idx, entry)
    setEditingDoneSet(false)
    setRpe('')

    const exNowDone = countCompleted(updated, selectedExerciseIndex, exercise.sets) === exercise.sets

    // Édition d'une série déjà validée : pas d'auto-enchaînement.
    if (wasDone) {
      if (!exNowDone) openCurrent()
      return
    }

    // Séance entièrement terminée → résumé.
    const sessionDone = !day.exercises.some((ex, e) => {
      for (let s = 0; s < ex.sets; s += 1) if (!updated[`${e}-${s}`]) return true
      return false
    })
    if (sessionDone) {
      setFinalPercent(100)
      setPhase('summary')
      return
    }

    // Exercice terminé mais séance non finie : on RESTE sur cet exercice avec le
    // choix « Continuer » / « Terminer la séance » (pas d'auto-enchaînement forcé).
    if (exNowDone) {
      setActiveSetIndex(exercise.sets - 1)
      return
    }

    // Série suivante DU MÊME exercice → repos puis reprise.
    let nextSet = idx + 1
    for (let s = 0; s < exercise.sets; s += 1) {
      if (!updated[`${selectedExerciseIndex}-${s}`]) {
        nextSet = s
        break
      }
    }
    const rest = exercise.rest_seconds || 0
    if (rest > 0) {
      const det = exercisesById[exercise.exercise_id]
      startRest(rest, `${det?.name ?? 'Exercice'} · série ${nextSet + 1}`)
      return
    }
    setActiveSetIndex(nextSet)
    loadFieldsFor(day, selectedExerciseIndex, nextSet, { sameExercise: true })
  }

  // Débloque l'audio (doit être appelé depuis un geste utilisateur, ex. Valider).
  function unlockAudio() {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (Ctx) audioCtxRef.current = new Ctx()
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
    } catch {
      // audio indisponible
    }
  }

  // Bip sonore + vibration à la fin du repos.
  function playRestDoneCue() {
    try {
      const ctx = audioCtxRef.current
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume()
        const start = ctx.currentTime
        for (const offset of [0, 0.28]) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = 880
          gain.gain.setValueAtTime(0.0001, start + offset)
          gain.gain.exponentialRampToValueAtTime(0.35, start + offset + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.22)
          osc.connect(gain).connect(ctx.destination)
          osc.start(start + offset)
          osc.stop(start + offset + 0.24)
        }
      }
    } catch {
      // ignore
    }
    try {
      navigator.vibrate?.([200, 100, 200])
    } catch {
      // ignore
    }
  }

  // Notification système quand le repos se termine alors que l'app est en fond.
  function notifyRestDone() {
    try {
      if (
        'Notification' in window &&
        Notification.permission === 'granted' &&
        document.visibilityState !== 'visible'
      ) {
        const notif = new Notification('Repos terminé 💪', {
          body: restNext ? `À suivre : ${restNext}` : 'Reprends ta série.',
          tag: 'rouxperf-rest',
        })
        setTimeout(() => notif.close(), 8000)
      }
    } catch {
      // ignore
    }
  }

  function startRest(seconds, label) {
    const end = Date.now() + seconds * 1000
    restFiredRef.current = false
    setRestNext(label)
    setRestRemaining(seconds)
    setRestEndAt(end)
    try {
      localStorage.setItem(REST_KEY, JSON.stringify({ end, label }))
    } catch {
      // ignore
    }
    unlockAudio()
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } catch {
      // ignore
    }
    setPhase('resting')
  }

  function finishRest() {
    if (restFiredRef.current) return
    restFiredRef.current = true
    try {
      localStorage.removeItem(REST_KEY)
    } catch {
      // ignore
    }
    playRestDoneCue()
    notifyRestDone()
    setRestEndAt(null)
    openCurrent()
  }

  function skipRest() {
    restFiredRef.current = true
    try {
      localStorage.removeItem(REST_KEY)
    } catch {
      // ignore
    }
    setRestEndAt(null)
    openCurrent()
  }

  function quitSession() {
    // Tout est déjà sauvegardé série par série : on peut sortir sans risque.
    navigate('/program')
  }

  // ---- Écran : résumé ----
  if (phase === 'summary') {
    return (
      <main className="session-run">
        <div className="card session-complete">
          <p className="eyebrow">{overallPercent === 100 ? 'Séance validée' : 'Séance enregistrée'}</p>
          <span className="completion-percent">{overallPercent}%</span>
          <h1>
            {day.name}
            {slotLabel}
          </h1>
          <p>
            {doneSets} / {totalSets} séries réalisées
          </p>
        </div>

        <div className="card session-summary">
          {day.exercises.map((ex, i) => {
            const det = exercisesById[ex.exercise_id]
            const doneCount = countCompleted(entries, i, ex.sets)
            return (
              <div key={i} className="session-summary-exo">
                <div className="session-summary-exo-head">
                  <strong>{det?.name ?? 'Exercice'}</strong>
                  <span className={`eyebrow${doneCount === ex.sets ? ' session-summary-done' : ''}`}>
                    {doneCount}/{ex.sets} séries
                  </span>
                </div>
                <ul className="session-summary-sets">
                  {Array.from({ length: ex.sets }).map((_, s) => {
                    const e = entries[`${i}-${s}`]
                    return (
                      <li key={s} className={e ? 'session-summary-set' : 'session-summary-set session-summary-skipped'}>
                        <span className="session-summary-set-n">{s + 1}</span>
                        {e ? (
                          <span>
                            {e.weight_kg ? `${e.weight_kg} kg` : 'PdC'} × {e.reps || ex.reps} reps
                            {e.rpe ? ` · RPE ${e.rpe}` : ''}
                          </span>
                        ) : (
                          <span>non réalisée</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>

        <Link to="/program" className="btn-primary session-finish-btn">
          Retour au programme
        </Link>
        <div className="bottom-nav-spacer" />
      </main>
    )
  }

  // ---- Écran : repos (guidé) ----
  if (phase === 'resting') {
    return (
      <main className="session-run">
        <div className="card rest-timer">
          <p className="eyebrow">Repos</p>
          <span className="rest-countdown">{restRemaining}s</span>
          <p>À suivre : {restNext}</p>
          <button type="button" className="btn-secondary" onClick={skipRest}>
            Passer le repos
          </button>
        </div>
      </main>
    )
  }

  // ---- Écran : liste (libre) ----
  if (phase === 'list') {
    return (
      <main className="session-run">
        <div className="session-runner-header">
          <button type="button" className="link-button" onClick={quitSession}>
            × Quitter
          </button>
          <span className="eyebrow">
            {day.name}
            {slotLabel}
          </span>
        </div>

        <div className="session-hub-progress">
          <span className="completion-percent">{overallPercent}%</span>
          <div className="week-progress-bar">
            <div className="week-progress-fill" style={{ width: `${overallPercent}%` }} />
          </div>
          <p className="eyebrow week-progress-label">
            {doneSets} / {totalSets} séries complétées
          </p>
        </div>

        <p className="session-list-hint">Lance la séance, ou choisis directement un exercice.</p>

        <div className="session-exercise-list">
          {day.exercises.map((exercise, i) => {
            const details = exercisesById[exercise.exercise_id]
            const completed = countCompleted(entries, i, exercise.sets)
            const done = completed === exercise.sets
            return (
              <button
                key={i}
                type="button"
                className="session-exercise-card"
                onClick={() => openExercise(day, i)}
              >
                <span className={`session-status-badge${done ? ' session-status-done' : ''}`}>
                  <Icon name={done ? 'check' : 'bolt'} size={16} />
                </span>
                <span className="session-exercise-info">
                  <strong>{details?.name ?? 'Exercice'}</strong>
                  <span className="eyebrow">
                    {completed} / {exercise.sets} séries
                  </span>
                </span>
                <span className="session-exercise-chevron">›</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="btn-primary session-finish-btn"
          onClick={() => (overallPercent === 100 ? setPhase('summary') : openCurrent())}
        >
          {overallPercent === 100 ? 'Voir le résumé' : doneSets > 0 ? 'Reprendre la séance' : 'Commencer'}
        </button>
        {doneSets > 0 && overallPercent < 100 && (
          <button
            type="button"
            className="btn-secondary session-finish-btn"
            onClick={() => {
              setFinalPercent(overallPercent)
              setPhase('summary')
            }}
          >
            Terminer la séance ({overallPercent}%)
          </button>
        )}
      </main>
    )
  }

  // ---- Écran : exercice (compact) ----
  if (selectedExerciseIndex == null || !day.exercises[selectedExerciseIndex]) return null
  const exercise = day.exercises[selectedExerciseIndex]
  const details = exercisesById[exercise.exercise_id]
  const media = mediaForSlug(details?.illustration_slug)
  const completed = countCompleted(entries, selectedExerciseIndex, exercise.sets)
  const exerciseDone = completed === exercise.sets
  const fillIdx = activeSetIndex
  const fillEntry = entries[`${selectedExerciseIndex}-${fillIdx}`]
  const showContinue = exerciseDone && !editingDoneSet
  const restLabel = restLabelFor(exercise.rest_seconds)

  function tapSet(i) {
    setActiveSetIndex(i)
    setEditingDoneSet(Boolean(entries[`${selectedExerciseIndex}-${i}`]))
    loadFieldsFor(day, selectedExerciseIndex, i, { sameExercise: true })
  }

  function onPrimary(e) {
    e.preventDefault()
    if (showContinue) {
      openCurrent()
      return
    }
    submitSet(fillIdx)
  }

  return (
    <main className="session-run">
      <div className="session-runner-header">
        <button type="button" className="link-button" onClick={() => setPhase('list')}>
          ‹ Exercices
        </button>
        <span className="eyebrow session-save-state">
          {saveState === 'saving' ? 'Enregistrement…' : saveState === 'saved' ? 'Enregistré ✓' : saveState === 'error' ? '⚠ non enregistré' : `${overallPercent}%`}
        </span>
      </div>

      <div className="week-progress-bar session-run-bar">
        <div className="week-progress-fill" style={{ width: `${overallPercent}%` }} />
      </div>

      <div className="card session-exo-card">
        <p className="eyebrow">
          Exercice {selectedExerciseIndex + 1}/{day.exercises.length} · {completed}/{exercise.sets} séries
        </p>
        <h2 className="session-exo-name">{details?.name ?? 'Exercice'}</h2>

        {media && (
          <div className="session-exo-media">
            <ExerciseLoop media={media} label={details?.name ?? 'Exercice'} />
            <ExerciseAttribution media={media} />
          </div>
        )}

        <div className="set-chips" role="tablist" aria-label="Séries">
          {Array.from({ length: exercise.sets }).map((_, i) => {
            const isDone = Boolean(entries[`${selectedExerciseIndex}-${i}`])
            const isActive = i === fillIdx
            return (
              <button
                key={i}
                type="button"
                className={`set-chip${isDone ? ' set-chip-done' : ''}${isActive ? ' set-chip-active' : ''}`}
                onClick={() => tapSet(i)}
                aria-label={`Série ${i + 1}${isDone ? ', complétée' : ''}`}
              >
                {isDone ? <Icon name="check" size={14} /> : i + 1}
              </button>
            )
          })}
        </div>

        {showContinue ? (
          <div className="set-fill">
            <p className="set-fill-done">Exercice terminé.</p>
            <div className="set-fill-actions">
              <button type="button" className="btn-primary" onClick={onPrimary}>
                Continuer
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setFinalPercent(overallPercent)
                  setPhase('summary')
                }}
              >
                Terminer la séance
              </button>
            </div>
          </div>
        ) : (
          <form className="set-fill" onSubmit={onPrimary}>
            <p className="set-fill-target">
              Série {fillIdx + 1} · objectif <strong>{exercise.reps}</strong> reps · repos {restLabel}
            </p>

            <label htmlFor="weight">Poids (kg)</label>
            <input
              id="weight"
              type="number"
              inputMode="decimal"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              autoComplete="off"
            />

            <label>RPE — difficulté ressentie (optionnel)</label>
            <div className="rpe-scale" role="radiogroup" aria-label="RPE, 1 facile à 10 difficile">
              {RPE_SCALE.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`rpe-option${rpe === String(value) ? ' rpe-option-selected' : ''}`}
                  style={{ '--rpe-color': rpeColor(value) }}
                  aria-pressed={rpe === String(value)}
                  onClick={() => setRpe(rpe === String(value) ? '' : String(value))}
                >
                  {value}
                </button>
              ))}
            </div>

            <button type="submit" className="btn-primary">
              {fillEntry ? `Mettre à jour la série ${fillIdx + 1}` : `Valider la série ${fillIdx + 1}`}
            </button>
          </form>
        )}

        {details?.instructions && (
          <details className="session-exo-instructions">
            <summary>Consignes</summary>
            <p>{details.instructions}</p>
          </details>
        )}
      </div>
    </main>
  )
}
