function round(value) {
  return Math.round(value * 10) / 10
}

function latestValue(measurements, field) {
  for (let i = measurements.length - 1; i >= 0; i--) {
    if (measurements[i][field] != null) return Number(measurements[i][field])
  }
  return null
}

function durationLabel(days) {
  if (days < 14) return `${days} jour${days > 1 ? 's' : ''}`
  if (days < 60) {
    const weeks = Math.round(days / 7)
    return `${weeks} semaine${weeks > 1 ? 's' : ''}`
  }
  const months = Math.round(days / 30)
  return `${months} mois`
}

function weightProgress(measurements) {
  const points = measurements
    .filter((m) => m.weight_kg != null)
    .map((m) => ({ date: m.measured_at, value: Number(m.weight_kg) }))

  if (points.length < 2) return null

  const first = points[0]
  const last = points[points.length - 1]
  const days = Math.round((new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24))
  if (days <= 0) return null

  return { deltaKg: round(last.value - first.value), label: durationLabel(days) }
}

export default function MeasurementSummaryRow({ measurements }) {
  const weight = latestValue(measurements, 'weight_kg')
  const bodyFat = latestValue(measurements, 'body_fat_pct')
  const progress = weightProgress(measurements)

  return (
    <div className="measurement-summary">
      <a href="#measurement-weight_kg" className="measurement-summary-item">
        <span className="measurement-summary-value">
          {weight != null ? round(weight) : '—'}
          {weight != null && <span className="measurement-unit">kg</span>}
        </span>
        <span className="measurement-summary-label">Poids</span>
      </a>

      <a href="#measurement-body_fat_pct" className="measurement-summary-item">
        <span className="measurement-summary-value">
          {bodyFat != null ? round(bodyFat) : '—'}
          {bodyFat != null && <span className="measurement-unit">%</span>}
        </span>
        <span className="measurement-summary-label">Masse grasse</span>
      </a>

      {progress && (
        <span className="measurement-summary-progress">
          <span className="measurement-summary-value">
            {progress.deltaKg > 0 ? '+' : ''}
            {progress.deltaKg} kg
          </span>
          <span className="measurement-summary-label">Progression en {progress.label}</span>
        </span>
      )}
    </div>
  )
}
