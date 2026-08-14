import { CORS, json, getUserId, serviceClient, stravaConfig, importActivities } from '../_shared/strava.ts'

// Échange le code OAuth contre des jetons, les stocke (rôle service), puis
// importe les dernières séances.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const userId = await getUserId(req)
  if (!userId) return json({ error: 'Non authentifié' }, 401)

  const { clientId, clientSecret } = stravaConfig()
  if (!clientId || !clientSecret) return json({ error: 'Strava non configuré.' }, 500)

  const { code, scope } = await req.json().catch(() => ({}))
  if (!code) return json({ error: 'Code OAuth manquant' }, 400)

  try {
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    })
    const t = await res.json()
    if (!res.ok || !t.access_token) {
      return json({ error: t?.message || "Échec de l'échange Strava" }, 502)
    }

    const supabase = serviceClient()
    const athleteId = t.athlete?.id ?? null

    await supabase.from('strava_tokens').upsert(
      {
        user_id: userId,
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        expires_at: t.expires_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    await supabase.from('strava_connections').upsert(
      { user_id: userId, athlete_id: athleteId, scope: scope ?? null, connected_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

    let imported = 0
    try {
      imported = await importActivities(supabase, userId, t.access_token)
    } catch {
      // La connexion est faite ; l'import pourra se refaire via strava-sync.
    }

    return json({ ok: true, athlete_id: athleteId, imported })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erreur inattendue' }, 500)
  }
})
