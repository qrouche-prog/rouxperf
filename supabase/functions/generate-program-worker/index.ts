import Anthropic from 'npm:@anthropic-ai/sdk@0.112.4'
import { createClient } from 'npm:@supabase/supabase-js@2.110.7'

const anthropic = new Anthropic()

const WEEKS_COUNT = 4

const FOCUS_AREA_LABELS: Record<string, string> = {
  cardio: 'Cardio',
  running: 'Course à pied',
  aerobic: 'Endurance aérobie',
  anaerobic: 'Capacité anaérobie',
  explosiveness: 'Explosivité / plyométrie',
  mobility: 'Mobilité',
}

const EQUIPMENT_TIERS: Record<string, string[]> = {
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

function exerciseInputSchema(exerciseIds: string[]) {
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

function programSchema(exerciseIds: string[]) {
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

function validateProgramStructure(structure: any, validExerciseIds: Set<string>): string | null {
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

const SYSTEM_PROMPT = `Tu es un coach sportif expérimenté qui conçoit des programmes d'entraînement personnalisés, sûrs et progressifs.
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
- focus_area_preferences précise, pour certains focus_areas, une fréquence
  hebdomadaire exacte et un mode d'intégration ("separate" ou "integrated") —
  respecte-les à la lettre plutôt que de deviner (détail plus bas).
- Si une compétition est renseignée (Hyrox, Spartan/OCR, marathon, semi,
  10km, 5km, triathlon), oriente une partie du programme vers la préparation
  spécifique à cet effort (endurance, mouvements fonctionnels) ; si
  event_date est fourni et proche, priorise le maintien/l'affûtage plutôt que
  la surcharge.
- Si un focus est "explosiveness"/"anaerobic" ou qu'un sport cible (target_sports)
  est renseigné, inclus des mouvements pliométriques/explosifs pertinents pour
  ce sport (ex. sauts pour le volleyball/basketball) quand la bibliothèque le
  permet — sans jamais sortir de la liste d'exercices fournie.

Le champ special_situation (et special_situation_details) signale une situation
qui change fondamentalement l'approche à adopter — la sécurité prime toujours
sur la performance, applique ces règles strictement :
- "pregnant" (grossesse) : jamais d'objectif de perte de poids ou de restriction
  implicite, quel que soit goal_type. Intensité modérée (test de la parole).
  À partir du 2e trimestre (trimester >= 2), évite toute position allongée sur
  le dos prolongée, les sauts/impacts élevés, les mouvements à risque de chute
  ou de contact, et les efforts en apnée/charge maximale. Privilégie renforcement
  postural, plancher pelvien, mobilité et cardio à impact modéré (marche, vélo,
  natation, rameur) si disponibles. Volume et charge nettement réduits par
  rapport à un profil standard de même niveau.
- "postpartum" (post-partum) : si weeks_since_birth < 6, limite-toi à des
  exercices très légers (marche, respiration, réactivation du plancher pelvien
  et de la sangle abdominale profonde) — pas de charge, pas de gainage frontal
  intense (crunchs, planches longues). Entre 6 et 12 semaines, progression très
  graduelle, priorité à la réintégration du tronc profond avant tout travail
  abdominal classique. Si delivery_type = "cesarean", marge de prudence
  supplémentaire sur le gainage et le port de charge.
- "injury_rehab" (rééducation) : ne sélectionne aucun exercice qui sollicite
  directement la zone indiquée (area) de façon intense ; privilégie les groupes
  musculaires non affectés et la mobilité douce autour de la zone si pertinent.
  Si cleared_by_professional est false, reste particulièrement conservateur
  (volume et charge bas).
- "competitive_athlete" (athlète confirmé) : adapte à competition_phase —
  "off_season" → volume plus élevé, développement général ; "pre_season" →
  montée progressive de l'intensité spécifique à la discipline ; "in_season" →
  maintien, volume réduit pour préserver la fraîcheur ; "taper" → réduction
  nette du volume avec maintien de l'intensité avant une compétition.

Dans tous les cas où special_situation n'est pas "none", ajoute dans le champ
"notes" du premier exercice de la première séance un rappel de prudence adapté
(ex. "Arrête tout mouvement provoquant une douleur inhabituelle et consulte un
professionnel de santé en cas de doute").

Le champ other_sport_notes contient des précisions libres de l'utilisateur
(sport non listé, contexte supplémentaire) — prends-les en compte comme un
complément d'information, sans jamais sortir de la bibliothèque d'exercices
fournie pour autant.`

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Token manquant' }), { status: 401 })
  }
  const token = authHeader.slice(7)

  const { program_id } = await req.json().catch(() => ({}))
  if (!program_id) {
    return new Response(JSON.stringify({ error: 'program_id manquant' }), { status: 400 })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Session invalide' }), { status: 401 })
  }

  const { data: program } = await supabase
    .from('user_programs')
    .select('id, status')
    .eq('id', program_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!program || program.status !== 'generating') {
    return new Response(JSON.stringify({ error: 'Programme introuvable ou déjà traité' }), { status: 409 })
  }

  async function runGeneration() {
    try {
      const [{ data: profile }, { data: goal }, { data: trainingProfile }, { data: measurement }] =
        await Promise.all([
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
        throw new Error("Profil d'onboarding incomplet.")
      }

      const allowedEquipment = EQUIPMENT_TIERS[trainingProfile.equipment_access] ?? ['bodyweight']
      const { data: allExercises } = await supabase.from('exercises').select('*')
      const availableExercises = (allExercises ?? []).filter((exercise: any) =>
        (exercise.equipment_required ?? []).every((item: string) => allowedEquipment.includes(item))
      )

      if (availableExercises.length === 0) {
        throw new Error('Aucun exercice disponible pour ce profil.')
      }

      const exerciseIds = availableExercises.map((exercise: any) => exercise.id)

      const promptSnapshot = {
        profile: { birth_date: profile.birth_date, sex: profile.sex, height_cm: profile.height_cm },
        goal: { goal_type: goal.goal_type, target_weight_kg: goal.target_weight_kg, target_date: goal.target_date },
        training_profile: trainingProfile,
        latest_measurement: measurement,
      }

      const focusAreaPreferences = trainingProfile.focus_area_preferences ?? {}
      const scheduleLines = Object.entries(focusAreaPreferences).map(([area, pref]: [string, any]) => {
        const label = FOCUS_AREA_LABELS[area] ?? area
        const modeText =
          pref.mode === 'integrated'
            ? "intégré à l'intérieur des séances de musculation existantes (échauffement, finisher ou superset), sans créer de séance séparée"
            : 'en séance(s) dédiée(s), distincte(s) des séances de musculation'
        return `- ${label} : ${pref.frequency}× par semaine, ${modeText}.`
      })

      const schedulingSection =
        scheduleLines.length > 0
          ? `\n\nFréquence hebdomadaire demandée par domaine (respecte-la exactement) :\n${scheduleLines.join('\n')}\nSi au moins un domaine est en mode "séance(s) dédiée(s)", ces séances comptent dans le total de ${trainingProfile.days_per_week} séance(s) par semaine — répartis-les sur des jours différents des séances de musculation pures quand c'est cohérent avec ce total.`
          : ''

      const situationSection =
        trainingProfile.special_situation && trainingProfile.special_situation !== 'none'
          ? `\n\nSituation particulière à respecter impérativement : "${trainingProfile.special_situation}" — détails : ${JSON.stringify(trainingProfile.special_situation_details ?? {})}. Applique les règles correspondantes définies dans tes instructions système, sans exception.`
          : ''

      const otherSportSection = trainingProfile.other_sport_notes
        ? `\n\nPrécisions libres de l'utilisateur sur ses sports/objectifs : ${trainingProfile.other_sport_notes}`
        : ''

      const userPrompt = `Génère un programme d'entraînement de ${WEEKS_COUNT} semaines, avec ${trainingProfile.days_per_week} séance(s) par semaine, d'une durée cible de ${trainingProfile.session_duration_minutes} minutes chacune.

Profil utilisateur :
${JSON.stringify(promptSnapshot, null, 2)}${schedulingSection}${situationSection}${otherSportSection}

Exercices disponibles (choisis exclusivement parmi ceux-ci, par exercise_id) :
${JSON.stringify(
  availableExercises.map(
    ({ id, name, category, muscle_group, contraindications, instructions }: any) => ({
      id,
      name,
      category,
      muscle_group,
      contraindications,
      instructions,
    })
  ),
  null,
  2
)}`

      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-5',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: programSchema(exerciseIds) },
        },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })
      const response = await stream.finalMessage()

      if (response.stop_reason === 'refusal') {
        throw new Error("Le modèle n'a pas pu générer de programme pour ce profil.")
      }
      if (response.stop_reason === 'max_tokens') {
        throw new Error('La génération a été tronquée, réessaie.')
      }

      const textBlock = response.content.find((block: any) => block.type === 'text')
      if (!textBlock) {
        throw new Error('Réponse du modèle invalide.')
      }

      let structure
      try {
        structure = JSON.parse((textBlock as any).text)
      } catch {
        throw new Error('Réponse du modèle mal formée.')
      }

      const validationError = validateProgramStructure(structure, new Set(exerciseIds))
      if (validationError) {
        throw new Error(`Programme invalide : ${validationError}`)
      }

      await supabase
        .from('user_programs')
        .update({ status: 'active', structure, generation_prompt_snapshot: promptSnapshot })
        .eq('id', program_id)

      await supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('user_id', user.id)
    } catch (err) {
      await supabase
        .from('user_programs')
        .update({ status: 'failed', error_message: err instanceof Error ? err.message : String(err) })
        .eq('id', program_id)
    }
  }

  // @ts-ignore -- global fourni par le runtime Edge Functions de Supabase, pas par Deno lui-même
  EdgeRuntime.waitUntil(runGeneration())

  return new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  })
})
