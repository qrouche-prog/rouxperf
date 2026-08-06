import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { withResolvedDayOfWeek, withStableDayNumbers } from '../lib/programDays'
import BottomNav from '../components/BottomNav'
import TopNav from '../components/TopNav'

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
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [weekIndex, setWeekIndex] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [{ data: programData, error: programError }, { data: trainingProfile }] = await Promise.all([
        supabase
          .from('user_programs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('user_training_profile')
          .select('special_situation, preferred_days')
          .eq('user_id', user.id)
          .maybeSingle(),
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
          return (
            <Link
              key={day.day_number}
              to={`/session/${week.week_number}/${day.day_number}`}
              className="preview-row preview-row-stacked"
            >
              <span className="preview-day">{dayLabel(day, dayDate(day))}</span>
              <strong className="preview-row-name">{day.name}</strong>
              <span className="preview-row-foot">
                <span className="preview-row-meta">
                  {day.exercises.length} exercice{day.exercises.length > 1 ? 's' : ''} · {totalSets} série
                  {totalSets > 1 ? 's' : ''}
                </span>
                <span className={`badge${isDone ? ' badge-high' : isStarted ? ' badge-mid' : ''}`}>
                  {isDone ? 'Terminée' : isStarted ? `${percent}%` : 'À faire'}
                </span>
              </span>
            </Link>
          )
        })}
      </div>

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
