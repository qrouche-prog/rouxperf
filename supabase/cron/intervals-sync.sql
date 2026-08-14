-- Planification de la synchronisation automatique intervals.icu.
-- À exécuter UNE FOIS dans Supabase → SQL Editor, après avoir :
--   1. déployé la fonction :  npx supabase functions deploy intervals-sync-all --no-verify-jwt
--   2. posé le secret cron :  npx supabase secrets set CRON_SECRET=<une-longue-chaîne-aléatoire>
--
-- Remplace <PROJECT_REF> par la référence de ton projet Supabase
-- (visible dans l'URL du dashboard) et <CRON_SECRET> par la MÊME valeur que le secret ci-dessus.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Sync chaque nuit à 03:00 UTC.
select cron.schedule(
  'intervals-sync-nightly',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/intervals-sync-all',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);

-- Pour vérifier / gérer ensuite :
--   select * from cron.job;                       -- liste les tâches planifiées
--   select cron.unschedule('intervals-sync-nightly');  -- pour l'annuler
