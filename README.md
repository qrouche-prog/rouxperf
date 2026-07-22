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
  uniquement depuis une fonction serveur Vercel (`api/generate-program.js`)
  — jamais depuis le navigateur. Sortie structurée (JSON Schema avec
  `exercise_id` contraint par `enum`) pour garantir que le modèle ne
  référence que des exercices réels.
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

**M1 terminé** : scaffold + auth de base (signup/login/reset/update
password, garde `RequireAuth`, table `profiles`). Déployé sur Vercel
(`https://rouxperf.vercel.app`, `vercel.json` avec rewrite SPA pour les
routes client) et connecté à Supabase (Site URL / Redirect URLs configurés
dans Authentication → URL Configuration). Parcours de bout en bout vérifié :
signup → confirmation email → login → `/dashboard`.

**M2 terminé** : wizard d'onboarding (infos, mesures avec bulles d'aide
illustrées, objectifs, expérience, préférences) avec sauvegarde progressive
à chaque étape, garde `RequireOnboarding`.

**M3 terminé** : bibliothèque de ~29 exercices (`exercises`, seedée),
génération de programme par IA (`api/generate-program.js`, Claude Opus 4.8,
sortie structurée), page `/program`. Un flag `MOCK_PROGRAM_GENERATION=true`
permet de tester tout le pipeline sans crédit API (utile tant que le compte
Anthropic n'est pas encore facturé) — à retirer pour la vraie génération.

**M4 terminé** : `workout_logs`/`workout_log_sets` (RLS, `week_number`/
`day_number` pointent dans `user_programs.structure` plutôt qu'une FK
relationnelle), page `/progress` — graphique de tendance par mesure
(`recharts`, palette et specs du skill `dataviz`, theme-aware via variables
CSS), formulaire d'ajout de mesure, formulaire de logging de séance par jour
du programme actif.

Prochain jalon : **M5** — polish (mobile, gestion des erreurs/coûts API,
`/settings`), audit RLS complet, DNS `rouxperf.ch` chez Infomaniak → Vercel.

## Documents utiles
- `PLAN.md` — plan de référence complet (schéma, décisions produit, ordre
  de construction).
