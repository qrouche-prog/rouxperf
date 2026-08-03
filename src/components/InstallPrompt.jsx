import { useEffect, useState } from 'react'

/* Invite discrète à installer rouxperf sur l'écran d'accueil.
   - Android / Chrome / Edge : capte `beforeinstallprompt` → vrai bouton « Installer ».
   - iOS / Safari : pas d'API d'install → on affiche les instructions manuelles.
   Se masque si l'app tourne déjà en standalone ou si l'invite a été rejetée. */

const DISMISS_KEY = 'rouxperf-install-dismissed'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function isIOS() {
  const ua = window.navigator.userAgent
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

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
  const [deferred, setDeferred] = useState(null)
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState(null) // 'prompt' | 'ios'

  useEffect(() => {
    if (isStandalone()) return
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1'
    } catch {}
    if (dismissed) return

    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferred(e)
      setMode('prompt')
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS ne déclenche jamais beforeinstallprompt : instructions après un court délai
    let timer
    if (isIOS()) {
      timer = window.setTimeout(() => {
        setMode((current) => current || 'ios')
        setVisible(true)
      }, 1800)
    }

    const onInstalled = () => setVisible(false)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {}
  }

  async function install() {
    if (!deferred) return
    deferred.prompt()
    try {
      await deferred.userChoice
    } catch {}
    setDeferred(null)
    dismiss()
  }

  if (!visible) return null

  return (
    <div className="install-prompt" role="dialog" aria-label="Installer rouxperf">
      {mode === 'prompt' ? (
        <>
          <p className="install-prompt-text">Installe rouxperf comme une app, en plein écran.</p>
          <div className="install-prompt-actions">
            <button type="button" className="install-prompt-cta" onClick={install}>
              Installer
            </button>
            <button
              type="button"
              className="install-prompt-close"
              onClick={dismiss}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="install-prompt-text">
            Ajoute rouxperf à ton écran d'accueil : appuie sur <ShareGlyph /> puis « Sur l'écran
            d'accueil ».
          </p>
          <button
            type="button"
            className="install-prompt-close"
            onClick={dismiss}
            aria-label="Fermer"
          >
            ×
          </button>
        </>
      )}
    </div>
  )
}
