import { useState } from 'react'
import { usePwaInstall } from '../lib/pwaInstall'

// Petit bouton d'installation, toujours visible dans le menu tant que l'app
// n'est pas installée. Android : déclenche l'installation. iOS / autres :
// affiche les instructions.
export default function InstallButton() {
  const { canInstall, isIOS, isStandalone, promptInstall } = usePwaInstall()
  const [tip, setTip] = useState(false)

  if (isStandalone) return null

  async function onClick() {
    if (canInstall) {
      await promptInstall()
      return
    }
    setTip((v) => !v)
  }

  return (
    <div className="install-btn-wrap">
      <button
        type="button"
        className="install-btn"
        onClick={onClick}
        aria-label="Installer l'application"
        title="Installer l'application"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12" />
          <path d="M8 11l4 4 4-4" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      </button>
      {tip && !canInstall && (
        <div className="install-tip" role="dialog">
          <p>
            {isIOS
              ? "Sur iPhone : appuie sur le bouton Partager de Safari, puis « Sur l'écran d'accueil »."
              : "Ouvre le menu de ton navigateur, puis « Installer l'application »."}
          </p>
          <button type="button" className="install-tip-close" onClick={() => setTip(false)} aria-label="Fermer">
            ×
          </button>
        </div>
      )}
    </div>
  )
}
