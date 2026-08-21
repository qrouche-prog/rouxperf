import Anthropic from 'npm:@anthropic-ai/sdk@0.112.4'
import { createClient } from 'npm:@supabase/supabase-js@2.110.7'

const anthropic = new Anthropic()

// Résume la charge réelle des 4 dernières semaines (séances importées d'une
// montre) pour que l'IA adapte le programme au volume réellement pratiqué.
function buildWearableSection(acts: any[]): string {
  if (!acts || acts.length === 0) return ''
  const weeks = 4
  const byType: Record<
    string,
    { n: number; dur: number; dist: number; hrSum: number; hrN: number; elev: number }
  > = {}
  let load = 0
  for (const a of acts) {
    const t = a.activity_type || 'activité'
    byType[t] = byType[t] || { n: 0, dur: 0, dist: 0, hrSum: 0, hrN: 0, elev: 0 }
    const b = byType[t]
    b.n += 1
    b.dur += Number(a.duration_s || 0)
    b.dist += Number(a.distance_m || 0)
    if (a.avg_hr) {
      b.hrSum += Number(a.avg_hr)
      b.hrN += 1
    }
    b.elev += Number(a.elevation_gain_m || 0)
    const tl = Number(a.raw?.icu_training_load)
    if (Number.isFinite(tl)) load += tl
  }
  const lines = Object.entries(byType).map(([t, b]) => {
    const perWeek = (b.n / weeks).toFixed(1)
    const min = b.dur ? `, ~${Math.round(b.dur / 60 / weeks)} min/sem` : ''
    const km = b.dist ? `, ~${(b.dist / 1000 / weeks).toFixed(1)} km/sem` : ''
    const hr = b.hrN ? `, FC moy ${Math.round(b.hrSum / b.hrN)}` : ''
    const elev = b.elev ? `, ~${Math.round(b.elev / weeks)} m D+/sem` : ''
    return `${t} : ${perWeek} séance(s)/sem${min}${km}${hr}${elev}`
  })
  const loadStr = load > 0 ? ` Charge d'entraînement moyenne ~${Math.round(load / weeks)}/semaine.` : ''
  return `\n\nDonnées réelles des 4 dernières semaines (montre connectée) — ce que l'utilisateur fait DÉJÀ :\n- ${lines.join(
    '\n- '
  )}.${loadStr}\nAdapte le programme à cette charge réelle : reste cohérent avec ce volume habituel (n'impose pas une charge très supérieure d'un coup), tiens compte du cardio/course déjà réalisé pour ne pas le dupliquer, et complète en priorité les qualités ou groupes musculaires négligés par cette pratique.`
}

const WEEKS_COUNT = 4

