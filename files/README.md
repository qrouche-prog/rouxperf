# rouxperf — bibliothèque d'exercices

Pipeline de constitution d'une bibliothèque d'illustrations d'exercices libres
de droits, à partir de deux sources ouvertes.

**Commence par lire [`CLAUDE.md`](./CLAUDE.md)** : chiffres mesurés, limites
connues et tâches ordonnées.

## Démarrage

```bash
npm i -D tsx && npm i fast-xml-parser
npx tsx scripts/build-exercise-library.ts
```

Produit `public/exercises/` (245 exercices illustrés, 18 Mo) et
`data/exercises.json`.

## Contenu

```
CLAUDE.md                            brief d'intégration ← point d'entrée
ATTRIBUTION.md                       page de crédits à publier (obligation CC BY-SA)
scripts/build-exercise-library.ts    pipeline principal
scripts/upload-to-blob.ts            bascule vers Vercel Blob (plus tard)
lib/exercises/types.ts               types partagés
lib/exercises/dictionaries.ts        traductions DE/EN → FR
components/ExerciseLoop.tsx          animation 2 poses en fondu
components/ExerciseAttribution.tsx   crédit obligatoire
```

## Principe

Un `slug` stable identifie l'exercice. Le `media` qui lui est rattaché est
interchangeable. Remplacer les illustrations libres par des assets payants ou
sur mesure se fera en modifiant une table, sans toucher aux routes, aux
programmes ni à l'UI.
