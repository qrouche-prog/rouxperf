-- M33 : filet de sécurité indépendant du code applicatif — échoue
-- automatiquement toute génération de programme bloquée depuis plus de
-- 3 minutes, au lieu de rester "generating" indéfiniment sans jamais écrire
-- d'erreur (le worker Edge Function peut être tué silencieusement par la
-- plateforme, sans que son propre code ait la main pour se signaler).
-- Vérifié toutes les minutes via pg_cron.
select cron.schedule(
  'stuck-program-generation-watchdog',
  '* * * * *',
  $$
  update public.user_programs
  set status = 'failed',
      error_message = 'Génération interrompue automatiquement après un délai anormalement long — réessaie.'
  where status = 'generating'
    and created_at < now() - interval '3 minutes';
  $$
);
