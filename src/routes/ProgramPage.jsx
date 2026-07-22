import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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
      <h1>Ton programme</h1>
      <p>
        Semaine {program.current_week} — <Link to="/dashboard">Tableau de bord</Link> ·{' '}
        <Link to="/progress">Ma progression</Link>
      </p>

      {program.structure.weeks.map((week) => (
        <section key={week.week_number}>
          <h2>Semaine {week.week_number}</h2>
          {week.days.map((day) => (
            <div key={day.day_number}>
              <h3>
                Jour {day.day_number} — {day.name}
              </h3>
              <ul>
                {day.exercises.map((exercise, index) => {
                  const details = exercisesById[exercise.exercise_id]
                  return (
                    <li key={`${day.day_number}-${index}`}>
                      <strong>{details?.name ?? 'Exercice'}</strong> — {exercise.sets} x {exercise.reps}, repos{' '}
                      {exercise.rest_seconds}s
                      {exercise.notes && <p>{exercise.notes}</p>}
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
