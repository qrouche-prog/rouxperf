import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import BodyFatGuide from './help/BodyFatGuide'
import MeasurementFieldHelp from './help/MeasurementFieldHelp'

export default function PersonalInfoStep({
  onNext,
  submitLabel = 'Continuer',
  includeMeasurements = false,
  initialMeasurement = null,
}) {
  const { user, profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '')
  const [sex, setSex] = useState(profile?.sex ?? '')
  const [heightCm, setHeightCm] = useState(profile?.height_cm ?? '')

  const [weightKg, setWeightKg] = useState(initialMeasurement?.weight_kg ?? '')
  const [bodyFatPct, setBodyFatPct] = useState(initialMeasurement?.body_fat_pct ?? '')
  const [waistCm, setWaistCm] = useState(initialMeasurement?.waist_cm ?? '')
  const [hipsCm, setHipsCm] = useState(initialMeasurement?.hips_cm ?? '')
  const [chestCm, setChestCm] = useState(initialMeasurement?.chest_cm ?? '')
  const [armCm, setArmCm] = useState(initialMeasurement?.arm_cm ?? '')
  const [thighCm, setThighCm] = useState(initialMeasurement?.thigh_cm ?? '')
  const hasInitialMeasurements = Boolean(
    initialMeasurement &&
      (initialMeasurement.body_fat_pct != null ||
        initialMeasurement.waist_cm != null ||
        initialMeasurement.hips_cm != null ||
        initialMeasurement.chest_cm != null ||
        initialMeasurement.arm_cm != null ||
        initialMeasurement.thigh_cm != null)
  )
  const [showMeasurements, setShowMeasurements] = useState(hasInitialMeasurements)

  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!fullName.trim() || !birthDate || !sex || !heightCm) {
      setError('Merci de compléter tous les champs.')
      return
    }
    if (includeMeasurements && !weightKg) {
      setError('Le poids actuel est nécessaire pour la suite.')
      return
    }

    setStatus('loading')
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        birth_date: birthDate,
        sex,
        height_cm: Number(heightCm),
      })
      .eq('user_id', user.id)

    if (updateError) {
      setStatus('idle')
      setError(updateError.message)
      return
    }

    if (includeMeasurements) {
      const measurementValues = {
        weight_kg: Number(weightKg),
        body_fat_pct: bodyFatPct ? Number(bodyFatPct) : null,
        waist_cm: waistCm ? Number(waistCm) : null,
        hips_cm: hipsCm ? Number(hipsCm) : null,
        chest_cm: chestCm ? Number(chestCm) : null,
        arm_cm: armCm ? Number(armCm) : null,
        thigh_cm: thighCm ? Number(thighCm) : null,
      }

      // Met à jour la mesure d'onboarding existante plutôt que d'en insérer une
      // nouvelle à chaque passage — évite les doublons au retour arrière.
      const { error: measurementError } = initialMeasurement?.id
        ? await supabase.from('body_measurements').update(measurementValues).eq('id', initialMeasurement.id)
        : await supabase.from('body_measurements').insert({ user_id: user.id, ...measurementValues })

      if (measurementError) {
        setStatus('idle')
        setError(measurementError.message)
        return
      }
    }

    setStatus('idle')
    await refreshProfile()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Informations personnelles</h2>

      <label htmlFor="fullName">Nom complet</label>
      <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />

      <label htmlFor="birthDate">Date de naissance</label>
      <input
        id="birthDate"
        type="date"
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
        required
      />

      <label htmlFor="sex">Sexe</label>
      <select id="sex" value={sex} onChange={(e) => setSex(e.target.value)} required>
        <option value="">Choisir...</option>
        <option value="female">Femme</option>
        <option value="male">Homme</option>
        <option value="other">Autre</option>
      </select>

      <label htmlFor="heightCm">Taille (cm)</label>
      <input
        id="heightCm"
        type="number"
        min="100"
        max="250"
        value={heightCm}
        onChange={(e) => setHeightCm(e.target.value)}
        required
      />

      {includeMeasurements && (
        <>
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

          <label className="measurements-toggle">
            <input
              type="checkbox"
              checked={showMeasurements}
              onChange={(e) => setShowMeasurements(e.target.checked)}
            />
            Ajouter mes mensurations (optionnel, pour un suivi plus précis)
          </label>

          {showMeasurements && (
            <div className="onboarding-reveal">
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
            </div>
          )}
        </>
      )}

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Enregistrement...' : submitLabel}
      </button>
    </form>
  )
}
