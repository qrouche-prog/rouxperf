export default function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 2 L30 16 L16 30 L2 16 Z"
        fill="none"
        stroke="var(--flame-2)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <g stroke="var(--flame-2)" strokeWidth="3.2" strokeLinecap="round">
        <line x1="12.5" y1="12.5" x2="19.5" y2="19.5" />
        <line x1="19.5" y1="12.5" x2="12.5" y2="19.5" />
      </g>
    </svg>
  )
}
