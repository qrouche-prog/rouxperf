import { createClient } from 'npm:@supabase/supabase-js@2.110.7'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Providers proposés dans le widget Terra (montre / santé).
const PROVIDERS = 'GARMIN,APPLE,FITBIT,POLAR,SUUNTO,WITHINGS,GOOGLE,COROS,WAHOO'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    // Identifie l'utilisateur appelant à partir de son JWT.
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return json({ error: 'Non authentifié' }, 401)

    const devId = Deno.env.get('TERRA_DEV_ID')
    const apiKey = Deno.env.get('TERRA_API_KEY')
    if (!devId || !apiKey) return json({ error: 'Terra non configuré (secrets manquants).' }, 500)

    const { redirect_url } = await req.json().catch(() => ({ redirect_url: '' }))
    const redirect = typeof redirect_url === 'string' && redirect_url ? redirect_url : 'https://app.rouxperf.ch/settings'

    const res = await fetch('https://api.tryterra.co/v2/auth/generateWidgetSession', {
      method: 'POST',
      headers: { 'dev-id': devId, 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference_id: user.id, // permet au webhook de retrouver notre utilisateur
        providers: PROVIDERS,
        language: 'fr',
        auth_success_redirect_url: redirect,
        auth_failure_redirect_url: redirect,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data?.url) {
      return json({ error: data?.message || 'Impossible de générer la session Terra.' }, 502)
    }
    return json({ url: data.url })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erreur inattendue' }, 500)
  }
})
