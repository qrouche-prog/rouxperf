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

// Domaines pour lesquels ça a du sens de demander une fréquence dédiée et un
// mode d'intégration — la force est la base du programme et perte de poids /
// prise de muscle sont des objectifs, pas des séances à planifier en soi.
const SCHEDULABLE_FOCUS_AREAS = new Set(['cardio', 'running', 'aerobic', 'anaerobic', 'explosiveness', 'mobility'])

const INTEGRATION_MODES = [
  { value: 'separate', label: 'Séances dédiées, séparées de la musculation' },
  { value: 'integrated', label: 'Intégré aux séances de musculation (échauffement/finisher)' },
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
  { value: 'combat', label: 'Sport de combat', icon: 'combat' },
  { value: 'tennis', label: 'Tennis', icon: 'tennis' },
  { value: 'rugby', label: 'Rugby', icon: 'rugby' },
  { value: 'cycling', label: 'Cyclisme', icon: 'cycling' },
  { value: 'climbing', label: 'Escalade', icon: 'climbing' },
  { value: 'golf', label: 'Golf', icon: 'golf' },
  { value: 'badminton', label: 'Badminton', icon: 'badminton' },
  { value: 'handball', label: 'Handball', icon: 'handball' },
  { value: 'athletics', label: 'Athlétisme', icon: 'athletics' },
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
  const [focusAreaPreferences, setFocusAreaPreferences] = useState({
    strength: { frequency: 3 },
    ...(initial?.focus_area_preferences ?? {}),
  })
  const [events, setEvents] = useState(initial?.upcoming_events ?? [])
  const [eventDate, setEventDate] = useState(initial?.event_date ?? '')
  const [targetSports, setTargetSports] = useState(initial?.target_sports ?? [])
  const [otherSportNotes, setOtherSportNotes] = useState(initial?.other_sport_notes ?? '')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const hasEvent = events.length > 0 && !events.includes('none')

  function toggleFocusArea(value) {
    setFocusAreas((current) => {
      const next = toggleValue(current, value)
      if (next.includes(value) && SCHEDULABLE_FOCUS_AREAS.has(value)) {
        setFocusAreaPreferences((prefs) => ({
          ...prefs,
          [value]: prefs[value] ?? { frequency: 2, mode: 'separate' },
        }))
      } else if (!next.includes(value)) {
        setFocusAreaPreferences((prefs) => {
          const { [value]: _removed, ...rest } = prefs
          return rest
        })
      }
      return next
    })
  }

  function updateFocusAreaPreference(area, patch) {
    setFocusAreaPreferences((prefs) => ({
      ...prefs,
      [area]: { ...(prefs[area] ?? { frequency: 2, mode: 'separate' }), ...patch },
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setStatus('loading')

    const { error: upsertError } = await supabase.from('user_training_profile').upsert(
      {
        user_id: user.id,
        focus_areas: focusAreas,
        focus_area_preferences: focusAreaPreferences,
        upcoming_events: events,
        event_date: hasEvent && eventDate ? eventDate : null,
        target_sports: targetSports,
        other_sport_notes: otherSportNotes.trim() || null,
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

  const schedulableSelected = focusAreas.filter((area) => SCHEDULABLE_FOCUS_AREAS.has(area))

  return (
    <form onSubmit={handleSubmit}>
      <h2>Tes objectifs sportifs</h2>
      <p>Sélectionne tout ce qui s'applique — ça affine directement ton programme.</p>

      <label>Aspects à travailler</label>
      <SelectableCardGrid options={FOCUS_AREAS} selected={focusAreas} onToggle={toggleFocusArea} />

      <div className="focus-schedule-list">
        <div className="focus-schedule-row">
          <strong>Musculation</strong>

          <label htmlFor="freq-strength">Combien de fois par semaine ?</label>
          <select
            id="freq-strength"
            value={focusAreaPreferences.strength?.frequency ?? 3}
            onChange={(e) => updateFocusAreaPreference('strength', { frequency: Number(e.target.value) })}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </div>

        {schedulableSelected.map((area) => {
            const areaLabel = FOCUS_AREAS.find((f) => f.value === area)?.label ?? area
            const pref = focusAreaPreferences[area] ?? { frequency: 2, mode: 'separate' }
            return (
              <div key={area} className="focus-schedule-row">
                <strong>{areaLabel}</strong>

                <label htmlFor={`freq-${area}`}>Combien de fois par semaine ?</label>
                <select
                  id={`freq-${area}`}
                  value={pref.frequency}
                  onChange={(e) => updateFocusAreaPreference(area, { frequency: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}×
                    </option>
                  ))}
                </select>

                <div role="radiogroup" aria-label={`Comment intégrer ${areaLabel}`}>
                  {INTEGRATION_MODES.map((mode) => (
                    <label key={mode.value} style={{ display: 'block' }}>
                      <input
                        type="radio"
                        name={`mode-${area}`}
                        value={mode.value}
                        checked={pref.mode === mode.value}
                        onChange={() => updateFocusAreaPreference(area, { mode: mode.value })}
                      />{' '}
                      {mode.label}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

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

      <label htmlFor="otherSportNotes">
        Un autre sport, une discipline précise ou une information à préciser (optionnel)
      </label>
      <textarea
        id="otherSportNotes"
        value={otherSportNotes}
        onChange={(e) => setOtherSportNotes(e.target.value)}
        rows={3}
        placeholder="Ex. escrime, water-polo, danse, ou toute précision utile sur tes objectifs"
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
