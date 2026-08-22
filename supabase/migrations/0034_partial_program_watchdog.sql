-- M34 : filet de sécurité complémentaire au watchdog M33. Depuis que la
-- génération se fait semaine par semaine avec auto-enchaînement (chaque
-- semaine redéclenche une invocation fraîche pour la suivante), un programme
-- peut rester "active" mais incomplet si l'enchaînement s'interrompt entre
-- deux semaines — le watchdog M33 ne surveille que status="generating" et ne
-- voit donc pas ce cas. Ce job reprend toute génération "active" mais dont
-- les 4 semaines de base ne sont pas encore là, en rappelant le worker (qui
-- est conçu pour reprendre depuis la dernière semaine sauvegardée).
--
-- La clé anon (publique, déjà exposée côté frontend) est stockée dans
-- Supabase Vault plutôt qu'écrite en dur dans la commande cron — voir :
--   select vault.create_secret('<clé>', 'supabase_anon_key', '...');
-- exécuté une fois séparément (pas versionné, comme un secret).
select cron.schedule(
  'stuck-partial-program-watchdog',
  '*/2 * * * *',
  $$
  do $body$
  declare
    anon_key text;
    r record;
  begin
    select decrypted_secret into anon_key
    from vault.decrypted_secrets
    where name = 'supabase_anon_key';

    if anon_key is null then
      return;
    end if;

    for r in
      select up.id, up.user_id
      from public.user_programs up
      where up.status = 'active'
        and up.created_at < now() - interval '5 minutes'
        and (
          select count(*)
          from jsonb_array_elements(coalesce(up.structure -> 'weeks', '[]'::jsonb)) w
          where (w ->> 'week_number')::int <= 4
        ) < 4
    loop
      perform net.http_post(
        url := 'https://nbyvxuvnlcyofytvmsvl.supabase.co/functions/v1/generate-program-worker',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key
        ),
        body := jsonb_build_object('program_id', r.id, 'user_id', r.user_id)
      );
    end loop;
  end;
  $body$;
  $$
);
