import Stripe from 'npm:stripe@17.7.0'
import { CORS, json, getUserId, serviceClient } from '../_shared/intervals.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
})

// Ouvre le portail de facturation Stripe (gestion / annulation de l'abonnement).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const userId = await getUserId(req)
  if (!userId) return json({ error: 'Non authentifié' }, 401)

  try {
    const body = await req.json().catch(() => ({}))
    const base = Deno.env.get('APP_URL') || String(body?.origin || '').replace(/\/$/, '')

    const supabase = serviceClient()
    const { data } = await supabase
      .from('subscriptions')
      .select('provider_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!data?.provider_customer_id) return json({ error: 'Aucun abonnement à gérer.' }, 400)

    const session = await stripe.billingPortal.sessions.create({
      customer: data.provider_customer_id,
      return_url: `${base}/premium`,
    })

    return json({ url: session.url })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erreur inattendue' }, 500)
  }
})
