-- Étend user_training_profile : aspects à travailler, compétition à venir,
-- sports pour lesquels progresser. Exploité par api/generate-program.js.
-- À exécuter dans Supabase → SQL Editor, après 0005_workout_logs.sql.

alter table public.user_training_profile
  add column focus_areas text[] not null default '{}',
  add column upcoming_events text[] not null default '{}',
  add column event_date date,
  add column target_sports text[] not null default '{}';
