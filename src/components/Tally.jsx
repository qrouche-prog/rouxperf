import { useId } from 'react'

const BAR_GAP = 6

function TallyGroup({ count, gradientId }) {
  const bars = Math.min(count, 4)
  const width = bars > 0 ? (bars - 1) * BAR_GAP + 6 : 6
  const stroke = `url(#${gradientId})`

  return (
    <svg width={width} height={18} viewBox={`0 0 ${width} 18`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <line
          key={i}
          x1={3 + i * BAR_GAP}
          y1={1}
          x2={3 + i * BAR_GAP}
          y2={17}
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      {count === 5 && <line x1={0} y1={17} x2={width} y2={1} stroke={stroke} strokeWidth={2} strokeLinecap="round" />}
    </svg>
  )
}

export default function Tally({ count, max = 20 }) {
  const gradientId = `tally-flame-${useId()}`

  if (!count || count <= 0) {
    return <span className="tally tally-empty">—</span>
  }

  const shown = Math.min(count, max)
  const groups = []
  let remaining = shown
  while (remaining > 0) {
    const n = Math.min(remaining, 5)
    groups.push(n)
    remaining -= n
  }

  return (
    <span className="tally" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} aria-label={String(count)}>
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--flame-3)" />
            <stop offset="55%" stopColor="var(--flame-2)" />
            <stop offset="100%" stopColor="var(--flame-1)" />
          </linearGradient>
        </defs>
      </svg>
      {groups.map((n, i) => (
        <TallyGroup key={i} count={n} gradientId={gradientId} />
      ))}
      {count > max && <span>+{count - max}</span>}
    </span>
  )
}
