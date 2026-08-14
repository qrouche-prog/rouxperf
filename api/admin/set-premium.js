import { requireAdmin } from '../_lib/adminAuth.js'

// Accorde ou retire le statut Premium à un utilisateur (pour les testeurs sans
// abonnement payant). Réservé aux administrateurs.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' })
    return
  }

  const admin = await requireAdmin(req, res)
  if (!admin) return
  const { adminClient } = admin

  const { user_id, premium } = req.body ?? {}
  if (!user_id) {
    res.status(400).json({ error: 'user_id manquant' })
    return
  }

  if (premium) {
    const { error } = await adminClient.from('subscriptions').upsert(
      {
        user_id,
        tier: 'premium',
        status: 'active',
        provider: 'admin',
        current_period_end: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }
  } else {
    const { error } = await adminClient.from('subscriptions').delete().eq('user_id', user_id)
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }
  }

  res.status(200).json({ ok: true, premium: !!premium })
}
