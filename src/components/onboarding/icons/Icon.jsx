const PATHS = {
  heart: (
    <path d="M12 20.5c-4-2.9-8-6-8-10.2A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8-.7 4.8 4.8 0 0 1 0 4C20 14.5 16 17.6 12 20.5Z" />
  ),
  run: (
    <>
      <circle cx="15.5" cy="4.5" r="1.6" />
      <path d="M13 9l2.5 2 3 1M9 22l3-6 2-2.5-2-3-4 1-1 4M13 9l-2 3.5 3 3 1.5 6" />
    </>
  ),
  lungs: (
    <path d="M12 3v9m0 0c-1-3-3-3-4.5-2S5 13 5 16s1.5 4 3 4 3-1.5 3.5-4M12 12c1-3 3-3 4.5-2s2.5 3 2.5 6-1.5 4-3 4-3-1.5-3.5-4" />
  ),
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  dumbbell: (
    <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
  ),
  jump: (
    <path d="M5 21 9 13l3 2 3-6M3 21h6M12 4l2 3-2 1-2-1 2-3ZM17 8l4 4-4 1" />
  ),
  stretch: <path d="M12 3v4M12 21a8 8 0 1 1 8-8M12 21l3-3M12 21l-3-3" />,
  scale: <path d="M12 3v18M6 7h12M6 7 3 13a3 3 0 0 0 6 0L6 7ZM18 7l-3 6a3 3 0 0 0 6 0l-3-6Z" />,
  bicep: <path d="M4 14c0-4 2-8 6-9l2 1 4-1 2 3-2 2c1 3 0 6-3 7-3 1-6 0-7-2l-2-1Z" />,
  hyrox: <path d="M3 17h4l2-6 3 10 3-14 2 10h4M3 21h18" />,
  obstacle: <path d="M4 21V9m0 0h6V4H4zM14 21V13m0 0h6V8h-6zM4 9h16" />,
  triathlon: (
    <path d="M4 18c1.5 0 1.5-2 3-2s1.5 2 3 2 1.5-2 3-2 1.5 2 3 2 1.5-2 3-2M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 13l3-4 3 2 3-5M17 4l2 2-3 2" />
  ),
  dash: <path d="M5 12h14" />,
  volleyball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c3 2.5 3 15.5 0 18M4 8c3 1 13 1 16 0M4 16c3-1 13-1 16 0" />
    </>
  ),
  football: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 8 3 2-1 4h-4l-1-4 3-2ZM12 3v5M6 9l-2.5-1M6 15l-2.5 1M18 9l2.5-1M18 15l2.5 1M9.5 19l1-3.5M14.5 19l-1-3.5" />
    </>
  ),
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18M5.5 5.5c3 3 3 10 0 13M18.5 5.5c-3 3-3 10 0 13" />
    </>
  ),
  swim: (
    <path d="M3 17c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0M6 13l4-5 4 2 4-4M9 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
  ),
  hockey: <path d="M6 3 4 15a2 2 0 0 0 2 2h2l10-3M6 21h6" />,
}

export default function Icon({ name, size = 28 }) {
  const content = PATHS[name]
  if (!content) return null

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content}
    </svg>
  )
}
