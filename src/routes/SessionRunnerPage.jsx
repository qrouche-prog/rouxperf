import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Tally from '../components/Tally'
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

function buildEntriesFromLoggedSets(day, loggedSets) {
  const entries = {}
  for (const set of loggedSets) {
    const setIndex = set.set_number - 1
    const exerciseIndex = day.exercises.findIndex(
      (exercise, i) => exercise.exercise_id === set.exercise_id && !entries[`${i}-${setIndex}`]
    )
    if (exerciseIndex !== -1) {
      entries[`${exerciseIndex}-${setIndex}`] = {
        reps: set.reps ?? '',
        weight_kg: set.weight_kg ?? '',
        rpe: set.rpe ?? '',
      }
    }
  }
  return entries
}

export default function SessionRunnerPage() {
  const { weekNumber, dayNumber } = useParams()
  const { user } = useAuth()

  const [program, setProgram] = useState(null)
  const [exercisesById, setExercisesById] = useState({})
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState(null)

  const [entries, setEntries] = useState({})
  const [persistedKeys, setPersistedKeys] = useState(new Set())
  const [resumeLogId, setResumeLogId] = useState(null)
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(null)
  const [phase, setPhase] = useState('hub')
  const [restRemaining, setRestRemaining] = useState(0)
  const [weight, setWeight] = useState('')
  const [rpe, setRpe] = useState('')
  const [submitStatus, setSubmitStatus] = useState('idle')
  const [submitError, setSubmitError] = useState(null)
  const [finalPercent, setFinalPercent] = useState(null)

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
        supabase.from('exercises').select('id, name'),
      ])
      if (error) {
        setLoadError(error.message)
        setStatus('idle')
        return
      }
      setProgram(programData)
      setExercisesById(Object.fromEntries((exercises ?? []).map((exercise) => [exercise.id, exercise])))

      if (programData) {
        const week = programData.structure.weeks.find((w) => w.week_number === Number(weekNumber))
        const day = week?.days.find((d) => d.day_number === Number(dayNumber))

        if (day) {
          const { data: existingLog } = await supabase
            .from('workout_logs')
            .select('id, performed_at, workout_log_sets(exercise_id, set_number, reps, weight_kg, rpe)')
            .eq('user_id', user.id)
            .eq('program_id', programData.id)
            .eq('week_number', Number(weekNumber))
            .eq('day_number', Number(dayNumber))
            .order('performed_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (existingLog) {
            const totalSets = day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
            const loggedCount = existingLog.workout_log_sets.length
            if (loggedCount > 0 && loggedCount < totalSets) {
              const resumedEntries = buildEntriesFromLoggedSets(day, existingLog.workout_log_sets)
              setEntries(resumedEntries)
              setPersistedKeys(new Set(Object.keys(resumedEntries)))
              setResumeLogId(existingLog.id)
            }
          }
        }
      }

      setStatus('idle')
    }
    load()
  }, [user.id, weekNumber, dayNumber])

  useEffect(() => {
    if (phase !== 'resting') return undefined
    if (restRemaining <= 0) {
      setPhase('exercise')
      return undefined
    }
    const timer = setTimeout(() => setRestRemaining((r) => r - 1), 1000)
    return () => clearTimeout(timer)
  }, [phase, restRemaining])

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

  const week = program.structure.weeks.find((w) => w.week_number === Number(weekNumber))
  const day = week?.days.find((d) => d.day_number === Number(dayNumber))

  if (!day) {
    return (
      <main>
        <p>Séance introuvable.</p>
        <Link to="/program">Retour au programme</Link>
      </main>
    )
  }

  const totalSets = day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
  const doneSets = day.exercises.reduce((sum, exercise, i) => sum + countCompleted(entries, i, exercise.sets), 0)
  const overallPercent = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0
  const allDone = doneSets === totalSets

  async function finalizeSession() {
    setSubmitStatus('loading')
    setSubmitError(null)

    let logId = resumeLogId
    if (!logId) {
      const { data: workoutLog, error: logError } = await supabase
        .from('workout_logs')
        .insert({
          user_id: user.id,
          program_id: program.id,
          week_number: Number(weekNumber),
          day_number: Number(dayNumber),
        })
        .select()
        .single()

      if (logError) {
        setSubmitStatus('idle')
        setSubmitError(logError.message)
        return
      }
      logId = workoutLog.id
    }

    const rows = Object.entries(entries)
      .filter(([key]) => !persistedKeys.has(key))
      .map(([key, entry]) => {
        const [exerciseIndex, setIndex] = key.split('-').map(Number)
        const exercise = day.exercises[exerciseIndex]
        return {
          workout_log_id: logId,
          user_id: user.id,
          exercise_id: exercise.exercise_id,
          set_number: setIndex + 1,
          reps: entry.reps ? Number(entry.reps) : null,
          weight_kg: entry.weight_kg ? Number(entry.weight_kg) : null,
          rpe: entry.rpe ? Number(entry.rpe) : null,
        }
      })

    if (rows.length > 0) {
      const { error: setsError } = await supabase.from('workout_log_sets').insert(rows)
      if (setsError) {
        setSubmitStatus('idle')
        setSubmitError(setsError.message)
        return
      }
    }

    setSubmitStatus('idle')
    setFinalPercent(overallPercent)
    setPhase('summary')
  }

  if (phase === 'summary') {
    return (
      <main>
        <div className="card session-complete">
          <p className="eyebrow">{finalPercent === 100 ? 'Séance validée' : 'Séance enregistrée'}</p>
          <span className="completion-percent">{finalPercent}%</span>
          <h1>{finalPercent === 100 ? 'Séance complète' : 'À bientôt pour la suite'}</h1>
          <p>
            {finalPercent === 100
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

  if (phase === 'resting') {
    const exercise = day.exercises[selectedExerciseIndex]
    const details = exercisesById[exercise.exercise_id]
    return (
      <main>
        <div className="card rest-timer">
          <p className="eyebrow">Repos</p>
          <span className="rest-countdown">{restRemaining}s</span>
          <p>Prochaine série : {details?.name ?? 'Exercice'}</p>
          <button type="button" onClick={() => setPhase('exercise')}>
            Passer
          </button>
        </div>
      </main>
    )
  }

  if (phase === 'exercise' && selectedExerciseIndex !== null) {
    const exercise = day.exercises[selectedExerciseIndex]
    const details = exercisesById[exercise.exercise_id]
    const completed = countCompleted(entries, selectedExerciseIndex, exercise.sets)
    const setIndexToFill = completed < exercise.sets ? completed : 0
    const isLastSetOfExercise = setIndexToFill === exercise.sets - 1

    function handleSetSubmit(e) {
      e.preventDefault()
      const key = `${selectedExerciseIndex}-${setIndexToFill}`
      const targetReps = parseTargetReps(exercise.reps)
      setEntries((current) => ({ ...current, [key]: { reps: targetReps, weight_kg: weight, rpe } }))
      setWeight('')
      setRpe('')

      if (isLastSetOfExercise) {
        setPhase('hub')
        setSelectedExerciseIndex(null)
        return
      }

      const restSeconds = exercise.rest_seconds || 0
      if (restSeconds > 0) {
        setRestRemaining(restSeconds)
        setPhase('resting')
      }
    }

    return (
      <main>
        <div className="session-runner-header">
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setPhase('hub')
              setSelectedExerciseIndex(null)
            }}
          >
            ‹ Exercices
          </button>
          <span className="eyebrow">
            {completed} / {exercise.sets} séries
          </span>
        </div>

        <div className="card set-input-card">
          <h2>{details?.name ?? 'Exercice'}</h2>
          <p className="eyebrow">
            Série {setIndexToFill + 1} / {exercise.sets} — cible : {exercise.reps}
          </p>
          <Tally count={exercise.sets} />

          {completed > 0 && (
            <ul className="completed-sets-list">
              {Array.from({ length: completed }).map((_, i) => {
                const done = entries[`${selectedExerciseIndex}-${i}`]
                return (
                  <li key={i}>
                    <span className="eyebrow">Série {i + 1}</span>
                    <span>
                      {done.reps || '—'} reps · {done.weight_kg || '—'} kg · RPE {done.rpe || '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          <form onSubmit={handleSetSubmit}>
            <label htmlFor="weight">Poids (kg)</label>
            <input
              id="weight"
              type="number"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
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

            <button type="submit">{isLastSetOfExercise ? "Terminer l'exercice" : 'Suivant'}</button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main>
      <div className="session-runner-header">
        <Link to="/program">‹ Programme</Link>
        <span className="eyebrow">{day.name}</span>
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
              onClick={() => {
                setSelectedExerciseIndex(i)
                setPhase('exercise')
              }}
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

      {submitError && <p role="alert">{submitError}</p>}

      <button
        type="button"
        className="btn-primary session-finish-btn"
        onClick={finalizeSession}
        disabled={submitStatus === 'loading' || doneSets === 0}
      >
        {submitStatus === 'loading' ? 'Enregistrement...' : allDone ? 'Valider la séance' : `Terminer la séance (${overallPercent}%)`}
      </button>
    </main>
  )
}
