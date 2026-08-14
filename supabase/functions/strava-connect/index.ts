import { CORS, json, getUserId, stravaConfig } from '../_shared/strava.ts'

// Construit l'URL d'autorisation Strava (le client_id n'est pas secret, mais on
// garde toute la config Strava dans les secrets Supabase).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const userId = await getUserId(req)
  if (!userId) return json({ error: 'Non authentifié' }, 401)

  const { clientId } = stravaConfig()
  if (!clientId) return json({ error: 'Strava non configuré (secrets manquants).' }, 500)

  const { redirect_uri } = await req.json().catch(() => ({ redirect_uri: '' }))
  const redirect =
    typeof redirect_uri === 'string' && redirect_uri ? redirect_uri : 'https://app.rouxperf.ch/settings'

  const url =
    'https://www.strava.com/oauth/authorize?' +
    new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirect,
      approval_prompt: 'auto',
      scope: 'read,activity:read_all',
    }).toString()

  return json({ url })
})
