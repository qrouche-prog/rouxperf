import { requireAdmin } from '../_lib/adminAuth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' })
    return
  }

  const admin = await requireAdmin(req, res)
  if (!admin) return
  const { adminClient } = admin

  const { data: programs, error: programsError } = await adminClient
    .from('user_programs')
    .select('id, user_id, created_at')
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: true })

  if (programsError) {
    res.status(500).json({ error: programsError.message })
    return
  }

  if (!programs || programs.length === 0) {
    res.status(200).json({ requests: [] })
    return
  }

  const userIds = programs.map((p) => p.user_id)
  const [{ data: profiles }, { data: goals }] = await Promise.all([
    adminClient.from('profiles').select('user_id, full_name').in('user_id', userIds),
    adminClient
      .from('goals')
      .select('user_id, goal_type')
      .in('user_id', userIds)
      .eq('is_active', true),
  ])

  const profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]))
  const goalsById = Object.fromEntries((goals ?? []).map((g) => [g.user_id, g]))

  const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const emailById = Object.fromEntries((authUsers?.users ?? []).map((u) => [u.id, u.email]))

  const requests = programs.map((p) => ({
    program_id: p.id,
    user_id: p.user_id,
    created_at: p.created_at,
    full_name: profilesById[p.user_id]?.full_name ?? null,
    email: emailById[p.user_id] ?? null,
    goal_type: goalsById[p.user_id]?.goal_type ?? null,
  }))

  res.status(200).json({ requests })
}
