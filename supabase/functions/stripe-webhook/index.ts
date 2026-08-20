import Stripe from 'npm:stripe@17.7.0'
import { serviceClient } from '../_shared/intervals.ts'

// Webhook Stripe : déployer avec --no-verify-jwt (Stripe n'envoie pas de JWT).
// La sécurité repose sur la vérification de signature (STRIPE_WEBHOOK_SECRET).
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
})
const cryptoProvider = Stripe.createSubtleCryptoProvider()

function tierFromStatus(status: string): string {
  return ['active', 'trialing'].includes(status) ? 'premium' : 'free'
}

// Traduit la cadence Stripe en libellé d'offre. Retourne null plutôt que de
// deviner : price_id reste la source de vérité, et une cadence inconnue ne
// doit pas se faire passer pour un plan existant.
function planFromPrice(price?: Stripe.Price | null): string | null {
  const r = price?.recurring
  if (!r) return null
  if (r.interval === 'year' && r.interval_count === 1) return 'annual'
  if (r.interval === 'month' && r.interval_count === 1) return 'monthly'
  if (r.interval === 'month' && r.interval_count === 3) return 'quarterly'
  return null
}

async function upsertFromSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id
  if (!userId) return
  const supabase = serviceClient()
  const price = sub.items?.data?.[0]?.price ?? null
  await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      tier: tierFromStatus(sub.status),
      status: ['active', 'trialing', 'past_due', 'canceled'].includes(sub.status) ? sub.status : 'canceled',
      provider: 'stripe',
      provider_customer_id: String(sub.customer),
      provider_subscription_id: sub.id,
      price_id: price?.id ?? null,
      plan: planFromPrice(price),
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 })

  const sig = req.headers.get('stripe-signature')
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!sig || !secret) return new Response('Signature manquante', { status: 400 })

  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret, undefined, cryptoProvider)
  } catch (err) {
    return new Response(`Signature invalide : ${err instanceof Error ? err.message : ''}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(session.subscription))
          if (!sub.metadata?.user_id && session.client_reference_id) {
            sub.metadata = { ...sub.metadata, user_id: session.client_reference_id }
          }
          await upsertFromSubscription(sub)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await upsertFromSubscription(event.data.object as Stripe.Subscription)
        break
      }
      default:
        break
    }
  } catch (err) {
    return new Response(`Erreur de traitement : ${err instanceof Error ? err.message : ''}`, { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
