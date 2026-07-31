# SETUP-THEME — mission pour Claude Code

Tu installes le système de thèmes (clair / sombre) de rouxperf.
Exécute les étapes dans l'ordre. Ne modifie aucun fichier hors de cette liste.

## Contexte

Deux thèmes, un seul jeu de tokens sémantiques. Les composants ne référencent
jamais un hex ni le thème courant, uniquement des variables CSS. L'accent de
marque est le roux : `#C4552B` en thème clair, `#E2703A` en sombre (la valeur
claire ne passe pas le contraste sur fond noir — ne jamais les unifier).

## Étape 1 — Repérer la structure

Détermine si le projet utilise `app/` ou `src/app/`, et le routeur App ou Pages.
Adapte tous les chemins ci-dessous en conséquence et annonce-moi ce que tu as trouvé.

## Étape 2 — Créer le fichier de tokens

Crée `app/rouxperf-theme.css` (ou `src/app/rouxperf-theme.css`) avec exactement
ce contenu :

```css
/* ==========================================================================
   rouxperf — système de thèmes
   Deux thèmes, un seul jeu de tokens sémantiques.
   Les composants n'utilisent QUE les tokens de la section 2.
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. Rampes brutes — ne pas utiliser directement dans les composants
   -------------------------------------------------------------------------- */
:root {
  /* Roux — la couleur de marque */
  --roux-50:  #FBEDE6;
  --roux-100: #F5D5C4;
  --roux-200: #E8C4B2;
  --roux-300: #E8A583;
  --roux-400: #E2703A; /* accent en thème sombre */
  --roux-500: #C4552B; /* accent en thème clair */
  --roux-600: #A5441F;
  --roux-700: #8A3A1C;
  --roux-900: #2A1206;

  /* Neutres chauds — clair */
  --craie-0:  #FFFFFF;
  --craie-50: #FAF8F5;
  --craie-100:#F2EEE8;
  --craie-200:#EBE5DC;
  --craie-300:#DDD6CC;
  --craie-400:#A9A29A;
  --craie-600:#77716A;
  --craie-900:#1C1B19;

  /* Neutres chauds — sombre */
  --nuit-0:   #0C0B0E;
  --nuit-50:  #111013;
  --nuit-100: #1B191D;
  --nuit-200: #232025;
  --nuit-300: #2E2A2E;
  --nuit-400: #3B363B;
  --nuit-500: #6E6862;
  --nuit-600: #A19A93;
  --nuit-900: #F4F1EE;

  /* Sémantique d'état — deux valeurs par rôle (clair / sombre) */
  --vert-clair:  #2F7A4F;
  --vert-sombre: #5FBF8B;
  --rouge-clair: #B3392F;
  --rouge-sombre:#F08078;
}

/* --------------------------------------------------------------------------
   2. Tokens sémantiques — thème clair (défaut)
   -------------------------------------------------------------------------- */
:root,
[data-theme="light"] {
  color-scheme: light;

  --bg:              var(--craie-50);
  --surface:         var(--craie-0);
  --surface-sunken:  var(--craie-100);
  --surface-hover:   var(--craie-100);

  --border:          var(--craie-200);
  --border-strong:   var(--craie-300);

  --text:            var(--craie-900);
  --text-muted:      var(--craie-600);
  --text-subtle:     var(--craie-400);

  --accent:          var(--roux-500);
  --accent-hover:    var(--roux-600);
  --accent-active:   var(--roux-700);
  --accent-fg:       #FFFFFF;
  --accent-soft:     var(--roux-50);
  --accent-soft-border: var(--roux-200);
  --accent-soft-fg:  var(--roux-700);

  --success:         var(--vert-clair);
  --danger:          var(--rouge-clair);

  --focus-ring:      0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent);
}

/* --------------------------------------------------------------------------
   3. Tokens sémantiques — thème sombre
   -------------------------------------------------------------------------- */
[data-theme="dark"] {
  color-scheme: dark;

  --bg:              var(--nuit-50);
  --surface:         var(--nuit-100);
  --surface-sunken:  var(--nuit-300);
  --surface-hover:   var(--nuit-200);

  --border:          var(--nuit-300);
  --border-strong:   var(--nuit-400);

  --text:            var(--nuit-900);
  --text-muted:      var(--nuit-600);
  --text-subtle:     var(--nuit-500);

  /* Le roux est éclairci : le #C4552B ne passe pas le contraste sur fond noir */
  --accent:          var(--roux-400);
  --accent-hover:    var(--roux-300);
  --accent-active:   var(--roux-200);
  --accent-fg:       var(--roux-900);
  --accent-soft:     color-mix(in srgb, var(--roux-400) 14%, var(--nuit-100));
  --accent-soft-border: color-mix(in srgb, var(--roux-400) 40%, var(--nuit-100));
  --accent-soft-fg:  var(--roux-300);

  --success:         var(--vert-sombre);
  --danger:          var(--rouge-sombre);
}

/* Suivi de la préférence système quand l'utilisateur n'a rien choisi */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg:              var(--nuit-50);
    --surface:         var(--nuit-100);
    --surface-sunken:  var(--nuit-300);
    --surface-hover:   var(--nuit-200);
    --border:          var(--nuit-300);
    --border-strong:   var(--nuit-400);
    --text:            var(--nuit-900);
    --text-muted:      var(--nuit-600);
    --text-subtle:     var(--nuit-500);
    --accent:          var(--roux-400);
    --accent-hover:    var(--roux-300);
    --accent-active:   var(--roux-200);
    --accent-fg:       var(--roux-900);
    --accent-soft:     color-mix(in srgb, var(--roux-400) 14%, var(--nuit-100));
    --accent-soft-border: color-mix(in srgb, var(--roux-400) 40%, var(--nuit-100));
    --accent-soft-fg:  var(--roux-300);
    --success:         var(--vert-sombre);
    --danger:          var(--rouge-sombre);
  }
}

/* --------------------------------------------------------------------------
   4. Échelle — identique dans les deux thèmes
   -------------------------------------------------------------------------- */
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;

  --radius-sm:  8px;
  --radius:     12px;
  --radius-lg:  20px;
  --radius-full: 999px;

  --control-h: 48px; /* cible tactile en salle */

  --text-xs: 12px;
  --text-sm: 13px;
  --text-base: 15px;
  --text-lg: 18px;
  --text-xl: 22px;
  --text-2xl: 28px;

  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Archivo", var(--font-sans);
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;

  --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* --------------------------------------------------------------------------
   5. Base
   -------------------------------------------------------------------------- */
html {
  background: var(--bg);
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* Transition douce au changement de thème, sans traîner sur les interactions */
html.theme-switching,
html.theme-switching * {
  transition: background-color 200ms ease, border-color 200ms ease, color 200ms ease !important;
}

@media (prefers-reduced-motion: reduce) {
  html.theme-switching,
  html.theme-switching * {
    transition: none !important;
  }
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* --------------------------------------------------------------------------
   6. Composants — aucune valeur codée en dur, tout passe par les tokens
   -------------------------------------------------------------------------- */

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-3) var(--space-4);
}

.card--active {
  border-color: var(--accent);
  border-width: 1.5px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--control-h);
  padding: 0 var(--space-5);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition), border-color var(--transition);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Un seul bouton plein par écran */
.btn--primary {
  background: var(--accent);
  color: var(--accent-fg);
}
.btn--primary:hover:not(:disabled)  { background: var(--accent-hover); }
.btn--primary:active:not(:disabled) { background: var(--accent-active); }

.btn--secondary {
  background: var(--surface);
  border-color: var(--border-strong);
  color: var(--text);
}
.btn--secondary:hover:not(:disabled) { background: var(--surface-hover); }

.btn--ghost {
  background: transparent;
  color: var(--text-muted);
}
.btn--ghost:hover:not(:disabled) { background: var(--surface-hover); color: var(--text); }

/* Champ de série : rempli / en cours / vide */
.set {
  flex: 1;
  text-align: center;
  padding: var(--space-2) 0;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: var(--surface-sunken);
  color: var(--text);
  font-size: var(--text-sm);
}

.set--current {
  background: var(--accent-soft);
  border-color: var(--accent-soft-border);
  color: var(--accent-soft-fg);
}

.set--empty {
  background: transparent;
  border-color: var(--border);
  color: var(--text-subtle);
}

.progress {
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--surface-sunken);
  overflow: hidden;
}
.progress > span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: inherit;
}

.badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--accent-soft-fg);
  font-size: var(--text-xs);
  font-weight: 500;
}

.input {
  width: 100%;
  min-height: var(--control-h);
  padding: 0 var(--space-3);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text);
  font: inherit;
}
.input::placeholder { color: var(--text-subtle); }
.input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}
```

