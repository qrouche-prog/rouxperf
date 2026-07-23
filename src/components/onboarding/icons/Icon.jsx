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
  home: <path d="M4 11 12 4l8 7M6 10v9h5v-5h2v5h5v-9" />,
  check: <path d="M4 12.5 9.5 18 20 6" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.5-2.4.8a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.4 2.3a7.6 7.6 0 0 0-2.6 1.5l-2.4-.8-2 3.5 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.5 2.4-.8a7.6 7.6 0 0 0 2.6 1.5L10 22h4l.4-2.3a7.6 7.6 0 0 0 2.6-1.5l2.4.8 2-3.5-2-1.5Z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </>
  ),
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
  combat: (
    <>
      <path d="M3 9a3 3 0 0 1 3-3c1.7 0 3 1.3 3 3v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
      <path d="M21 9a3 3 0 0 0-3-3c-1.7 0-3 1.3-3 3v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V9Z" />
      <path d="M9 12h6" />
    </>
  ),
  tennis: (
    <>
      <ellipse cx="12" cy="9" rx="5.5" ry="6.5" />
      <path d="M12 2.5v13M6.7 9h10.6" />
      <path d="M12 15.5V22M9.5 22h5" />
    </>
  ),
  rugby: (
    <>
      <path d="M12 3c4 0 7 4 7 9s-3 9-7 9-7-4-7-9 3-9 7-9Z" />
      <path d="M12 3v18M8.5 8h7M8.5 16h7" />
    </>
  ),
  cycling: (
    <>
      <circle cx="6" cy="17" r="3.5" />
      <circle cx="18" cy="17" r="3.5" />
      <path d="M6 17l4-8h5l3 8M10 9l3-4h3M13 9l5 8" />
    </>
  ),
  climbing: (
    <>
      <path d="M3 19 9 8l3 5 2-3 7 9H3Z" />
      <circle cx="9" cy="5" r="1.6" />
    </>
  ),
  golf: (
    <>
      <path d="M6 21V4M6 4l9 3-9 3" />
      <circle cx="6" cy="21" r="1.4" fill="currentColor" />
    </>
  ),
  badminton: (
    <>
      <path d="M12 3l4 7-8 3 4-10Z" />
      <path d="M12 13v9M9.5 22h5" />
    </>
  ),
  handball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M6 6l12 12M18 6 6 18" />
    </>
  ),
  athletics: (
    <>
      <path d="M3 18c4-8 14-8 18 0" />
      <path d="M3 21c4-6 14-6 18 0" />
    </>
  ),
  pregnancy: (
    <>
      <circle cx="12" cy="5" r="2.2" />
      <path d="M9 8c-3 1-4 4-4 7a7 7 0 0 0 14 0c0-2-.5-3.5-1.5-5" />
    </>
  ),
  baby: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M9 10c.5 1 1.5 1.5 3 1.5s2.5-.5 3-1.5M9 8h.01M15 8h.01" />
      <path d="M12 14v7" />
    </>
  ),
  medical: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
      <path d="M12 13v5M9 21h6" />
    </>
  ),
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
