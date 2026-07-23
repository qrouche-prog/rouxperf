import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import SelectableCardGrid from './SelectableCardGrid'

const FOCUS_AREAS = [
  { value: 'cardio', label: 'Cardio', icon: 'heart' },
  { value: 'running', label: 'Course à pied', icon: 'run' },
  { value: 'aerobic', label: 'Endurance aérobie', icon: 'lungs' },
  { value: 'anaerobic', label: 'Capacité anaérobie', icon: 'bolt' },
  { value: 'strength', label: 'Force', icon: 'dumbbell' },
  { value: 'explosiveness', label: 'Explosivité / plyométrie', icon: 'jump' },
  { value: 'mobility', label: 'Mobilité', icon: 'stretch' },
  { value: 'weight_loss', label: 'Perte de poids', icon: 'scale' },
  { value: 'muscle_gain', label: 'Prise de muscle', icon: 'bicep' },
]

const EVENTS = [
  { value: 'hyrox', label: 'Hyrox', icon: 'hyrox' },
  { value: 'spartan', label: 'Spartan / OCR', icon: 'obstacle' },
  { value: 'marathon', label: 'Marathon', icon: 'run' },
  { value: 'semi_marathon', label: 'Semi-marathon', icon: 'run' },
  { value: '10km', label: '10 km', icon: 'run' },
  { value: '5km', label: '5 km', icon: 'run' },
  { value: 'triathlon', label: 'Triathlon', icon: 'triathlon' },
  { value: 'none', label: 'Aucune pour l\'instant', icon: 'dash' },
]

const SPORTS = [
  { value: 'volleyball', label: 'Volleyball', icon: 'volleyball' },
  { value: 'football', label: 'Football', icon: 'football' },
  { value: 'basketball', label: 'Basketball', icon: 'basketball' },
  { value: 'swimming', label: 'Natation', icon: 'swim' },
  { value: 'hockey', label: 'Hockey', icon: 'hockey' },
]

function toggleValue(list, value, exclusiveValue) {
  if (value === exclusiveValue) {
    return list.includes(value) ? [] : [value]
  }
  const withoutExclusive = list.filter((v) => v !== exclusiveValue)
  return withoutExclusive.includes(value)
    ? withoutExclusive.filter((v) => v !== value)
    : [...withoutExclusive, value]
}

export default function SportGoalsStep({ onNext, onBack, initial, submitLabel = 'Continuer' }) {
  const { user } = useAuth()
  const [focusAreas, setFocusAreas] = useState(initial?.focus_areas ?? [])
  const [events, setEvents] = useState(initial?.upcoming_events ?? [])
  const [eventDate, setEventDate] = useState(initial?.event_date ?? '')
  const [targetSports, setTargetSports] = useState(initial?.target_sports ?? [])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const hasEvent = events.length > 0 && !events.includes('none')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setStatus('loading')

    const { error: upsertError } = await supabase.from('user_training_profile').upsert(
      {
        user_id: user.id,
        focus_areas: focusAreas,
        upcoming_events: events,
        event_date: hasEvent && eventDate ? eventDate : null,
        target_sports: targetSports,
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
      <h2>Tes objectifs sportifs</h2>
      <p>Sélectionne tout ce qui s'applique — ça affine directement ton programme.</p>

      <label>Aspects à travailler</label>
      <SelectableCardGrid
        options={FOCUS_AREAS}
        selected={focusAreas}
        onToggle={(value) => setFocusAreas((current) => toggleValue(current, value))}
      />

      <label>Compétition à venir</label>
      <SelectableCardGrid
        options={EVENTS}
        selected={events}
        onToggle={(value, exclusiveValue) => setEvents((current) => toggleValue(current, value, exclusiveValue))}
        exclusiveValue="none"
      />

      {hasEvent && (
        <>
          <label htmlFor="eventDate">Date de la compétition (optionnel)</label>
          <input id="eventDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </>
      )}

      <label>Sport(s) pour lesquels progresser (optionnel)</label>
      <SelectableCardGrid
        options={SPORTS}
        selected={targetSports}
        onToggle={(value) => setTargetSports((current) => toggleValue(current, value))}
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
