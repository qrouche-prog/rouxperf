import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Tally from '../components/Tally'

function buildSteps(exercises) {
  return exercises.flatMap((exercise, exerciseIndex) =>
    Array.from({ length: exercise.sets }, (_, setIndex) => ({ exerciseIndex, setIndex }))
  )
}

export default function SessionRunnerPage() {
  const { weekNumber, dayNumber } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [program, setProgram] = useState(null)
  const [exercisesById, setExercisesById] = useState({})
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState(null)

  const [stepIndex, setStepIndex] = useState(0)
  const [entries, setEntries] = useState({})
  const [phase, setPhase] = useState('input')
  const [restRemaining, setRestRemaining] = useState(0)
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [rpe, setRpe] = useState('')
  const [submitStatus, setSubmitStatus] = useState('idle')
  const [submitError, setSubmitError] = useState(null)

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
      setPhase('input')
      setStepIndex((i) => i + 1)
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

  const steps = buildSteps(day.exercises)
  const current = steps[stepIndex]
  const finished = !current

  async function finalizeSession(finalEntries) {
    setSubmitStatus('loading')
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

    const rows = day.exercises.flatMap((exercise, exerciseIndex) =>
      Array.from({ length: exercise.sets }, (_, setIndex) => {
        const entry = finalEntries[`${exerciseIndex}-${setIndex}`] ?? {}
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
    )

    const { error: setsError } = await supabase.from('workout_log_sets').insert(rows)
    setSubmitStatus('idle')

    if (setsError) {
      setSubmitError(setsError.message)
      return
    }

    navigate('/program', { replace: true })
  }

  if (finished) {
    return (
      <main>
        <div className="card session-complete">
          <h1>Séance terminée</h1>
          <p>Enregistrement en cours...</p>
        </div>
      </main>
    )
  }

  const currentExercise = day.exercises[current.exerciseIndex]
  const exerciseDetails = exercisesById[currentExercise.exercise_id]
  const isLastStep = stepIndex === steps.length - 1

  async function handleSetSubmit(e) {
    e.preventDefault()
    setSubmitError(null)

    const key = `${current.exerciseIndex}-${current.setIndex}`
    const newEntries = { ...entries, [key]: { reps, weight_kg: weight, rpe } }
    setEntries(newEntries)
    setReps('')
    setWeight('')
    setRpe('')

    if (isLastStep) {
      await finalizeSession(newEntries)
      return
    }

    const restSeconds = currentExercise.rest_seconds || 0
    if (restSeconds > 0) {
      setRestRemaining(restSeconds)
      setPhase('resting')
    } else {
      setStepIndex((i) => i + 1)
    }
  }

  function skipRest() {
    setPhase('input')
    setStepIndex((i) => i + 1)
  }

  if (phase === 'resting') {
    return (
      <main>
        <div className="card rest-timer">
          <p className="eyebrow">Repos</p>
          <span className="rest-countdown">{restRemaining}s</span>
          <p>Prochaine série : {exerciseDetails?.name ?? 'Exercice'}</p>
          <button type="button" onClick={skipRest}>
            Passer
          </button>
        </div>
      </main>
    )
  }

  return (
    <main>
      <div className="session-runner-header">
        <Link to="/program">Abandonner</Link>
        <span className="eyebrow">
          Série {stepIndex + 1} / {steps.length}
        </span>
      </div>

      <div className="week-progress-bar">
        <div className="week-progress-fill" style={{ width: `${(stepIndex / steps.length) * 100}%` }} />
      </div>

      <div className="card set-input-card">
        <h2>{exerciseDetails?.name ?? 'Exercice'}</h2>
        <p className="eyebrow">
          Série {current.setIndex + 1} / {currentExercise.sets} — cible : {currentExercise.reps}
        </p>
        <Tally count={currentExercise.sets} />

        <form onSubmit={handleSetSubmit}>
          <label htmlFor="reps">Répétitions</label>
          <input id="reps" type="number" value={reps} onChange={(e) => setReps(e.target.value)} required />

          <label htmlFor="weight">Poids (kg)</label>
          <input id="weight" type="number" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} />

          <label htmlFor="rpe">RPE (optionnel)</label>
          <input id="rpe" type="number" step="0.5" min="1" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} />

          {submitError && <p role="alert">{submitError}</p>}

          <button type="submit" disabled={submitStatus === 'loading'}>
            {submitStatus === 'loading' ? 'Enregistrement...' : isLastStep ? 'Terminer la séance' : 'Suivant'}
          </button>
        </form>
      </div>
    </main>
  )
}
