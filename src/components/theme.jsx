import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

/* ==========================================================================
   rouxperf — gestion du thème
   Trois choix : clair, sombre, système. Persisté en localStorage.
   ========================================================================== */

const STORAGE_KEY = 'rouxperf-theme'

/* --------------------------------------------------------------------------
   Script anti-flash — à injecter dans <head> AVANT tout rendu.
   Sans ça, la page s'affiche en clair une fraction de seconde puis bascule.
   En Vite, ce même script est inliné dans index.html (voir <head>).
   -------------------------------------------------------------------------- */
export const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`

/* --------------------------------------------------------------------------
   Contexte
   -------------------------------------------------------------------------- */

const ThemeContext = createContext(null)

function systemTheme() {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('system')
  const [resolvedTheme, setResolvedTheme] = useState('light')

  useEffect(() => {
    let stored = 'system'
    try {
      const value = localStorage.getItem(STORAGE_KEY)
      if (value === 'light' || value === 'dark' || value === 'system') stored = value
    } catch {}
    setThemeState(stored)
    setResolvedTheme(stored === 'system' ? systemTheme() : stored)
  }, [])

  // Suit la préférence système en direct, uniquement en mode "system"
  useEffect(() => {
    if (theme !== 'system') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolvedTheme(query.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [theme])

  // Applique le thème au document + aligne le chrome de l'app (barre système,
  // couleur d'onglet) sur le fond réel du thème, pour un rendu homogène.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)

    // Lire le fond effectif après application du thème (recalc synchrone)
    const bg = getComputedStyle(document.body).backgroundColor
    if (bg) {
      let meta = document.querySelector('meta[name="theme-color"]')
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('name', 'theme-color')
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', bg)
    }
  }, [theme, resolvedTheme])

  const setTheme = useCallback((next) => {
    const root = document.documentElement

    // Transition douce, retirée juste après pour ne pas ralentir le reste de l'UI
    root.classList.add('theme-switching')
    window.setTimeout(() => root.classList.remove('theme-switching'), 250)

    setThemeState(next)
    setResolvedTheme(next === 'system' ? systemTheme() : next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme doit être utilisé dans un ThemeProvider')
  return context
}

/* --------------------------------------------------------------------------
   Sélecteur segmenté — à poser dans les réglages
   -------------------------------------------------------------------------- */

const OPTIONS = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'system', label: 'Système' },
]

export function ThemePicker() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Thème"
      style={{
        display: 'inline-flex',
        gap: 'var(--space-1)',
        padding: 'var(--space-1)',
        background: 'var(--surface-sunken)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {OPTIONS.map((option) => {
        const selected = theme === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(option.value)}
            style={{
              minHeight: 40,
              padding: '0 var(--space-4)',
              border: '1px solid transparent',
              borderRadius: 'var(--radius-sm)',
              background: selected ? 'var(--surface)' : 'transparent',
              borderColor: selected ? 'var(--border)' : 'transparent',
              color: selected ? 'var(--text)' : 'var(--text-muted)',
              font: 'inherit',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color var(--transition), color var(--transition)',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/* --------------------------------------------------------------------------
   Bouton unique clair ↔ sombre — pour une barre de navigation
   -------------------------------------------------------------------------- */

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const next = resolvedTheme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === 'dark' ? 'Passer en thème sombre' : 'Passer en thème clair'}
      className="rx-btn rx-btn--ghost"
      style={{ width: 'var(--control-h)', minWidth: 'var(--control-h)', padding: 0 }}
    >
      {resolvedTheme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
