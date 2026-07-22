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

  return (
    <main>
      <nav className="crumbs">
        <Link to="/dashboard">Tableau de bord</Link> · <Link to="/progress">Ma progression</Link>
      </nav>
      <h1>Ton programme</h1>
      <p className="eyebrow">Semaine {program.current_week}</p>

      {program.structure.weeks.map((week) => (
        <section key={week.week_number} className="card">
          <h2>Semaine {week.week_number}</h2>
          {week.days.map((day) => (
            <div key={day.day_number} className="program-day">
              <h3>
                Jour {day.day_number} — {day.name}
              </h3>
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
          ))}
        </section>
      ))}
    </main>
  )
}
