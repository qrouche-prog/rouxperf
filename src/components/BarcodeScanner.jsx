import { useEffect, useRef, useState } from 'react'

// Scanner de code-barres via ZXing. La librairie est importée dynamiquement
// pour rester hors du bundle initial. Fonctionne sur iOS Safari (contrairement
// à l'API BarcodeDetector native).
export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (cancelled) return
        const reader = new BrowserMultiFormatReader()
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _err, ctrls) => {
          if (result) {
            ctrls.stop()
            onDetectedRef.current(result.getText())
          }
        })
        controlsRef.current = controls
        if (cancelled) controls.stop()
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Caméra indisponible')
      }
    }
    start()
    return () => {
      cancelled = true
      try {
        controlsRef.current?.stop()
      } catch {
        // ignore
      }
    }
  }, [])

  return (
    <div className="scanner-overlay" role="dialog" aria-label="Scanner un code-barres">
      <div className="scanner-frame">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="scanner-video" muted playsInline />
        <div className="scanner-reticle" />
      </div>
      {error ? (
        <p className="scanner-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="scanner-hint">Vise le code-barres du produit</p>
      )}
      <button type="button" className="btn-secondary scanner-close" onClick={onClose}>
        Annuler
      </button>
    </div>
  )
}
