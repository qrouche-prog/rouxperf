import { CORS, json, serviceClient, importActivities } from '../_shared/intervals.ts'

// Synchronise TOUS les comptes intervals.icu connectés. Appelée par un cron
// (pg_cron + pg_net) — protégée par un secret partagé `CRON_SECRET`.
// À déployer sans vérification de JWT : `--no-verify-jwt`.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const secret = Deno.env.get('CRON_SECRET')
  if (secret && req.headers.get('x-cron-secret') !== secret) {
    return new Response('forbidden', { status: 403 })
  }

  const supabase = serviceClient()
  const { data: conns } = await supabase.from('intervals_connections').select('user_id, athlete_id')

  let users = 0
  let imported = 0
  let errors = 0
  for (const c of conns ?? []) {
    try {
      const { data: sec } = await supabase
        .from('intervals_secrets')
        .select('api_key')
        .eq('user_id', c.user_id)
        .maybeSingle()
      if (!sec?.api_key || !c.athlete_id) continue
      // Fenêtre courte : on ne récupère que les séances récentes chaque nuit.
      imported += await importActivities(supabase, c.user_id, c.athlete_id, sec.api_key, 14)
      users += 1
    } catch {
      errors += 1
    }
  }

  return json({ users, imported, errors })
})
