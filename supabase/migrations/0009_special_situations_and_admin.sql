-- M3 (suite) : situations particulières (grossesse, post-partum, rééducation,
-- athlète confirmé) prises en compte réellement dans la génération, sport/
-- info libre, et rôle administrateur.
-- À exécuter dans Supabase → SQL Editor, après 0008_focus_area_preferences.sql.

alter table public.user_training_profile add column special_situation text
  check (special_situation in ('none', 'pregnant', 'postpartum', 'injury_rehab', 'competitive_athlete'))
  default 'none';

alter table public.user_training_profile add column special_situation_details jsonb;

alter table public.user_training_profile add column other_sport_notes text;

alter table public.profiles add column is_admin boolean not null default false;

-- Pour te donner toi-même le rôle admin, exécute ensuite (en remplaçant l'email) :
-- update public.profiles set is_admin = true
-- where user_id = (select id from auth.users where email = 'ton.email@example.com');
