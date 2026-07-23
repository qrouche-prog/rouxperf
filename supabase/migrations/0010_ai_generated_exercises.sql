-- M3 (suite) : distingue les exercices ajoutés automatiquement par l'IA
-- (cardio/sport/conditionnement libre, quand la bibliothèque ne couvre pas
-- le besoin) des exercices de la bibliothèque curée manuellement.
-- À exécuter dans Supabase → SQL Editor, après 0009_special_situations_and_admin.sql.

alter table public.exercises add column is_ai_generated boolean not null default false;
