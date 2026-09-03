-- M36 : intégration vidéo MuscleWiki (plan Testing) — colonne de mapping
-- exercice rouxperf -> exercice MuscleWiki. Nullable : un exercice sans
-- correspondance fiable garde son illustration OpenTraining existante
-- (voir mediaForSlug) au lieu d'afficher une vidéo potentiellement erronée.
alter table public.exercises add column musclewiki_exercise_id integer;
alter table public.exercises add column musclewiki_videos jsonb;

comment on column public.exercises.musclewiki_exercise_id is
  'ID exercice côté API MuscleWiki (api.musclewiki.com), quand une correspondance fiable a été validée. Null = pas de vidéo MuscleWiki, fallback sur illustration_slug.';
comment on column public.exercises.musclewiki_videos is
  'Tableau des vidéos MuscleWiki ([{url, angle, gender, og_image}]) mis en cache depuis GET /exercises/{id} — autorisé 30 jours par leurs conditions, à rafraîchir périodiquement plutôt que rappelé à chaque affichage.';
