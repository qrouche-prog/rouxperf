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

const CUSTOM_EXERCISE_SENTINEL = 'custom'

// Formats de bloc de conditionnement supportés par le lanceur de séance —
// "straight" = série classique (défaut), sinon un bloc AMRAP/EMOM regroupant
// plusieurs exercices consécutifs partageant le même block_id.
const BLOCK_FORMATS = ['straight', 'amrap', 'emom']

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
    required: [
      'exercise_id',
      'custom_name',
      'custom_instructions',
      'sets',
      'reps',
      'rest_seconds',
      'notes',
      'block_format',
      'block_id',
      'block_time_cap_seconds',
      'block_interval_seconds',
      'block_rounds',
    ],
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

const SYSTEM_PROMPT = `Tu es un coach sportif expérimenté qui conçoit des programmes d'entraînement personnalisés, sûrs et progressifs.
Respecte strictement les blessures et limitations indiquées par l'utilisateur : si un mouvement pourrait les aggraver, ne le sélectionne pas.
Adapte le volume, l'intensité et la complexité technique au niveau d'expérience indiqué.
Prévois une progression cohérente d'une semaine à l'autre (charge, volume ou intensité perçue) et indique-la dans le champ "notes" de chaque exercice.

Structure chaque séance de musculation comme un vrai programme :
1. un ou deux exercices poly-articulaires principaux adaptés au niveau (squat, soulevé, développé, tirage…) ;
2. deux à trois exercices accessoires ciblés pour équilibrer le corps ;
3. AU MOINS un exercice de tronc / abdominaux (un exercice dont le muscle_group est "core") dans la grande majorité des séances de musculation — n'oublie jamais le gainage et le renforcement abdominal ;
4. un finisher ou du conditionnement selon l'objectif — SYSTÉMATIQUE (pas optionnel) pour "weight_loss" et pour tout profil où focus_areas contient "weight_loss", voir le détail dans le bloc "weight_loss" ci-dessous.
Sur l'ensemble de la semaine, équilibre les schémas moteurs (pousser/tirer, dominante genou/hanche) et ne néglige aucun groupe musculaire. Varie les exercices d'une séance à l'autre plutôt que de répéter le même mouvement partout.

Adapte concrètement la programmation à l'objectif (goal_type) :
- "weight_loss" (perte de poids) : vise une dépense énergétique élevée — séances plutôt full-body, densité élevée (supersets ou circuits), temps de repos courts entre exercices de force. Termine SYSTÉMATIQUEMENT chaque séance de musculation par un finisher de 8 à 15 minutes, en variant les deux formats suivants d'une séance à l'autre plutôt que de répéter toujours le même :
  a) gainage/abdominaux complémentaires (2-4 exercices core additionnels) ;
  b) un bloc de conditionnement varié type AMRAP (autant de tours que possible dans un temps donné, ex. 12 minutes) ou EMOM (un enchaînement à répéter au début de chaque minute, le temps restant de la minute sert de repos), mêlant 3 à 5 mouvements différents (ex. squats, fentes, burpees, mountain climbers, corde à sauter, kettlebell swings, rameur) à une intensité modérée à soutenue — PAS uniquement des intervalles très haute intensité (HIIT) répétés à l'identique semaine après semaine : varie les mouvements, la structure (AMRAP/EMOM/circuit) et l'intensité perçue.
  Pour représenter un bloc AMRAP/EMOM, utilise les champs block_* prévus à cet effet (le lanceur de séance affiche un vrai minuteur dédié pour ces blocs — ne mets JAMAIS ces informations dans "notes") : liste chaque mouvement du bloc comme un exercice séparé et CONSÉCUTIF dans le tableau "exercises" (jamais entrecoupé d'un autre exercice), avec sets=1, reps=le nombre de répétitions prescrites pour ce mouvement à chaque tour/round (ou une durée si le mouvement est chronométré, ex. "30s"), rest_seconds=0 ; block_format="amrap" ou "emom" sur CHAQUE exercice du bloc ; block_id=un identifiant court partagé par tous les exercices de ce bloc (ex. "b1"), unique par bloc dans la séance. Pour un bloc "amrap" : renseigne block_time_cap_seconds (durée totale en secondes, ex. 720 pour 12 minutes) ; block_interval_seconds et block_rounds valent 0. Pour un bloc "emom" : renseigne block_interval_seconds (durée d'un round, généralement 60) et block_rounds (nombre total de rounds/minutes, ex. 10) ; block_time_cap_seconds vaut 0. Pour tout exercice hors bloc (séries classiques) : block_format="straight", block_id="", et les trois champs numériques block_* valent 0.
  Sur le reste de la semaine, intègre aussi du cardio continu à faible/moyen impact (marche rapide inclinée, montée d'escaliers, vélo, elliptique, rameur) pour varier les stimuli — ne fais pas reposer tout le volet cardio sur des intervalles intenses. Ne te limite pas à de la musculation classique.
- "muscle_gain" (prise de muscle) : hypertrophie — 8 à 12 répétitions, volume suffisant par groupe musculaire, repos modérés (60-120 s), split cohérent avec la fréquence.
- "strength" (force) : mouvements poly-articulaires lourds en priorité, 3 à 6 répétitions, repos longs (2-4 min).
- "endurance" : résistance musculaire (répétitions élevées, circuits) et travail cardio régulier.
- "recomposition" / "hybrid" : combine renforcement musculaire (hypertrophie, 8-12 répétitions, repos modérés) et conditionnement cardio régulier dans la semaine. Le dosage entre les deux dépend de focus_areas (voir ci-dessous) : sans signal supplémentaire, équilibre les deux également.
- "general_fitness" : programme équilibré et varié (force, tronc, mobilité, un peu de cardio).

Le goal_type ne suffit pas toujours à capter l'intention réelle — croise-le avec focus_areas (des aspects secondaires à travailler, en plus de l'objectif principal) :
- si focus_areas contient "weight_loss" (même quand goal_type est "recomposition", "hybrid" ou autre), applique EN PLUS les principes de densité du bloc "weight_loss" ci-dessus (repos courts, supersets/circuits, cardio systématique) sur la part musculation du programme, plutôt que de traiter ce cas comme une hypertrophie classique ;
- si focus_areas contient "muscle_gain" alors que goal_type n'est pas déjà "muscle_gain", pondère la part musculation vers un travail d'hypertrophie (8-12 répétitions, volume par groupe musculaire) sur les groupes ciblés, sans pour autant abandonner ce que demande goal_type par ailleurs.

Sécurité et pathologies (prioritaire) : croise systématiquement le champ "contraindications" de chaque exercice avec les blessures, limitations et la situation particulière de l'utilisateur, et n'inclus JAMAIS un exercice dont une contre-indication correspond à une zone à risque. En cas de doute, choisis une variante plus sûre.

Rythme de perte de poids et échéances (prioritaire, même esprit que les contre-indications physiques) : si le prompt utilisateur indique un rythme de perte de poids visé au-delà d'environ 1 kg/semaine, ou une échéance trop proche pour l'atteindre sainement, NE conçois PAS un programme visant à forcer ce rythme (pas de déficit extrême, pas de volume/densité excessifs pour "rattraper" le temps). Construis plutôt la progression la plus sûre et cohérente possible sur la durée du programme, et indique clairement dans le champ "notes" du premier exercice de la première séance que l'échéance ou le rythme demandé n'est pas réaliste de façon saine, avec l'estimation réaliste fournie dans le prompt si elle est présente.

Pour choisir chaque exercice, deux options :
1. Un exercice de la bibliothèque fournie, référencé par son exercise_id exact —
   c'est le choix par défaut et obligatoire pour tout mouvement de musculation
   avec charge ou technique (squat, soulevé, développé, tirage, machines,
   isolation, etc.). Ne sors jamais de la bibliothèque pour ce type de mouvement,
   même si elle te semble incomplète — la sécurité d'exécution prime.
2. Un exercice libre, uniquement pour du cardio, un geste spécifique à un sport,
   ou du conditionnement général quand rien dans la bibliothèque ne convient
   (ex. course à pied si absente, geste technique d'un sport de combat, drill
   spécifique à un sport listé dans target_sports) : mets exercise_id à "custom",
   remplis custom_name (nom clair et court) et custom_instructions (description
   concise, sûre et exécutable de comment le réaliser). N'utilise "custom" que
   pour ce type de travail à faible risque technique — jamais pour remplacer un
   mouvement de force qui existe déjà dans la bibliothèque. Quand exercise_id
   n'est pas "custom", laisse custom_name et custom_instructions vides ("").

Chaque exercice porte aussi des champs block_* (block_format, block_id,
block_time_cap_seconds, block_interval_seconds, block_rounds) qui pilotent
l'affichage d'un vrai minuteur dans le lanceur de séance. Par défaut, pour un
exercice en séries classiques (l'immense majorité des cas) : block_format=
"straight", block_id="", et les trois champs numériques valent 0. Utilise
"amrap"/"emom" uniquement pour les blocs de conditionnement décrits dans le
bloc "weight_loss" ci-dessous et dans les autres goal_type où un tel
finisher a du sens — jamais pour un exercice de musculation classique.

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
  ce sport (ex. sauts pour le volleyball/basketball) en priorité depuis la
  bibliothèque, et via un exercice "custom" seulement si un geste vraiment
  spécifique au sport manque.

Le champ special_situation (et special_situation_details) signale une situation
qui change fondamentalement l'approche à adopter.
PRIORITÉ ABSOLUE — santé et sécurité : si special_situation n'est pas "none" ou
si des blessures/limitations sont déclarées, cette situation PRIME sur l'objectif
de performance ou d'esthétique et STRUCTURE tout le programme. Tu construis le
programme AUTOUR d'elle : chaque semaine et chaque séance sont pensées d'abord
pour la sécurité, la récupération et la reconstruction progressive. Fais des
4 semaines une vraie progression (semaine 1 la plus prudente, montée graduelle et
adaptée). Pour ces situations, PRIORISE les exercices de mobilité et d'activation
de la bibliothèque (respiration diaphragmatique, activation du plancher pelvien et
du transverse, bascule du bassin, chat-vache, bird dog, marche active…) et le
renforcement au poids du corps, avant tout travail lourd ou intense.
Applique ces règles strictement :
- "pregnant" (grossesse) : jamais d'objectif de perte de poids ou de restriction
  implicite, quel que soit goal_type. Intensité modérée (test de la parole).
  À partir du 2e trimestre (trimester >= 2), évite toute position allongée sur
  le dos prolongée, les sauts/impacts élevés, les mouvements à risque de chute
  ou de contact, et les efforts en apnée/charge maximale. Privilégie renforcement
  postural, plancher pelvien, mobilité et cardio à impact modéré (marche, vélo,
  natation, rameur) si disponibles. Volume et charge nettement réduits par
  rapport à un profil standard de même niveau. Intègre à chaque semaine de la
  respiration et de l'activation du plancher pelvien, évite l'apnée/Valsalva, et
  adapte la difficulté au fil du trimestre (progression douce, jamais de montée
  d'intensité agressive).
- "postpartum" (post-partum) : reconstruis progressivement, phase par phase, en
  protégeant le plancher pelvien et en surveillant le diastasis des grands droits
  (évite tout mouvement qui fait saillir/pousser le ventre = pression
  intra-abdominale, et l'apnée/Valsalva). Adapte selon weeks_since_birth :
  • < 6 semaines : UNIQUEMENT respiration diaphragmatique, activation du plancher
    pelvien et du transverse, mobilité douce (bascule du bassin, chat-vache) et
    marche. AUCUNE charge, AUCUN gainage frontal (crunch, planche), aucun impact,
    aucun saut.
  • 6 à 12 semaines : réintègre le tronc profond (dead bug, bird dog, marche du
    pont fessier), renforcement doux au poids du corps et fessiers, progression
    très graduelle. Toujours pas de crunch/planche longue ni de charge lourde tant
    que le tronc profond et le plancher pelvien ne sont pas restaurés.
  • > 12 semaines : réintroduis progressivement le renforcement classique et un
    peu de charge si tout va bien, en gardant un gainage anti-pression (pas de
    crunch intense en priorité) et en restant à l'écoute des symptômes (fuites,
    lourdeur, douleur → on réduit).
  Si delivery_type = "cesarean" : cicatrisation — prudence supplémentaire, retarde
  encore le gainage et le port de charge. Fais des 4 semaines une vraie
  progression de rééducation cohérente avec weeks_since_birth.
- "injury_rehab" (rééducation) : construis le programme AUTOUR de la zone
  indiquée (area). Ne sélectionne aucun exercice qui la sollicite directement de
  façon intense ; renforce en priorité le reste du corps (groupes non affectés),
  et travaille la mobilité et l'activation douce autour de la zone si pertinent.
  Ne réintroduis un travail progressif de la zone que si cleared_by_professional
  est true, en montant très graduellement sur les 4 semaines. Si
  cleared_by_professional est false, reste particulièrement conservateur (volume
  et charge bas, aucun mouvement à risque sur la zone).
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
complément d'information ; utilise un exercice "custom" si un geste propre à
ce sport n'existe pas dans la bibliothèque.`

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
          ? `\n\nCe bloc de ${WEEKS_COUNT} semaines est un mésocycle qui sera répété ${blocks} fois pour couvrir ${durationMonths} mois d'entraînement, avec une montée progressive de la charge à chaque répétition (la répétition et l'augmentation entre blocs sont gérées automatiquement après ta génération). Conçois donc une progression cohérente et logique à l'intérieur de ces 4 semaines.`
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

      const userPrompt = `Génère un programme d'entraînement de ${WEEKS_COUNT} semaines, avec ${totalSessions} séance(s) par semaine au total, d'une durée cible de ${trainingProfile.session_duration_minutes} minutes chacune.

Profil utilisateur :
${JSON.stringify(promptSnapshot, null, 2)}${schedulingSection}${runningSection}${trailSection}${daySection}${durationSection}${targetSection}${situationSection}${injuriesSection}${otherSportSection}${wearableSection}${adjustmentSection}

Exercices disponibles (choisis parmi ceux-ci par exercise_id en priorité ; "custom" uniquement pour du cardio/sport/conditionnement absent de cette liste, jamais pour un mouvement de musculation) :
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

      // Effort forcé à "low" pour tout le monde : "medium"/"high" avec
      // réflexion adaptative dépassent la limite d'exécution en arrière-plan
      // des Edge Functions (waitUntil) et bloquent silencieusement la
      // génération — testé et confirmé à deux reprises (30min puis 11min sans
      // log ni erreur, alors que "low" aboutit en ~105s). Un override reste
      // possible depuis l'admin (forcedEffort) pour tester une fois le
      // problème de timeout résolu autrement (ex. génération hors Edge
      // Function).
      const effort = ['low', 'medium', 'high'].includes(forcedEffort) ? forcedEffort : 'low'

      // Plafond 40k : assez pour un bloc de 4 semaines sans troncature.
      const t0 = Date.now()
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-5',
        max_tokens: 40000,
        thinking: { type: 'adaptive' },
        output_config: {
          effort,
          format: { type: 'json_schema', schema: programSchema(exerciseIds) },
        },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })
      const response = await stream.finalMessage()
      console.log(
        `[generate-program] user=${user_id} effort=${effort} durée=${Date.now() - t0}ms tokens_in=${response.usage?.input_tokens} tokens_out=${response.usage?.output_tokens} stop=${response.stop_reason}`
      )

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

      const validationError = validateProgramStructure(structure, new Set(exerciseIds), {
        sameDayCombining,
        totalSessions,
        expectedModalityCounts,
      })
      if (validationError) {
        throw new Error(`Programme invalide : ${validationError}`)
      }

      structure = await resolveCustomExercises(structure)

      const finalValidationError = validateProgramStructure(
        structure,
        new Set([...exerciseIds, ...structure.weeks.flatMap((w: any) => w.days.flatMap((d: any) => d.exercises.map((e: any) => e.exercise_id)))]),
        { sameDayCombining, totalSessions, expectedModalityCounts }
      )
      if (finalValidationError) {
        throw new Error(`Programme invalide après résolution des exercices personnalisés : ${finalValidationError}`)
      }

      // Répète le mésocycle de 4 semaines pour couvrir la durée choisie, avec
      // une directive de progression de charge à chaque bloc.
      structure = expandBlocks(structure, blocks)

      await supabase
        .from('user_programs')
        .update({ status: 'active', structure, generation_prompt_snapshot: promptSnapshot })
        .eq('id', program_id)

      if (adjustment) {
        await supabase
          .from('program_adjustments')
          .update({ applied: true, applied_at: new Date().toISOString() })
          .eq('id', adjustment.id)
      }

      await supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('user_id', user_id)
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
