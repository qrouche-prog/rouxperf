import { CORS, json, getUserId, serviceClient, importActivities } from '../_shared/intervals.ts'

// Valide (athlete_id, api_key) en important une première fois, puis les stocke.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const userId = await getUserId(req)
  if (!userId) return json({ error: 'Non authentifié' }, 401)

  const { athlete_id, api_key } = await req.json().catch(() => ({}))
  const athleteId = String(athlete_id ?? '').trim()
  const apiKey = String(api_key ?? '').trim()
  if (!athleteId || !apiKey) return json({ error: 'Athlete ID et clé API requis.' }, 400)

  try {
    const supabase = serviceClient()
    // Valide les identifiants en important immédiatement (lève une erreur si 401/403).
    const imported = await importActivities(supabase, userId, athleteId, apiKey)

    await supabase
      .from('intervals_secrets')
      .upsert({ user_id: userId, api_key: apiKey, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    await supabase
      .from('intervals_connections')
      .upsert({ user_id: userId, athlete_id: athleteId, connected_at: new Date().toISOString() }, { onConflict: 'user_id' })

    return json({ ok: true, imported })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erreur inattendue' }, 400)
  }
})
