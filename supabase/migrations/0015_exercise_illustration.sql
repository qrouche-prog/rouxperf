-- M7 : lien optionnel vers une illustration de la bibliothèque libre.
-- Le slug est l'identité stable du média (public/exercises + data/exercises.json).
-- Colonne facultative : un exercice sans slug s'affiche en texte seul.
-- À exécuter dans Supabase → SQL Editor, après 0014_event_details.sql.

alter table public.exercises add column illustration_slug text;
