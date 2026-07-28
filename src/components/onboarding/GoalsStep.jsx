import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const GOAL_TYPES = [
  { value: 'weight_loss', label: 'Perte de poids' },
  { value: 'muscle_gain', label: 'Prise de muscle' },
  { value: 'strength', label: 'Force' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'general_fitness', label: 'Forme générale' },
  { value: 'recomposition', label: 'Recomposition corporelle' },
  { value: 'hybrid', label: 'Hybride' },
]

const DURATIONS = [
  { value: 1, label: '1 mois' },
  { value: 3, label: '3 mois' },
]

export default function GoalsStep({ onNext, onBack, initial, submitLabel = 'Continuer' }) {
  const { user } = useAuth()
  const [goalType, setGoalType] = useState(initial?.goal_type ?? '')
  const [targetWeightKg, setTargetWeightKg] = useState(initial?.target_weight_kg ?? '')
  const [targetDate, setTargetDate] = useState(initial?.target_date ?? '')
  const [durationMonths, setDurationMonths] = useState(initial?.program_duration_months ?? 1)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

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
          </button>
        ))}
      </div>

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

      {targetDate && (
        <p className="eyebrow">L'IA calera la progression de ton programme sur cette échéance.</p>
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
