import { createClient } from 'npm:@supabase/supabase-js@2.110.7'

// Reçoit les webhooks Terra (auth, activity, deauth…). À déployer SANS
// vérification de JWT (Terra n'envoie pas de token) — voir supabase/config.toml.
// La signature `terra-signature` est vérifiée avec le secret de signature Terra.

async function verifySignature(rawBody: string, header: string, secret: string): Promise<boolean> {
  // Format : "t=<timestamp>,v1=<hmac_sha256_hex>", signé sur `${t}.${rawBody}`.
  const parts: Record<string, string> = {}
  for (const kv of header.split(',')) {
    const idx = kv.indexOf('=')
    if (idx > 0) parts[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim()
  }
  const t = parts.t
  const sig = parts.v1
  if (!t || !sig) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return hex === sig
}

function num(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function mapActivity(a: any, userId: string, provider?: string) {
  const md = a?.metadata ?? {}
  const external = md.summary_id ?? md.upload_id ?? `${md.start_time ?? ''}-${md.type ?? ''}`
  const durSec = num(a?.active_durations_data?.activity_seconds)
  return {
    user_id: userId,
    source: 'terra',
    provider: provider ?? null,
    external_id: String(external),
    activity_type: String(md.name ?? md.type ?? 'activity'),
    started_at: md.start_time ?? null,
    duration_s: durSec != null ? Math.round(durSec) : null,
    distance_m: num(a?.distance_data?.summary?.distance_meters),
    calories: num(a?.calories_data?.total_burned_calories) ?? num(a?.calories_data?.net_activity_calories),
    avg_hr: (() => {
      const v = num(a?.heart_rate_data?.summary?.avg_hr_bpm)
      return v != null ? Math.round(v) : null
    })(),
    max_hr: (() => {
      const v = num(a?.heart_rate_data?.summary?.max_hr_bpm)
      return v != null ? Math.round(v) : null
    })(),
    elevation_gain_m: num(a?.distance_data?.summary?.elevation?.gain_actual_meters),
    raw: a,
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')

  const raw = await req.text()
  const secret = Deno.env.get('TERRA_SIGNING_SECRET')
  const sigHeader = req.headers.get('terra-signature')
  if (secret && sigHeader) {
    const ok = await verifySignature(raw, sigHeader, secret)
    if (!ok) return new Response('signature invalide', { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('json invalide', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const type = payload?.type
  const terraUserId = payload?.user?.user_id
  const referenceId = payload?.user?.reference_id
  const provider = payload?.user?.provider

  try {
    if (type === 'auth' && referenceId && terraUserId) {
      await supabase
        .from('terra_connections')
        .upsert({ user_id: referenceId, terra_user_id: terraUserId, provider }, { onConflict: 'user_id,terra_user_id' })
    } else if (type === 'deauth' && terraUserId) {
      await supabase.from('terra_connections').delete().eq('terra_user_id', terraUserId)
    } else if (type === 'activity' && terraUserId) {
      const { data: conn } = await supabase
        .from('terra_connections')
        .select('user_id')
        .eq('terra_user_id', terraUserId)
        .maybeSingle()
      if (conn?.user_id) {
        const rows = (payload.data ?? []).map((a: any) => mapActivity(a, conn.user_id, provider))
        if (rows.length > 0) {
          await supabase.from('wearable_activities').upsert(rows, { onConflict: 'user_id,external_id' })
        }
      }
    }
    // Les autres types (daily, sleep, body…) sont acquittés pour l'instant.
  } catch (err) {
    // On répond 200 quand même : Terra réessaie sinon en boucle. On log l'erreur.
    console.error('terra-webhook error', err)
  }

  return new Response('ok', { status: 200 })
})
