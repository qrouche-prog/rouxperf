# Identité de marque — rouxperf.ch

Direction retenue : **Forgé** — l'entraînement comme un forgeage. Sombre
comme une forge la nuit, la couleur n'apparaît que là où ça chauffe : un
dégradé de flamme (rouge braise → orange → jaune), pas un néon plat.
Remplace une première direction ("Iron Ledger", carnet précis clair/sombre)
jugée trop sage par le client — celle-ci assume un ton plus radical, "esprit
guerrier".

## Signature visuelle

Les séries s'affichent toujours en **bâtons de comptage** (`||||`, voir
`src/components/Tally.jsx`) — la fonction (compter à la main) reste
identique à la version précédente, mais les traits sont désormais tracés
avec le dégradé de flamme plutôt qu'une couleur plate. Même principe pour la
progression de l'onboarding et le CTA principal : la couleur n'existe que
comme énergie/chaleur, jamais comme décoration plate.

Ambiance animée sobre : légère pulsation lumineuse sur le CTA principal et
quelques braises qui montent en fond du hero (`prefers-reduced-motion`
respecté — désactivé si l'utilisateur le demande). Pas de vraies vidéos
sport intégrées : aucune source de contenu fournie, et interdiction de
deviner/inventer des liens vers des vidéos qui n'existent pas.

## Palette (thème unique, sombre — pas de mode clair)

| Rôle | Valeur |
|---|---|
| Fond (`--page-bg`) | `#0A0908` (suie) |
| Texte principal (`--ink`) | `#EDE6DC` (cendre) |
| Carte / surface élevée (`--card`) | `#1C1712` |
| Texte secondaire / bordures (`--iron`) | `#8A8177` |
| Accent uni (`--ember`) | `#E5501C` |
| Dégradé flamme (`--flame-1/2/3`) | `#C81E1E` → `#FF6B00` → `#FFC72C` |

`--ember` est le validé du skill `dataviz`
(`scripts/validate_palette.js --mode dark --surface #1C1712`) — un premier
orange plus vif (`#FF5A1F`) échouait la bande de luminosité sombre, d'où ce
ton légèrement plus sourd pour l'accent uni (graphique, liens, focus). Le
dégradé flamme, purement décoratif (CTA, titres, halo), n'a pas besoin de
cette validation — seule la couleur de trace du graphique en a besoin.

## Typographie

- **Titres** : Teko (500–700), condensée et verticale — évoque la lame
  plutôt que la plaque de fonte (direction précédente). Alternative plus
  radicale qu'Anton (cliché "police de sport") tout en restant très lisible
  en majuscules courtes.
- **Texte courant** : IBM Plex Sans (400–600) — inchangé.
- **Données chiffrées** : IBM Plex Mono (400–500) — inchangé, même logique
  qu'avant : un nombre a un registre visuel distinct du texte courant.

## Ton éditorial

Direct, sans blabla motivationnel creux — l'énergie vient de la couleur et
du mouvement, pas de superlatifs ("CRUSH YOUR GOALS"). Les boutons nomment
l'action exacte ; le message de confirmation reprend le même verbe.

## Application

Design system en variables CSS dans `src/index.css` (`:root`, thème unique
— `color-scheme: dark` fixe, pas de branche `prefers-color-scheme`). Le
graphique de `/progress` utilise `--ember` comme couleur de tracé.
