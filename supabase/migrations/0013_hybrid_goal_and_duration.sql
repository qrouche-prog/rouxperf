-- M5 : objectif "hybride" + durée de programme choisie (1 ou 3 mois).
-- À exécuter dans Supabase → SQL Editor, après 0012_same_day_combining.sql.

alter table public.goals drop constraint goals_goal_type_check;

alter table public.goals add constraint goals_goal_type_check
  check (
    goal_type in (
      'weight_loss', 'muscle_gain', 'strength', 'endurance',
      'general_fitness', 'recomposition', 'hybrid'
    )
  );

alter table public.goals add column program_duration_months int not null default 1
  check (program_duration_months in (1, 3));
