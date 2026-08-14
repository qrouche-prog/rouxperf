import { CORS, json, getUserId, serviceClient, importActivities } from '../_shared/intervals.ts'

// Resynchronise les séances depuis intervals.icu avec les identifiants stockés.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const userId = await getUserId(req)
  if (!userId) return json({ error: 'Non authentifié' }, 401)

  try {
    const supabase = serviceClient()
    const [{ data: conn }, { data: secret }] = await Promise.all([
      supabase.from('intervals_connections').select('athlete_id').eq('user_id', userId).maybeSingle(),
      supabase.from('intervals_secrets').select('api_key').eq('user_id', userId).maybeSingle(),
    ])
    if (!conn?.athlete_id || !secret?.api_key) return json({ error: 'intervals.icu non connecté' }, 400)
    const imported = await importActivities(supabase, userId, conn.athlete_id, secret.api_key)
    return json({ ok: true, imported })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erreur inattendue' }, 500)
  }
})
