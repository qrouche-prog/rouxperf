import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
]

export default function PreferencesStep({ onNext, onBack }) {
  const { user } = useAuth()
  const [equipmentAccess, setEquipmentAccess] = useState('')
  const [daysPerWeek, setDaysPerWeek] = useState('')
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState('')
  const [preferredDays, setPreferredDays] = useState([])
  const [injuriesLimitations, setInjuriesLimitations] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  function toggleDay(day) {
    setPreferredDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!equipmentAccess || !daysPerWeek || !sessionDurationMinutes) {
      setError('Merci de compléter le matériel, les jours et la durée de séance.')
      return
    }

    setStatus('loading')
    const { error: upsertError } = await supabase.from('user_training_profile').upsert(
      {
        user_id: user.id,
        equipment_access: equipmentAccess,
        days_per_week: Number(daysPerWeek),
        session_duration_minutes: Number(sessionDurationMinutes),
        preferred_days: preferredDays,
        injuries_limitations: injuriesLimitations.trim() || null,
      },
      { onConflict: 'user_id' }
    )
    setStatus('idle')

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    onNext()
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Tes préférences d'entraînement</h2>

      <label htmlFor="equipmentAccess">Matériel disponible</label>
      <select
        id="equipmentAccess"
        value={equipmentAccess}
        onChange={(e) => setEquipmentAccess(e.target.value)}
        required
      >
        <option value="">Choisir...</option>
        <option value="bodyweight">Poids du corps uniquement</option>
        <option value="home_dumbbells">Haltères à la maison</option>
        <option value="home_full_gym">Salle complète à la maison</option>
        <option value="commercial_gym">Salle de sport commerciale</option>
      </select>

      <label htmlFor="daysPerWeek">Jours d'entraînement par semaine</label>
      <input
        id="daysPerWeek"
        type="number"
        min="1"
        max="7"
        value={daysPerWeek}
        onChange={(e) => setDaysPerWeek(e.target.value)}
        required
      />

      <label htmlFor="sessionDurationMinutes">Durée de séance visée (minutes)</label>
      <input
        id="sessionDurationMinutes"
        type="number"
        min="15"
        max="180"
        step="5"
        value={sessionDurationMinutes}
        onChange={(e) => setSessionDurationMinutes(e.target.value)}
        required
      />

      <fieldset>
        <legend>Jours préférés (optionnel)</legend>
        {DAYS.map((day) => (
          <label key={day.value} style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={preferredDays.includes(day.value)}
              onChange={() => toggleDay(day.value)}
            />
            {' '}
            {day.label}
          </label>
        ))}
      </fieldset>

      <label htmlFor="injuriesLimitations">Blessures / limitations (optionnel)</label>
      <textarea
        id="injuriesLimitations"
        value={injuriesLimitations}
        onChange={(e) => setInjuriesLimitations(e.target.value)}
        rows={3}
      />

      {error && <p role="alert">{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onBack}>
          Retour
        </button>
        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Enregistrement...' : 'Continuer'}
        </button>
      </div>
    </form>
  )
}
