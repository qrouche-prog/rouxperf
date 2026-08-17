import { requireAdmin } from '../_lib/adminAuth.js'

// Régénère le programme d'un utilisateur (ex. après qu'il a modifié des réglages
// liés à son programme). Crée un nouveau programme en génération et déclenche le
// worker — sans validation ni quota. Réservé aux administrateurs.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' })
    return
  }

  const admin = await requireAdmin(req, res)
  if (!admin) return
  const { adminClient } = admin

  const { user_id, effort } = req.body ?? {}
  if (!user_id) {
    res.status(400).json({ error: 'user_id manquant' })
    return
  }
  const forcedEffort = ['low', 'medium', 'high'].includes(effort) ? effort : undefined

  const { data: last } = await adminClient
    .from('user_programs')
    .select('status')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (last && (last.status === 'generating' || last.status === 'pending_approval')) {
    res.status(409).json({ error: 'Une génération est déjà en cours pour cet utilisateur.' })
    return
  }

  const { data: program, error: insErr } = await adminClient
    .from('user_programs')
    .insert({ user_id, status: 'generating', current_week: 1, structure: null })
    .select()
    .single()
  if (insErr || !program) {
    res.status(500).json({ error: insErr?.message ?? 'Création du programme impossible.' })
    return
  }

  try {
    const workerResponse = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/generate-program-worker`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ program_id: program.id, user_id, effort: forcedEffort }),
      signal: AbortSignal.timeout(8000),
    })
    if (!workerResponse.ok) {
      const body = await workerResponse.json().catch(() => ({}))
      throw new Error(body.error ?? `worker a répondu ${workerResponse.status}`)
    }
  } catch (err) {
    await adminClient
      .from('user_programs')
      .update({ status: 'failed', error_message: `Échec du déclenchement : ${err.message}` })
      .eq('id', program.id)
    res.status(502).json({ error: 'Échec du déclenchement de la génération.', detail: err.message })
    return
  }

  res.status(200).json({ ok: true, program_id: program.id })
}
