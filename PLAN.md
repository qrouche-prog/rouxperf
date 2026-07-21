# rouxperf.ch — Plateforme de coaching sportif (nouveau projet)

## Contexte

Le client (Quentin) abandonne le positionnement "studio web" de `rouche-project`
pour un nouveau produit : **rouxperf.ch**, une application où les utilisateurs
s'inscrivent eux-mêmes, renseignent leurs informations personnelles, mesures
corporelles, objectifs et expérience sportive, et reçoivent un programme
d'entraînement structuré généré par un système de règles/templates (pas d'IA).
L'app doit aussi permettre de suivre facilement l'évolution (mesures et séances
dans le temps, avec graphiques).

C'est un projet **séparé** de `rouche-project` (qui reste intact), avec son
propre dossier, repo GitHub, projet Vercel et projet Supabase.

Décisions déjà validées avec le client :
- Utilisateurs : auto-service public (pas un outil de coach pour gérer des clients).
- Génération de programme : **par IA** (Claude API), et non par un système de
  templates fixes — décision confirmée par le client après une première
  proposition de templates déterministes. Pour rester responsable sur un
  produit sportif (blessures, contre-indications), l'IA reste **ancrée** dans
  une bibliothèque d'exercices structurée (`exercises`) plutôt que de générer
  du texte libre — voir section dédiée ci-dessous.
- Backend : **Supabase** (Postgres + Auth + Storage), choisi pour éviter d'avoir
  un serveur à héberger/maintenir — le frontend React s'y connecte directement.
- Déploiement : même schéma que `rouche-project` (GitHub → Vercel, déploiement
  auto sur push).
- **Important : le client a demandé que ce projet soit construit dans une
  nouvelle conversation dédiée**, pas dans celle-ci. Ce plan sert de document
  de référence pour cette future session — il ne doit pas être exécuté ici.

## Emplacement du projet

Nouveau dossier frère de `rouche-project`, ex. :
`C:\Users\QuentinRouche\OneDrive - TrustInfo SA\Documents\rouche-project\rouxperf`

## Schéma Supabase (Postgres)

**Tables liées à l'utilisateur** (RLS activé, policy `user_id = auth.uid()`) :
- `profiles` (1:1 avec `auth.users`) — nom, date de naissance, sexe, taille,
  `onboarding_completed_at` (flag qui débloque le dashboard). Créée
  automatiquement via un trigger `handle_new_user` sur `auth.users`.
- `body_measurements` — série temporelle : poids, % masse grasse, tour de
  taille/hanches/poitrine/bras/cuisse, notes, `measured_at`.
- `goals` — type d'objectif (perte de poids, prise de muscle, force,
  endurance, forme générale, recomposition), poids cible, date cible,
  `is_active` (un seul objectif actif à la fois via index unique partiel).
- `user_training_profile` — niveau d'expérience, années de pratique, accès
  matériel (poids du corps / haltères maison / salle complète maison / salle
  commerciale), jours/semaine, durée de séance, jours préférés, blessures/
  limitations.
- `user_programs` — programme généré par l'IA pour cet utilisateur : statut,
  semaine courante, `structure` (jsonb : semaines → jours → exercices avec
  séries/reps/repos/notes de progression, au même format que ce qu'on
  aurait stocké pour un template — voir génération IA ci-dessous),
  `generation_prompt_snapshot` (jsonb : copie des données utilisateur envoyées
  au modèle, pour pouvoir déboguer/regénérer plus tard sans dépendre de l'état
  courant du profil).
- `workout_logs` (+ `week_number`/`day_number` en int, pointant vers une
  entrée de `user_programs.structure` plutôt qu'une FK relationnelle
  puisque la structure du programme est maintenant du jsonb) +
  `workout_log_sets` — séances réellement effectuées (distinct de
  `body_measurements`), avec reps/poids/RPE par série. `workout_log_sets`
  dénormalise `user_id` pour garder une policy RLS simple.

