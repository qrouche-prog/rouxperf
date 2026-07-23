import { createClient } from '@supabase/supabase-js'
import { validateProgramStructure } from './_lib/validateProgram.js'

const EQUIPMENT_TIERS = {
  bodyweight: ['bodyweight'],
  home_dumbbells: ['bodyweight', 'dumbbell'],
  home_full_gym: ['bodyweight', 'dumbbell', 'barbell', 'bench', 'pull_up_bar', 'kettlebell'],
  commercial_gym: [
    'bodyweight',
    'dumbbell',
    'barbell',
    'bench',
    'pull_up_bar',
    'kettlebell',
    'cable_machine',
    'machine',
  ],
}

const WEEKS_COUNT = 4

function buildMockProgram(availableExercises, trainingProfile) {
  const daysPerWeek = trainingProfile.days_per_week ?? 3
  const exercisesPerDay = Math.min(4, availableExercises.length)
  const weeks = []

  for (let weekNumber = 1; weekNumber <= WEEKS_COUNT; weekNumber += 1) {
    const days = []
    for (let dayNumber = 1; dayNumber <= daysPerWeek; dayNumber += 1) {
      const exercises = []
      for (let i = 0; i < exercisesPerDay; i += 1) {
        const exercise = availableExercises[(dayNumber - 1 + i) % availableExercises.length]
        exercises.push({
          exercise_id: exercise.id,
          sets: 3,
          reps: '8-12',
          rest_seconds: 90,
          notes: `Programme d'exemple (mode mock, semaine ${weekNumber}) — pas de vraie génération IA.`,
        })
      }
      days.push({ day_number: dayNumber, name: `Séance ${dayNumber}`, exercises })
    }
    weeks.push({ week_number: weekNumber, days })
  }

  return { weeks }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' })
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token manquant' })
    return
  }
  const token = authHeader.slice(7)

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    res.status(401).json({ error: 'Session invalide' })
    return
  }

  const [{ data: profile }, { data: goal }, { data: trainingProfile }, { data: measurement }] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).single(),
    supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('user_training_profile').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!profile || !goal || !trainingProfile || !measurement) {
    res.status(400).json({ error: "Profil d'onboarding incomplet." })
    return
  }

  const allowedEquipment = EQUIPMENT_TIERS[trainingProfile.equipment_access] ?? ['bodyweight']
  const { data: allExercises } = await supabase.from('exercises').select('*')
  const availableExercises = (allExercises ?? []).filter((exercise) =>
    (exercise.equipment_required ?? []).every((item) => allowedEquipment.includes(item))
  )

  if (availableExercises.length === 0) {
    res.status(500).json({ error: 'Aucun exercice disponible pour ce profil.' })
    return
  }

  // Mode mock : génération instantanée en local, pas d'appel IA payant.
  if (process.env.MOCK_PROGRAM_GENERATION === 'true') {
    const structure = buildMockProgram(availableExercises, trainingProfile)
    const validationError = validateProgramStructure(structure, new Set(availableExercises.map((e) => e.id)))
    if (validationError) {
      res.status(500).json({ error: `Programme mock invalide : ${validationError}` })
      return
    }

    const { data: program, error: insertError } = await supabase
      .from('user_programs')
      .insert({ user_id: user.id, status: 'active', current_week: 1, structure })
      .select()
      .single()

    if (insertError) {
      res.status(500).json({ error: insertError.message })
      return
    }

    await supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('user_id', user.id)
    res.status(200).json({ program })
    return
  }

  // Génération réelle : l'appel Claude (30-90s) dépasse le plafond de 10s des
  // fonctions serverless Vercel Hobby. On crée un programme "generating" et on
  // délègue le travail à une Supabase Edge Function (EdgeRuntime.waitUntil),
  // qui écrit le résultat en base une fois terminé ; le client poll le statut.
  const { data: program, error: insertError } = await supabase
    .from('user_programs')
    .insert({ user_id: user.id, status: 'generating', current_week: 1, structure: null })
    .select()
    .single()

  if (insertError) {
    res.status(500).json({ error: insertError.message })
    return
  }

  try {
    const workerResponse = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/generate-program-worker`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ program_id: program.id }),
      signal: AbortSignal.timeout(8000),
    })

    if (!workerResponse.ok) {
      const body = await workerResponse.json().catch(() => ({}))
      throw new Error(body.error ?? `worker a répondu ${workerResponse.status}`)
    }
  } catch (err) {
    await supabase
      .from('user_programs')
      .update({ status: 'failed', error_message: `Échec du déclenchement : ${err.message}` })
      .eq('id', program.id)
    res.status(502).json({ error: 'Échec du déclenchement de la génération.', detail: err.message })
    return
  }

  res.status(200).json({ program })
}
