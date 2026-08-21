import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import SelectableCardGrid from './SelectableCardGrid'

// Liste resserrée : "Endurance aérobie" et "Capacité anaérobie" ont été
// fusionnées dans "Cardio" / "Explosivité" respectivement (recouvrement quasi
// total côté génération, aucune règle distincte) ; "Mobilité" retirée (l'app
// ne proposait qu'un exemple vague de 12 min sans vraie structure) —
// remplacée par un échauffement systématique et adapté à chaque séance,
// généré automatiquement, plutôt qu'un choix à part qui ne tenait pas ses
// promesses. "Force" a été retirée puis réintégrée : contrairement à
// "Perte de poids"/"Prise de muscle" elle n'était pas croisée avec goal_type
// dans le prompt (case sans effet) — corrigé, elle fonctionne maintenant
// comme un aspect secondaire réel (insister sur du lourd/faibles répétitions
// même quand l'objectif principal est autre chose), au même titre que les deux
// autres objectifs listés ici.
const FOCUS_AREAS = [
  { value: 'cardio', label: 'Cardio', icon: 'heart' },
  { value: 'running', label: 'Course à pied', icon: 'run' },
  { value: 'strength', label: 'Force', icon: 'dumbbell' },
  { value: 'explosiveness', label: 'Explosivité / puissance', icon: 'jump' },
  { value: 'weight_loss', label: 'Perte de poids', icon: 'scale' },
  { value: 'muscle_gain', label: 'Prise de muscle', icon: 'bicep' },
]

// Domaines pour lesquels ça a du sens de demander une fréquence dédiée et un
// mode d'intégration — la force est la base du programme et perte de poids /
// prise de muscle sont des objectifs, pas des séances à planifier en soi.
const SCHEDULABLE_FOCUS_AREAS = new Set(['cardio', 'running', 'explosiveness'])

const INTEGRATION_MODES = [
  { value: 'separate', label: 'Séances dédiées, séparées de la musculation' },
  { value: 'integrated', label: 'Intégré aux séances de musculation (échauffement/finisher)' },
]

const EVENT_GROUPS = [
  {
    category: 'Course à pied',
    options: [
      { value: '5km', label: '5 km', icon: 'run' },
      { value: '10km', label: '10 km', icon: 'run' },
      { value: 'semi_marathon', label: 'Semi-marathon', icon: 'run' },
      { value: 'marathon', label: 'Marathon', icon: 'run' },
      { value: 'trail', label: 'Trail', icon: 'run' },
    ],
  },
  {
    category: 'Multisport & obstacle',
    options: [
      { value: 'hyrox', label: 'Hyrox', icon: 'hyrox' },
      { value: 'spartan', label: 'Spartan / OCR', icon: 'obstacle' },
      { value: 'triathlon', label: 'Triathlon', icon: 'triathlon' },
    ],
  },
]

const NONE_EVENT = { value: 'none', label: "Aucune pour l'instant", icon: 'dash' }

const RUNNING_QUALITIES = [
  { value: 'speed', label: 'Vitesse' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'vma', label: 'VMA' },
  { value: 'elevation', label: 'Dénivelé / côtes' },
]

