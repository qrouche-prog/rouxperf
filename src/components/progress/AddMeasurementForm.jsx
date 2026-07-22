import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import BodyFatGuide from '../onboarding/help/BodyFatGuide'
import MeasurementFieldHelp from '../onboarding/help/MeasurementFieldHelp'

export default function AddMeasurementForm({ onAdded }) {
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
      setError('Le poids est nécessaire.')
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

    setWeightKg('')
    setBodyFatPct('')
    setWaistCm('')
    setHipsCm('')
    setChestCm('')
    setArmCm('')
    setThighCm('')
    onAdded()
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>Ajouter une mesure</h3>

      <label htmlFor="progressWeightKg">Poids (kg)</label>
      <input
        id="progressWeightKg"
        type="number"
        step="0.1"
        min="30"
        max="300"
        value={weightKg}
        onChange={(e) => setWeightKg(e.target.value)}
        required
      />

      <div className="field-label-row">
        <label htmlFor="progressBodyFatPct">Masse grasse (%, optionnel)</label>
        <BodyFatGuide />
      </div>
      <input
        id="progressBodyFatPct"
        type="number"
        step="0.1"
        min="1"
        max="70"
        value={bodyFatPct}
        onChange={(e) => setBodyFatPct(e.target.value)}
      />

      <div className="field-label-row">
        <label htmlFor="progressWaistCm">Tour de taille (cm, optionnel)</label>
        <MeasurementFieldHelp type="waist" />
      </div>
      <input id="progressWaistCm" type="number" step="0.1" value={waistCm} onChange={(e) => setWaistCm(e.target.value)} />

      <div className="field-label-row">
        <label htmlFor="progressHipsCm">Tour de hanches (cm, optionnel)</label>
        <MeasurementFieldHelp type="hips" />
      </div>
      <input id="progressHipsCm" type="number" step="0.1" value={hipsCm} onChange={(e) => setHipsCm(e.target.value)} />

      <div className="field-label-row">
        <label htmlFor="progressChestCm">Tour de poitrine (cm, optionnel)</label>
        <MeasurementFieldHelp type="chest" />
      </div>
      <input id="progressChestCm" type="number" step="0.1" value={chestCm} onChange={(e) => setChestCm(e.target.value)} />

      <div className="field-label-row">
        <label htmlFor="progressArmCm">Tour de bras (cm, optionnel)</label>
        <MeasurementFieldHelp type="arm" />
      </div>
      <input id="progressArmCm" type="number" step="0.1" value={armCm} onChange={(e) => setArmCm(e.target.value)} />

      <div className="field-label-row">
        <label htmlFor="progressThighCm">Tour de cuisse (cm, optionnel)</label>
        <MeasurementFieldHelp type="thigh" />
      </div>
      <input id="progressThighCm" type="number" step="0.1" value={thighCm} onChange={(e) => setThighCm(e.target.value)} />

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Enregistrement...' : 'Ajouter'}
      </button>
    </form>
  )
}
