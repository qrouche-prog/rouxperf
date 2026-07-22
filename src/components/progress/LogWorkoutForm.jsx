import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

function buildInitialSets(day) {
  return day.exercises.map((exercise) =>
    Array.from({ length: exercise.sets }, () => ({ reps: '', weight_kg: '', rpe: '' }))
  )
}

export default function LogWorkoutForm({ program, exercisesById, onLogged }) {
  const { user } = useAuth()
  const currentWeek = program.structure.weeks.find((week) => week.week_number === program.current_week)
  const days = currentWeek?.days ?? []

  const [dayNumber, setDayNumber] = useState(days[0]?.day_number ?? null)
  const selectedDay = days.find((day) => day.day_number === dayNumber)
  const [sets, setSets] = useState(selectedDay ? buildInitialSets(selectedDay) : [])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (selectedDay) setSets(buildInitialSets(selectedDay))
  }, [dayNumber])

  if (!selectedDay) {
    return <p>Aucun jour disponible pour la semaine en cours.</p>
  }

  function updateSet(exerciseIndex, setIndex, field, value) {
    setSets((current) =>
      current.map((exerciseSets, i) =>
        i === exerciseIndex
          ? exerciseSets.map((set, j) => (j === setIndex ? { ...set, [field]: value } : set))
          : exerciseSets
      )
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setStatus('loading')

    const { data: workoutLog, error: logError } = await supabase
      .from('workout_logs')
      .insert({
        user_id: user.id,
        program_id: program.id,
        week_number: program.current_week,
        day_number: selectedDay.day_number,
      })
      .select()
      .single()

    if (logError) {
      setStatus('idle')
      setError(logError.message)
      return
    }

    const rows = selectedDay.exercises.flatMap((exercise, exerciseIndex) =>
      sets[exerciseIndex].map((set, setIndex) => ({
        workout_log_id: workoutLog.id,
        user_id: user.id,
        exercise_id: exercise.exercise_id,
        set_number: setIndex + 1,
        reps: set.reps ? Number(set.reps) : null,
        weight_kg: set.weight_kg ? Number(set.weight_kg) : null,
        rpe: set.rpe ? Number(set.rpe) : null,
      }))
    )

    const { error: setsError } = await supabase.from('workout_log_sets').insert(rows)
    setStatus('idle')

    if (setsError) {
      setError(setsError.message)
      return
    }

    onLogged()
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>Logger une séance</h3>

      <label htmlFor="dayNumber">Jour</label>
      <select id="dayNumber" value={dayNumber ?? ''} onChange={(e) => setDayNumber(Number(e.target.value))}>
        {days.map((day) => (
          <option key={day.day_number} value={day.day_number}>
            Jour {day.day_number} — {day.name}
          </option>
        ))}
      </select>

      {selectedDay.exercises.map((exercise, exerciseIndex) => (
        <fieldset key={exercise.exercise_id}>
          <legend>{exercisesById[exercise.exercise_id]?.name ?? 'Exercice'}</legend>
          {sets[exerciseIndex]?.map((set, setIndex) => (
            <div key={setIndex} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>Série {setIndex + 1}</span>
              <input
                type="number"
                placeholder="reps"
                value={set.reps}
                onChange={(e) => updateSet(exerciseIndex, setIndex, 'reps', e.target.value)}
                style={{ width: 70 }}
              />
              <input
                type="number"
                step="0.5"
                placeholder="kg"
                value={set.weight_kg}
                onChange={(e) => updateSet(exerciseIndex, setIndex, 'weight_kg', e.target.value)}
                style={{ width: 70 }}
              />
              <input
                type="number"
                step="0.5"
                min="1"
                max="10"
                placeholder="RPE"
                value={set.rpe}
                onChange={(e) => updateSet(exerciseIndex, setIndex, 'rpe', e.target.value)}
                style={{ width: 70 }}
              />
            </div>
          ))}
        </fieldset>
      ))}

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Enregistrement...' : 'Enregistrer la séance'}
      </button>
    </form>
  )
}
