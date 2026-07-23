import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/onboarding/icons/Icon'

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [program, setProgram] = useState(null)
  const [sessionCount, setSessionCount] = useState(null)
  const [latestWeight, setLatestWeight] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    async function load() {
      const [{ data: programData }, { count }, { data: measurement }] = await Promise.all([
        supabase
          .from('user_programs')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
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
      setSessionCount(count ?? 0)
      setLatestWeight(measurement?.weight_kg ?? null)
      setStatus('idle')
    }
    load()
  }, [user.id])

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  const totalWeeks = program?.structure?.weeks?.length ?? null

  return (
    <main>
      <p className="eyebrow">{user?.email}</p>
      <h1>Tableau de bord</h1>

      {status !== 'loading' && (
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
    </main>
  )
}
