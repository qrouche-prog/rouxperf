import { createClient } from '@supabase/supabase-js'
import { validateProgramStructure } from './_lib/validateProgram.js'
import { sendEmail } from './_lib/sendEmail.js'

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

  // Génération réelle : coût IA payé de la poche de l'admin tant qu'il n'y a
  // pas de paiement sur le site — le programme reste "pending_approval" et
  // n'appelle pas Claude tant qu'un admin ne l'a pas validé depuis /admin.
  const { data: program, error: insertError } = await supabase
    .from('user_programs')
    .insert({ user_id: user.id, status: 'pending_approval', current_week: 1, structure: null })
    .select()
    .single()

  if (insertError) {
    res.status(500).json({ error: insertError.message })
    return
  }

  // Marque l'onboarding comme terminé dès la demande plutôt qu'à la fin de la
  // génération réelle : l'utilisateur a fini son profil, l'approbation puis
  // la génération sont des étapes asynchrones — pas de raison de le bloquer
  // sur l'écran de génération en attendant.
  await supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('user_id', user.id)

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `rouxperf — nouvelle demande de génération (${profile.full_name || user.email})`,
      html: `<p><strong>${profile.full_name || user.email}</strong> souhaite générer son programme.</p>
             <p>Objectif : ${goal.goal_type} — Niveau : ${trainingProfile.experience_level ?? 'non renseigné'}</p>
             <p><a href="https://app.rouxperf.ch/admin">Voir et approuver dans /admin</a></p>`,
    })
  }

  res.status(200).json({ program })
}
