import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
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
  const [status, setStatus] = useState('loading')

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
      await Promise.all([loadMeasurements(), loadWorkoutLogs()])
      setStatus('idle')
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  if (status === 'loading') return null

  const [weightField, ...otherFields] = MEASUREMENT_FIELDS

  return (
    <main>
      <TopNav />
      <h1>Ta progression</h1>

      <MeasurementSummaryRow fields={MEASUREMENT_FIELDS} measurements={measurements} />

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
