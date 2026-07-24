import { requireAdmin } from '../_lib/adminAuth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' })
    return
  }

  const admin = await requireAdmin(req, res)
  if (!admin) return
  const { adminClient } = admin

  const { program_id } = req.body ?? {}
  if (!program_id) {
    res.status(400).json({ error: 'program_id manquant' })
    return
  }

  const { data: program } = await adminClient
    .from('user_programs')
    .select('id, user_id, status')
    .eq('id', program_id)
    .maybeSingle()

  if (!program || program.status !== 'pending_approval') {
    res.status(409).json({ error: 'Demande introuvable ou déjà traitée' })
    return
  }

  const { error: updateError } = await adminClient
    .from('user_programs')
    .update({ status: 'generating' })
    .eq('id', program_id)

  if (updateError) {
    res.status(500).json({ error: updateError.message })
    return
  }

  try {
    const workerResponse = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/generate-program-worker`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ program_id: program.id, user_id: program.user_id }),
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

  res.status(200).json({ ok: true })
}
