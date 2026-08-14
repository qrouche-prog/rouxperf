import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.110.7'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

// Identifie l'utilisateur appelant à partir de son JWT.
export async function getUserId(req: Request): Promise<string | null> {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export function stravaConfig() {
  return { clientId: Deno.env.get('STRAVA_CLIENT_ID'), clientSecret: Deno.env.get('STRAVA_CLIENT_SECRET') }
}

// Retourne un access_token valide (rafraîchi si expiré), ou null si non connecté.
export async function getValidToken(
  supabase: SupabaseClient,
  userId: string,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  const { data: tok } = await supabase.from('strava_tokens').select('*').eq('user_id', userId).maybeSingle()
  if (!tok) return null
  const now = Math.floor(Date.now() / 1000)
  if (tok.expires_at - 60 > now) return tok.access_token

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tok.refresh_token,
    }),
  })
  const j = await res.json()
  if (!res.ok || !j.access_token) throw new Error('Échec du rafraîchissement du jeton Strava')
  await supabase
    .from('strava_tokens')
    .update({
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  return j.access_token
}

function mapActivity(a: any, userId: string) {
  return {
    user_id: userId,
    source: 'strava',
    provider: 'strava',
    external_id: `strava-${a.id}`,
    activity_type: a.sport_type || a.type || 'activity',
    started_at: a.start_date ?? null,
    duration_s: a.moving_time ?? a.elapsed_time ?? null,
    distance_m: a.distance ?? null,
    calories: a.calories ?? null, // absent des résumés Strava (présent sur l'activité détaillée)
    avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    max_hr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    elevation_gain_m: a.total_elevation_gain ?? null,
    raw: a,
  }
}

// Récupère les dernières activités et les upsert (dédup par external_id).
export async function importActivities(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  perPage = 30
): Promise<number> {
  const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Strava a répondu ${res.status}`)
  const acts = await res.json()
  if (!Array.isArray(acts) || acts.length === 0) return 0
  const rows = acts.map((a) => mapActivity(a, userId))
  const { error } = await supabase.from('wearable_activities').upsert(rows, { onConflict: 'user_id,external_id' })
  if (error) throw new Error(error.message)
  return rows.length
}
