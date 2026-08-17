import { useEffect, useState } from 'react'

// Capture globale de l'événement d'installation (une seule source), pour que la
// bannière ET les Réglages puissent déclencher l'installation.
let deferred = null
const subs = new Set()
function emit() {
  subs.forEach((f) => f())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

export function canInstall() {
  return !!deferred
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function isIOS() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export async function promptInstall() {
  if (!deferred) return false
  deferred.prompt()
  try {
    await deferred.userChoice
  } catch {
    // ignore
  }
  deferred = null
  emit()
  return true
}

export function usePwaInstall() {
  const [, force] = useState(0)
  useEffect(() => subscribe(() => force((n) => n + 1)), [])
  return { canInstall: canInstall(), isIOS: isIOS(), isStandalone: isStandalone(), promptInstall }
}

export function subscribe(fn) {
  subs.add(fn)
  return () => subs.delete(fn)
}
