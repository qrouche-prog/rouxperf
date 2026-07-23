import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Tally from '../components/Tally'

export default function ProgramPage() {
  const { user } = useAuth()
  const [program, setProgram] = useState(null)
  const [exercisesById, setExercisesById] = useState({})
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [weekIndex, setWeekIndex] = useState(0)
  const [dayIndex, setDayIndex] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [{ data: programData, error: programError }, { data: exercises }] = await Promise.all([
        supabase
          .from('user_programs')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('exercises').select('id, name, instructions'),
      ])

      if (cancelled) return

      if (programError) {
        setError(programError.message)
        setStatus('idle')
        return
      }

      setProgram(programData)
      if (programData) {
        const totalWeeks = programData.structure.weeks.length
        setWeekIndex(Math.min(Math.max(programData.current_week - 1, 0), totalWeeks - 1))
      }
      setExercisesById(Object.fromEntries((exercises ?? []).map((exercise) => [exercise.id, exercise])))
      setStatus('idle')
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user.id])

  if (status === 'loading') return null

  if (error) {
    return (
      <main>
        <p role="alert">{error}</p>
      </main>
    )
  }

  if (!program) {
    return (
      <main>
        <p>Aucun programme actif pour l'instant.</p>
        <Link to="/dashboard">Retour au tableau de bord</Link>
      </main>
    )
  }

  const weeks = program.structure.weeks
  const week = weeks[weekIndex]
  const days = week.days
  const day = days[dayIndex]

  function goWeek(offset) {
    const next = weekIndex + offset
    if (next < 0 || next >= weeks.length) return
    setWeekIndex(next)
    setDayIndex(0)
  }

  function goDay(offset) {
    const next = dayIndex + offset
    if (next < 0 || next >= days.length) return
    setDayIndex(next)
  }

  return (
    <main>
      <nav className="crumbs">
        <Link to="/dashboard">Tableau de bord</Link> · <Link to="/progress">Ma progression</Link>
      </nav>
      <h1>Ton programme</h1>

      <div className="week-nav">
        <button type="button" className="nav-arrow" onClick={() => goWeek(-1)} disabled={weekIndex === 0}>
          ‹
        </button>
        <div className="week-nav-label">
          <h2>Semaine {week.week_number}</h2>
          <span className="eyebrow">/ {weeks.length}</span>
        </div>
        <button
          type="button"
          className="nav-arrow"
          onClick={() => goWeek(1)}
          disabled={weekIndex === weeks.length - 1}
        >
          ›
        </button>
      </div>

      <div className="card">
        <div className="day-nav">
          <button type="button" className="nav-arrow" onClick={() => goDay(-1)} disabled={dayIndex === 0}>
            ‹
          </button>
          <div className="day-nav-label">
            <h3>
              Jour {day.day_number} — {day.name}
            </h3>
            <span className="eyebrow">
              Séance {dayIndex + 1} / {days.length}
            </span>
          </div>
          <button
            type="button"
            className="nav-arrow"
            onClick={() => goDay(1)}
            disabled={dayIndex === days.length - 1}
          >
            ›
          </button>
        </div>

        <div className="day-dots">
          {days.map((d, i) => (
            <button
              key={d.day_number}
              type="button"
              className={`day-dot${i === dayIndex ? ' day-dot-active' : ''}`}
              onClick={() => setDayIndex(i)}
              aria-label={`Jour ${d.day_number}`}
              aria-current={i === dayIndex}
            />
          ))}
        </div>

        <ul className="exercise-list">
          {day.exercises.map((exercise, index) => {
            const details = exercisesById[exercise.exercise_id]
            return (
              <li key={`${day.day_number}-${index}`} className="exercise-row">
                <div className="exercise-row-header">
                  <strong>{details?.name ?? 'Exercice'}</strong>
                  <Tally count={exercise.sets} />
                </div>
                <p className="exercise-meta">
                  {exercise.reps} reps · repos {exercise.rest_seconds}s
                </p>
                {exercise.notes && <p className="exercise-notes">{exercise.notes}</p>}
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
