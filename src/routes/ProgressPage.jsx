import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { frActivityLabel, activityEmoji } from '../lib/activityLabels'
import { useAuth } from '../context/AuthContext'
import MeasurementCard from '../components/progress/MeasurementCard'
import MeasurementSummaryRow from '../components/progress/MeasurementSummaryRow'
import BottomNav from '../components/BottomNav'
import TopNav from '../components/TopNav'

const MEASUREMENT_FIELDS = [
  { value: 'weight_kg', label: 'Poids', unit: 'kg' },
  { value: 'body_fat_pct', label: 'Masse grasse', unit: '%' },
  { value: 'waist_cm', label: 'Tour de taille', unit: 'cm' },
  { value: 'hips_cm', label: 'Tour de hanches', unit: 'cm' },
  { value: 'chest_cm', label: 'Tour de poitrine', unit: 'cm' },
  { value: 'arm_cm', label: 'Tour de bras', unit: 'cm' },
  { value: 'thigh_cm', label: 'Tour de cuisse', unit: 'cm' },
]

export default function ProgressPage() {
  const { user } = useAuth()
  const [measurements, setMeasurements] = useState([])
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [activities, setActivities] = useState([])
  const [status, setStatus] = useState('loading')

  async function loadActivities() {
    const { data } = await supabase
      .from('wearable_activities')
      .select('id, activity_type, started_at, duration_s, distance_m, calories, avg_hr, max_hr, elevation_gain_m')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(40)
    setActivities(data ?? [])
  }

  async function loadMeasurements() {
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: true })
    setMeasurements(data ?? [])
  }

  async function loadWorkoutLogs() {
    const { data } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('performed_at', { ascending: false })
      .limit(10)
    setWorkoutLogs(data ?? [])
  }

  useEffect(() => {
    async function load() {
      await Promise.all([loadMeasurements(), loadWorkoutLogs(), loadActivities()])
      setStatus('idle')
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  if (status === 'loading') return null

  const [weightField, ...otherFields] = MEASUREMENT_FIELDS

  // Résumé hebdo des séances de montre sur 4 semaines.
  const now = Date.now()
  const recent = activities.filter((a) => a.started_at && now - new Date(a.started_at).getTime() < 28 * 86400000)
  const byType = {}
  for (const a of recent) {
    const t = a.activity_type || 'activité'
    const b = (byType[t] = byType[t] || { n: 0, dur: 0, dist: 0, hrSum: 0, hrN: 0 })
    b.n += 1
    b.dur += Number(a.duration_s || 0)
    b.dist += Number(a.distance_m || 0)
    if (a.avg_hr) {
      b.hrSum += Number(a.avg_hr)
      b.hrN += 1
    }
  }
  const weeklySummary = Object.entries(byType).map(([t, b]) => ({
    type: frActivityLabel(t),
    perWeek: (b.n / 4).toFixed(1),
    km: b.dist ? (b.dist / 1000 / 4).toFixed(1) : null,
    min: b.dur ? Math.round(b.dur / 60 / 4) : null,
    hr: b.hrN ? Math.round(b.hrSum / b.hrN) : null,
  }))

  return (
    <main>
      <TopNav />
      <h1>Ta progression</h1>

      <MeasurementSummaryRow measurements={measurements} />

      <MeasurementCard
        field={weightField.value}
        label={weightField.label}
        unit={weightField.unit}
        data={measurements}
        onAdded={loadMeasurements}
        featured
      />

      <div className="measurement-grid">
        {otherFields.map((field) => (
          <MeasurementCard
            key={field.value}
            field={field.value}
            label={field.label}
            unit={field.unit}
            data={measurements}
            onAdded={loadMeasurements}
          />
        ))}
      </div>

      <h2>Séances de ta montre</h2>
      {activities.length === 0 ? (
        <p>
          Aucune séance importée. Connecte ta montre dans <Link to="/settings#objets">Réglages</Link>.
        </p>
      ) : (
        <>
          {weeklySummary.length > 0 && (
            <div className="card wearable-summary">
              <p className="eyebrow">Charge des 4 dernières semaines (par semaine)</p>
              <ul className="wearable-summary-list">
                {weeklySummary.map((s) => (
                  <li key={s.type}>
                    <strong>{s.type}</strong> : {s.perWeek} séance(s)
                    {s.min ? ` · ${s.min} min` : ''}
                    {s.km ? ` · ${s.km} km` : ''}
                    {s.hr ? ` · FC ${s.hr}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className="activity-cards">
            {activities.slice(0, 15).map((a) => (
              <li key={a.id} className="activity-card">
                <span className="activity-emoji">{activityEmoji(a.activity_type)}</span>
                <div className="activity-card-body">
                  <div className="activity-card-top">
                    <strong>{frActivityLabel(a.activity_type)}</strong>
                    <span className="eyebrow">
                      {a.started_at
                        ? new Date(a.started_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
                        : ''}
                    </span>
                  </div>
                  <div className="activity-chips">
                    {a.duration_s ? <span className="activity-chip">{Math.round(a.duration_s / 60)} min</span> : null}
                    {a.distance_m ? <span className="activity-chip">{(a.distance_m / 1000).toFixed(1)} km</span> : null}
                    {a.avg_hr ? <span className="activity-chip">❤️ {a.avg_hr}</span> : null}
                    {a.elevation_gain_m ? (
                      <span className="activity-chip">↑ {Math.round(a.elevation_gain_m)} m</span>
                    ) : null}
                    {a.calories ? <span className="activity-chip">{Math.round(a.calories)} kcal</span> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Séances récentes</h2>
      {workoutLogs.length === 0 ? (
        <p>Aucune séance loggée pour l'instant.</p>
      ) : (
        <ul className="workout-log-list">
          {workoutLogs.map((log) => (
            <li key={log.id}>
              <span className="eyebrow">{new Date(log.performed_at).toLocaleDateString('fr-CH')}</span>
              <span>
                Semaine {log.week_number}, jour {log.day_number}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