// aerobic/anaerobic/mobility conservés pour d'anciens profils qui les
// auraient encore sélectionnés (retirés du picker, mais valeurs backend
// toujours valides) — plus proposés aux nouveaux utilisateurs.
const FOCUS_AREA_LABELS: Record<string, string> = {
  cardio: 'Cardio',
  running: 'Course à pied',
  aerobic: 'Endurance aérobie',
  anaerobic: 'Capacité anaérobie',
  explosiveness: 'Explosivité / puissance',
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

const CUSTOM_EXERCISE_SENTINEL = 'custom'

// Formats de bloc supportés par le lanceur de séance — "straight" = série
// classique (défaut). "amrap"/"emom" regroupent plusieurs exercices
// consécutifs partageant le même block_id derrière un minuteur dédié.
// "warmup" regroupe l'échauffement en tête de séance pour l'affichage (une
// seule carte "Échauffement"), mais chaque mouvement garde ses vraies
// séries/répétitions — pas de minuteur, logué normalement comme un exercice.
const BLOCK_FORMATS = ['straight', 'amrap', 'emom', 'warmup']

function exerciseInputSchema(exerciseIds: string[]) {
  return {
    type: 'object',
    properties: {
      exercise_id: { type: 'string', enum: [...exerciseIds, CUSTOM_EXERCISE_SENTINEL] },
      custom_name: { type: 'string' },
      custom_instructions: { type: 'string' },
      sets: { type: 'integer' },
      reps: { type: 'string' },
      rest_seconds: { type: 'integer' },
      notes: { type: 'string' },
      block_format: { type: 'string', enum: BLOCK_FORMATS },
      block_id: { type: 'string' },
      block_time_cap_seconds: { type: 'integer' },
      block_interval_seconds: { type: 'integer' },
      block_rounds: { type: 'integer' },
    },
    // Les champs block_* sont volontairement PAS requis : les exiger sur
    // chaque exercice forçait Claude à répéter 5 champs à leur valeur par
    // défaut sur la quasi-totalité des ~140+ exercices d'un programme
    // (4 semaines × ~7 séances × ~5 exercices), ce qui alourdissait
    // nettement la sortie et a fait dépasser la limite d'exécution en
    // arrière-plan (génération bloquée, aucune erreur). Absents = exercice
    // classique (voir les valeurs par défaut dans validateProgramStructure).
    required: ['exercise_id', 'custom_name', 'custom_instructions', 'sets', 'reps', 'rest_seconds', 'notes'],
    additionalProperties: false,
  }
}

// Schéma d'UNE semaine (la génération se fait semaine par semaine, voir
// runGeneration) — minItems/maxItems=1 contraint explicitement le modèle à
// ne renvoyer que la semaine demandée, pas tout le mésocycle d'un coup.
function programSchema(exerciseIds: string[]) {
  return {
    type: 'object',
    properties: {
      weeks: {
        type: 'array',
        minItems: 1,
        maxItems: 1,
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
                  day_of_week: { type: 'integer' },
                  slot: { type: 'string', enum: ['morning', 'evening', ''] },
                  modality: { type: 'string' },
                  name: { type: 'string' },
                  exercises: { type: 'array', items: exerciseInputSchema(exerciseIds) },
                },
                required: ['day_number', 'day_of_week', 'slot', 'modality', 'name', 'exercises'],
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

function validateProgramStructure(
  structure: any,
  validExerciseIds: Set<string>,
  options: {
    sameDayCombining: string
    totalSessions?: number
    expectedModalityCounts?: Record<string, number>
  }
): string | null {
  if (!structure || !Array.isArray(structure.weeks) || structure.weeks.length === 0) {
    return 'aucune semaine générée'
  }
  for (const week of structure.weeks) {
    if (!Array.isArray(week.days) || week.days.length === 0) return 'jours manquants'

    // Le prompt demande explicitement un nombre de séances et une répartition
    // par modalité précis — ne fait pas confiance au modèle pour les
    // respecter sur plusieurs semaines, on le vérifie déterministiquement.
    if (options.totalSessions != null && week.days.length !== options.totalSessions) {
      return `nombre de séances incohérent (semaine ${week.week_number ?? '?'} : ${week.days.length} au lieu de ${options.totalSessions})`
    }
    if (options.expectedModalityCounts) {
      const modalityCounts: Record<string, number> = {}
      for (const day of week.days) {
        modalityCounts[day.modality] = (modalityCounts[day.modality] ?? 0) + 1
      }
      for (const [modality, expected] of Object.entries(options.expectedModalityCounts)) {
        if ((modalityCounts[modality] ?? 0) !== expected) {
          return `répartition par modalité incohérente (semaine ${week.week_number ?? '?'} : "${modality}" ${modalityCounts[modality] ?? 0}× au lieu de ${expected}×)`
        }
      }
    }

    const daysByWeekday: Record<number, any[]> = {}
    for (const day of week.days) {
      if (!Number.isInteger(day.day_of_week) || day.day_of_week < 1 || day.day_of_week > 7) {
        return 'day_of_week invalide'
      }
      if (!['morning', 'evening', ''].includes(day.slot)) {
        return 'slot invalide'
      }
      if (!day.modality || !String(day.modality).trim()) {
        return 'modality manquante'
      }
      daysByWeekday[day.day_of_week] = [...(daysByWeekday[day.day_of_week] ?? []), day]
    }

    for (const sameDayList of Object.values(daysByWeekday)) {
      if (sameDayList.length > 2) return 'plus de 2 séances le même jour'
      if (sameDayList.length === 2) {
        if (options.sameDayCombining === 'never') {
          return 'séances combinées alors que non autorisées'
        }
        if (sameDayList[0].modality === sameDayList[1].modality) {
          return 'deux séances de la même modalité le même jour'
        }
        const slots = sameDayList.map((d) => d.slot).sort()
        if (slots[0] !== 'evening' || slots[1] !== 'morning') {
          return 'slot manquant pour des séances combinées'
        }
      }
    }

    for (const day of week.days) {
      if (!Array.isArray(day.exercises) || day.exercises.length === 0) {
        return 'exercices manquants pour un jour'
      }
      for (const exercise of day.exercises) {
        if (exercise.exercise_id === CUSTOM_EXERCISE_SENTINEL) {
          if (!exercise.custom_name || !exercise.custom_name.trim()) {
            return 'exercice personnalisé sans nom'
          }
        } else if (!validExerciseIds.has(exercise.exercise_id)) {
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
        // block_format absent = exercice classique (champ non requis dans le
        // schéma, pour ne pas alourdir la sortie sur chaque exercice).
        if (exercise.block_format == null) exercise.block_format = 'straight'
        if (!BLOCK_FORMATS.includes(exercise.block_format)) {
          return `format de bloc invalide (${exercise.block_format})`
        }
        if (exercise.block_format !== 'straight' && !String(exercise.block_id ?? '').trim()) {
          return 'block_id manquant pour un exercice en bloc AMRAP/EMOM'
        }
        if (
          exercise.block_format === 'amrap' &&
          (!Number.isInteger(exercise.block_time_cap_seconds) ||
            exercise.block_time_cap_seconds < 60 ||
            exercise.block_time_cap_seconds > 3600)
        ) {
          return 'durée AMRAP invalide (block_time_cap_seconds)'
        }
        if (
          exercise.block_format === 'emom' &&
          (!Number.isInteger(exercise.block_interval_seconds) ||
            exercise.block_interval_seconds < 10 ||
            exercise.block_interval_seconds > 300 ||
            !Number.isInteger(exercise.block_rounds) ||
            exercise.block_rounds < 2 ||
            exercise.block_rounds > 60)
        ) {
          return 'paramètres EMOM invalides (block_interval_seconds / block_rounds)'
        }
      }

      // Cohérence des blocs AMRAP/EMOM : un même block_id doit toujours porter
      // le même format, et ses exercices doivent être consécutifs dans le
      // tableau (le lanceur de séance regroupe par contiguïté, pas par id seul).
      const blockFormatById: Record<string, string> = {}
      const blockIndexRanges: Record<string, { first: number; last: number; count: number }> = {}
      for (let idx = 0; idx < day.exercises.length; idx += 1) {
        const exercise = day.exercises[idx]
        const bId = exercise.block_id
        if (!bId) continue
        if (blockFormatById[bId] == null) {
          blockFormatById[bId] = exercise.block_format
        } else if (blockFormatById[bId] !== exercise.block_format) {
          return `format incohérent au sein du bloc "${bId}"`
        }
        if (!blockIndexRanges[bId]) blockIndexRanges[bId] = { first: idx, last: idx, count: 1 }
        else {
          blockIndexRanges[bId].last = idx
          blockIndexRanges[bId].count += 1
        }
      }
      for (const [bId, range] of Object.entries(blockIndexRanges)) {
        if (range.last - range.first + 1 !== range.count) {
          return `bloc "${bId}" non contigu`
        }
      }
    }
  }
  return null
}

// Répète un bloc (mésocycle) de N semaines `blocks` fois pour couvrir la durée
// choisie, en décalant les week_number et en ajoutant une consigne de
// progression de charge sur les blocs suivants.
function expandBlocks(baseStructure: any, blocks: number): any {
  if (blocks <= 1) return baseStructure
  const baseWeeks = baseStructure.weeks
  const weeks: any[] = []
  for (let b = 0; b < blocks; b += 1) {
    for (const w of baseWeeks) {
      const cloned = JSON.parse(JSON.stringify(w))
      cloned.week_number = b * baseWeeks.length + w.week_number
      if (b > 0) {
        const pct = b * 5
        for (const day of cloned.days) {
          for (const ex of day.exercises) {
            ex.notes = `Bloc ${b + 1} : augmente la charge d'environ ${pct}% par rapport au 1er bloc (ou +1-2 répétitions si tu ne peux pas charger davantage). ${ex.notes ?? ''}`.trim()
          }
        }
      }
      weeks.push(cloned)
    }
  }
  return { ...baseStructure, weeks }
}

// Résumé compact d'une semaine déjà générée (sans notes/champs block_*),
// injecté dans le prompt de la semaine suivante pour assurer une progression
// cohérente sans repasser tout l'historique complet à chaque appel.
function recapWeek(week: any): string {
  const compact = week.days.map((d: any) => ({
    day_of_week: d.day_of_week,
    slot: d.slot,
    modality: d.modality,
    name: d.name,
    exercises: d.exercises.map((e: any) => ({
      exercise_id: e.exercise_id,
      sets: e.sets,
      reps: e.reps,
      rest_seconds: e.rest_seconds,
    })),
  }))
  return JSON.stringify(compact)
}

const SYSTEM_PROMPT = `Tu es un coach sportif expérimenté qui conçoit des programmes d'entraînement personnalisés, sûrs et progressifs.
Respecte strictement les blessures et limitations indiquées par l'utilisateur : si un mouvement pourrait les aggraver, ne le sélectionne pas.
Adapte le volume, l'intensité et la complexité technique au niveau d'expérience indiqué.
Prévois une progression cohérente d'une semaine à l'autre (charge, volume ou intensité perçue), indiquée dans "notes".

Structure de CHAQUE séance, y compris cardio/course :
1. échauffement court (5-8 min, 2-4 mouvements) adapté au contenu de la séance — ex. mobilité hanches/chevilles avant jambes, épaules/thoracique avant haut du corps poussée/tirée, activation dynamique des jambes avant course/cardio. Mouvements de la bibliothèque (category "mobility" en priorité), avec leurs vraies sets/reps/rest_seconds — regroupe-les en tête du tableau "exercises" avec block_format="warmup" et un block_id partagé par tous les mouvements de cet échauffement (même mécanique que pour un bloc AMRAP/EMOM, mais SANS minuteur : chaque mouvement garde ses propres sets/reps réels, jamais sets=1 forcé).
2. un ou deux exercices poly-articulaires principaux adaptés au niveau (séances de musculation) ;
3. deux à trois accessoires ciblés pour équilibrer le corps ;
4. au moins un exercice core (tronc/abdos) dans la majorité des séances de musculation ;
5. finisher/conditionnement — SYSTÉMATIQUE si goal_type="weight_loss" ou focus_areas contient "weight_loss" (détail ci-dessous).
Équilibre les schémas moteurs (pousser/tirer, genou/hanche) sur la semaine, varie les exercices d'une séance à l'autre.

Adapte la programmation à goal_type :
- "weight_loss" : dépense énergétique élevée — full-body, densité élevée (supersets/circuits), repos courts. Finisher SYSTÉMATIQUE de 8-15 min en fin de séance, en alternant : (a) gainage/abdos complémentaires, ou (b) bloc AMRAP/EMOM de 3-5 mouvements variés (squats, burpees, mountain climbers, corde à sauter, kettlebell swings…) à intensité modérée-soutenue — jamais le même HIIT répété identique chaque semaine. Pour un bloc AMRAP/EMOM (jamais dans "notes") : mouvements consécutifs dans "exercises", sets=1, reps=répétitions par tour, rest_seconds=0, block_format="amrap"/"emom" sur chacun, block_id partagé. AMRAP → block_time_cap_seconds uniquement (ex. 720 pour 12 min). EMOM → block_interval_seconds (ex. 60) + block_rounds uniquement. Exercices hors bloc AMRAP/EMOM et hors échauffement (l'immense majorité) : n'écris AUCUN champ block_*. Intègre aussi du cardio continu faible/moyen impact (marche inclinée, escaliers, vélo, elliptique, rameur) ailleurs dans la semaine.
- "muscle_gain" : hypertrophie, 8-12 reps, volume par groupe, repos 60-120s, split cohérent avec la fréquence.
- "strength" : poly-articulaires lourds, 3-6 reps, repos 2-4 min.
- "endurance" : répétitions élevées/circuits + cardio régulier.
- "recomposition"/"hybrid" : musculation (8-12 reps, repos modérés) + cardio régulier, dosage équilibré sauf signal de focus_areas.
- "general_fitness" : équilibré et varié (force, tronc, mobilité, cardio léger).
Croise avec focus_areas : "weight_loss" présent → applique aussi la densité/repos courts/cardio du bloc weight_loss même si goal_type diffère. "muscle_gain" présent (goal_type différent) → pondère vers l'hypertrophie sur les groupes ciblés sans abandonner goal_type. "strength" présent (goal_type différent) → sur les exercices poly-articulaires principaux, insère aussi des séries lourdes à faibles répétitions (3-6 reps, repos 2-4 min) en plus de ce que demande goal_type, sans transformer toute la séance en pur travail de force.

Sécurité (prioritaire) : croise "contraindications" de chaque exercice avec blessures/limitations/special_situation ; jamais d'exercice à contre-indication en zone à risque, variante plus sûre en cas de doute.

Rythme de perte/prise de poids (prioritaire) : si le rythme visé dépasse ~1 kg/semaine ou l'échéance est intenable, NE force PAS ce rythme (pas de déficit extrême ni volume excessif) — construis la progression la plus sûre possible et signale-le dans "notes" du premier exercice de la première séance.

Choix de chaque exercice :
1. Bibliothèque fournie (exercise_id exact) — obligatoire pour tout mouvement de force/technique, même si elle semble incomplète.
2. "custom" — uniquement cardio/geste sportif/conditionnement absent de la bibliothèque : exercise_id="custom", custom_name + custom_instructions remplis (sinon vides ""). Jamais pour remplacer un mouvement de force existant.

Le profil contient aussi focus_areas, une compétition à venir (upcoming_events, event_date) et des sports cibles (target_sports) :
- focus "cardio"/"running"/"aerobic"/"anaerobic" → exercices cardio ; "reps" peut exprimer une durée ("30s") ou distance ("400m").
- focus_area_preferences précise fréquence et mode ("separate"/"integrated") par focus_area — respecte-les à la lettre.
- Compétition renseignée (Hyrox, Spartan/OCR, marathon, semi, 10km, 5km, triathlon) → oriente une partie du programme vers la préparation spécifique ; event_date proche → affûtage plutôt que surcharge.
- focus "explosiveness"/"anaerobic" ou target_sports renseigné → mouvements pliométriques/explosifs pertinents (bibliothèque en priorité, "custom" si geste vraiment spécifique manquant).

special_situation (et special_situation_details) change fondamentalement l'approche. PRIORITÉ ABSOLUE si special_situation ≠ "none" ou blessures déclarées : ça prime sur performance/esthétique et structure tout le programme, construit AUTOUR de la situation, sécurité/récupération/reconstruction progressive d'abord, semaine 1 la plus prudente. Priorise mobilité/activation (respiration diaphragmatique, plancher pelvien, transverse, bascule du bassin, chat-vache, bird dog, marche active) et poids du corps avant tout travail lourd.
- "pregnant" : jamais d'objectif perte de poids/restriction quel que soit goal_type, intensité modérée (test de la parole). Dès trimester ≥ 2 : évite décubitus dorsal prolongé, sauts/impacts, risque de chute/contact, apnée/charge maximale. Renforcement postural, plancher pelvien, mobilité, cardio impact modéré (marche/vélo/natation/rameur). Volume/charge nettement réduits, respiration + plancher pelvien chaque semaine, progression douce au fil du trimestre.
- "postpartum" : reconstruction progressive par phase, protège plancher pelvien et diastasis (jamais de mouvement qui pousse le ventre, jamais d'apnée/Valsalva). < 6 sem : UNIQUEMENT respiration, activation plancher pelvien/transverse, mobilité douce, marche — aucune charge, aucun gainage frontal, aucun impact/saut. 6-12 sem : tronc profond (dead bug, bird dog, marche du pont fessier), renforcement doux, progression très graduelle, toujours pas de crunch/planche longue ni charge lourde. > 12 sem : renforcement classique + charge légère si tout va bien, gainage anti-pression, à l'écoute des symptômes (fuites, lourdeur, douleur → on réduit). Cesarean : prudence supplémentaire, retarde gainage/charge. Vraie progression de rééducation cohérente avec weeks_since_birth sur les 4 semaines.
- "injury_rehab" : programme construit AUTOUR de la zone (area) — rien qui la sollicite intensément, priorité au reste du corps, mobilité/activation douce autour si pertinent. Travail progressif de la zone seulement si cleared_by_professional=true, montée très graduelle ; sinon reste conservateur (volume/charge bas, rien à risque sur la zone).
- "competitive_athlete" : adapte à competition_phase — off_season (volume élevé, développement général), pre_season (montée progressive spécifique), in_season (maintien, volume réduit), taper (réduction nette du volume, intensité maintenue).
Dans tous les cas où special_situation ≠ "none", ajoute dans "notes" du premier exercice de la première séance un rappel de prudence (ex. "Arrête tout mouvement provoquant une douleur inhabituelle et consulte un professionnel de santé en cas de doute").

other_sport_notes contient des précisions libres (sport non listé, contexte) — prends-les en compte, "custom" si geste propre au sport absent de la bibliothèque.`

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 })
  }

  // Appelée uniquement depuis notre propre backend (déclenchement initial ou
  // approbation admin), jamais directement par le navigateur d'un
  // utilisateur — donc un unique client service-role pour tout, plus besoin
  // de forwarder le JWT d'un utilisateur final (l'admin qui approuve n'a de
  // toute façon pas accès à celui de l'utilisateur cible).
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { program_id, user_id, effort: forcedEffort } = await req.json().catch(() => ({}))
  if (!program_id || !user_id) {
    return new Response(JSON.stringify({ error: 'program_id ou user_id manquant' }), { status: 400 })
  }

  async function resolveCustomExercises(structure: any) {
    for (const week of structure.weeks) {
      for (const day of week.days) {
        for (const exercise of day.exercises) {
          if (exercise.exercise_id !== CUSTOM_EXERCISE_SENTINEL) continue

          const name = exercise.custom_name.trim()
          const { data: existing } = await supabase
            .from('exercises')
            .select('id')
            .ilike('name', name)
            .limit(1)
            .maybeSingle()

          if (existing) {
            exercise.exercise_id = existing.id
          } else {
            const { data: created, error: createError } = await supabase
              .from('exercises')
              .insert({
                name,
                category: 'cardio',
                muscle_group: 'cardio',
                equipment_required: [],
                contraindications: [],
                instructions: exercise.custom_instructions?.trim() || name,
                is_ai_generated: true,
              })
              .select('id')
              .single()

            if (createError || !created) {
              throw new Error(`Échec de création de l'exercice personnalisé "${name}"`)
            }
            exercise.exercise_id = created.id
          }

          delete exercise.custom_name
          delete exercise.custom_instructions
        }
      }
    }
    return structure
  }

  const { data: program } = await supabase
    .from('user_programs')
    .select('id, status')
    .eq('id', program_id)
    .eq('user_id', user_id)
    .maybeSingle()

  if (!program || program.status !== 'generating') {
    return new Response(JSON.stringify({ error: 'Programme introuvable ou déjà traité' }), { status: 409 })
  }

  async function runGeneration() {
    try {
      const [{ data: profile }, { data: goal }, { data: trainingProfile }, { data: measurement }] =
        await Promise.all([
          supabase.from('profiles').select('*').eq('user_id', user_id).single(),
          supabase
            .from('goals')
            .select('*')
            .eq('user_id', user_id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('user_training_profile').select('*').eq('user_id', user_id).maybeSingle(),
          supabase
            .from('body_measurements')
            .select('*')
            .eq('user_id', user_id)
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

      const focusAreaPreferences = trainingProfile.focus_area_preferences ?? { strength: { frequency: 3 } }
      const totalSessions = Object.entries(focusAreaPreferences).reduce((sum: number, [area, pref]: [string, any]) => {
        if (area === 'strength') return sum + (pref.frequency ?? 0)
        return pref.mode === 'integrated' ? sum : sum + (pref.frequency ?? 0)
      }, 0)

      // Attendu par modalité pour la validation déterministe post-génération
      // (le prompt seul ne garantit pas fiablement le respect des fréquences
      // demandées sur un programme de plusieurs semaines) : une entrée par
      // domaine non "integrated", modality = "strength" pour la musculation.
      const expectedModalityCounts: Record<string, number> = {}
      for (const [area, pref] of Object.entries(focusAreaPreferences) as [string, any][]) {
        if (area !== 'strength' && pref.mode === 'integrated') continue
        const modality = area === 'strength' ? 'strength' : area
        expectedModalityCounts[modality] = (expectedModalityCounts[modality] ?? 0) + (pref.frequency ?? 0)
      }

      const scheduleLines = Object.entries(focusAreaPreferences).map(([area, pref]: [string, any]) => {
        const label = area === 'strength' ? 'Musculation' : (FOCUS_AREA_LABELS[area] ?? area)
        // pref.mode n'a pas de sens pour "strength" (rien ne peut s'y
        // "intégrer" en amont) : l'absence de mode y retombe intentionnellement
        // sur "dédiée(s)", pas un oubli de valeur par défaut.
        const modeText =
          pref.mode === 'integrated'
            ? "intégré à l'intérieur des séances de musculation existantes (échauffement, finisher ou superset), sans créer de séance séparée"
            : 'en séance(s) dédiée(s), distincte(s) des séances des autres domaines'
        return `- ${label} : ${pref.frequency}× par semaine, ${modeText}.`
      })

      const schedulingSection =
        scheduleLines.length > 0
          ? `\n\nFréquence hebdomadaire demandée par domaine (respecte-la exactement) :\n${scheduleLines.join('\n')}\nCes fréquences déterminent le nombre total de séances (${totalSessions} au total, cf. plus bas) — n'ajoute ni n'enlève de séance par rapport à cette somme.`
          : ''

      const preferredDays: number[] = trainingProfile.preferred_days ?? []
      const weekdayNames: Record<number, string> = {
        1: 'lundi',
        2: 'mardi',
        3: 'mercredi',
        4: 'jeudi',
        5: 'vendredi',
        6: 'samedi',
        7: 'dimanche',
      }
      const preferredDaysText =
        preferredDays.length > 0
          ? preferredDays.map((d) => weekdayNames[d]).join(', ')
          : 'aucun jour précis indiqué — choisis librement des jours cohérents dans la semaine'

      const sameDayCombining = trainingProfile.same_day_combining ?? 'if_needed'
      const combiningInstruction =
        {
          never:
            'Ne place jamais deux séances le même jour (day_of_week), même si le nombre total de séances dépasse le nombre de jours disponibles ci-dessus — utilise dans ce cas des jours en dehors de cette liste plutôt que d\'en doubler un.',
          if_needed:
            'Ne place deux séances le même jour (day_of_week) que si le nombre total de séances dépasse le nombre de jours disponibles ci-dessus — dans ce cas seulement, combine deux séances de modalités différentes sur un même jour.',
          allowed:
            "Tu peux placer deux séances le même jour (day_of_week) même si ce n'est pas strictement nécessaire, quand ça a du sens pour l'utilisateur (par exemple regrouper deux séances courtes plutôt que d'utiliser un jour de plus) — sans dépasser 2 séances par jour.",
        }[sameDayCombining as string] ?? ''

      const daySection = `\n\nJours disponibles pour l'entraînement : ${preferredDaysText}.
Pour chaque séance générée, indique un champ day_of_week (1=lundi ... 7=dimanche) parmi ces jours.
${combiningInstruction}
Règles à respecter dans tous les cas : jamais plus de 2 séances sur le même day_of_week ; jamais deux séances de la même modalité (champ "modality") le même jour ; quand deux séances partagent le même day_of_week, donne à l'une slot="morning" et à l'autre slot="evening" pour les distinguer ; sinon laisse slot à "" (chaîne vide). Le champ modality doit valoir "strength" pour une séance de musculation, ou reprendre le nom du focus area concerné (ex. "running", "cardio") pour une séance dédiée à ce domaine.`

      const situationSection =
        trainingProfile.special_situation && trainingProfile.special_situation !== 'none'
          ? `\n\nSituation particulière à respecter impérativement : "${trainingProfile.special_situation}" — détails : ${JSON.stringify(trainingProfile.special_situation_details ?? {})}. Applique les règles correspondantes définies dans tes instructions système, sans exception.`
          : ''

      const otherSportSection = trainingProfile.other_sport_notes
        ? `\n\nPrécisions libres de l'utilisateur sur ses sports/objectifs : ${trainingProfile.other_sport_notes}`
        : ''

      // Champ libre côté formulaire ("informations supplémentaires") : peut
      // contenir une vraie blessure, une simple préférence, une contrainte
      // d'horaire, ou un mélange des trois. Ne force pas une lecture
      // "blessure" sur tout le texte — laisse le modèle distinguer.
      const injuriesSection = trainingProfile.injuries_limitations
        ? `\n\nInformations supplémentaires libres de l'utilisateur : "${trainingProfile.injuries_limitations}". Interprète ce texte avec discernement selon son contenu réel, phrase par phrase si besoin : toute partie qui décrit une douleur, une blessure ou une limitation physique doit être appliquée avec la même priorité de sécurité absolue que les contre-indications (exclus tout exercice susceptible de l'aggraver, propose des variantes plus sûres, abstiens-toi en cas de doute) ; toute autre partie (préférence, contrainte d'horaire, objectif, contexte général) doit simplement enrichir la personnalisation du programme, sans lui appliquer une restriction de sécurité qui n'a pas lieu d'être.`
        : ''

      const runningPref = focusAreaPreferences.running
      const RUNNING_QUALITY_LABELS: Record<string, string> = {
        speed: 'vitesse',
        endurance: 'endurance',
        vma: 'VMA',
        elevation: 'dénivelé / côtes',
      }
      const runningSection = runningPref
        ? (() => {
            const parts: string[] = []
            const qualities = (runningPref.qualities ?? []).map((q: string) => RUNNING_QUALITY_LABELS[q] ?? q)
            if (qualities.length > 0) {
              parts.push(`qualités de course à développer en priorité : ${qualities.join(', ')}`)
            }
            if (runningPref.weekly_km) {
              parts.push(`kilométrage hebdomadaire moyen visé : ${runningPref.weekly_km} km (construis des séances de course cohérentes avec ce volume : fractionné/VMA, seuil, sorties longues, récupération)`)
            }
            return parts.length > 0 ? `\n\nCourse à pied — ${parts.join(' ; ')}.` : ''
          })()
        : ''

      const trailSection = trainingProfile.event_details?.trail_km
        ? `\n\nL'utilisateur prépare un trail de ${trainingProfile.event_details.trail_km} km — intègre du travail spécifique (dénivelé, endurance, sorties longues) adapté à cette distance.`
        : ''

      const durationMonths = goal.program_duration_months === 3 ? 3 : 1
      const blocks = durationMonths === 3 ? 3 : 1
      const durationSection =
        blocks > 1
          ? `\n\nCe mésocycle de ${WEEKS_COUNT} semaines sera répété ${blocks} fois pour couvrir ${durationMonths} mois d'entraînement, avec une montée de charge automatique à chaque répétition (gérée après coup, pas par toi). Assure une progression cohérente d'une semaine à l'autre au sein de ce mésocycle.`
          : ''

      // Calculé en code plutôt que laissé à l'arithmétique de dates du modèle
      // (peu fiable) : signale explicitement un rythme de perte/prise de
      // poids visé au-delà de ~1 kg/semaine, ou une échéance déjà dépassée /
      // tombant avant la fin du programme — le system prompt sait alors qu'il
      // ne doit pas essayer de "rattraper" une échéance irréaliste.
      let targetRealismNote = ''
      if (goal.target_date) {
        const programDurationDays = WEEKS_COUNT * blocks * 7
        const daysUntilTarget = Math.round((new Date(goal.target_date).getTime() - Date.now()) / 86400000)
        const weeksUntilTarget = daysUntilTarget / 7
        if (goal.target_weight_kg && measurement.weight_kg && weeksUntilTarget > 0) {
          const weightDeltaKg = Math.abs(measurement.weight_kg - goal.target_weight_kg)
          const ratePerWeek = weightDeltaKg / weeksUntilTarget
          if (ratePerWeek > 1) {
            targetRealismNote += ` Attention : cela représente un rythme d'environ ${ratePerWeek.toFixed(1)} kg/semaine, au-delà d'un rythme sain (généralement 0,5 à 1 kg/semaine) — ne cherche pas à forcer ce rythme, vise une progression réaliste et sûre.`
          }
        }
        if (daysUntilTarget <= 0) {
          targetRealismNote += ` Cette échéance est déjà passée ou tombe aujourd'hui — traite-la comme indicative seulement, sans t'y adapter littéralement.`
        } else if (daysUntilTarget < programDurationDays) {
          targetRealismNote += ` Cette échéance tombe avant la fin des ${Math.round(programDurationDays / 7)} semaines du programme (dans ${daysUntilTarget} jour${daysUntilTarget > 1 ? 's' : ''}) — priorise une progression sûre et cohérente plutôt que de tout concentrer avant cette date.`
        }
      }

      const targetSection = goal.target_date
        ? `\n\nL'utilisateur vise une échéance au ${goal.target_date}${goal.target_weight_kg ? ` avec un poids cible de ${goal.target_weight_kg} kg` : ''} — oriente la progression et l'intensité pour l'amener au mieux à cette date.${targetRealismNote}`
        : ''

      // Demande d'ajustement Premium en attente : à prendre en compte en
      // priorité pour ce (re)génération, puis marquée comme appliquée.
      const { data: adjustment } = await supabase
        .from('program_adjustments')
        .select('id, prompt')
        .eq('user_id', user_id)
        .eq('applied', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const adjustmentSection = adjustment
        ? `\n\nDemande explicite de l'utilisateur pour ajuster son programme — prends-la en compte en priorité, dans les limites de sécurité et de cohérence de ses instructions système et de son profil : "${adjustment.prompt}"`
        : ''

      // Charge réelle récente (montres connectées via intervals.icu / import).
      const wearableSince = new Date(Date.now() - 28 * 86400000).toISOString()
      const { data: wearables } = await supabase
        .from('wearable_activities')
        .select('activity_type, started_at, duration_s, distance_m, avg_hr, elevation_gain_m, raw')
        .eq('user_id', user_id)
        .gte('started_at', wearableSince)
        .order('started_at', { ascending: false })
      const wearableSection = buildWearableSection(wearables ?? [])

      const exerciseCatalogText = JSON.stringify(
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
      )
      const validExerciseIdSet = new Set(exerciseIds)

      // Effort forcé à "low" pour tout le monde : "medium"/"high" avec
      // réflexion adaptative dépassent la limite d'exécution en arrière-plan
      // des Edge Functions (waitUntil) et bloquent silencieusement la
      // génération — testé et confirmé à plusieurs reprises. Un override
      // reste possible depuis l'admin (forcedEffort) pour comparer.
      const effort = ['low', 'medium', 'high'].includes(forcedEffort) ? forcedEffort : 'low'

      // Génération SEMAINE PAR SEMAINE plutôt qu'en un seul appel pour les
      // 4 semaines : chaque appel est ~4x plus petit (donc plus rapide et
      // bien moins exposé au blocage silencieux observé sur de gros appels —
      // probablement un timeout d'infrastructure sur la requête HTTP
      // individuelle, pas sur la durée totale de la fonction). Bénéfice
      // supplémentaire : la semaine 1 est sauvegardée et rendue active dès
      // qu'elle est prête, sans attendre les 4 semaines pour être utilisable.
      const allWeeks: any[] = []
      for (let weekNum = 1; weekNum <= WEEKS_COUNT; weekNum += 1) {
        const recapSection =
          weekNum > 1
            ? `\n\nVoici la semaine précédente (semaine ${weekNum - 1}), pour assurer une progression cohérente d'une semaine à l'autre — garde la même structure de jours/modalités sauf besoin réel de changement, fais évoluer charge/volume/intensité perçue, et indique cette progression dans "notes" :\n${recapWeek(allWeeks[allWeeks.length - 1])}`
            : ''

        const userPrompt = `Génère UNIQUEMENT la semaine ${weekNum} sur ${WEEKS_COUNT} d'un programme d'entraînement (les autres semaines sont générées séparément, une par une) — le champ week_number de cette semaine doit valoir ${weekNum}. Cette semaine compte ${totalSessions} séance(s), d'une durée cible de ${trainingProfile.session_duration_minutes} minutes chacune.

Profil utilisateur :
${JSON.stringify(promptSnapshot, null, 2)}${schedulingSection}${runningSection}${trailSection}${daySection}${durationSection}${targetSection}${situationSection}${injuriesSection}${otherSportSection}${wearableSection}${adjustmentSection}${recapSection}

Exercices disponibles (choisis parmi ceux-ci par exercise_id en priorité ; "custom" uniquement pour du cardio/sport/conditionnement absent de cette liste, jamais pour un mouvement de musculation) :
${exerciseCatalogText}`

        // Timeout explicite par semaine : sans lui, un appel qui reste bloqué
        // n'écrit jamais rien et le programme reste "generating" sans trace.
        // Plus court qu'avant (90s vs 4min) car chaque appel est désormais
        // ~4x plus petit.
        const GENERATION_TIMEOUT_MS = 90 * 1000
        const abortController = new AbortController()
        const timeoutId = setTimeout(() => abortController.abort(), GENERATION_TIMEOUT_MS)
        const t0 = Date.now()
        let response
        try {
          const stream = anthropic.messages.stream(
            {
              model: 'claude-sonnet-5',
              max_tokens: 12000,
              thinking: { type: 'adaptive' },
              output_config: {
                effort,
                format: { type: 'json_schema', schema: programSchema(exerciseIds) },
              },
              system: SYSTEM_PROMPT,
              messages: [{ role: 'user', content: userPrompt }],
            },
            { signal: abortController.signal }
          )
          response = await stream.finalMessage()
        } catch (err) {
          if (abortController.signal.aborted) {
            throw new Error(
              `Semaine ${weekNum} : génération au-delà de ${GENERATION_TIMEOUT_MS / 1000}s — réessaie.`
            )
          }
          throw err
        } finally {
          clearTimeout(timeoutId)
        }
        console.log(
          `[generate-program] user=${user_id} week=${weekNum}/${WEEKS_COUNT} effort=${effort} durée=${Date.now() - t0}ms tokens_in=${response.usage?.input_tokens} tokens_out=${response.usage?.output_tokens} stop=${response.stop_reason}`
        )

        if (response.stop_reason === 'refusal') {
          throw new Error(`Le modèle n'a pas pu générer la semaine ${weekNum} pour ce profil.`)
        }
        if (response.stop_reason === 'max_tokens') {
          throw new Error(`La génération de la semaine ${weekNum} a été tronquée, réessaie.`)
        }

        const textBlock = response.content.find((block: any) => block.type === 'text')
        if (!textBlock) {
          throw new Error(`Réponse du modèle invalide (semaine ${weekNum}).`)
        }

        let weekStructure
        try {
          weekStructure = JSON.parse((textBlock as any).text)
        } catch {
          throw new Error(`Réponse du modèle mal formée (semaine ${weekNum}).`)
        }

        if (!Array.isArray(weekStructure.weeks) || weekStructure.weeks.length !== 1) {
          throw new Error(`Semaine ${weekNum} : nombre de semaines inattendu dans la réponse.`)
        }

        let validationError = validateProgramStructure(weekStructure, validExerciseIdSet, {
          sameDayCombining,
          totalSessions,
          expectedModalityCounts,
        })
        if (validationError) {
          throw new Error(`Semaine ${weekNum} invalide : ${validationError}`)
        }

        weekStructure = await resolveCustomExercises(weekStructure)

        const resolvedIds = new Set([
          ...exerciseIds,
          ...weekStructure.weeks.flatMap((w: any) => w.days.flatMap((d: any) => d.exercises.map((e: any) => e.exercise_id))),
        ])
        validationError = validateProgramStructure(weekStructure, resolvedIds, {
          sameDayCombining,
          totalSessions,
          expectedModalityCounts,
        })
        if (validationError) {
          throw new Error(`Semaine ${weekNum} invalide après résolution des exercices personnalisés : ${validationError}`)
        }

        const generatedWeek = weekStructure.weeks[0]
        generatedWeek.week_number = weekNum
        allWeeks.push(generatedWeek)

        // Sauvegarde incrémentale : dès la semaine 1, le programme passe
        // "active" et devient utilisable — pas besoin d'attendre les 4
        // semaines. Si une semaine suivante échoue, ce qui est déjà
        // sauvegardé reste utilisable (voir le catch plus bas).
        await supabase
          .from('user_programs')
          .update({ status: 'active', structure: { weeks: allWeeks }, generation_prompt_snapshot: promptSnapshot })
          .eq('id', program_id)
      }

      // Répète le mésocycle de 4 semaines pour couvrir la durée choisie, avec
      // une directive de progression de charge à chaque bloc — pur calcul
      // local, pas d'appel supplémentaire au modèle.
      if (blocks > 1) {
        const expanded = expandBlocks({ weeks: allWeeks }, blocks)
        await supabase.from('user_programs').update({ structure: expanded }).eq('id', program_id)
      }

      if (adjustment) {
        await supabase
          .from('program_adjustments')
          .update({ applied: true, applied_at: new Date().toISOString() })
          .eq('id', adjustment.id)
      }

      await supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('user_id', user_id)
    } catch (err) {
      // Si des semaines ont déjà été sauvegardées, le programme est déjà
      // "active" et utilisable — ne pas l'écraser en "failed", juste
      // consigner l'échec de la suite pour visibilité (ex. dans /admin).
      const { data: current } = await supabase.from('user_programs').select('status').eq('id', program_id).maybeSingle()
      const message = err instanceof Error ? err.message : String(err)
      if (current?.status === 'active') {
        await supabase
          .from('user_programs')
          .update({ error_message: `Génération partielle (certaines semaines manquantes) : ${message}` })
          .eq('id', program_id)
      } else {
        await supabase.from('user_programs').update({ status: 'failed', error_message: message }).eq('id', program_id)
      }
    }
  }

  // @ts-ignore -- global fourni par le runtime Edge Functions de Supabase, pas par Deno lui-même
  EdgeRuntime.waitUntil(runGeneration())

  return new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  })
})
