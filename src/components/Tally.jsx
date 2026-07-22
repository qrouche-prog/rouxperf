const BAR_GAP = 6

function TallyGroup({ count }) {
  const bars = Math.min(count, 4)
  const width = bars > 0 ? (bars - 1) * BAR_GAP + 6 : 6

  return (
    <svg width={width} height={18} viewBox={`0 0 ${width} 18`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <line
          key={i}
          x1={3 + i * BAR_GAP}
          y1={1}
          x2={3 + i * BAR_GAP}
          y2={17}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      {count === 5 && (
        <line x1={0} y1={17} x2={width} y2={1} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      )}
    </svg>
  )
}

export default function Tally({ count, max = 20 }) {
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
      {groups.map((n, i) => (
        <TallyGroup key={i} count={n} />
      ))}
      {count > max && <span>+{count - max}</span>}
    </span>
  )
}
