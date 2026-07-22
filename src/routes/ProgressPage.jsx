import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MeasurementChart from '../components/progress/MeasurementChart'
import AddMeasurementForm from '../components/progress/AddMeasurementForm'
import LogWorkoutForm from '../components/progress/LogWorkoutForm'

const MEASUREMENT_FIELDS = [
  { value: 'weight_kg', label: 'Poids' },
  { value: 'body_fat_pct', label: 'Masse grasse' },
  { value: 'waist_cm', label: 'Tour de taille' },
  { value: 'hips_cm', label: 'Tour de hanches' },
  { value: 'chest_cm', label: 'Tour de poitrine' },
  { value: 'arm_cm', label: 'Tour de bras' },
  { value: 'thigh_cm', label: 'Tour de cuisse' },
]

export default function ProgressPage() {
  const { user } = useAuth()
  const [measurements, setMeasurements] = useState([])
  const [program, setProgram] = useState(null)
  const [exercisesById, setExercisesById] = useState({})
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [selectedField, setSelectedField] = useState('weight_kg')
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
      const [{ data: programData }, { data: exercises }] = await Promise.all([
        supabase
          .from('user_programs')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('exercises').select('id, name'),
      ])
      setProgram(programData)
      setExercisesById(Object.fromEntries((exercises ?? []).map((exercise) => [exercise.id, exercise])))
      await Promise.all([loadMeasurements(), loadWorkoutLogs()])
      setStatus('idle')
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  if (status === 'loading') return null

  return (
    <main>
      <h1>Ta progression</h1>
      <p>
        <Link to="/dashboard">Tableau de bord</Link> · <Link to="/program">Programme</Link>
      </p>

      <label htmlFor="measurementField">Mesure affichée</label>
      <select id="measurementField" value={selectedField} onChange={(e) => setSelectedField(e.target.value)}>
        {MEASUREMENT_FIELDS.map((field) => (
          <option key={field.value} value={field.value}>
            {field.label}
          </option>
        ))}
      </select>

      <MeasurementChart
        data={measurements}
        field={selectedField}
        label={MEASUREMENT_FIELDS.find((field) => field.value === selectedField)?.label ?? selectedField}
      />

      <AddMeasurementForm onAdded={loadMeasurements} />

      {program ? (
        <LogWorkoutForm program={program} exercisesById={exercisesById} onLogged={loadWorkoutLogs} />
      ) : (
        <p>Pas de programme actif pour l'instant.</p>
      )}

      <h2>Séances récentes</h2>
      {workoutLogs.length === 0 ? (
        <p>Aucune séance loggée pour l'instant.</p>
      ) : (
        <ul>
          {workoutLogs.map((log) => (
            <li key={log.id}>
              {new Date(log.performed_at).toLocaleDateString('fr-CH')} — Semaine {log.week_number}, Jour{' '}
              {log.day_number}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
