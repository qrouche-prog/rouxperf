import { requireAdmin } from '../_lib/adminAuth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' })
    return
  }

  const admin = await requireAdmin(req, res)
  if (!admin) return
  const { adminClient } = admin

  const [{ data: authUsers, error: authError }, { data: profiles, error: profilesError }, { data: subs }] =
    await Promise.all([
      adminClient.auth.admin.listUsers({ perPage: 1000 }),
      adminClient.from('profiles').select('user_id, full_name, is_admin, onboarding_completed_at'),
      adminClient.from('subscriptions').select('user_id, tier, status, current_period_end'),
    ])

  if (authError || profilesError) {
    res.status(500).json({ error: (authError ?? profilesError).message })
    return
  }

  function isPremium(sub) {
    if (!sub || sub.tier !== 'premium') return false
    if (sub.status && !['active', 'trialing'].includes(sub.status)) return false
    if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) return false
    return true
  }

  const profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]))
  const subsById = Object.fromEntries((subs ?? []).map((s) => [s.user_id, s]))

  const users = (authUsers?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    full_name: profilesById[u.id]?.full_name ?? null,
    is_admin: profilesById[u.id]?.is_admin ?? false,
    onboarding_completed_at: profilesById[u.id]?.onboarding_completed_at ?? null,
    is_premium: isPremium(subsById[u.id]),
  }))

  res.status(200).json({ users })
}
