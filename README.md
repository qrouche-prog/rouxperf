# rouxperf.ch — plateforme de coaching sportif

Application où les utilisateurs s'inscrivent, renseignent leurs mesures et
objectifs, et reçoivent un programme d'entraînement généré par IA (ancré sur
une bibliothèque d'exercices). Projet séparé de `rouche-project`.

Le plan complet (schéma Supabase, génération IA, routes, jalons M1-M5) est
documenté dans `PLAN.md`.

## Stack
- React + Vite + `react-router-dom`
- Supabase (Postgres + Auth), via `@supabase/supabase-js`
- Génération de programme : Claude API (`@anthropic-ai/sdk`), appelée
  uniquement depuis une fonction serveur Vercel (`api/generate-program.js`,
  à venir en M3) — jamais depuis le navigateur.
- `recharts` pour les graphiques de progression (M4)

## Démarrer

```bash
npm install
cp .env.example .env   # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev
```

Le site est disponible sur http://localhost:5173

## Supabase

Le schéma SQL est dans `supabase/migrations/` — à exécuter dans l'éditeur
SQL du projet Supabase (pas de CLI Supabase utilisée pour l'instant).
`0001_init.sql` crée `profiles` (1:1 avec `auth.users`, via un trigger
`handle_new_user`) et ses policies RLS.

## Où en est le projet

**M1 (en cours)** : scaffold + auth de base (signup/login/reset/update
password, garde `RequireAuth`, table `profiles`). Reste à faire pour clore
M1 : créer le repo GitHub, le projet Supabase, le projet Vercel, et
vérifier le parcours de bout en bout (voir `PLAN.md` § Vérification).

Jalons suivants : onboarding (M2), génération IA du programme (M3), suivi
de progression (M4), polish + DNS (M5).

## Documents utiles
- `PLAN.md` — plan de référence complet (schéma, décisions produit, ordre
  de construction).
