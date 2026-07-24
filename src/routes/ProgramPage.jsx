import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Tally from '../components/Tally'
import Icon from '../components/onboarding/icons/Icon'
import BottomNav from '../components/BottomNav'
import TopNav from '../components/TopNav'

const SITUATION_LABELS = {
  pregnant: 'grossesse',
  postpartum: 'post-partum',
  injury_rehab: 'rééducation / blessure en cours',
}

const WEEKDAY_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

function daySlotLabel(day) {
  const weekday = WEEKDAY_FULL[day.day_of_week - 1]
  if (!weekday) return null
  if (day.slot === 'morning') return `${weekday} · matin`
  if (day.slot === 'evening') return `${weekday} · soir`
  return weekday
}

export default function ProgramPage() {
  const { user } = useAuth()
  const [program, setProgram] = useState(null)
  const [specialSituation, setSpecialSituation] = useState(null)
  const [exercisesById, setExercisesById] = useState({})
  const [setsLoggedByDay, setSetsLoggedByDay] = useState({})
  const [setsLoggedByExercise, setSetsLoggedByExercise] = useState({})
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [weekIndex, setWeekIndex] = useState(0)
  const [openDayNumber, setOpenDayNumber] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [{ data: programData, error: programError }, { data: exercises }, { data: trainingProfile }] =
        await Promise.all([
          supabase
            .from('user_programs')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('exercises').select('id, name, instructions'),
          supabase.from('user_training_profile').select('special_situation').eq('user_id', user.id).maybeSingle(),
        ])

      if (cancelled) return

      if (programError) {
        setError(programError.message)
        setStatus('idle')
        return
      }

      setProgram(programData)
      setSpecialSituation(trainingProfile?.special_situation ?? null)
      setExercisesById(Object.fromEntries((exercises ?? []).map((exercise) => [exercise.id, exercise])))

      if (programData?.structure) {
        const totalWeeks = programData.structure.weeks.length
        setWeekIndex(Math.min(Math.max(programData.current_week - 1, 0), totalWeeks - 1))

        const { data: logs } = await supabase
          .from('workout_logs')
          .select('week_number, day_number, performed_at, workout_log_sets(exercise_id)')
          .eq('user_id', user.id)
          .eq('program_id', programData.id)
          .order('performed_at', { ascending: false })

        if (!cancelled) {
          const latestByDay = {}
          const latestByDayExercise = {}
          for (const log of logs ?? []) {
            const key = `${log.week_number}-${log.day_number}`
            if (!(key in latestByDay)) {
              latestByDay[key] = log.workout_log_sets.length
              const perExercise = {}
              for (const set of log.workout_log_sets) {
                perExercise[set.exercise_id] = (perExercise[set.exercise_id] ?? 0) + 1
              }
              latestByDayExercise[key] = perExercise
            }
          }
          setSetsLoggedByDay(latestByDay)
          setSetsLoggedByExercise(latestByDayExercise)
        }
      }

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
        <TopNav />
        <p role="alert">{error}</p>
      </main>
    )
  }

  if (program?.status === 'pending_approval') {
    return (
      <main>
        <TopNav />
        <p>Ta demande de génération a bien été reçue et est en attente de validation par l'équipe rouXperf.</p>
        <Link to="/dashboard">Retour au tableau de bord</Link>
      </main>
    )
  }

  if (program?.status === 'generating') {
    return (
      <main>
        <TopNav />
        <p>Ton programme est en cours de génération — ça prend généralement moins d'une minute.</p>
        <Link to="/dashboard">Retour au tableau de bord</Link>
      </main>
    )
  }

  if (program?.status === 'failed') {
    return (
      <main>
        <TopNav />
        <p role="alert">
          La génération de ton programme a échoué{program.error_message ? ` : ${program.error_message}` : '.'}
        </p>
        <Link to="/dashboard">Retour au tableau de bord</Link>
      </main>
    )
  }

  if (!program?.structure) {
    return (
      <main>
        <TopNav />
        <p>Aucun programme actif pour l'instant.</p>
        <Link to="/dashboard">Retour au tableau de bord</Link>
      </main>
    )
  }

  const weeks = program.structure.weeks
  const week = weeks[weekIndex]
  const slotRank = (slot) => (slot === 'morning' ? 0 : slot === 'evening' ? 1 : 0)
  const days = [...week.days].sort(
    (a, b) => (a.day_of_week ?? 0) - (b.day_of_week ?? 0) || slotRank(a.slot) - slotRank(b.slot)
  )

  function sessionPercent(day) {
    const totalSets = day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
    const loggedSets = setsLoggedByDay[`${week.week_number}-${day.day_number}`] ?? 0
    return totalSets > 0 ? Math.min(100, Math.round((loggedSets / totalSets) * 100)) : 0
  }

  const doneCount = days.filter((d) => sessionPercent(d) === 100).length

  function goWeek(offset) {
    const next = weekIndex + offset
    if (next < 0 || next >= weeks.length) return
    setWeekIndex(next)
    setOpenDayNumber(null)
  }

  return (
    <main>
      <TopNav />
      <h1>Ton programme</h1>

      {SITUATION_LABELS[specialSituation] && (
        <p className="situation-disclaimer">
          Programme adapté à ta situation ({SITUATION_LABELS[specialSituation]}) — ça reste une proposition
          automatisée à titre indicatif, pas un avis médical. Consulte un professionnel de santé en cas de doute.
        </p>
      )}

      <div className="week-nav">
        <button type="button" className="nav-arrow" onClick={() => goWeek(-1)} disabled={weekIndex === 0}>
          ‹
        </button>
        <div className="week-nav-label">
          <h2>Semaine {week.week_number}</h2>
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

      <div className="week-progress-bar">
        <div className="week-progress-fill" style={{ width: `${(doneCount / days.length) * 100}%` }} />
      </div>
      <p className="eyebrow week-progress-label">
        {doneCount} / {days.length} séances complétées
      </p>

      <div className="session-list">
        {days.map((day) => {
          const percent = sessionPercent(day)
          const isDone = percent === 100
          const isStarted = percent > 0
          const isOpen = openDayNumber === day.day_number
          return (
            <div key={day.day_number} className="session-card">
              <div className="session-card-row">
                <span className={`session-status-badge${isDone ? ' session-status-done' : ''}`}>
                  <Icon name={isDone ? 'check' : 'bolt'} size={18} />
                </span>
                <span className="session-card-title">
                  {daySlotLabel(day) && <span className="eyebrow">{daySlotLabel(day)}</span>}
                  <strong>{day.name}</strong>
                  <span className="eyebrow">
                    {isDone ? 'Terminé — 100%' : isStarted ? `${percent}% réalisé` : 'Non commencé'}
                  </span>
                </span>
              </div>

              <Link to={`/session/${week.week_number}/${day.day_number}`} className="btn-primary session-start-btn">
                {isDone ? 'Refaire' : isStarted ? 'Continuer' : 'Commencer'}
              </Link>

              <button
                type="button"
                className="session-toggle"
                onClick={() => setOpenDayNumber(isOpen ? null : day.day_number)}
              >
                {isOpen ? 'Masquer les exercices ︿' : 'Voir les exercices ﹀'}
              </button>

              <div className="session-progress-bar">
                <div
                  className={`session-progress-fill${isDone ? ' session-progress-fill-done' : ''}`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              {isOpen && (
                <ul className="exercise-list">
                  {day.exercises.map((exercise, index) => {
                    const details = exercisesById[exercise.exercise_id]
                    const loggedForExercise =
                      setsLoggedByExercise[`${week.week_number}-${day.day_number}`]?.[exercise.exercise_id] ?? 0
                    const exercisePercent =
                      exercise.sets > 0 ? Math.min(100, Math.round((loggedForExercise / exercise.sets) * 100)) : 0
                    const exerciseDone = exercisePercent === 100
                    return (
                      <li key={`${day.day_number}-${index}`} className="exercise-row">
                        <div className="exercise-row-header">
                          <strong>{details?.name ?? 'Exercice'}</strong>
                          <Tally count={exercise.sets} />
                        </div>
                        <p className="exercise-meta">
                          {exercise.reps} reps · repos {exercise.rest_seconds}s
                        </p>
                        <div className="exercise-progress-row">
                          <div className="exercise-progress-bar">
                            <div
                              className={`exercise-progress-fill${exerciseDone ? ' exercise-progress-fill-done' : ''}`}
                              style={{ width: `${exercisePercent}%` }}
                            />
                          </div>
                          <span className="eyebrow exercise-progress-label">
                            {loggedForExercise} / {exercise.sets} séries
                            {exercisePercent > 0 && ` — ${exercisePercent}%`}
                          </span>
                        </div>
                        {exercise.notes && <p className="exercise-notes">{exercise.notes}</p>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
