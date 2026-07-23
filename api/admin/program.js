import { requireAdmin } from '../_lib/adminAuth.js'
import { validateProgramStructure } from '../_lib/validateProgram.js'

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const { adminClient } = admin

  if (req.method === 'GET') {
    const userId = req.query.user_id
    if (!userId) {
      res.status(400).json({ error: 'user_id manquant' })
      return
    }

    const { data: program, error } = await adminClient
      .from('user_programs')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ program })
    return
  }

  if (req.method === 'PUT') {
    const { program_id, structure } = req.body ?? {}
    if (!program_id || !structure) {
      res.status(400).json({ error: 'program_id et structure sont requis' })
      return
    }

    const { data: exercises } = await adminClient.from('exercises').select('id')
    const validExerciseIds = new Set((exercises ?? []).map((e) => e.id))

    const validationError = validateProgramStructure(structure, validExerciseIds)
    if (validationError) {
      res.status(422).json({ error: `Programme invalide : ${validationError}` })
      return
    }

    const { data: updated, error } = await adminClient
      .from('user_programs')
      .update({ structure })
      .eq('id', program_id)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ program: updated })
    return
  }

  res.status(405).json({ error: 'Méthode non autorisée' })
}