## Étape 3 — Créer le composant de thème

Crée `components/theme.tsx` (crée le dossier `components/` s'il n'existe pas)
avec exactement ce contenu :

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/* ==========================================================================
   rouxperf — gestion du thème
   Trois choix : clair, sombre, système. Persisté en localStorage.
   ========================================================================== */

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "rouxperf-theme";

/* --------------------------------------------------------------------------
   Script anti-flash — à injecter dans <head> AVANT tout rendu.
   Sans ça, la page s'affiche en clair une fraction de seconde puis bascule.
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
`;

/* --------------------------------------------------------------------------
   Contexte
   -------------------------------------------------------------------------- */

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    let stored: Theme = "system";
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === "light" || value === "dark" || value === "system") stored = value;
    } catch {}
    setThemeState(stored);
    setResolvedTheme(stored === "system" ? systemTheme() : stored);
  }, []);

  // Suit la préférence système en direct, uniquement en mode "system"
  useEffect(() => {
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(query.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  // Applique le thème au document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme, resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    const root = document.documentElement;

    // Transition douce, retirée juste après pour ne pas ralentir le reste de l'UI
    root.classList.add("theme-switching");
    window.setTimeout(() => root.classList.remove("theme-switching"), 250);

    setThemeState(next);
    setResolvedTheme(next === "system" ? systemTheme() : next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme doit être utilisé dans un ThemeProvider");
  return context;
}

/* --------------------------------------------------------------------------
   Sélecteur segmenté — à poser dans les réglages
   -------------------------------------------------------------------------- */

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
  { value: "system", label: "Système" },
];

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Thème"
      style={{
        display: "inline-flex",
        gap: "var(--space-1)",
        padding: "var(--space-1)",
        background: "var(--surface-sunken)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(option.value)}
            style={{
              minHeight: 40,
              padding: "0 var(--space-4)",
              border: "1px solid transparent",
              borderRadius: "var(--radius-sm)",
              background: selected ? "var(--surface)" : "transparent",
              borderColor: selected ? "var(--border)" : "transparent",
              color: selected ? "var(--text)" : "var(--text-muted)",
              font: "inherit",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background-color var(--transition), color var(--transition)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Bouton unique clair ↔ sombre — pour une barre de navigation
   -------------------------------------------------------------------------- */

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === "dark" ? "Passer en thème sombre" : "Passer en thème clair"}
      className="btn btn--ghost"
      style={{ width: "var(--control-h)", minWidth: "var(--control-h)", padding: 0 }}
    >
      {resolvedTheme === "dark" ? "☀" : "☾"}
    </button>
  );
}
```

## Étape 4 — Câbler le layout

Modifie `app/layout.tsx`. Conserve tout ce qui existe déjà (metadata, etc.) et
ajoute uniquement ce qui manque :

- l'import de `./rouxperf-theme.css` APRÈS l'import du CSS global existant
- `suppressHydrationWarning` sur la balise `<html>`
- le script anti-flash dans `<head>`
- le `<ThemeProvider>` enveloppant les enfants dans `<body>`

Résultat attendu :

```tsx
import "./globals.css";
import "./rouxperf-theme.css";
import { ThemeProvider, themeScript } from "@/components/theme";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

Si l'alias `@/` n'est pas configuré dans `tsconfig.json`, utilise un chemin relatif.

## Étape 5 — Les polices

Charge Inter et Archivo via `next/font/google` dans le layout :

```tsx
import { Inter, Archivo } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });
```

Applique `className={`${inter.variable} ${archivo.variable}`}` sur `<html>`, puis
dans `rouxperf-theme.css` section 4, remplace les déclarations de police par :

```css
--font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
--font-display: var(--font-archivo), var(--font-sans);
```

## Étape 6 — Nettoyer les conflits

Cherche dans le CSS global existant toute règle qui force `background` ou `color`
sur `html` ou `body` avec une valeur en dur. Supprime-la : c'est désormais
`rouxperf-theme.css` qui s'en charge, et ces règles empêcheraient le thème de
basculer. Liste-moi ce que tu as retiré.

## Étape 7 — Ajouter le sélecteur

Place `<ThemePicker />` dans la page de réglages si elle existe, sinon dans le
header principal. Importe-le depuis `components/theme`.

## Étape 8 — Le CLAUDE.md

Ajoute le bloc suivant à la fin du `CLAUDE.md` du projet rouxperf (crée le
fichier s'il n'existe pas). Attention : dans le CLAUDE.md du projet, pas dans
celui du dossier parent.

~~~markdown

## Système visuel

Le système de thèmes vit dans `app/rouxperf-theme.css` (tokens) et
`components/theme.tsx` (provider, sélecteur). Deux thèmes : clair et sombre,
plus le suivi de la préférence système.

### Règle absolue : aucune couleur en dur

Tout ce qui est couleur, espacement, rayon ou taille de police passe par un token.

```css
/* oui */
background: var(--surface);
color: var(--text-muted);
border: 1px solid var(--border);
padding: var(--space-3) var(--space-4);
border-radius: var(--radius);

/* non — casse le thème sombre */
background: #FFFFFF;
color: rgba(0, 0, 0, 0.6);
padding: 14px 17px;
```

Jamais de branche conditionnelle sur le thème dans un composant. Si tu écris
`resolvedTheme === "dark" ? ... : ...` pour une couleur, c'est qu'il manque un
token — ajoute-le dans les deux blocs de thème du CSS.

### Tokens disponibles

Surfaces : `--bg`, `--surface`, `--surface-sunken`, `--surface-hover`
Bordures : `--border`, `--border-strong`
Texte : `--text`, `--text-muted`, `--text-subtle`
Accent : `--accent`, `--accent-hover`, `--accent-active`, `--accent-fg`,
`--accent-soft`, `--accent-soft-border`, `--accent-soft-fg`
États : `--success`, `--danger`
Échelle : `--space-1` à `--space-7`, `--radius-sm|--radius|--radius-lg|--radius-full`,
`--text-xs` à `--text-2xl`, `--control-h`

L'accent n'a pas la même valeur dans les deux thèmes (`#C4552B` en clair,
`#E2703A` en sombre) : le roux clair ne passe pas le contraste sur fond blanc.
Ne jamais unifier les deux.

### Règles de composition

- Un seul bouton `.btn--primary` par écran. Le reste en `--secondary` ou `--ghost`.
- Hauteur de cible tactile minimum `var(--control-h)` (48 px) sur tout élément
  cliquable — l'app est utilisée en salle, sur mobile.
- Pas d'ombres. Les séparations se font à la bordure 1 px.
- Deux graisses de police : 400 et 500. Pas de 600 ni 700.
- Casse phrase partout, y compris sur les boutons et les titres.

### Avant de considérer une UI terminée

- La tester dans les deux thèmes, pas seulement celui de ton OS.
- Vérifier qu'aucun `#` de couleur n'a été ajouté hors de `rouxperf-theme.css`.
- Vérifier le focus clavier visible sur tous les contrôles.
~~~

## Étape 9 — Vérifier

Lance le build et confirme qu'il passe. Puis exécute :

```bash
grep -rEn "#[0-9a-fA-F]{3,8}" app components --include="*.tsx" | head -50
```

Ne migre PAS ces occurrences maintenant — contente-toi de me les lister. La
migration des composants fera l'objet d'une passe séparée.

## Ce que tu ne fais pas

- Ne touche à aucun composant existant en dehors du layout.
- Ne modifie pas les valeurs des tokens.
- Ne remplace pas le CSS global existant, tu ajoutes par-dessus.
- Ne crée pas de fichier de test, de documentation ou de démo supplémentaire.

## Rapport final attendu

Structure détectée, liste des fichiers créés avec leurs chemins, règles CSS
retirées à l'étape 6, emplacement du sélecteur, statut du build.
