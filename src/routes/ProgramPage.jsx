import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { withResolvedDayOfWeek, withStableDayNumbers, programSchedule } from '../lib/programDays'
import BottomNav from '../components/BottomNav'
import TopNav from '../components/TopNav'
import ExerciseAlternatives from '../components/ExerciseAlternatives'
import { groupDayExercises, blockLabel } from '../lib/workoutBlocks'

const SITUATION_LABELS = {
  pregnant: 'grossesse',
  postpartum: 'post-partum',
  injury_rehab: 'rééducation / blessure en cours',
}

const WEEKDAY_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

function mondayOf(dateLike) {
  const d = new Date(dateLike)
  const iso = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (iso - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function dayLabel(day, date) {
  const weekday = WEEKDAY_FULL[day.day_of_week - 1]
  if (!weekday) return `Séance ${day.day_number}`
  const base = date ? `${weekday} ${date.getDate()}` : weekday
  if (day.slot === 'morning') return `${base} · matin`
  if (day.slot === 'evening') return `${base} · soir`
  return base
}

export default function ProgramPage() {
  const { user } = useAuth()
  const [program, setProgram] = useState(null)
  const [specialSituation, setSpecialSituation] = useState(null)
  const [preferredDays, setPreferredDays] = useState([])
  const [setsLoggedByDay, setSetsLoggedByDay] = useState({})
  const [exercisesById, setExercisesById] = useState({})
  const [equipmentAccess, setEquipmentAccess] = useState('bodyweight')
  const [expandedDay, setExpandedDay] = useState(null)
  const [swapping, setSwapping] = useState(false)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [weekIndex, setWeekIndex] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [{ data: programData, error: programError }, { data: trainingProfile }, { data: exercises }] =
        await Promise.all([
          supabase
            .from('user_programs')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('user_training_profile')
            .select('special_situation, preferred_days, equipment_access')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase.from('exercises').select('id, name, category, muscle_group, equipment_required, is_ai_generated'),
        ])

      if (cancelled) return

      if (programError) {
        setError(programError.message)
        setStatus('idle')
        return
      }

      setProgram(programData)
      setSpecialSituation(trainingProfile?.special_situation ?? null)
      setPreferredDays(trainingProfile?.preferred_days ?? [])
      setEquipmentAccess(trainingProfile?.equipment_access ?? 'bodyweight')
      setExercisesById(Object.fromEntries((exercises ?? []).map((e) => [e.id, e])))

      if (programData?.structure) {
        const totalWeeks = programData.structure.weeks.length
        const sched = programSchedule(programData)
        setWeekIndex(Math.min(Math.max((sched?.currentWeek ?? 1) - 1, 0), totalWeeks - 1))

        const { data: logs } = await supabase
          .from('workout_logs')
          .select('week_number, day_number, performed_at, workout_log_sets(exercise_id)')
          .eq('user_id', user.id)
          .eq('program_id', programData.id)
          .order('performed_at', { ascending: false })

        if (!cancelled) {
          const latestByDay = {}
          for (const log of logs ?? []) {
            const key = `${log.week_number}-${log.day_number}`
            if (!(key in latestByDay)) {
              latestByDay[key] = log.workout_log_sets.length
            }
          }
          setSetsLoggedByDay(latestByDay)
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
  const schedule = programSchedule(program)
  const expired = schedule?.expired
  const week1Monday = mondayOf(program.created_at)
  const slotRank = (slot) => (slot === 'morning' ? 0 : slot === 'evening' ? 1 : 0)
  const days = withStableDayNumbers(withResolvedDayOfWeek(week.days, preferredDays))
    .slice()
    .sort((a, b) => (a.day_of_week ?? 0) - (b.day_of_week ?? 0) || slotRank(a.slot) - slotRank(b.slot))

  function dayDate(day) {
    if (!Number.isInteger(day.day_of_week)) return null
    const d = new Date(week1Monday)
    d.setDate(week1Monday.getDate() + (week.week_number - 1) * 7 + (day.day_of_week - 1))
    return d
  }

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
  }

  // Remplace un exercice partout dans le programme et persiste (Premium).
  async function swapExercise(oldId, newId) {
    if (!oldId || !program?.structure || swapping) return
    setSwapping(true)
    const next = JSON.parse(JSON.stringify(program.structure))
    for (const wk of next.weeks) {
      for (const d of wk.days) {
        for (const ex of d.exercises) {
          if (ex.exercise_id === oldId) ex.exercise_id = newId
        }
      }
    }
    const { error: upErr } = await supabase.from('user_programs').update({ structure: next }).eq('id', program.id)
    setSwapping(false)
    if (upErr) return
    setProgram((p) => ({ ...p, structure: next }))
    setAltsKey(null)
  }

  return (
    <main>
      <TopNav />
      <h1>Ton programme</h1>

      {expired && (
        <p className="situation-disclaimer">
          Ce programme est arrivé à échéance et n'est plus disponible. Retourne au{' '}
          <Link to="/dashboard">tableau de bord</Link> pour générer un nouveau programme.
        </p>
      )}

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

      <div className="card preview-card">
        <div className="preview-card-header">
          <span className="eyebrow">Semaine {week.week_number}</span>
          <span className="eyebrow">{doneCount} / {days.length} séances</span>
        </div>
        {days.map((day) => {
          const percent = sessionPercent(day)
          const isDone = percent === 100
          const isStarted = percent > 0
          const totalSets = day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
          const inner = (
            <>
              <span className="preview-day">{dayLabel(day, dayDate(day))}</span>
              <strong className="preview-row-name">{day.name}</strong>
              <span className="preview-row-foot">
                <span className="preview-row-meta">
                  {day.exercises.length} exercice{day.exercises.length > 1 ? 's' : ''} · {totalSets} série
                  {totalSets > 1 ? 's' : ''}
                </span>
                <span className={`badge${isDone ? ' badge-high' : isStarted ? ' badge-mid' : ''}`}>
                  {expired ? 'Indisponible' : isDone ? 'Terminée' : isStarted ? `${percent}%` : 'À faire'}
                </span>
              </span>
            </>
          )
          const dayKey = `${week.week_number}-${day.day_number}`
          return (
            <div key={day.day_number} className="program-day">
              {expired ? (
                <div className="preview-row preview-row-stacked preview-row-disabled">{inner}</div>
              ) : (
                <Link to={`/session/${week.week_number}/${day.day_number}`} className="preview-row preview-row-stacked">
                  {inner}
                </Link>
              )}
              {!expired && (
                <button
                  type="button"
                  className="program-day-expand"
                  onClick={() => setExpandedDay(expandedDay === dayKey ? null : dayKey)}
                >
                  {expandedDay === dayKey ? 'Masquer les exercices' : 'Voir / adapter les exercices'}
                </button>
              )}
              {expandedDay === dayKey && (
                <ul className="program-exos">
                  {groupDayExercises(day.exercises).map((item) => {
                    if (item.type === 'block') {
                      const first = day.exercises[item.index]
                      return (
                        <li key={item.index} className="program-exo">
                          <div className="program-exo-head">
                            <span className="program-exo-name">{blockLabel(first)}</span>
                          </div>
                          <p className="eyebrow">
                            {item.members
                              .map(({ exercise: e }) => exercisesById[e.exercise_id]?.name ?? 'Exercice')
                              .join(' · ')}
                          </p>
                        </li>
                      )
                    }
                    const i = item.index
                    const ex = day.exercises[i]
                    const det = exercisesById[ex.exercise_id]
                    return (
                      <li key={i} className="program-exo">
                        <div className="program-exo-head">
                          <span className="program-exo-name">{det?.name ?? 'Exercice'}</span>
                        </div>
                        <ExerciseAlternatives
                          exercisesById={exercisesById}
                          details={det}
                          equipmentAccess={equipmentAccess}
                          swapping={swapping}
                          onSwap={(newId) => swapExercise(det.id, newId)}
                        />
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
