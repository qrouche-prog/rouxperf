import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import MeasurementChart from './MeasurementChart'

function round(value) {
  return Math.round(value * 10) / 10
}

export default function MeasurementCard({ field, label, unit, data, onAdded }) {
  const { user } = useAuth()
  const [value, setValue] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const points = data
    .filter((entry) => entry[field] != null)
    .map((entry) => ({ date: entry.measured_at, value: Number(entry[field]) }))

  const latest = points.length ? points[points.length - 1].value : null
  const previous = points.length > 1 ? points[points.length - 2].value : null
  const delta = latest != null && previous != null ? round(latest - previous) : null

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!value) return

    setStatus('loading')
    const { error: insertError } = await supabase.from('body_measurements').insert({
      user_id: user.id,
      [field]: Number(value),
    })
    setStatus('idle')

    if (insertError) {
      setError(insertError.message)
      return
    }

    setValue('')
    onAdded()
  }

  return (
    <div className="card measurement-card">
      <div className="measurement-card-header">
        <div>
          <span className="eyebrow">{label}</span>
          <p className={`measurement-latest${latest == null ? ' measurement-latest-empty' : ''}`}>
            {latest != null ? round(latest) : '—'}
            {latest != null && <span className="measurement-unit">{unit}</span>}
          </p>
        </div>
        {delta != null && delta !== 0 && (
          <span className={`measurement-delta${delta > 0 ? ' measurement-delta-up' : ' measurement-delta-down'}`}>
            {delta > 0 ? '+' : ''}
            {delta} {unit}
          </span>
        )}
      </div>

      <MeasurementChart points={points} unit={unit} label={label} />

      <form className="measurement-quick-add" onSubmit={handleSubmit}>
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          placeholder={`Nouvelle valeur (${unit})`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`Nouvelle valeur pour ${label} (${unit})`}
        />
        <button type="submit" disabled={status === 'loading' || !value} aria-label={`Ajouter une mesure pour ${label}`}>
          {status === 'loading' ? '…' : '+'}
        </button>
      </form>
      {error && (
        <p role="alert" className="measurement-error">
          {error}
        </p>
      )}
    </div>
  )
}