**Table de référence** (RLS activé, lecture publique `USING (true)` pour les
utilisateurs authentifiés, écriture uniquement via SQL Editor/seed, jamais
depuis le navigateur) :
- `exercises` — nom, catégorie, groupe musculaire, matériel requis,
  contre-indications, instructions, lien vidéo optionnel. Peuplée via un
  fichier seed SQL/JSON (pas d'interface d'administration en v1).

Contrairement à la version précédente de ce plan, il n'y a **plus de tables
`program_templates`/`template_weeks`/`template_days`/`template_exercises`** :
le programme n'est plus assemblé à partir de templates pré-écrits, il est
généré à la volée par l'IA et stocké directement dans `user_programs.structure`.

## Génération de programme par IA

**Pourquoi une fonction serveur (pas d'appel direct depuis le navigateur) :**
la clé API Anthropic ne doit jamais être exposée côté client. La génération
passe donc par une **Vercel Serverless Function** (ex.
`api/generate-program.js`), appelée par le frontend après la dernière étape
de l'onboarding.

1. Le frontend envoie au endpoint les données du profil (mesures, objectifs,
   niveau, matériel, dispo, blessures/limitations).
2. La fonction serveur appelle l'**API Claude** (voir le skill `claude-api`
   pour le choix du modèle et les paramètres — ne pas deviner ces détails,
   les vérifier au moment de l'implémentation) avec :
   - un prompt système décrivant le rôle de coach sportif et les contraintes
     de sécurité (respecter les blessures/limitations, progressivité adaptée
     au niveau) ;
   - la liste des exercices disponibles dans `exercises` (ou un sous-ensemble
     filtré par matériel/contre-indications) pour **ancrer** la génération —
     le modèle doit choisir parmi ces exercices (référencés par `id`) plutôt
     que d'en inventer, afin de garantir que chaque exercice généré a des
     instructions/vidéo/tags matériel connus et cohérents ;
   - un schéma de sortie structuré (tool use / structured output) définissant
     la forme attendue : semaines → jours → exercices (`exercise_id`, séries,
     reps, repos, notes de progression) — pas de texte libre à parser.
3. La fonction valide la réponse (les `exercise_id` référencés existent bien
   dans `exercises`, respect grossier des contraintes numériques), puis
   insère le résultat dans `user_programs.structure` et marque
   `profiles.onboarding_completed_at = now()`, ce qui débloque le reste de
   l'app.
4. **Erreurs/latence** : la génération IA peut échouer ou prendre plusieurs
   secondes — prévoir un état de chargement explicite côté onboarding et un
   comportement de repli clair en cas d'échec (message d'erreur + bouton
   "réessayer"), pas un écran bloqué silencieusement.
5. **Coût** : chaque inscription déclenche un appel API payant — à surveiller
   une fois en production (pas de limite de génération prévue en v1, à
   réévaluer si besoin).

## Architecture frontend

- **Stack** : React + Vite (comme `rouche-project`), + `react-router-dom`
  (nécessaire ici — app multi-pages avec routes protégées, contrairement au
  site vitrine one-page) + `@supabase/supabase-js` + `recharts` pour les
  graphiques de progression + `@anthropic-ai/sdk` (utilisé uniquement côté
  serveur, dans la fonction Vercel de génération). Pas de kit UI, pas de
  librairie de formulaires (même pattern que `Contact.jsx` du site vitrine :
  `useState` + validateurs maison).
- **Fonction serveur** : `api/generate-program.js` (Vercel Serverless
  Function) — seul endroit du code qui détient la clé API Anthropic
  (`ANTHROPIC_API_KEY` en variable d'environnement Vercel, jamais exposée au
  frontend).
- **Routes** : `/`, `/login`, `/signup`, `/reset-password`,
  `/update-password`, `/onboarding/:step` (wizard multi-étapes : infos
  perso → mesures → objectifs → expérience → préférences → génération IA),
  `/dashboard`, `/program`, `/program/log/:week/:day`, `/progress`,
  `/progress/measurements/new`, `/settings`.
