import { requireAdmin } from '../_lib/adminAuth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' })
    return
  }

  const admin = await requireAdmin(req, res)
  if (!admin) return
  const { adminClient, callerId } = admin

  const { user_id } = req.body ?? {}
  if (!user_id) {
    res.status(400).json({ error: 'user_id manquant' })
    return
  }

  if (user_id === callerId) {
    res.status(400).json({ error: 'Tu ne peux pas supprimer ton propre compte admin.' })
    return
  }

  // Toutes les tables métier référencent auth.users avec on delete cascade —
  // supprimer l'utilisateur auth efface donc profil, objectifs, mesures,
  // programme et logs associés en une seule opération.
  const { error } = await adminClient.auth.admin.deleteUser(user_id)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(200).json({ ok: true })
}
