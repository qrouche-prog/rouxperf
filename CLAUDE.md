
## Système visuel

Le système de thèmes vit dans `src/rouxperf-theme.css` (tokens) et
`src/components/theme.jsx` (provider, sélecteur). Deux thèmes : clair et sombre,
plus le suivi de la préférence système. Le provider est câblé dans `src/main.jsx`
et le script anti-flash est inliné dans `index.html` (projet Vite, pas de layout
Next.js).

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
