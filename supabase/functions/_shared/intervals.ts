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

export async function getUserId(req: Request): Promise<string | null> {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

function mapActivity(a: any, userId: string) {
  return {
    user_id: userId,
    source: 'intervals',
    provider: 'intervals',
    external_id: `icu-${a.id}`,
    activity_type: a.type || a.name || 'activity',
    started_at: a.start_date_local ?? a.start_date ?? null,
    duration_s: a.moving_time ?? a.elapsed_time ?? null,
    distance_m: a.distance ?? null,
    calories: a.calories ?? null,
    avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    max_hr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    elevation_gain_m: a.total_elevation_gain ?? null,
    raw: a,
  }
}

// Récupère les séances des `days` derniers jours via l'API intervals.icu
// (auth Basic : user "API_KEY", password = clé), et les upsert.
export async function importActivities(
  supabase: SupabaseClient,
  userId: string,
  athleteId: string,
  apiKey: string,
  days = 60
): Promise<number> {
  const newest = new Date().toISOString().slice(0, 10)
  const oldest = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const auth = 'Basic ' + btoa(`API_KEY:${apiKey}`)
  const query = `activities?oldest=${oldest}&newest=${newest}`

  // Tolérance : id en minuscule (intervals.icu utilise "i675729"), avec repli
  // sur la partie numérique seule si le premier essai renvoie 404.
  const normalized = athleteId.trim().toLowerCase()
  const candidates = [normalized]
  const digits = normalized.replace(/\D/g, '')
  if (digits && digits !== normalized) candidates.push(digits)

  let res: Response | null = null
  for (const id of candidates) {
    res = await fetch(`https://intervals.icu/api/v1/athlete/${encodeURIComponent(id)}/${query}`, {
      headers: { Authorization: auth },
    })
    if (res.status === 401 || res.status === 403) throw new Error('Clé API invalide')
    if (res.status !== 404) break
  }
  if (!res || !res.ok) throw new Error(`intervals.icu a répondu ${res?.status ?? 'sans réponse'} (athlete ID ?)`)
  const acts = await res.json()
  if (!Array.isArray(acts) || acts.length === 0) return 0
  const rows = acts.map((a) => mapActivity(a, userId))
  const { error } = await supabase.from('wearable_activities').upsert(rows, { onConflict: 'user_id,external_id' })
  if (error) throw new Error(error.message)
  return rows.length
}
