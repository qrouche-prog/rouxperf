import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import BodyFatGuide from './help/BodyFatGuide'
import MeasurementFieldHelp from './help/MeasurementFieldHelp'

export default function MeasurementsStep({ onNext, onBack }) {
  const { user } = useAuth()
  const [weightKg, setWeightKg] = useState('')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [waistCm, setWaistCm] = useState('')
  const [hipsCm, setHipsCm] = useState('')
  const [chestCm, setChestCm] = useState('')
  const [armCm, setArmCm] = useState('')
  const [thighCm, setThighCm] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!weightKg) {
      setError('Le poids actuel est nécessaire pour la suite.')
      return
    }

    setStatus('loading')
    const { error: insertError } = await supabase.from('body_measurements').insert({
      user_id: user.id,
      weight_kg: Number(weightKg),
      body_fat_pct: bodyFatPct ? Number(bodyFatPct) : null,
      waist_cm: waistCm ? Number(waistCm) : null,
      hips_cm: hipsCm ? Number(hipsCm) : null,
      chest_cm: chestCm ? Number(chestCm) : null,
      arm_cm: armCm ? Number(armCm) : null,
      thigh_cm: thighCm ? Number(thighCm) : null,
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
      <h2>Tes mesures actuelles</h2>
      <p>Seul le poids est obligatoire, le reste t'aidera à suivre ta progression plus précisément.</p>

      <label htmlFor="weightKg">Poids (kg)</label>
      <input
        id="weightKg"
        type="number"
        step="0.1"
        min="30"
        max="300"
        value={weightKg}
        onChange={(e) => setWeightKg(e.target.value)}
        required
      />

      <div className="field-label-row">
        <label htmlFor="bodyFatPct">Masse grasse (%, optionnel)</label>
        <BodyFatGuide />
      </div>
      <input
        id="bodyFatPct"
        type="number"
        step="0.1"
        min="1"
        max="70"
        value={bodyFatPct}
        onChange={(e) => setBodyFatPct(e.target.value)}
      />

      <div className="field-label-row">
        <label htmlFor="waistCm">Tour de taille (cm, optionnel)</label>
        <MeasurementFieldHelp type="waist" />
      </div>
      <input id="waistCm" type="number" step="0.1" value={waistCm} onChange={(e) => setWaistCm(e.target.value)} />

      <div className="field-label-row">
        <label htmlFor="hipsCm">Tour de hanches (cm, optionnel)</label>
        <MeasurementFieldHelp type="hips" />
      </div>
      <input id="hipsCm" type="number" step="0.1" value={hipsCm} onChange={(e) => setHipsCm(e.target.value)} />

      <div className="field-label-row">
        <label htmlFor="chestCm">Tour de poitrine (cm, optionnel)</label>
        <MeasurementFieldHelp type="chest" />
      </div>
      <input id="chestCm" type="number" step="0.1" value={chestCm} onChange={(e) => setChestCm(e.target.value)} />

      <div className="field-label-row">
        <label htmlFor="armCm">Tour de bras (cm, optionnel)</label>
        <MeasurementFieldHelp type="arm" />
      </div>
      <input id="armCm" type="number" step="0.1" value={armCm} onChange={(e) => setArmCm(e.target.value)} />

      <div className="field-label-row">
        <label htmlFor="thighCm">Tour de cuisse (cm, optionnel)</label>
        <MeasurementFieldHelp type="thigh" />
      </div>
      <input id="thighCm" type="number" step="0.1" value={thighCm} onChange={(e) => setThighCm(e.target.value)} />

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
