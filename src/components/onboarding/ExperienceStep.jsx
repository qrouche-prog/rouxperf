import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ExperienceLevelGuide from './help/ExperienceLevelGuide'

export default function ExperienceStep({ onNext, onBack, initial, submitLabel = 'Continuer' }) {
  const { user } = useAuth()
  const [experienceLevel, setExperienceLevel] = useState(initial?.experience_level ?? '')
  const [yearsTraining, setYearsTraining] = useState(initial?.years_training ?? '')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!experienceLevel) {
      setError('Choisis ton niveau.')
      return
    }

    setStatus('loading')
    const { error: upsertError } = await supabase.from('user_training_profile').upsert(
      {
        user_id: user.id,
        experience_level: experienceLevel,
        years_training: yearsTraining ? Number(yearsTraining) : null,
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
      <h2>Ton expérience sportive</h2>

      <div className="field-label-row">
        <label htmlFor="experienceLevel">Niveau</label>
        <ExperienceLevelGuide />
      </div>
      <select
        id="experienceLevel"
        value={experienceLevel}
        onChange={(e) => setExperienceLevel(e.target.value)}
        required
      >
        <option value="">Choisir...</option>
        <option value="beginner">Débutant</option>
        <option value="intermediate">Intermédiaire</option>
        <option value="advanced">Avancé</option>
      </select>

      <label htmlFor="yearsTraining">Années de pratique (optionnel)</label>
      <input
        id="yearsTraining"
        type="number"
        step="0.5"
        min="0"
        value={yearsTraining}
        onChange={(e) => setYearsTraining(e.target.value)}
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
