# Identité de marque — rouxperf.ch

Direction retenue : **Iron Ledger** — le carnet d'entraînement précis. Plutôt
que l'imagerie gym-bro (néon, "beast mode") ou le défaut "IA cream + serif +
terracotta", la marque part du geste le plus universel de la musculation :
compter ses séries à la main, en bâtons, sur un carnet.

## Signature visuelle

Les séries s'affichent en **bâtons de comptage** (`||||`) plutôt qu'en simple
chiffre — voir `src/components/Tally.jsx`. Le même motif sert d'indicateur de
progression (étape de l'onboarding, semaine en cours du programme) : un trait
qui se remplit au fil de l'avancée. Un seul élément signature, réutilisé
partout, plutôt que plusieurs gadgets visuels.

## Palette

| Rôle | Clair | Sombre |
|---|---|---|
| Fond (`--ink`/`--paper`) | `#F4EFE4` (papier) | `#17140F` (encre) |
| Texte principal | `#17140F` | `#F4EFE4` |
| Carte / surface élevée | `#EDE6D8` | `#211D16` |
| Texte secondaire / bordures (`--iron`) | `#6B6355` | `#A39C8C` |
| Accent (`--ember`) | `#C7401A` | `#E5501C` |
| Succès / progression (`--moss`) | `#4F6B2C` | `#8FB25A` |

Le mode sombre est la valeur par défaut d'usage (utilisation typique en
salle, sur téléphone), mais le mode clair reste pleinement fonctionnel.
Les teintes `--ember` diffèrent légèrement entre clair et sombre : validées
séparément avec le validateur du skill `dataviz`
(`scripts/validate_palette.js`) pour rester dans la bande de luminosité et le
contraste requis sur chaque surface — un seul orange n'aurait pas passé les
deux.

## Typographie

- **Titres** : Big Shoulders (700–900), condensée façon pochoir industriel —
  évoque les plaques de fonte et la signalétique d'atelier, sans être le
  cliché "police sport" (type Anton).
- **Texte courant** : IBM Plex Sans (400–600).
- **Données chiffrées** (séries, reps, kg, RPE, dates) : IBM Plex Mono
  (400–500) — tout nombre a un registre visuel distinct du texte courant,
  cohérent avec l'idée de carnet précis.

## Ton éditorial

Direct, encourageant sans emphase creuse — pas de "CRUSH YOUR GOALS". Les
boutons nomment l'action exacte ("Générer mon programme", "Enregistrer la
séance") et le message de confirmation reprend le même verbe.

## Application

Le design system est posé en variables CSS dans `src/index.css` (`:root` +
`prefers-color-scheme: dark`), consommées par toutes les pages existantes
(accueil, auth, onboarding, dashboard, programme, progression). Le graphique
de `/progress` utilise `--ember` comme couleur de tracé (remplace le bleu
par défaut du skill `dataviz`, revalidé pour les deux surfaces).
