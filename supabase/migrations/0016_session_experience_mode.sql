-- Mode de déroulé de séance par défaut, par utilisateur.
--   'guided' : tout s'enchaîne (série → repos → exercice suivant), aucune navigation.
--   'free'   : l'utilisateur navigue librement entre les exercices.
-- Le mode reste modifiable au lancement de chaque séance ; cette colonne ne
-- porte que le défaut du compte.
alter table public.profiles
  add column session_mode text not null default 'guided'
  check (session_mode in ('guided', 'free'));

-- Correction de nommage : l'exercice s'appelle « Course en côte » (et non
-- « Côtes en course »).
update public.exercises
  set name = 'Course en côte'
  where name = 'Côtes en course';
