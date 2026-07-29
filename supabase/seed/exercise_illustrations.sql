-- Rapprochement bibliothèque d'illustrations ↔ exercices curés (par nom).
-- Lot initial vérifié à la main : chaque slug pointe une illustration qui
-- représente bien le mouvement. À compléter au fil de l'eau pour les autres
-- exercices (les slugs disponibles sont dans data/exercises.json).
-- À exécuter dans Supabase → SQL Editor, après 0015_exercise_illustration.sql
-- et après le seed des exercices.

update public.exercises set illustration_slug = 'squats'               where name = 'Squat au poids du corps';
update public.exercises set illustration_slug = 'squats'               where name = 'Squat arrière barre';
update public.exercises set illustration_slug = 'squats'               where name = 'Squat gobelet haltère';
update public.exercises set illustration_slug = 'squats'               where name = 'Squats sautés';
update public.exercises set illustration_slug = 'pushup'               where name = 'Pompes';
update public.exercises set illustration_slug = 'superman'             where name = 'Superman';
update public.exercises set illustration_slug = 'bridge'               where name = 'Pont fessier';
update public.exercises set illustration_slug = 'dips'                 where name = 'Dips';
update public.exercises set illustration_slug = 'benchpress'           where name = 'Développé couché barre';
update public.exercises set illustration_slug = 'curl-standing'        where name = 'Curl biceps haltères';
update public.exercises set illustration_slug = 'dumbbell-lateral-raise' where name = 'Élévations latérales haltères';
update public.exercises set illustration_slug = 'triceps-kickback'     where name = 'Extension triceps haltère';
update public.exercises set illustration_slug = 'lunges-dumbbell'      where name = 'Fentes avant';
update public.exercises set illustration_slug = 'lunges-dumbbell'      where name = 'Fentes sautées';
update public.exercises set illustration_slug = 'shoulder-press-one-arm' where name = 'Développé épaules haltères';
update public.exercises set illustration_slug = 't-bar-row'           where name = 'Rowing barre';
