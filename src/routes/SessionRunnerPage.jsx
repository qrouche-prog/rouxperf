import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { withStableDayNumbers } from '../lib/programDays'
import { mediaForSlug } from '../lib/exerciseMedia'
import ExerciseLoop from '../components/ExerciseLoop'
import ExerciseAttribution from '../components/ExerciseAttribution'
import Icon from '../components/onboarding/icons/Icon'

const RPE_SCALE = Array.from({ length: 10 }, (_, i) => i + 1)
const MODE_KEY = 'rouxperf-session-mode'

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
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [program, setProgram] = useState(null)
  const [exercisesById, setExercisesById] = useState({})
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState(null)

  const [entries, setEntries] = useState({})
  const [carryoverByExercise, setCarryoverByExercise] = useState({})

  const [mode, setMode] = useState('guided')
  const [phase, setPhase] = useState('launch') // launch | list | exercise | resting | summary
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(null)
  const [activeSetIndex, setActiveSetIndex] = useState(0)
  const [editingDoneSet, setEditingDoneSet] = useState(false)
  const [restRemaining, setRestRemaining] = useState(0)
  const [restNext, setRestNext] = useState('')

  const [weight, setWeight] = useState('')
  const [rpe, setRpe] = useState('')
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [finalPercent, setFinalPercent] = useState(null)

  // Refs pour éviter les closures périmées dans les timers / callbacks async.
  const entriesRef = useRef({})
  const logIdRef = useRef(null)
  const rowIdsRef = useRef({})
  const selectedExRef = useRef(null)
  const wakeLockRef = useRef(null)

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

          let resumed = {}
          if (existingLog && existingLog.workout_log_sets.length > 0) {
            const built = buildFromLoggedSets(theDay, existingLog.workout_log_sets)
            resumed = built.entries
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

          // Mode : dernier choix mémorisé, sinon défaut du compte.
          let chosen = null
          try {
            chosen = localStorage.getItem(MODE_KEY)
          } catch {
            chosen = null
          }
          const resolvedMode = chosen === 'guided' || chosen === 'free' ? chosen : profile?.session_mode ?? 'guided'
          setMode(resolvedMode)

          // Reprise en cours → on rouvre directement sur l'exercice courant.
          const hasProgress = Object.keys(resumed).length > 0
          setStatus('idle')
          if (hasProgress) {
            // openCurrent lit entriesRef (déjà à jour)
            queueMicrotask(() => openCurrent(theDay))
          }
          return
        }
      }

      setStatus('idle')
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, weekNumber, dayNumber])

  // Décompte du repos (mode guidé)
  useEffect(() => {
    if (phase !== 'resting') return undefined
    if (restRemaining <= 0) {
      openCurrent()
      return undefined
    }
    const timer = setTimeout(() => setRestRemaining((r) => r - 1), 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, restRemaining])

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

  function startSession() {
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      // ignore
    }
    if (mode === 'guided') openCurrent()
    else setPhase('list')
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

    // Nouvelle série validée : enchaînement.
    const stillSomething = day.exercises.some((ex, e) => {
      for (let s = 0; s < ex.sets; s += 1) if (!updated[`${e}-${s}`]) return true
      return false
    })

    // Chrono de repos après chaque série validée, dans les deux modes
    // (en Libre, il reste passable via « Passer le repos »).
    if (stillSomething) {
      const rest = exercise.rest_seconds || 0
      if (rest > 0) {
        // Cible affichée pendant le repos
        let label = 'Série suivante'
        outer: for (let e = 0; e < day.exercises.length; e += 1) {
          const ex = day.exercises[e]
          for (let s = 0; s < ex.sets; s += 1) {
            if (!updated[`${e}-${s}`]) {
              const det = exercisesById[ex.exercise_id]
              label = `${det?.name ?? 'Exercice'} · série ${s + 1}`
              break outer
            }
          }
        }
        setRestNext(label)
        setRestRemaining(rest)
        setPhase('resting')
        return
      }
    }
    openCurrent(day)
  }

  function quitSession() {
    // Tout est déjà sauvegardé série par série : on peut sortir sans risque.
    navigate('/program')
  }

  // ---- Écran : lancement ----
  if (phase === 'launch') {
    return (
      <main className="session-run">
        <div className="card session-launch">
          <p className="eyebrow">
            {day.name}
            {slotLabel}
          </p>
          <h1>Prêt pour la séance ?</h1>
          <p className="session-launch-meta">
            {day.exercises.length} exercice{day.exercises.length > 1 ? 's' : ''} · {totalSets} séries
          </p>

          <p className="session-launch-q">Comment veux-tu la vivre ?</p>
          <div className="mode-toggle" role="radiogroup" aria-label="Mode de séance">
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'guided'}
              className={`mode-toggle-option${mode === 'guided' ? ' mode-toggle-option-active' : ''}`}
              onClick={() => setMode('guided')}
            >
              <strong>▶ Guidé</strong>
              <span>Tout s'enchaîne, tu suis.</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'free'}
              className={`mode-toggle-option${mode === 'free' ? ' mode-toggle-option-active' : ''}`}
              onClick={() => setMode('free')}
            >
              <strong>⇄ Libre</strong>
              <span>Tu gères tes exercices.</span>
            </button>
          </div>

          <button type="button" className="btn-primary session-launch-start" onClick={startSession}>
            Commencer
          </button>
          <button type="button" className="link-button" onClick={quitSession}>
            Retour
          </button>
        </div>
      </main>
    )
  }

  // ---- Écran : résumé ----
  if (phase === 'summary') {
    return (
      <main>
        <div className="card session-complete">
          <p className="eyebrow">{finalPercent === 100 ? 'Séance validée' : 'Séance enregistrée'}</p>
          <span className="completion-percent">{overallPercent}%</span>
          <h1>{overallPercent === 100 ? 'Séance complète' : 'À bientôt pour la suite'}</h1>
          <p>
            {overallPercent === 100
              ? 'Tous les exercices sont faits, bien joué.'
              : `${doneSets} série(s) sur ${totalSets} enregistrée(s). Reviens ici pour continuer.`}
          </p>
          <Link to="/program" className="btn-primary">
            Retour au programme
          </Link>
        </div>
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
          <button type="button" className="btn-secondary" onClick={() => openCurrent()}>
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

        {overallPercent === 100 && (
          <button type="button" className="btn-primary session-finish-btn" onClick={() => setPhase('summary')}>
            Voir le résumé
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
            <button type="button" className="btn-primary" onClick={onPrimary}>
              Continuer
            </button>
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
