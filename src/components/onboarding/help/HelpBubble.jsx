import { useState } from 'react'

export default function HelpBubble({ label, children }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="help-bubble">
      <button
        type="button"
        className="help-bubble-trigger"
        aria-expanded={open}
        aria-label={`Comment mesurer : ${label}`}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <div className="help-bubble-panel" role="tooltip">
          {children}
        </div>
      )}
    </span>
  )
}
