const BANDS = {
  chest: { type: 'line', y: 58 },
  waist: { type: 'line', y: 92 },
  hips: { type: 'line', y: 112 },
  arm: { type: 'ring', cx: 29, cy: 54, rx: 8, ry: 12 },
  thigh: { type: 'ring', cx: 29, cy: 150, rx: 9, ry: 15 },
}

export default function MeasurementSilhouette({ highlight }) {
  const band = BANDS[highlight]

  return (
    <svg
      viewBox="0 0 100 200"
      width="80"
      height="160"
      role="img"
      aria-label={`Emplacement de la mesure : ${highlight}`}
    >
      <circle cx="50" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M35 30 Q30 60 32 90 Q34 110 30 130 L70 130 Q66 110 68 90 Q70 60 65 30 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M35 34 L18 90" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M65 34 L82 90" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M32 130 L26 195" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M68 130 L74 195" fill="none" stroke="currentColor" strokeWidth="2" />

      {band.type === 'line' && (
        <line x1="20" y1={band.y} x2="80" y2={band.y} stroke="#D3242A" strokeWidth="3" strokeDasharray="4 3" />
      )}
      {band.type === 'ring' && (
        <ellipse
          cx={band.cx}
          cy={band.cy}
          rx={band.rx}
          ry={band.ry}
          fill="none"
          stroke="#D3242A"
          strokeWidth="3"
          strokeDasharray="4 3"
        />
      )}
    </svg>
  )
}
