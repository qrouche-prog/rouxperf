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
]

export default function GoalsStep({ onNext, onBack }) {
  const { user } = useAuth()
  const [goalType, setGoalType] = useState('')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [targetDate, setTargetDate] = useState('')
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
      goal_type: goalType,
      target_weight_kg: targetWeightKg ? Number(targetWeightKg) : null,
      target_date: targetDate || null,
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
