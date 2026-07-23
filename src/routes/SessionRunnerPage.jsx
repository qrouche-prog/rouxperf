import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Tally from '../components/Tally'
import Icon from '../components/onboarding/icons/Icon'

function countCompleted(entries, exerciseIndex, totalSets) {
  let n = 0
  for (let i = 0; i < totalSets; i += 1) {
    if (entries[`${exerciseIndex}-${i}`]) n += 1
  }
  return n
}

export default function SessionRunnerPage() {
  const { weekNumber, dayNumber } = useParams()
  const { user } = useAuth()

  const [program, setProgram] = useState(null)
  const [exercisesById, setExercisesById] = useState({})
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState(null)

  const [entries, setEntries] = useState({})
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(null)
  const [phase, setPhase] = useState('hub')
  const [restRemaining, setRestRemaining] = useState(0)
  const [reps, setReps] = useState('')
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
      setStatus('idle')
    }
    load()
  }, [user.id])

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

    const rows = Object.entries(entries).map(([key, entry]) => {
      const [exerciseIndex, setIndex] = key.split('-').map(Number)
      const exercise = day.exercises[exerciseIndex]
      return {
        workout_log_id: workoutLog.id,
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
              : `${doneSets} série(s) sur ${totalSets} enregistrée(s).`}
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
      setEntries((current) => ({ ...current, [key]: { reps, weight_kg: weight, rpe } }))
      setReps('')
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

          <form onSubmit={handleSetSubmit}>
            <label htmlFor="reps">Répétitions</label>
            <input id="reps" type="number" value={reps} onChange={(e) => setReps(e.target.value)} required />

            <label htmlFor="weight">Poids (kg)</label>
            <input
              id="weight"
              type="number"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />

            <label htmlFor="rpe">RPE (optionnel)</label>
            <input
              id="rpe"
              type="number"
              step="0.5"
              min="1"
              max="10"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
            />

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
