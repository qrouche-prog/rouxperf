# Bibliothèque d'exercices rouxperf — brief d'intégration

Ce dossier contient un pipeline **déjà exécuté et validé** sur les sources
réelles. Les chiffres ci-dessous sont mesurés, pas estimés. Ton travail est de
l'intégrer au projet, pas de le réinventer.

## Objectif

Doter rouxperf d'une bibliothèque d'illustrations d'exercices **libres de
droits**, utilisable dès maintenant et conservable après monétisation du site.

Contrainte structurante : le média doit pouvoir être remplacé plus tard (par des
assets payants ou produits sur mesure) **sans toucher au reste de
l'application**. D'où la séparation stricte entre `slug` (identité stable de
l'exercice) et `media` (interchangeable).

## Sources et licences

| Source | Contenu | Licence | Conséquence |
|---|---|---|---|
| `chaosbastler/opentraining-exercises` | illustrations Everkinetic | **CC BY-SA 3.0** | crédit obligatoire à l'affichage |
| `yuhonas/free-exercise-db` | métadonnées, instructions | domaine public revendiqué | aucune obligation |

**Le crédit CC BY-SA n'est pas optionnel.** Le composant
`ExerciseAttribution` doit apparaître sur chaque fiche affichant une
illustration, ou à défaut sur une page `/credits` liée depuis chaque fiche.

Nuance utile : le partage à l'identique de CC BY-SA porte sur les œuvres
dérivées de l'image, **pas sur l'application qui l'affiche**. Monétiser rouxperf
avec ces illustrations est parfaitement légal tant que le crédit est présent.

⚠️ Ne remplace jamais ces sources par un dataset d'« exercise GIFs » trouvé sur
npm ou GitHub. Les jolis GIFs animés qui circulent sont des assets GymVisual
redistribués sans droits.

## Ce que le pipeline produit — chiffres réels

Après `npx tsx scripts/build-exercise-library.ts` :

```
Exercices OpenTraining   246
Fiches free-exercise-db  873
Avec illustration        245
Dont ≥ 2 poses           221      ← animables
Rapprochés (≥ 0.82)      131
À valider à la main       99      → data/_review.csv
```

Médias écrits dans `public/exercises/` : 134 SVG, 154 PNG, 181 GIF — **18 Mo**
(SVG 4,4 Mo / PNG 11 Mo / GIF 2,4 Mo).

## Limites connues — ne les découvre pas en production

1. **Seuls les 66 XML de la racine du dépôt portent muscles et matériel.** Les
   ~180 autres (`still_unsorted/`) n'ont que nom + images. Leurs métadonnées
   viennent donc du rapprochement avec free-exercise-db, quand il aboutit.

2. **Seuls 134 fichiers ont une version vectorielle.** Le dossier `svg/` du
   dépôt ne couvre que la racine. Le reste tombe en PNG/GIF : utilisable, mais
   **non recolorisable**. Prévois que la palette rouxperf ne s'appliquera pas
   uniformément — c'est le compromis assumé pour passer de 68 à 245 exercices
   illustrés.

3. **Le rapprochement flou se trompe.** Exemple vérifié : `squats` est associé à
   une fiche d'étirement, d'où `category: "étirement"` — faux. C'est
   précisément à quoi sert `data/_review.csv`. Ne fais pas confiance à
   `category` / `level` / `force` tant que `reviewed !== true`.

4. **Les GIF sont des images fixes**, pas des animations. L'animation vient du
   composant `ExerciseLoop`, pas du fichier.

5. **`nameFr` et `instructionsFr` ne sont pas remplis.** `nameFr` est amorcé
   avec le nom anglais, `instructionsFr` est vide. C'est volontaire : la
   traduction automatique produirait de la bouillie technique
   (« bench press » → « presse de banc »). Ce contenu relève de la voix
   éditoriale rouxperf.

## Tâches, dans l'ordre

### 1. Installer

```bash
npm i -D tsx
npm i fast-xml-parser
```

Copier dans le projet :

```
scripts/build-exercise-library.ts
scripts/upload-to-blob.ts          (optionnel, plus tard)
lib/exercises/types.ts
lib/exercises/dictionaries.ts
components/ExerciseLoop.tsx
components/ExerciseAttribution.tsx
```

Ajouter à `.gitignore` : `.cache/`

Ajouter à `package.json` :

```json
"scripts": { "build:exercises": "tsx scripts/build-exercise-library.ts" }
```

### 2. Lancer le build

```bash
npm run build:exercises
```

Le script sort en code 1 si un terme allemand ou anglais manque dans
`lib/exercises/dictionaries.ts`. C'est voulu : un terme non traduit en
production est plus coûteux à repérer qu'un build cassé. Complète le
dictionnaire et relance.

### 3. Câbler l'affichage

Crée la route de listing et la fiche exercice. Points non négociables :

- `ExerciseLoop` reçoit `media` et `label`
- `ExerciseAttribution` est présent sur toute vue affichant une illustration
- Les SVG sont colorés via la classe de texte du parent (`currentColor`) —
  teste avec la couleur d'accent rouxperf
- Filtres sur `primaryMuscles` et `equipment` (valeurs déjà en français)

### 4. Marquer un premier lot comme relu

Ouvre `data/_review.csv`, corrige les fiches douteuses dans
`data/exercises.json`, passe `reviewed: true`. Commence par les exercices qui
apparaissent dans les programmes publiés — inutile de traiter les 246.

Écris `nameFr` et `instructionsFr` pour ce lot. C'est le vrai différenciateur du
site, pas le dessin.

### 5. Plus tard seulement

`scripts/upload-to-blob.ts` bascule les médias vers Vercel Blob si les 18 Mo
deviennent gênants. Tant que le dépôt le supporte, ne le lance pas : moins de
pièces mobiles.

## Ce qu'il ne faut pas faire

- Ne pas mettre d'URL externe dans `media.frames`. Tous les médias sont servis
  par notre domaine. Pas de hotlink vers GitHub.
- Ne pas coder en dur un chemin d'image dans un composant. Tout passe par
  `media.frames`.
- Ne pas supprimer `attribution` de la structure de données « parce que c'est
  toujours la même valeur ». Le jour où une seconde source arrive, le champ
  existe déjà.
- Ne pas régénérer `data/exercises.json` après avoir saisi des traductions : le
  script écrase le fichier. Si tu dois relancer le build, prévois d'abord une
  fusion qui préserve `nameFr`, `instructionsFr` et `reviewed`.

Ce dernier point est le piège le plus probable. Traite-le à la tâche 4 : ajoute
une lecture du JSON existant en début de `build()` et reporte ces trois champs
sur les fiches régénérées, par `slug`.
