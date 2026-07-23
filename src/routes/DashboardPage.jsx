import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/onboarding/icons/Icon'
import BottomNav from '../components/BottomNav'

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
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [program, setProgram] = useState(null)
  const [trainingProfile, setTrainingProfile] = useState(null)
  const [goal, setGoal] = useState(null)
  const [sessionCount, setSessionCount] = useState(null)
  const [latestWeight, setLatestWeight] = useState(null)
  const [todayLogged, setTodayLogged] = useState(false)
  const [status, setStatus] = useState('loading')

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
        const preferredDays = [...(profileData?.preferred_days ?? [])].sort((a, b) => a - b)
        const todayIso = isoWeekday(new Date())
        const occurrenceIndex = preferredDays.indexOf(todayIso)
        if (occurrenceIndex !== -1) {
          const currentWeekData = programData.structure.weeks.find((w) => w.week_number === programData.current_week)
          const todaysDay = currentWeekData?.days[occurrenceIndex]
          if (todaysDay) {
            const { data: log } = await supabase
              .from('workout_logs')
              .select('id')
              .eq('user_id', user.id)
              .eq('program_id', programData.id)
              .eq('week_number', programData.current_week)
              .eq('day_number', todaysDay.day_number)
              .maybeSingle()
            setTodayLogged(!!log)
          }
        }
      }

      setStatus('idle')
    }
    load()
  }, [user.id])

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  if (status === 'loading') return null

  const totalWeeks = program?.structure?.weeks?.length ?? null
  const weekDates = getCurrentWeekDates()
  const todayIso = isoWeekday(new Date())
  const preferredDays = trainingProfile?.preferred_days ?? []

  const sortedPreferred = [...preferredDays].sort((a, b) => a - b)
  const occurrenceIndex = sortedPreferred.indexOf(todayIso)
  const isTrainingDay = occurrenceIndex !== -1
  const currentWeekData = program?.structure?.weeks?.find((w) => w.week_number === program.current_week)
  const todaysSession = isTrainingDay ? currentWeekData?.days[occurrenceIndex] : null

  return (
    <main>
      <p className="eyebrow">{user?.email}</p>
      <h1>Tableau de bord</h1>

      <div className="day-strip">
        {weekDates.map((date, i) => {
          const iso = i + 1
          const isToday = iso === todayIso
          const isTraining = preferredDays.includes(iso)
          return (
            <div key={i} className={`day-strip-item${isToday ? ' day-strip-item-today' : ''}`}>
              <span className="day-strip-letter">{WEEKDAY_LABELS[i]}</span>
              <span className="day-strip-date">{date.getDate()}</span>
              {isTraining && <span className="day-strip-dot" />}
            </div>
          )
        })}
      </div>

      <div className="card session-of-day">
        <Icon name={todaysSession ? 'bolt' : 'stretch'} size={26} />
        {program && todaysSession ? (
          <>
            <h3>Séance du jour — {todaysSession.name}</h3>
            <p>{todayLogged ? 'Déjà loggée aujourd\'hui, bien joué.' : "Pas encore loggée aujourd'hui."}</p>
            <Link to="/program" className="btn-primary">
              {todayLogged ? 'Revoir la séance' : 'Voir la séance'}
            </Link>
          </>
        ) : program ? (
          <>
            <h3>Jour de repos</h3>
            <p>Pas de séance prévue aujourd'hui selon tes préférences.</p>
          </>
        ) : (
          <>
            <h3>Pas encore de programme</h3>
            <p>Termine ton onboarding pour générer ton programme.</p>
          </>
        )}
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-value">
            {program ? program.current_week : '—'}
            {totalWeeks && <span className="stat-unit">/{totalWeeks}</span>}
          </span>
          <span className="stat-label">Semaine</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{sessionCount}</span>
          <span className="stat-label">Séances loggées</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">
            {latestWeight ?? '—'}
            {latestWeight != null && <span className="stat-unit">kg</span>}
          </span>
          <span className="stat-label">Poids actuel</span>
        </div>
      </div>

      {goal && (
        <div className="card goal-card">
          <Icon name="target" size={24} />
          <div>
            <span className="eyebrow">Ton objectif</span>
            <h3>{GOAL_LABELS[goal.goal_type] ?? goal.goal_type}</h3>
            {goal.target_date && (
              <p>Échéance : {new Date(goal.target_date).toLocaleDateString('fr-CH')}</p>
            )}
          </div>
        </div>
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
      </div>

      <button onClick={handleSignOut}>Se déconnecter</button>

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
