import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

// "hybrid" retiré de la liste : traité de façon strictement identique à
// "recomposition" côté génération (même règle de programmation dans le
// system prompt) — les deux proposer comme choix distincts n'apportait que
// de la confusion. "hybrid" reste une valeur backend valide (anciens profils).
const GOAL_TYPES = [
  { value: 'weight_loss', label: 'Perte de poids' },
  { value: 'muscle_gain', label: 'Prise de muscle' },
  { value: 'strength', label: 'Force' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'general_fitness', label: 'Forme générale' },
  { value: 'recomposition', label: 'Recomposition corporelle' },
]

const DURATIONS = [
  { value: 1, label: '1 mois', tag: 'Gratuit' },
  { value: 3, label: '3 mois', tag: 'Payant' },
]

const MS_PER_DAY = 1000 * 60 * 60 * 24

export default function GoalsStep({ onNext, onBack, initial, submitLabel = 'Continuer' }) {
  const { user } = useAuth()
  const [goalType, setGoalType] = useState(initial?.goal_type ?? '')
  const [targetWeightKg, setTargetWeightKg] = useState(initial?.target_weight_kg ?? '')
  const [targetDate, setTargetDate] = useState(initial?.target_date ?? '')
  const [durationMonths, setDurationMonths] = useState(initial?.program_duration_months ?? 1)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const daysUntilTarget = targetDate ? Math.round((new Date(targetDate) - new Date()) / MS_PER_DAY) : null
  const targetTooSoon = daysUntilTarget != null && daysUntilTarget >= 0 && daysUntilTarget < 30

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!goalType) {
      setError('Choisis un objectif.')
      return
    }

    setStatus('loading')

    const values = {
      goal_type: goalType,
      target_weight_kg: targetWeightKg ? Number(targetWeightKg) : null,
      target_date: targetDate || null,
      program_duration_months: Number(durationMonths),
    }

    // Idempotent : si un objectif actif existe déjà (retour arrière), on le met
    // à jour au lieu d'empiler une nouvelle ligne à chaque passage.
    if (initial?.id) {
      const { error: updateError } = await supabase.from('goals').update(values).eq('id', initial.id)
      setStatus('idle')
      if (updateError) {
        setError(updateError.message)
        return
      }
      onNext()
      return
    }

    const { error: deactivateError } = await supabase
      .from('goals')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (deactivateError) {
      setStatus('idle')
      setError(deactivateError.message)
      return
    }

    const { error: insertError } = await supabase.from('goals').insert({
      user_id: user.id,
      ...values,
      is_active: true,
    })
    setStatus('idle')

    if (insertError) {
      setError(insertError.message)
      return
    }

    onNext()
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Ton objectif</h2>

      <label htmlFor="goalType">Type d'objectif</label>
      <select id="goalType" value={goalType} onChange={(e) => setGoalType(e.target.value)} required>
        <option value="">Choisir...</option>
        {GOAL_TYPES.map((goal) => (
          <option key={goal.value} value={goal.value}>
            {goal.label}
          </option>
        ))}
      </select>

      <label>Durée du programme</label>
      <div className="segmented" role="radiogroup" aria-label="Durée du programme">
        {DURATIONS.map((d) => (
          <button
            key={d.value}
            type="button"
            className={`segmented-option${durationMonths === d.value ? ' segmented-option-active' : ''}`}
            aria-pressed={durationMonths === d.value}
            onClick={() => setDurationMonths(d.value)}
          >
            {d.label}
            <span className="segmented-tag">{d.tag}</span>
          </button>
        ))}
      </div>
      <p className="eyebrow">
        {durationMonths === 1
          ? "L'offre 1 mois est gratuite."
          : 'La formule 3 mois est payante ; sinon on régénère ton programme chaque mois.'}
      </p>

      <label htmlFor="targetWeightKg">Poids cible (kg, optionnel)</label>
      <input
        id="targetWeightKg"
        type="number"
        step="0.1"
        value={targetWeightKg}
        onChange={(e) => setTargetWeightKg(e.target.value)}
      />

      <label htmlFor="targetDate">Date cible (optionnel)</label>
      <input id="targetDate" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />

      {targetDate && !targetTooSoon && (
        <p className="eyebrow">L'IA calera la progression de ton programme sur cette échéance.</p>
      )}
      {targetTooSoon && (
        <p className="situation-disclaimer">
          ⚠️ Ta date cible est à moins d'un mois — c'est un délai court, l'objectif sera plus difficile à atteindre
          et les résultats risquent d'être limités.
        </p>
      )}

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
