import { useEffect, useState } from 'react'
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

const COMBINING_OPTIONS = [
  { value: 'never', label: 'Non, je préfère répartir sur plus de jours si besoin' },
  { value: 'if_needed', label: "Seulement si je n'ai pas assez de jours cochés" },
  { value: 'allowed', label: 'Oui, ça peut m\'arranger même sans nécessité' },
]

// Dupliqué volontairement (même logique qu'api/generate-program.js et le
// worker Deno) : pas de module partageable entre ces trois runtimes.
function totalSessionsPerWeek(prefs) {
  return Object.entries(prefs ?? {}).reduce((sum, [area, pref]) => {
    if (area === 'strength') return sum + (pref.frequency ?? 0)
    return pref.mode === 'integrated' ? sum : sum + (pref.frequency ?? 0)
  }, 0)
}

export default function PreferencesStep({ onNext, onBack, initial, submitLabel = 'Continuer' }) {
  const { user } = useAuth()
  const [equipmentAccess, setEquipmentAccess] = useState(initial?.equipment_access ?? '')
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(initial?.session_duration_minutes ?? '')
  const [preferredDays, setPreferredDays] = useState(initial?.preferred_days ?? [])
  const [injuriesLimitations, setInjuriesLimitations] = useState(initial?.injuries_limitations ?? '')
  const [sameDayCombining, setSameDayCombining] = useState(initial?.same_day_combining ?? 'if_needed')
  const [focusAreaPreferences, setFocusAreaPreferences] = useState(initial?.focus_area_preferences ?? null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (initial?.focus_area_preferences !== undefined) {
      setFocusAreaPreferences(initial.focus_area_preferences)
    }
  }, [initial?.focus_area_preferences])

  useEffect(() => {
    if (initial !== undefined) return
    async function load() {
      const { data } = await supabase
        .from('user_training_profile')
        .select('focus_area_preferences')
        .eq('user_id', user.id)
        .maybeSingle()
      setFocusAreaPreferences(data?.focus_area_preferences ?? {})
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  const total = totalSessionsPerWeek(focusAreaPreferences)

  function toggleDay(day) {
    setPreferredDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!equipmentAccess || !sessionDurationMinutes) {
      setError('Merci de compléter le matériel et la durée de séance.')
      return
    }

    if (sameDayCombining === 'never' && preferredDays.length > 0 && total > preferredDays.length) {
      setError(
        `Tu as ${total} séance(s) par semaine mais seulement ${preferredDays.length} jour(s) coché(s), sans autoriser les séances doublées. Coche plus de jours, réduis tes fréquences dans l'étape précédente, ou autorise les séances combinées.`
      )
      return
    }

    setStatus('loading')
    const { error: upsertError } = await supabase.from('user_training_profile').upsert(
      {
        user_id: user.id,
        equipment_access: equipmentAccess,
        session_duration_minutes: Number(sessionDurationMinutes),
        preferred_days: preferredDays,
        injuries_limitations: injuriesLimitations.trim() || null,
        same_day_combining: sameDayCombining,
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

      {focusAreaPreferences !== null && (
        <p className="eyebrow">D'après tes séances choisies : {total} séance(s) par semaine</p>
      )}

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

      <fieldset>
        <legend>Deux séances le même jour ?</legend>
        <div role="radiogroup" aria-label="Deux séances le même jour">
          {COMBINING_OPTIONS.map((option) => (
            <label key={option.value} style={{ display: 'block' }}>
              <input
                type="radio"
                name="sameDayCombining"
                value={option.value}
                checked={sameDayCombining === option.value}
                onChange={() => setSameDayCombining(option.value)}
              />
              {' '}
              {option.label}
            </label>
          ))}
        </div>
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
        {onBack && (
          <button type="button" onClick={onBack}>
            Retour
          </button>
        )}
        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Enregistrement...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
