-- M37 : étapes numérotées MuscleWiki (GET /exercises/{id}.steps), mises en
-- cache comme musclewiki_videos — utilisées dans le panneau "ⓘ info" à côté
-- du texte libre "instructions" existant.
alter table public.exercises add column if not exists musclewiki_steps jsonb;

comment on column public.exercises.musclewiki_steps is
  'Étapes numérotées (texte) depuis GET /exercises/{id}.steps — mis en cache comme musclewiki_videos.';
