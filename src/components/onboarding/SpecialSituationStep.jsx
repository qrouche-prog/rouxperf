import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import SelectableCardGrid from './SelectableCardGrid'

const SITUATIONS = [
  { value: 'none', label: 'Aucune particularité', icon: 'check' },
  { value: 'pregnant', label: 'Grossesse', icon: 'pregnancy' },
  { value: 'postpartum', label: 'Post-partum', icon: 'baby' },
  { value: 'injury_rehab', label: 'Rééducation / blessure en cours', icon: 'medical' },
  { value: 'competitive_athlete', label: 'Athlète confirmé / compétiteur', icon: 'trophy' },
]

const NEEDS_DISCLAIMER = new Set(['pregnant', 'postpartum', 'injury_rehab'])

function defaultDetails(situation) {
  switch (situation) {
    case 'pregnant':
      return { trimester: 1 }
    case 'postpartum':
      return { weeks_since_birth: 6, delivery_type: 'unspecified' }
    case 'injury_rehab':
      return { area: '', pathology: '', cleared_by_professional: false }
    case 'competitive_athlete':
      return { discipline: '', competition_phase: 'off_season' }
    default:
      return {}
  }
}

export default function SpecialSituationStep({ onNext, onBack, initial, submitLabel = 'Continuer' }) {
  const { user } = useAuth()
  const [situation, setSituation] = useState(initial?.special_situation ?? 'none')
  const [details, setDetails] = useState(initial?.special_situation_details ?? defaultDetails(initial?.special_situation ?? 'none'))
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  function handleSituationChange(value) {
    setSituation(value)
    setDetails(defaultDetails(value))
  }

  function updateDetail(patch) {
    setDetails((current) => ({ ...current, ...patch }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setStatus('loading')

    const { error: upsertError } = await supabase.from('user_training_profile').upsert(
      {
        user_id: user.id,
        special_situation: situation,
        special_situation_details: situation === 'none' ? null : details,
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
      <h2>Ta situation actuelle</h2>
      <p>
        Ces informations orientent réellement le choix des exercices et l'intensité — sois précis, ça évite les
        mauvaises surprises.
      </p>

      <SelectableCardGrid
        options={SITUATIONS}
        selected={[situation]}
        onToggle={handleSituationChange}
      />

      {situation === 'pregnant' && (
        <>
          <label htmlFor="trimester">Trimestre</label>
          <select
            id="trimester"
            value={details.trimester ?? 1}
            onChange={(e) => updateDetail({ trimester: Number(e.target.value) })}
          >
            <option value={1}>1er trimestre</option>
            <option value={2}>2e trimestre</option>
            <option value={3}>3e trimestre</option>
          </select>
        </>
      )}

      {situation === 'postpartum' && (
        <>
          <label htmlFor="weeksSinceBirth">Depuis combien de semaines as-tu accouché ?</label>
          <input
            id="weeksSinceBirth"
            type="number"
            min="0"
            max="104"
            value={details.weeks_since_birth ?? ''}
            onChange={(e) => updateDetail({ weeks_since_birth: Number(e.target.value) })}
          />

          <label htmlFor="deliveryType">Type d'accouchement</label>
          <select
            id="deliveryType"
            value={details.delivery_type ?? 'unspecified'}
            onChange={(e) => updateDetail({ delivery_type: e.target.value })}
          >
            <option value="unspecified">Préfère ne pas préciser</option>
            <option value="vaginal">Voie basse</option>
            <option value="cesarean">Césarienne</option>
          </select>
        </>
      )}

      {situation === 'injury_rehab' && (
        <>
          <label htmlFor="rehabArea">Zone concernée (ex. genou, épaule, lombaires)</label>
          <input id="rehabArea" value={details.area ?? ''} onChange={(e) => updateDetail({ area: e.target.value })} />

          <label htmlFor="rehabPathology">Pathologie / blessure (si connue, optionnel)</label>
          <input
            id="rehabPathology"
            value={details.pathology ?? ''}
            onChange={(e) => updateDetail({ pathology: e.target.value })}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={details.cleared_by_professional ?? false}
              onChange={(e) => updateDetail({ cleared_by_professional: e.target.checked })}
            />
            Un professionnel de santé (médecin, physiothérapeute) m'a donné son accord pour reprendre une activité
            physique
          </label>
        </>
      )}

      {situation === 'competitive_athlete' && (
        <>
          <label htmlFor="discipline">Discipline principale</label>
          <input
            id="discipline"
            value={details.discipline ?? ''}
            onChange={(e) => updateDetail({ discipline: e.target.value })}
          />

          <label htmlFor="competitionPhase">Phase actuelle</label>
          <select
            id="competitionPhase"
            value={details.competition_phase ?? 'off_season'}
            onChange={(e) => updateDetail({ competition_phase: e.target.value })}
          >
            <option value="off_season">Hors-saison (développement général)</option>
            <option value="pre_season">Avant-saison (montée en intensité)</option>
            <option value="in_season">En saison (maintien)</option>
            <option value="taper">Affûtage avant compétition</option>
          </select>
        </>
      )}

      {NEEDS_DISCLAIMER.has(situation) && (
        <p className="situation-disclaimer">
          Le programme généré reste une proposition automatisée à titre indicatif. Il ne remplace pas l'avis d'un
          professionnel de santé — consulte ton médecin, ta sage-femme ou ton physiothérapeute avant de commencer,
          et arrête tout exercice provoquant une douleur inhabituelle.
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