- **Guards** : `RequireAuth` (session Supabase) et `RequireOnboarding`
  (`profiles.onboarding_completed_at` non nul) protègent
  dashboard/programme/progression/réglages.
- **Dossiers** : `src/lib` (client Supabase, matching, validateurs),
  `src/context/AuthContext.jsx`, `src/routes/*Page.jsx`, `src/components/
  {onboarding,program,progress}/*`, `src/hooks/*`, `supabase/migrations/`,
  `supabase/seed/`.
- ⚠️ Consulter le **skill `dataviz`** avant de construire les graphiques de
  `MeasurementChart.jsx` / la page `/progress` — ne pas designer les
  visualisations à l'improviste.

## Auth (Supabase)

Signup/login/reset via `supabase.auth.*`, session gérée par un
`AuthContext` (`onAuthStateChange`). Le trigger `handle_new_user` crée la
ligne `profiles` à l'inscription. Penser à configurer les redirect URLs
Supabase (localhost + domaine Vercel) sinon les liens d'email cassent.

## Ordre de construction suggéré

1. **M1** — Scaffold + repo GitHub + Vercel + projet Supabase + auth de base
   (`profiles`, trigger, RLS) + déploiement du squelette pour valider les
   env vars de bout en bout.
2. **M2** — Modèle de données onboarding (`body_measurements`, `goals`,
   `user_training_profile`) + wizard + garde `RequireOnboarding`.
3. **M3** — Bibliothèque d'exercices (`exercises`, seed) + fonction serveur
   `api/generate-program.js` (appel Claude API, sortie structurée ancrée sur
   `exercises`, validation) + `user_programs` + page `/program`. Consulter le
   skill `claude-api` pour le modèle/paramètres exacts avant d'implémenter.
4. **M4** — Logging des séances + mesures + page `/progress` avec graphiques
   (skill `dataviz`).
5. **M5** — Polish (mobile, états de chargement/erreur pour la génération IA,
   `/settings`), audit RLS, gestion des coûts/erreurs API, DNS `rouxperf.ch`
   chez Infomaniak → Vercel, README/CLAUDE.md documentant le schéma et le
   prompt de génération pour les sessions futures.

## Étapes de setup pratiques (rappel pour la nouvelle session)

Le client a déjà eu besoin d'accompagnement pas-à-pas pour : installation de
Node, création de repo GitHub, import Vercel, DNS Infomaniak (voir
l'historique de `rouche-project`). Prévoir le même niveau de guidage pour :
- la création du compte/projet Supabase (URL + clé anon dans `.env`,
  gitignored, + config des mêmes variables dans Vercel avant le premier
  déploiement) ;
- l'obtention d'une clé API Anthropic (`ANTHROPIC_API_KEY`) et sa
  configuration en variable d'environnement **Vercel uniquement** (jamais
  dans `.env` frontend, jamais avec un préfixe `VITE_` qui l'exposerait au
  navigateur).

## Vérification

- Après M1 : créer un compte de test, confirmer l'email, se connecter, vérifier
  qu'une ligne `profiles` existe bien (RLS + trigger fonctionnels).
- Après M2 : compléter le wizard entièrement, vérifier en base que
  `body_measurements`/`goals`/`user_training_profile` sont bien remplis et que
  `RequireOnboarding` redirige correctement avant complétion.
- Après M3 : appeler `api/generate-program.js` avec plusieurs profils types
  (débutant/avancé, matériel limité, avec blessure) et vérifier que le
  programme retourné ne référence que des `exercise_id` valides et respecte
  les contraintes (matériel, contre-indications) ; vérifier l'affichage sur
  `/program`.
- Après M4 : logger une séance et une mesure depuis un viewport mobile,
  vérifier que les graphiques de `/progress` reflètent les nouvelles données.
- Avant mise en ligne finale : audit RLS (un utilisateur ne doit jamais voir
  les données d'un autre), test du parcours complet sur `rouxperf.ch` une fois
  le DNS propagé.
