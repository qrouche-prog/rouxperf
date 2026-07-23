import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function PersonalInfoStep({ onNext, submitLabel = 'Continuer' }) {
  const { user, profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '')
  const [sex, setSex] = useState(profile?.sex ?? '')
  const [heightCm, setHeightCm] = useState(profile?.height_cm ?? '')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!fullName.trim() || !birthDate || !sex || !heightCm) {
      setError('Merci de compléter tous les champs.')
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
    setStatus('idle')

    if (updateError) {
      setError(updateError.message)
      return
    }

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

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Enregistrement...' : submitLabel}
      </button>
    </form>
  )
}
