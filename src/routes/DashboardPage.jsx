import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/onboarding/icons/Icon'
import BottomNav from '../components/BottomNav'
import TopNav from '../components/TopNav'

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const GOAL_LABELS = {
  weight_loss: 'Perte de poids',
  muscle_gain: 'Prise de muscle',
  strength: 'Force',
  endurance: 'Endurance',
  general_fitness: 'Forme générale',
  recomposition: 'Recomposition corporelle',
}

function isoWeekday(date) {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getCurrentWeekDates() {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (isoWeekday(today) - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const [greeting, setGreeting] = useState('')
  const [program, setProgram] = useState(null)
  const [trainingProfile, setTrainingProfile] = useState(null)
  const [goal, setGoal] = useState(null)
  const [sessionCount, setSessionCount] = useState(null)
  const [latestWeight, setLatestWeight] = useState(null)
  const [setsLoggedByDay, setSetsLoggedByDay] = useState({})
  const [status, setStatus] = useState('loading')
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  useEffect(() => {
    async function load() {
      const [{ data: programData }, { data: profileData }, { data: goalData }, { count }, { data: measurement }] =
        await Promise.all([
          supabase
            .from('user_programs')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('user_training_profile').select('*').eq('user_id', user.id).maybeSingle(),
          supabase
            .from('goals')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase
            .from('body_measurements')
            .select('weight_kg')
            .eq('user_id', user.id)
            .order('measured_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

      setProgram(programData)
      setTrainingProfile(profileData)
      setGoal(goalData)
      setSessionCount(count ?? 0)
      setLatestWeight(measurement?.weight_kg ?? null)

      if (programData) {
        const { data: logs } = await supabase
          .from('workout_logs')
          .select('week_number, day_number, performed_at, workout_log_sets(exercise_id)')
          .eq('user_id', user.id)
          .eq('program_id', programData.id)
          .order('performed_at', { ascending: false })

        const latestByDay = {}
        for (const log of logs ?? []) {
          const key = `${log.week_number}-${log.day_number}`
          if (!(key in latestByDay)) {
            latestByDay[key] = log.workout_log_sets.length
          }
        }
        setSetsLoggedByDay(latestByDay)
      }

      setStatus('idle')
    }
    load()
  }, [user.id])

  useEffect(() => {
    if (!user) return
    const key = `rouxperf-welcomed-${user.id}`
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1')
      setGreeting('Bienvenue')
    } else {
      setGreeting(Math.random() < 0.5 ? 'Bonjour' : 'Content de te revoir')
    }
  }, [user])

  if (status === 'loading') return null

  const firstName = profile?.full_name?.trim().split(' ')[0] || null

  const totalWeeks = program?.structure?.weeks?.length ?? null
  const weekDates = getCurrentWeekDates()
  const today = new Date()
  const todayIso = isoWeekday(today)
  const preferredDays = trainingProfile?.preferred_days ?? []
  const sortedPreferred = [...preferredDays].sort((a, b) => a - b)
  const currentWeekData = program?.structure?.weeks?.find((w) => w.week_number === program.current_week)

  const selectedIso = isoWeekday(selectedDate)
  const selectedOccurrenceIndex = sortedPreferred.indexOf(selectedIso)
  const isSelectedTrainingDay = selectedOccurrenceIndex !== -1
  const selectedSession = isSelectedTrainingDay ? currentWeekData?.days[selectedOccurrenceIndex] : null

  let selectedPercent = 0
  if (program && selectedSession) {
    const totalSets = selectedSession.exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
    const loggedSets = setsLoggedByDay[`${program.current_week}-${selectedSession.day_number}`] ?? 0
    selectedPercent = totalSets > 0 ? Math.min(100, Math.round((loggedSets / totalSets) * 100)) : 0
  }
  const selectedIsToday = isSameDay(selectedDate, today)
  const selectedIsPast = !selectedIsToday && selectedDate < today
  const selectedIsFuture = !selectedIsToday && selectedDate > today

  const dayLabelFormatter = new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <main>
      <TopNav />
      <p className="eyebrow">
        {greeting}
        {firstName ? `, ${firstName}` : ''}
        {greeting === 'Bienvenue' ? ' !' : ''}
      </p>
      <h1>Tableau de bord</h1>

      <div className="day-strip">
        {weekDates.map((date, i) => {
          const iso = i + 1
          const isToday = isSameDay(date, today)
          const isSelected = isSameDay(date, selectedDate)
          const isTraining = preferredDays.includes(iso)
          return (
            <button
              key={i}
              type="button"
              className={`day-strip-item${isSelected ? ' day-strip-item-selected' : ''}${isToday ? ' day-strip-item-today' : ''}`}
              onClick={() => setSelectedDate(date)}
            >
              <span className="day-strip-letter">{WEEKDAY_LABELS[i]}</span>
              <span className="day-strip-date">{date.getDate()}</span>
              {isTraining && <span className="day-strip-dot" />}
            </button>
          )
        })}
      </div>

      <Link
        to={
          program && selectedSession
            ? `/session/${program.current_week}/${selectedSession.day_number}`
            : '/program'
        }
        className="card session-of-day"
      >
        <Icon name={selectedSession ? 'bolt' : 'stretch'} size={26} />
        {program && selectedSession ? (
          <>
            <span className="eyebrow">
              {selectedIsToday ? "Aujourd'hui" : dayLabelFormatter.format(selectedDate)}
            </span>
            <h3>{selectedSession.name}</h3>
            <p>
              {selectedPercent === 100
                ? 'Terminée — 100%'
                : selectedPercent > 0
                  ? `${selectedPercent}% réalisé`
                  : selectedIsFuture
                    ? "Pas encore commencée."
                    : selectedIsPast
                      ? 'Non réalisée.'
                      : "Pas encore loggée aujourd'hui."}
            </p>
            <span className="btn-primary">
              {selectedPercent === 100 ? 'Revoir la séance' : selectedPercent > 0 ? 'Continuer' : 'Voir la séance'}
            </span>
          </>
        ) : program ? (
          <>
            <span className="eyebrow">
              {selectedIsToday ? "Aujourd'hui" : dayLabelFormatter.format(selectedDate)}
            </span>
            <h3>Jour de repos</h3>
            <p>Pas de séance prévue ce jour-là selon tes préférences.</p>
          </>
        ) : (
          <>
            <h3>Pas encore de programme</h3>
            <p>Termine ton onboarding pour générer ton programme.</p>
          </>
        )}
      </Link>

      <div className="stat-row">
        <Link to="/program" className="stat-tile">
          <span className="stat-value">
            {program ? program.current_week : '—'}
            {totalWeeks && <span className="stat-unit">/{totalWeeks}</span>}
          </span>
          <span className="stat-label">Semaine</span>
        </Link>
        <Link to="/progress" className="stat-tile">
          <span className="stat-value">{sessionCount}</span>
          <span className="stat-label">Séances loggées</span>
        </Link>
        <Link to="/progress" className="stat-tile">
          <span className="stat-value">
            {latestWeight ?? '—'}
            {latestWeight != null && <span className="stat-unit">kg</span>}
          </span>
          <span className="stat-label">Poids actuel</span>
        </Link>
      </div>

      {goal && (
        <Link to="/settings#objectif" className="card goal-card">
          <Icon name="target" size={24} />
          <div>
            <span className="eyebrow">Ton objectif</span>
            <h3>{GOAL_LABELS[goal.goal_type] ?? goal.goal_type}</h3>
            {goal.target_date && (
              <p>Échéance : {new Date(goal.target_date).toLocaleDateString('fr-CH')}</p>
            )}
          </div>
        </Link>
      )}

      <div className="dashboard-links">
        <Link to="/program" className="card dashboard-link">
          <Icon name="dumbbell" size={30} />
          <h3>Ton programme</h3>
          <p>Semaines, jours, exercices — ce que tu dois faire aujourd'hui.</p>
        </Link>
        <Link to="/progress" className="card dashboard-link">
          <Icon name="run" size={30} />
          <h3>Ta progression</h3>
          <p>Mesures dans le temps, séances loggées.</p>
        </Link>
        <Link to="/settings" className="card dashboard-link">
          <Icon name="settings" size={30} />
          <h3>Réglages</h3>
          <p>Modifie tes infos, ton objectif et tes préférences.</p>
        </Link>
      </div>

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
