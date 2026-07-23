import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic()

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

function exerciseInputSchema(exerciseIds) {
  return {
    type: 'object',
    properties: {
      exercise_id: { type: 'string', enum: exerciseIds },
      sets: { type: 'integer' },
      reps: { type: 'string' },
      rest_seconds: { type: 'integer' },
      notes: { type: 'string' },
    },
    required: ['exercise_id', 'sets', 'reps', 'rest_seconds', 'notes'],
    additionalProperties: false,
  }
}

function programSchema(exerciseIds) {
  return {
    type: 'object',
    properties: {
      weeks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            week_number: { type: 'integer' },
            days: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  day_number: { type: 'integer' },
                  name: { type: 'string' },
                  exercises: { type: 'array', items: exerciseInputSchema(exerciseIds) },
                },
                required: ['day_number', 'name', 'exercises'],
                additionalProperties: false,
              },
            },
          },
          required: ['week_number', 'days'],
          additionalProperties: false,
        },
      },
    },
    required: ['weeks'],
    additionalProperties: false,
  }
}

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

function validateProgramStructure(structure, validExerciseIds) {
  if (!structure || !Array.isArray(structure.weeks) || structure.weeks.length === 0) {
    return 'aucune semaine générée'
  }
  for (const week of structure.weeks) {
    if (!Array.isArray(week.days) || week.days.length === 0) return 'jours manquants'
    for (const day of week.days) {
      if (!Array.isArray(day.exercises) || day.exercises.length === 0) {
        return 'exercices manquants pour un jour'
      }
      for (const exercise of day.exercises) {
        if (!validExerciseIds.has(exercise.exercise_id)) {
          return `exercice inconnu (${exercise.exercise_id})`
        }
        if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 10) {
          return 'nombre de séries invalide'
        }
        if (
          !Number.isInteger(exercise.rest_seconds) ||
          exercise.rest_seconds < 0 ||
          exercise.rest_seconds > 600
        ) {
          return 'temps de repos invalide'
        }
      }
    }
  }
  return null
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

  const exerciseIds = availableExercises.map((exercise) => exercise.id)

  const promptSnapshot = {
    profile: { birth_date: profile.birth_date, sex: profile.sex, height_cm: profile.height_cm },
    goal: { goal_type: goal.goal_type, target_weight_kg: goal.target_weight_kg, target_date: goal.target_date },
    training_profile: trainingProfile,
    latest_measurement: measurement,
  }

  const systemPrompt = `Tu es un coach sportif expérimenté qui conçoit des programmes d'entraînement personnalisés, sûrs et progressifs.
Respecte strictement les blessures et limitations indiquées par l'utilisateur : si un mouvement pourrait les aggraver, ne le sélectionne pas.
Adapte le volume, l'intensité et la complexité technique au niveau d'expérience indiqué.
Choisis uniquement des exercices parmi la liste fournie, en les référençant par leur exercise_id exact — n'invente jamais d'exercice.
Prévois une progression cohérente d'une semaine à l'autre (charge, volume ou intensité perçue) et indique-la dans le champ "notes" de chaque exercice.

Le profil contient aussi des aspects à travailler (focus_areas), une éventuelle
compétition à venir (upcoming_events, event_date) et des sports pour lesquels
progresser (target_sports) — prends-les en compte concrètement, pas seulement
en façade :
- Si un focus est "cardio", "running", "aerobic" ou "anaerobic", inclus des
  exercices de la catégorie "cardio" (conditionnement, intervalles) — le champ
  "reps" peut alors exprimer une durée ("30s", "45s") ou une distance ("400m")
  plutôt qu'un nombre de répétitions, exactement comme indiqué sur l'exercice.
- Si une compétition est renseignée (Hyrox, Spartan/OCR, marathon, semi,
  10km, 5km, triathlon), oriente une partie du programme vers la préparation
  spécifique à cet effort (endurance, mouvements fonctionnels) ; si
  event_date est fourni et proche, priorise le maintien/l'affûtage plutôt que
  la surcharge.
- Si un focus est "explosiveness"/"anaerobic" ou qu'un sport cible (target_sports)
  est renseigné, inclus des mouvements pliométriques/explosifs pertinents pour
  ce sport (ex. sauts pour le volleyball/basketball) quand la bibliothèque le
  permet — sans jamais sortir de la liste d'exercices fournie.`

  const userPrompt = `Génère un programme d'entraînement de ${WEEKS_COUNT} semaines, avec ${trainingProfile.days_per_week} séance(s) par semaine, d'une durée cible de ${trainingProfile.session_duration_minutes} minutes chacune.

Profil utilisateur :
${JSON.stringify(promptSnapshot, null, 2)}

Exercices disponibles (choisis exclusivement parmi ceux-ci, par exercise_id) :
${JSON.stringify(
  availableExercises.map(({ id, name, category, muscle_group, contraindications, instructions }) => ({
    id,
    name,
    category,
    muscle_group,
    contraindications,
    instructions,
  })),
  null,
  2
)}`

  let structure

  if (process.env.MOCK_PROGRAM_GENERATION === 'true') {
    // Bypasses the paid Anthropic call for local/staging testing without API credits.
    structure = buildMockProgram(availableExercises, trainingProfile)
  } else {
    let response
    try {
      const stream = anthropic.messages.stream({
        model: 'claude-opus-4-8',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: programSchema(exerciseIds) },
        },
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })
      response = await stream.finalMessage()
    } catch (err) {
      res.status(502).json({ error: 'Échec de la génération du programme.', detail: err.message })
      return
    }

    if (response.stop_reason === 'refusal') {
      res.status(422).json({ error: "Le modèle n'a pas pu générer de programme pour ce profil." })
      return
    }
    if (response.stop_reason === 'max_tokens') {
      res.status(502).json({ error: 'La génération a été tronquée, réessaie.' })
      return
    }

    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock) {
      res.status(502).json({ error: 'Réponse du modèle invalide.' })
      return
    }

    try {
      structure = JSON.parse(textBlock.text)
    } catch {
      res.status(502).json({ error: 'Réponse du modèle mal formée.' })
      return
    }
  }

  const validationError = validateProgramStructure(structure, new Set(exerciseIds))
  if (validationError) {
    res.status(502).json({ error: `Programme invalide : ${validationError}` })
    return
  }

  const { data: program, error: insertError } = await supabase
    .from('user_programs')
    .insert({
      user_id: user.id,
      status: 'active',
      current_week: 1,
      structure,
      generation_prompt_snapshot: promptSnapshot,
    })
    .select()
    .single()

  if (insertError) {
    res.status(500).json({ error: insertError.message })
    return
  }

  await supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('user_id', user.id)

  res.status(200).json({ program })
}
