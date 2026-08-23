-- M35 : le timeout applicatif de la semaine 1 est passé de 90s à 150s (prompt
-- renforcé niveau avancé, plus long à générer) — remonte le seuil du filet de
-- sécurité M33 à 4 minutes pour ne pas tuer une génération encore légitimement
-- en cours (90s de marge après le timeout applicatif + overhead DB/prompt).
select cron.schedule(
  'stuck-program-generation-watchdog',
  '* * * * *',
  $$
  update public.user_programs
  set status = 'failed',
      error_message = 'Génération interrompue automatiquement après un délai anormalement long — réessaie.'
  where status = 'generating'
    and created_at < now() - interval '4 minutes';
  $$
);
