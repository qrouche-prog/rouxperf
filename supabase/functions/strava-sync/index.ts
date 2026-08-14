import { CORS, json, getUserId, serviceClient, stravaConfig, getValidToken, importActivities } from '../_shared/strava.ts'

// Récupère les dernières séances Strava (rafraîchit le jeton au besoin).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const userId = await getUserId(req)
  if (!userId) return json({ error: 'Non authentifié' }, 401)

  const { clientId, clientSecret } = stravaConfig()
  if (!clientId || !clientSecret) return json({ error: 'Strava non configuré.' }, 500)

  try {
    const supabase = serviceClient()
    const token = await getValidToken(supabase, userId, clientId, clientSecret)
    if (!token) return json({ error: 'Strava non connecté' }, 400)
    const imported = await importActivities(supabase, userId, token)
    return json({ ok: true, imported })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erreur inattendue' }, 500)
  }
})
