-- M3 (suite) : génération asynchrone du programme (contourne le timeout
-- de 10s des fonctions serverless Vercel Hobby en déportant l'appel IA
-- réel vers une Supabase Edge Function qui écrit le résultat ici).
-- À exécuter dans Supabase → SQL Editor, après 0006_sport_goals.sql.

alter table public.user_programs alter column structure drop not null;

alter table public.user_programs drop constraint user_programs_status_check;

alter table public.user_programs add constraint user_programs_status_check
  check (status in ('generating', 'active', 'completed', 'archived', 'failed'));

alter table public.user_programs add column error_message text;
