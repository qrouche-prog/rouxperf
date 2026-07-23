import { useId } from 'react'

export default function LogoMark({ size = 28 }) {
  const gradientId = `logo-flame-${useId()}`

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--flame-1)" />
          <stop offset="55%" stopColor="var(--flame-2)" />
          <stop offset="100%" stopColor="var(--flame-3)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="var(--page-bg)" />
      <g fill="none" stroke={`url(#${gradientId})`} strokeWidth={2.6} strokeLinecap="round">
        <line x1="8" y1="25" x2="8" y2="15" />
        <line x1="13" y1="25" x2="13" y2="9" />
        <line x1="18" y1="25" x2="18" y2="7" />
        <line x1="23" y1="25" x2="23" y2="13" />
        <line x1="5.5" y1="23" x2="26.5" y2="9.5" />
      </g>
    </svg>
  )
}
