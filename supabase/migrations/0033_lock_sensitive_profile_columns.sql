-- M33 : verrouille les colonnes sensibles de public.profiles
--
-- PROBLÈME
-- La policy « Users can update their own profile » (0001) ne vérifie que la
-- propriété de la ligne :
--
--     on public.profiles for update using (user_id = auth.uid())
--
-- RLS ne restreint pas les colonnes, et aucun GRANT par colonne n'existait.
-- Le rôle `authenticated` disposait donc d'un UPDATE sur toute la table, donc
-- sur toutes les colonnes de sa propre ligne. Deux conséquences, toutes deux
-- atteignables par un simple PATCH sur l'API REST, sans passer par l'app :
--
--   1. is_admin — api/_lib/adminAuth.js accorde l'accès admin en lisant
--      profiles.is_admin. N'importe quel compte pouvait donc se promouvoir
--      administrateur, puis appeler les routes api/admin/* (approbation de
--      génération, passage en premium, suppression d'utilisateur).
--
--   2. created_at — _shared/intervals.ts calcule la fin de l'essai de 7 jours
--      à partir de cette colonne. La repousser dans le futur donnait un essai
--      permanent, et donc les quatre fonctions IA gratuitement, indéfiniment.
--      Le contrôle serveur était bon ; c'est l'horloge qu'il consultait qui
--      était réinscriptible par l'utilisateur.
--
-- CORRECTIF
-- On retire l'UPDATE de table à `authenticated` et on ne rend accessibles en
-- écriture que les colonnes que le client modifie réellement :
--
--   full_name, birth_date, sex, height_cm   (PersonalInfoStep)
--   last_free_alternative_at                (ExerciseAlternatives)
--
-- Restent donc en lecture seule pour le client :
--   user_id, created_at, is_admin, onboarding_completed_at,
--   last_program_settings_change_at
--
-- `service_role` n'est pas touché : les écritures serveur (api/generate-program,
-- generate-program-worker sur onboarding_completed_at, routes admin) continuent
-- de fonctionner.
--
-- La policy RLS reste en place et garde son rôle : elle limite l'accès à sa
-- propre ligne. Les GRANT ci-dessous limitent, eux, les colonnes. Les deux
-- mécanismes sont complémentaires — l'un ne remplace pas l'autre.

revoke update on public.profiles from authenticated;

grant update (full_name, birth_date, sex, height_cm, last_free_alternative_at)
  on public.profiles to authenticated;

-- Vérification après application (doit lister exactement les 5 colonnes) :
--
--   select column_name
--   from information_schema.column_privileges
--   where grantee = 'authenticated'
--     and table_schema = 'public'
--     and table_name = 'profiles'
--     and privilege_type = 'UPDATE'
--   order by column_name;
