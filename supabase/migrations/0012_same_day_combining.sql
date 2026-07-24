-- M4 : fréquences de séances par modalité (musculation incluse dans
-- focus_area_preferences) + possibilité de deux séances le même jour.
-- À exécuter dans Supabase → SQL Editor, après 0011_generation_approval.sql.

alter table public.user_training_profile
  add column same_day_combining text not null default 'if_needed'
    check (same_day_combining in ('never', 'if_needed', 'allowed'));
