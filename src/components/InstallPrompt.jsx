import { useEffect, useState } from 'react'
import { usePwaInstall } from '../lib/pwaInstall'

/* Invite à installer rouXperf sur l'écran d'accueil.
   - Android / Chrome / Edge : vrai bouton « Installer » (via beforeinstallprompt).
   - iOS / Safari : pas d'API → instructions manuelles.
   Se masque si l'app tourne déjà en standalone ou si l'invite a été rejetée. */

const DISMISS_KEY = 'rouxperf-install-dismissed'

function ShareGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ verticalAlign: '-3px', margin: '0 2px' }}
    >
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
    </svg>
  )
}

export default function InstallPrompt() {
  const { canInstall, isIOS, isStandalone, promptInstall } = usePwaInstall()
  const [dismissed, setDismissed] = useState(true)
  const [iosReady, setIosReady] = useState(false)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      setDismissed(false)
    }
    // iOS : pas d'événement d'install → on montre les instructions après un délai.
    const t = window.setTimeout(() => setIosReady(true), 1500)
    return () => window.clearTimeout(t)
  }, [])

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
  }

  async function install() {
    await promptInstall()
    dismiss()
  }

  if (isStandalone() || dismissed) return null

  const showAndroid = canInstall
  const showIOS = !canInstall && isIOS && iosReady
  if (!showAndroid && !showIOS) return null

  return (
    <div className="install-prompt" role="dialog" aria-label="Installer rouXperf">
      {showAndroid ? (
        <>
          <p className="install-prompt-text">
            📲 Installe rouXperf comme une vraie app — plein écran, accès direct depuis ton écran d'accueil.
          </p>
          <div className="install-prompt-actions">
            <button type="button" className="install-prompt-cta" onClick={install}>
              Installer
            </button>
            <button type="button" className="install-prompt-close" onClick={dismiss} aria-label="Fermer">
              ×
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="install-prompt-text">
            📲 Ajoute rouXperf à ton écran d'accueil : appuie sur <ShareGlyph /> puis « Sur l'écran d'accueil ».
          </p>
          <button type="button" className="install-prompt-close" onClick={dismiss} aria-label="Fermer">
            ×
          </button>
        </>
      )}
    </div>
  )
}
