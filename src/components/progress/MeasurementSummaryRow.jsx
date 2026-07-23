function round(value) {
  return Math.round(value * 10) / 10
}

function latestValue(measurements, field) {
  for (let i = measurements.length - 1; i >= 0; i--) {
    if (measurements[i][field] != null) return Number(measurements[i][field])
  }
  return null
}

function overallProgressPct(measurements, fields) {
  const pcts = []
  for (const field of fields) {
    const points = measurements.filter((m) => m[field] != null).map((m) => Number(m[field]))
    if (points.length >= 2 && points[0] !== 0) {
      pcts.push(((points[points.length - 1] - points[0]) / points[0]) * 100)
    }
  }
  if (pcts.length === 0) return null
  return pcts.reduce((sum, p) => sum + p, 0) / pcts.length
}

export default function MeasurementSummaryRow({ fields, measurements }) {
  const progress = overallProgressPct(
    measurements,
    fields.map((field) => field.value)
  )

  return (
    <div className="measurement-summary">
      {fields.map((field) => {
        const value = latestValue(measurements, field.value)
        return (
          <a key={field.value} href={`#measurement-${field.value}`} className="measurement-summary-item">
            <span className="measurement-summary-value">
              {value != null ? round(value) : '—'}
              {value != null && <span className="measurement-unit">{field.unit}</span>}
            </span>
            <span className="measurement-summary-label">{field.label}</span>
          </a>
        )
      })}
      {progress != null && (
        <span className="measurement-summary-progress">
          <span className="measurement-summary-value">
            {progress > 0 ? '+' : ''}
            {round(progress)}%
          </span>
          <span className="measurement-summary-label">Progression</span>
        </span>
      )}
    </div>
  )
}
