-- M6 : détails de compétition (ex. distance d'un trail) stockés en jsonb.
-- À exécuter dans Supabase → SQL Editor, après 0013_hybrid_goal_and_duration.sql.

alter table public.user_training_profile add column event_details jsonb;