const SPORT_GROUPS = [
  {
    category: 'Sports collectifs & ballon',
    options: [
      { value: 'football', label: 'Football', icon: 'football' },
      { value: 'basketball', label: 'Basketball', icon: 'basketball' },
      { value: 'volleyball', label: 'Volleyball', icon: 'volleyball' },
      { value: 'handball', label: 'Handball', icon: 'handball' },
      { value: 'rugby', label: 'Rugby', icon: 'rugby' },
      { value: 'water_polo', label: 'Water-polo', icon: 'swim' },
      { value: 'futsal', label: 'Futsal', icon: 'football' },
      { value: 'baseball', label: 'Baseball', icon: 'sport' },
    ],
  },
  {
    category: 'Sports de raquette',
    options: [
      { value: 'tennis', label: 'Tennis', icon: 'tennis' },
      { value: 'badminton', label: 'Badminton', icon: 'badminton' },
      { value: 'table_tennis', label: 'Tennis de table', icon: 'tennis' },
      { value: 'squash', label: 'Squash', icon: 'tennis' },
      { value: 'padel', label: 'Padel', icon: 'tennis' },
    ],
  },
  {
    category: 'Sports de combat',
    options: [
      { value: 'boxing', label: 'Boxe', icon: 'boxing' },
      { value: 'mma', label: 'MMA', icon: 'combat' },
      { value: 'judo', label: 'Judo', icon: 'combat' },
      { value: 'karate', label: 'Karaté', icon: 'combat' },
      { value: 'taekwondo', label: 'Taekwondo', icon: 'combat' },
      { value: 'wrestling', label: 'Lutte', icon: 'combat' },
      { value: 'bjj', label: 'Jiu-jitsu brésilien', icon: 'combat' },
      { value: 'fencing', label: 'Escrime', icon: 'combat' },
      { value: 'combat', label: 'Autre sport de combat', icon: 'combat' },
    ],
  },
  {
    category: 'Sports aquatiques',
    options: [
      { value: 'swimming', label: 'Natation', icon: 'swim' },
      { value: 'rowing', label: 'Aviron', icon: 'sport' },
      { value: 'surfing', label: 'Surf', icon: 'sport' },
      { value: 'sailing', label: 'Voile', icon: 'sport' },
      { value: 'kayak', label: 'Kayak', icon: 'sport' },
      { value: 'diving', label: 'Plongée', icon: 'swim' },
    ],
  },
  {
    category: 'Glace & neige',
    options: [
      { value: 'hockey', label: 'Hockey', icon: 'hockey' },
      { value: 'skating', label: 'Patinage', icon: 'skating' },
      { value: 'ski', label: 'Ski', icon: 'ski' },
      { value: 'snowboard', label: 'Snowboard', icon: 'ski' },
      { value: 'cross_country_ski', label: 'Ski de fond', icon: 'ski' },
    ],
  },
  {
    category: 'Endurance & plein air',
    options: [
      { value: 'cycling', label: 'Cyclisme', icon: 'cycling' },
      { value: 'climbing', label: 'Escalade', icon: 'climbing' },
      { value: 'athletics', label: 'Athlétisme', icon: 'athletics' },
      { value: 'trail', label: 'Trail', icon: 'run' },
      { value: 'hiking', label: 'Randonnée', icon: 'run' },
      { value: 'orienteering', label: "Course d'orientation", icon: 'run' },
    ],
  },
  {
    category: 'Cible & précision',
    options: [
      { value: 'golf', label: 'Golf', icon: 'golf' },
      { value: 'archery', label: 'Tir à l\'arc', icon: 'archery' },
      { value: 'petanque', label: 'Pétanque', icon: 'sport' },
      { value: 'bowling', label: 'Bowling', icon: 'sport' },
    ],
  },
  {
    category: 'Artistique',
    options: [
      { value: 'gymnastics', label: 'Gymnastique', icon: 'gymnastics' },
      { value: 'dance', label: 'Danse', icon: 'dance' },
    ],
  },
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
  const [trailKm, setTrailKm] = useState(initial?.event_details?.trail_km ?? '')
  const [targetSports, setTargetSports] = useState(initial?.target_sports ?? [])
  const [otherSportNotes, setOtherSportNotes] = useState(initial?.other_sport_notes ?? '')
  const [openCategories, setOpenCategories] = useState(() => {
    const open = {}
    for (const group of SPORT_GROUPS) {
      if (group.options.some((o) => (initial?.target_sports ?? []).includes(o.value))) {
        open[group.category] = true
      }
    }
    return open
  })
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const hasEvent = events.length > 0 && !events.includes('none')
  const hasTrail = events.includes('trail')

  function toggleCategory(category) {
    setOpenCategories((current) => ({ ...current, [category]: !current[category] }))
  }

  function toggleRunningQuality(quality) {
    setFocusAreaPreferences((prefs) => {
      const running = prefs.running ?? { frequency: 2, mode: 'separate' }
      const qualities = running.qualities ?? []
      const nextQualities = qualities.includes(quality)
        ? qualities.filter((q) => q !== quality)
        : [...qualities, quality]
      return { ...prefs, running: { ...running, qualities: nextQualities } }
    })
  }

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

    if (focusAreas.length === 0) {
      setError('Choisis au moins un aspect à travailler.')
      return
    }

    if (events.length === 0) {
      setError("Sélectionne une compétition ou « Aucune pour l'instant » pour continuer.")
      return
    }

    setStatus('loading')
    const { error: upsertError } = await supabase.from('user_training_profile').upsert(
      {
        user_id: user.id,
        focus_areas: focusAreas,
        focus_area_preferences: focusAreaPreferences,
        upcoming_events: events,
        event_date: hasEvent && eventDate ? eventDate : null,
        event_details: hasTrail && trailKm ? { trail_km: Number(trailKm) } : null,
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
  const showCompetition = focusAreas.length > 0
  const showSports = focusAreas.length > 0 && events.length > 0

  return (
    <form onSubmit={handleSubmit}>
      <h2>Tes objectifs sportifs</h2>
      <p>On avance étape par étape — chaque choix débloque la suite.</p>

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
            <div key={area} className="focus-schedule-row onboarding-reveal">
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

              {area === 'running' && (
                <div className="running-detail onboarding-reveal">
                  <label>Qualités à améliorer</label>
                  <div className="chip-group" role="group" aria-label="Qualités de course à améliorer">
                    {RUNNING_QUALITIES.map((q) => {
                      const active = (pref.qualities ?? []).includes(q.value)
                      return (
                        <button
                          key={q.value}
                          type="button"
                          className={`chip${active ? ' chip-active' : ''}`}
                          aria-pressed={active}
                          onClick={() => toggleRunningQuality(q.value)}
                        >
                          {q.label}
                        </button>
                      )
                    })}
                  </div>

                  <label htmlFor="weekly-km">Kilométrage moyen visé par semaine (km)</label>
                  <input
                    id="weekly-km"
                    type="number"
                    min="0"
                    max="300"
                    value={pref.weekly_km ?? ''}
                    onChange={(e) =>
                      updateFocusAreaPreference('running', {
                        weekly_km: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="ex. 30"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showCompetition && (
        <div className="onboarding-reveal">
          <label>Compétition à venir</label>
          {events.length === 0 && (
            <p className="situation-disclaimer">
              Sélectionne au moins une option — ou « Aucune pour l'instant » — pour aller plus loin.
            </p>
          )}
          {EVENT_GROUPS.map((group) => (
            <div key={group.category} className="sport-category">
              <span className="eyebrow">{group.category}</span>
              <SelectableCardGrid
                options={group.options}
                selected={events}
                onToggle={(value) => setEvents((current) => toggleValue(current, value, 'none'))}
              />
            </div>
          ))}
          <div className="sport-category">
            <SelectableCardGrid
              options={[NONE_EVENT]}
              selected={events}
              onToggle={(value) => setEvents((current) => toggleValue(current, value, 'none'))}
              exclusiveValue="none"
            />
          </div>

          {hasTrail && (
            <div className="onboarding-reveal">
              <label htmlFor="trailKm">Distance du trail (km)</label>
              <input
                id="trailKm"
                type="number"
                min="0"
                max="500"
                value={trailKm}
                onChange={(e) => setTrailKm(e.target.value)}
                placeholder="ex. 21"
              />
            </div>
          )}

          {hasEvent && (
            <div className="onboarding-reveal">
              <label htmlFor="eventDate">Date de la compétition (optionnel)</label>
              <input id="eventDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {showSports && (
        <div className="onboarding-reveal">
          <label>Sport(s) pour lesquels progresser (optionnel)</label>
          {SPORT_GROUPS.map((group) => {
            const count = group.options.filter((o) => targetSports.includes(o.value)).length
            const open = Boolean(openCategories[group.category])
            return (
              <div key={group.category} className="sport-accordion">
                <button
                  type="button"
                  className="sport-accordion-summary"
                  onClick={() => toggleCategory(group.category)}
                  aria-expanded={open}
                >
                  <span>
                    {group.category}
                    {count > 0 && <span className="sport-accordion-count"> · {count}</span>}
                  </span>
                  <span className="sport-accordion-chevron">{open ? '▲' : '▼'}</span>
                </button>
                {open && (
                  <div className="onboarding-reveal">
                    <SelectableCardGrid
                      options={group.options}
                      selected={targetSports}
                      onToggle={(value) => setTargetSports((current) => toggleValue(current, value))}
                    />
                  </div>
                )}
              </div>
            )
          })}

          <p className="sport-other-label">Un autre sport, une discipline précise ou une information à préciser ?</p>
          <textarea
            id="otherSportNotes"
            value={otherSportNotes}
            onChange={(e) => setOtherSportNotes(e.target.value)}
            rows={3}
            placeholder="Ex. escrime, water-polo, danse, ou toute précision utile sur tes objectifs (optionnel)"
          />
        </div>
      )}

      {error && <p role="alert">{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        {onBack && (
          <button type="button" onClick={onBack}>
            Retour
          </button>
        )}
        <button
          type="submit"
          disabled={status === 'loading' || focusAreas.length === 0 || events.length === 0}
        >
          {status === 'loading' ? 'Enregistrement...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
