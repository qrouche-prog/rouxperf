import Stripe from 'npm:stripe@17.7.0'
import { CORS, json, getUserId, serviceClient } from '../_shared/intervals.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
})

// Crée une session Stripe Checkout (abonnement) pour l'utilisateur connecté.
// Body : { plan: 'monthly' | 'quarterly', origin }.
//
// Le plan annuel a été retiré de l'offre. Le contrôle est ici et pas seulement
// dans l'interface : sans ça, un POST { plan: 'annual' } continuerait à créer
// une session au tarif annuel. Une valeur inconnue retombe sur le mensuel.
// Le prix Stripe annuel et le secret STRIPE_PRICE_ANNUAL restent en place —
// les abonnements annuels déjà souscrits continuent de se renouveler.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const userId = await getUserId(req)
  if (!userId) return json({ error: 'Non authentifié' }, 401)

  try {
    const body = await req.json().catch(() => ({}))
    const plan = ['monthly', 'quarterly'].includes(body?.plan) ? body.plan : 'monthly'
    const priceEnv = plan === 'quarterly' ? 'STRIPE_PRICE_QUARTERLY' : 'STRIPE_PRICE_MONTHLY'
    const price = Deno.env.get(priceEnv)
    if (!price) return json({ error: 'Tarif non configuré.' }, 500)

    const base = String(Deno.env.get('APP_URL') || body?.origin || '').trim().replace(/\/+$/, '')
    if (!base) return json({ error: 'Origine manquante.' }, 400)

    const supabase = serviceClient()

    // Réutilise le client Stripe existant, sinon en crée un lié à l'utilisateur.
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('provider_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    let customer = existing?.provider_customer_id ?? null
    if (!customer) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId)
      const email = authUser?.user?.email ?? undefined
      const created = await stripe.customers.create({ email, metadata: { user_id: userId } })
      customer = created.id
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price, quantity: 1 }],
      client_reference_id: userId,
      allow_promotion_codes: true,
      subscription_data: { metadata: { user_id: userId } },
      success_url: `${base}/premium?status=success`,
      cancel_url: `${base}/premium?status=cancel`,
    })

    return json({ url: session.url })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erreur inattendue' }, 500)
  }
})
