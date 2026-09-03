import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { withStableDayNumbers, programSchedule } from '../lib/programDays'
import { mediaForSlug } from '../lib/exerciseMedia'
import ExerciseLoop from '../components/ExerciseLoop'
import ExerciseVideo from '../components/ExerciseVideo'
import ExerciseAttribution from '../components/ExerciseAttribution'
import Icon from '../components/onboarding/icons/Icon'
import ExerciseAlternatives from '../components/ExerciseAlternatives'
import BlockRunner from '../components/BlockRunner'
import {
  groupDayExercises,
  isBlockExercise,
  isWarmupExercise,
  isSupersetExercise,
  intensificationLabel,
  blockMembers,
  firstIndexOfBlock,
  blockLabel,
  blockExplainer,
} from '../lib/workoutBlocks'

function parseTargetReps(repsText) {
  const match = String(repsText ?? '').match(/\d+/)
  return match ? Number(match[0]) : null
}

// Durée d'effort en secondes si l'objectif est exprimé en temps ("30s",
// "45 sec", "1 min", "1:30"), sinon null (objectif en répétitions).
function repsSeconds(repsText) {
  const t = String(repsText ?? '').toLowerCase().trim()
  let m = t.match(/^(\d+)\s*:\s*(\d{2})$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  m = t.match(/^(\d+)\s*(min|mn|minutes?)\b/)
  if (m) return Number(m[1]) * 60
  m = t.match(/^(\d+)\s*(s|sec|secs|secondes?)\b/)
  if (m) return Number(m[1])
  return null
}

// mm:ss quand ≥ 1 min, sinon "Ns".
function fmtCountdown(sec) {
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`
}

// Les champs distance / allure / vitesse ne concernent QUE la course à pied
// (ou une consigne qui impose une distance en m/km). Tout le reste — y compris
// la pliométrie (squats sautés, step-ups…) — se log en poids × répétitions,
// ou en temps d'effort si la consigne est chronométrée.
const RUN_RE =
  /course|running|\brun\b|footing|jogging|fractionn|trail|marathon|semi|sprint|fartlek|\bvma\b|seuil|sortie longue|tapis|treadmill|allure/i
const RUN_MODALITY_RE = /^(run(ning)?|course|aerobic|endurance|trail|footing)$/i
function isRunningDay(modality) {
  return RUN_MODALITY_RE.test(String(modality ?? '').trim())
}
// Course à pied : toute la séance de course (échauffement, intervalles, sortie,
// retour au calme) via sa modalité, ou un exercice à distance/nom évocateur.
function isRunningExercise(details, reps, modality) {
  if (isRunningDay(modality)) return true
  if (hasDistanceUnit(reps)) return true
  return RUN_RE.test(details?.name ?? '')
}

// "5x1000m" / "8 x 400 m" / "5x3min" → { count, target }. Sinon null.
function intervalCount(repsText) {
  const m = String(repsText ?? '').trim().match(/^(\d+)\s*[x×]\s*(.+)$/i)
  return m ? { count: Number(m[1]), target: m[2].trim() } : null
}

function hasDistanceUnit(text) {
  return /\d\s*(m|km)\b/i.test(String(text ?? ''))
}

// Première distance trouvée, convertie en km ("1000m" → 1, "5km" → 5).
function distanceKmOf(text) {
  const m = String(text ?? '').match(/(\d+(?:[.,]\d+)?)\s*(m|km)\b/i)
  if (!m) return null
  const v = Number(m[1].replace(',', '.'))
  return m[2].toLowerCase() === 'km' ? v : v / 1000
}

// Nombre effectif de séries : un intervalle cardio "Nx…" compte pour N séries,
// même si le programme n'en déclare qu'une.
function setsOf(exercise, details, modality) {
  if (isRunningExercise(details, exercise.reps, modality)) {
    const ic = intervalCount(exercise.reps)
    if (ic && ic.count > 1) return ic.count
  }
  return exercise.sets
}

// Allure en secondes par km. Accepte "5:30" (min:sec) ou un décimal de minutes.
function parsePace(text) {
  const t = String(text ?? '').trim()
  let m = t.match(/^(\d+):(\d{1,2})$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  m = t.match(/^(\d+(?:[.,]\d+)?)$/)
  if (m) return Math.round(Number(t.replace(',', '.')) * 60)
  return null
}

// Secondes/km → "5:30".
function fmtPace(sec) {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Libellé d'une série réalisée dans le résumé, selon sa nature.
function setSummary(e, ex, running) {
  if (ex.block_id) {
    const n = e.reps ?? 0
    return `${n} tour${n > 1 ? 's' : ''} complété${n > 1 ? 's' : ''}${e.note ? ` · ${e.note}` : ''}`
  }
  if (e.metric_kind === 'effort_s') return `${e.metric_value}s d'effort${e.note ? ` · ${e.note}` : ''}`
  const note = e.note ? ` · ${e.note}` : ''
  const parts = []
  if (e.distance_km) parts.push(`${e.distance_km} km`)
  if (e.metric_kind === 'pace') parts.push(`${fmtPace(e.metric_value)} /km`)
  else if (e.metric_kind === 'speed') parts.push(`${e.metric_value} km/h`)
  else if (e.metric_kind === 'time') parts.push(`${e.metric_value} min`)
  if (parts.length) return parts.join(' · ') + note
  if (running) return `série faite${note}`
  return `${e.weight_kg ? `${e.weight_kg} kg` : 'PdC'} × ${e.reps || ex.reps} reps${note}`
}

function countCompleted(entries, exerciseIndex, totalSets) {
  let n = 0
  for (let i = 0; i < totalSets; i += 1) {
    if (entries[`${exerciseIndex}-${i}`]) n += 1
  }
  return n
}

// Libellé exact du repos (pas d'arrondi trompeur : 75 s ≠ "1 min").
function restLabelFor(seconds) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m} min`
  return `${m} min ${s}s`
}

// Reconstruit les séries déjà enregistrées → entrées locales + id de ligne
// (pour pouvoir mettre à jour une série au lieu d'en réinsérer une).
function buildFromLoggedSets(day, loggedSets) {
  const entries = {}
  const rowIds = {}
  for (const set of loggedSets) {
    const setIndex = set.set_number - 1
    const exerciseIndex = day.exercises.findIndex(
      (exercise, i) => exercise.exercise_id === set.exercise_id && !entries[`${i}-${setIndex}`]
    )
    if (exerciseIndex !== -1) {
      const key = `${exerciseIndex}-${setIndex}`
      entries[key] = {
        reps: set.reps ?? '',
        weight_kg: set.weight_kg ?? '',
        note: set.note ?? '',
        metric_kind: set.metric_kind ?? null,
        metric_value: set.metric_value ?? null,
        distance_km: set.distance_km ?? null,
      }
      if (set.id != null) rowIds[key] = set.id
    }
  }
  return { entries, rowIds }
}

export default function SessionRunnerPage() {
  const { weekNumber, dayNumber } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [program, setProgram] = useState(null)
  const [exercisesById, setExercisesById] = useState({})
  const [equipmentAccess, setEquipmentAccess] = useState('bodyweight')
  const [swapping, setSwapping] = useState(false)
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState(null)

  const [entries, setEntries] = useState({})
  const [carryoverByExercise, setCarryoverByExercise] = useState({})

  const [phase, setPhase] = useState('exercise') // exercise | superset | list | resting | effort | summary
  const [supersetWeights, setSupersetWeights] = useState({}) // exIdx -> poids (kg) saisi pour le tour affiché
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(null)
  const [activeSetIndex, setActiveSetIndex] = useState(0)
  const [editingDoneSet, setEditingDoneSet] = useState(false)
  const [restRemaining, setRestRemaining] = useState(0)
  const [restEndAt, setRestEndAt] = useState(null)
  const [restNext, setRestNext] = useState('')
  const [effortRemaining, setEffortRemaining] = useState(0)
  const [effortEndAt, setEffortEndAt] = useState(null)

  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')
  const [metricKind, setMetricKind] = useState('pace') // pace | speed | time
  const [metricValue, setMetricValue] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [, setFinalPercent] = useState(null)

  // Refs pour éviter les closures périmées dans les timers / callbacks async.
  const entriesRef = useRef({})
  const logIdRef = useRef(null)
  const rowIdsRef = useRef({})
  const selectedExRef = useRef(null)
  const wakeLockRef = useRef(null)
  const audioCtxRef = useRef(null)
  const restFiredRef = useRef(false)
  const effortFiredRef = useRef(false)
  const effortTargetRef = useRef(null)

  const REST_KEY = `rouxperf-rest-${weekNumber}-${dayNumber}`

  const week = program?.structure?.weeks?.find((w) => w.week_number === Number(weekNumber))
  const days = withStableDayNumbers(week?.days ?? [])
  const day = days.find((d) => d.day_number === Number(dayNumber))

  // Nombre effectif de "séries" d'un exercice (gère les intervalles course
  // "Nx…" et les blocs AMRAP/EMOM, comptés comme UNE seule série sur le
  // premier exercice du bloc — les suivants comptent pour 0 pour ne pas
  // fausser la progression, ils sont gérés ensemble via le minuteur de bloc).
  const setCount = (ex) => {
    // Seul un vrai bloc AMRAP/EMOM se compte comme UNE série combinée ;
    // l'échauffement (block_format="warmup") garde ses vraies séries — sinon
    // ses mouvements suivants perdraient leur suivi individuel.
    if (isBlockExercise(ex)) {
      const firstIdx = day.exercises.findIndex((e) => e.block_id === ex.block_id)
      return day.exercises.indexOf(ex) === firstIdx ? 1 : 0
    }
    return setsOf(ex, exercisesById[ex.exercise_id], day?.modality)
  }

  // Pour un superset/triset : la vraie prochaine étape est le tour le moins
  // avancé (minimum de séries complétées parmi les membres), sur le premier
  // membre qui n'a pas encore cette série — ça reste correct même si l'app a
  // été fermée en plein milieu d'un tour (un membre validé, l'autre pas).
  function nextBlockTarget(entriesMap, blockId) {
    const members = blockMembers(day.exercises, blockId)
    if (members.length === 0) return null
    let round = Infinity
    for (const { exercise, index } of members) {
      round = Math.min(round, countCompleted(entriesMap, index, setCount(exercise)))
    }
    for (const { index } of members) {
      if (!entriesMap[`${index}-${round}`]) return { exIdx: index, setIdx: round }
    }
    return null
  }

  function syncEntries(next) {
    entriesRef.current = next
    setEntries(next)
  }

  function carryoverFor(exerciseId, setIndex0) {
    const w = carryoverByExercise[exerciseId]?.[setIndex0 + 1]
    return w != null ? String(w) : ''
  }

  // Charge les valeurs du champ (poids/note) pour une série donnée.
  function loadFieldsFor(dayArg, exIdx, setIdx, { sameExercise } = {}) {
    const ex = dayArg.exercises[exIdx]
    const existing = entriesRef.current[`${exIdx}-${setIdx}`]
    if (existing) {
      setWeight(existing.weight_kg != null ? String(existing.weight_kg) : '')
      setNote(existing.note != null ? String(existing.note) : '')
      setDistanceKm(existing.distance_km != null ? String(existing.distance_km) : '')
      if (existing.metric_kind && existing.metric_kind !== 'effort_s') {
        setMetricKind(existing.metric_kind)
        setMetricValue(
          existing.metric_value == null
            ? ''
            : existing.metric_kind === 'pace'
              ? fmtPace(existing.metric_value)
              : String(existing.metric_value)
        )
      } else {
        setMetricValue('')
      }
      return
    }
    const carry = carryoverFor(ex.exercise_id, setIdx)
    if (carry) setWeight(carry)
    else if (!sameExercise) setWeight('') // nouvel exercice sans reprise : on repart vide
    // même exercice sans reprise : on garde le poids déjà saisi
    setNote('')
    setMetricValue('')
    setDistanceKm('')
  }

  // Charge les poids affichés pour un tour de superset/triset — un champ par
  // membre du bloc, tous affichés et validés ensemble.
  function loadSupersetFieldsFor(dayArg, blockId, roundIdx) {
    const members = blockMembers(dayArg.exercises, blockId)
    const weights = {}
    for (const { exercise: me, index: mi } of members) {
      const existing = entriesRef.current[`${mi}-${roundIdx}`]
      weights[mi] = existing?.weight_kg != null ? String(existing.weight_kg) : carryoverFor(me.exercise_id, roundIdx)
    }
    setSupersetWeights(weights)
  }

  // Ouvre la série à faire courante (1er exercice, 1re série non complétés).
  // Renvoie true si une série reste à faire, false si la séance est terminée.
  function openCurrent(dayArg) {
    const target = dayArg || day
    if (!target) return false
    for (let e = 0; e < target.exercises.length; e += 1) {
      const ex = target.exercises[e]
      for (let s = 0; s < setCount(ex); s += 1) {
        if (!entriesRef.current[`${e}-${s}`]) {
          if (isBlockExercise(ex)) {
            selectedExRef.current = e
            setSelectedExerciseIndex(e)
            setPhase('block')
            return true
          }
          if (isSupersetExercise(ex)) {
            const t = nextBlockTarget(entriesRef.current, ex.block_id) || { exIdx: e, setIdx: s }
            const anchorIdx = firstIndexOfBlock(target.exercises, ex.block_id)
            selectedExRef.current = anchorIdx
            setSelectedExerciseIndex(anchorIdx)
            setActiveSetIndex(t.setIdx)
            setEditingDoneSet(false)
            loadSupersetFieldsFor(target, ex.block_id, t.setIdx)
            setPhase('superset')
            return true
          }
          const sameExercise = e === selectedExRef.current
          selectedExRef.current = e
          setSelectedExerciseIndex(e)
          setActiveSetIndex(s)
          setEditingDoneSet(false)
          loadFieldsFor(target, e, s, { sameExercise })
          setPhase('exercise')
          return true
        }
      }
    }
    // Tout est fait
    setFinalPercent(100)
    setPhase('summary')
    return false
  }

  function openExercise(dayArg, exIdx) {
    const target = dayArg || day
    const ex = target.exercises[exIdx]
    if (isBlockExercise(ex)) {
      const firstIdx = firstIndexOfBlock(target.exercises, ex.block_id)
      selectedExRef.current = firstIdx
      setSelectedExerciseIndex(firstIdx)
      setPhase('block')
      return
    }
    if (isSupersetExercise(ex)) {
      const t = nextBlockTarget(entriesRef.current, ex.block_id) || { exIdx, setIdx: 0 }
      const anchorIdx = firstIndexOfBlock(target.exercises, ex.block_id)
      selectedExRef.current = anchorIdx
      setSelectedExerciseIndex(anchorIdx)
      setActiveSetIndex(t.setIdx)
      setEditingDoneSet(false)
      loadSupersetFieldsFor(target, ex.block_id, t.setIdx)
      setPhase('superset')
      return
    }
    let setIdx = 0
    for (let s = 0; s < setCount(ex); s += 1) {
      if (!entriesRef.current[`${exIdx}-${s}`]) {
        setIdx = s
        break
      }
      setIdx = s // tout fait : on pointe la dernière
    }
    selectedExRef.current = exIdx
    setSelectedExerciseIndex(exIdx)
    setActiveSetIndex(setIdx)
    setEditingDoneSet(false)
    loadFieldsFor(target, exIdx, setIdx, { sameExercise: false })
    setPhase('exercise')
  }

  useEffect(() => {
    async function load() {
      const [{ data: programData, error }, { data: exercises }, { data: tp }] = await Promise.all([
        supabase
          .from('user_programs')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('exercises')
          .select(
            'id, name, instructions, illustration_slug, category, muscle_group, equipment_required, is_ai_generated, musclewiki_videos'
          ),
        supabase.from('user_training_profile').select('equipment_access').eq('user_id', user.id).maybeSingle(),
      ])
      if (error) {
        setLoadError(error.message)
        setStatus('idle')
        return
      }
      setProgram(programData)
      setExercisesById(Object.fromEntries((exercises ?? []).map((exercise) => [exercise.id, exercise])))
      if (tp?.equipment_access) setEquipmentAccess(tp.equipment_access)

      if (programData) {
        const wk = programData.structure.weeks.find((w) => w.week_number === Number(weekNumber))
        const normalizedDays = withStableDayNumbers(wk?.days ?? [])
        const theDay = normalizedDays.find((d) => d.day_number === Number(dayNumber))

        if (theDay) {
          const { data: existingLog } = await supabase
            .from('workout_logs')
            .select(
              'id, performed_at, workout_log_sets(id, exercise_id, set_number, reps, weight_kg, note, metric_kind, metric_value, distance_km)'
            )
            .eq('user_id', user.id)
            .eq('program_id', programData.id)
            .eq('week_number', Number(weekNumber))
            .eq('day_number', Number(dayNumber))
            .order('performed_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (existingLog && existingLog.workout_log_sets.length > 0) {
            const built = buildFromLoggedSets(theDay, existingLog.workout_log_sets)
            entriesRef.current = built.entries
            rowIdsRef.current = built.rowIds
            logIdRef.current = existingLog.id
            setEntries(built.entries)
          }

          // Reprise des poids : dernière séance complétée d'une semaine
          // antérieure pour le même jour, pour pré-remplir série par série.
          const { data: priorLog } = await supabase
            .from('workout_logs')
            .select('week_number, workout_log_sets(exercise_id, set_number, weight_kg)')
            .eq('user_id', user.id)
            .eq('program_id', programData.id)
            .eq('day_number', Number(dayNumber))
            .lt('week_number', Number(weekNumber))
            .order('week_number', { ascending: false })
            .order('performed_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (priorLog) {
            const map = {}
            for (const set of priorLog.workout_log_sets) {
              if (set.weight_kg == null) continue
              map[set.exercise_id] = map[set.exercise_id] ?? {}
              map[set.exercise_id][set.set_number] = set.weight_kg
            }
            setCarryoverByExercise(map)
          }

          let storedRest = null
          try {
            storedRest = JSON.parse(localStorage.getItem(REST_KEY) || 'null')
          } catch {
            storedRest = null
          }
          const hasProgress = Object.keys(entriesRef.current).length > 0
          setStatus('idle')
          if (hasProgress && storedRest && typeof storedRest.end === 'number' && storedRest.end > Date.now()) {
            // Un repos était en cours (app fermée entre-temps) : on le reprend.
            restFiredRef.current = false
            setRestNext(storedRest.label || '')
            setRestRemaining(Math.max(0, Math.round((storedRest.end - Date.now()) / 1000)))
            setRestEndAt(storedRest.end)
            setPhase('resting')
          } else {
            // Séance déjà commencée (ou pas encore) : on retombe sur la liste
            // des exercices plutôt que d'ouvrir directement la série en cours
            // — l'utilisateur choisit où reprendre.
            if (hasProgress) {
              try {
                localStorage.removeItem(REST_KEY)
              } catch {
                // ignore
              }
            }
            setPhase('list')
          }
          return
        }
      }

      setStatus('idle')
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, weekNumber, dayNumber])

  // Décompte du repos, basé sur l'heure de fin (restEndAt) plutôt qu'un
  // compteur décrémenté : les timers sont gelés en arrière-plan, mais recalculer
  // depuis un timestamp donne toujours la bonne valeur au retour dans l'app.
  useEffect(() => {
    if (phase !== 'resting' || restEndAt == null) return undefined
    function tick() {
      const remaining = Math.max(0, Math.round((restEndAt - Date.now()) / 1000))
      setRestRemaining(remaining)
      if (remaining <= 0) finishRest()
    }
    function onVisible() {
      if (document.visibilityState === 'visible') tick()
    }
    tick()
    const id = setInterval(tick, 500)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, restEndAt])

  // Décompte de l'effort (exercices chronométrés), même logique que le repos.
  useEffect(() => {
    if (phase !== 'effort' || effortEndAt == null) return undefined
    function tick() {
      const remaining = Math.max(0, Math.round((effortEndAt - Date.now()) / 1000))
      setEffortRemaining(remaining)
      if (remaining <= 0) finishEffort()
    }
    function onVisible() {
      if (document.visibilityState === 'visible') tick()
    }
    tick()
    const id = setInterval(tick, 500)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, effortEndAt])

  // Garde l'écran allumé pendant la séance (Wake Lock, si supporté)
  useEffect(() => {
    const active =
      phase === 'exercise' ||
      phase === 'superset' ||
      phase === 'resting' ||
      phase === 'effort' ||
      phase === 'list' ||
      phase === 'block'
    async function acquire() {
      if (!active || !('wakeLock' in navigator)) return
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      } catch {
        wakeLockRef.current = null
      }
    }
    function onVisible() {
      if (document.visibilityState === 'visible') acquire()
    }
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
    }
  }, [phase])

  if (status === 'loading') return null

  if (loadError) {
    return (
      <main>
        <p role="alert">{loadError}</p>
      </main>
    )
  }

  if (!program) {
    return (
      <main>
        <p>Aucun programme actif.</p>
        <Link to="/program">Retour au programme</Link>
      </main>
    )
  }

  if (!day) {
    return (
      <main>
        <p>Séance introuvable.</p>
        <Link to="/program">Retour au programme</Link>
      </main>
    )
  }

  if (programSchedule(program)?.expired) {
    return (
      <main>
        <p>Ce programme est arrivé à échéance et n'est plus disponible.</p>
        <Link to="/program">Retour au programme</Link>
      </main>
    )
  }

  const slotLabel = day.slot === 'morning' ? ' · matin' : day.slot === 'evening' ? ' · soir' : ''
  const totalSets = day.exercises.reduce((sum, exercise) => sum + setCount(exercise), 0)
  const doneSets = day.exercises.reduce((sum, exercise, i) => sum + countCompleted(entries, i, setCount(exercise)), 0)
  const overallPercent = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0

  // Écrit une série en base immédiatement (création du log au besoin).
  async function persistSet(exIdx, setIdx, entry) {
    setSaveState('saving')
    let id = logIdRef.current
    if (!id) {
      const { data, error } = await supabase
        .from('workout_logs')
        .insert({
          user_id: user.id,
          program_id: program.id,
          week_number: Number(weekNumber),
          day_number: Number(dayNumber),
        })
        .select('id')
        .single()
      if (error) {
        setSaveState('error')
        return
      }
      id = data.id
      logIdRef.current = id
    }

    const exercise = day.exercises[exIdx]
    const key = `${exIdx}-${setIdx}`
    const row = {
      workout_log_id: id,
      user_id: user.id,
      exercise_id: exercise.exercise_id,
      set_number: setIdx + 1,
      reps: entry.reps ? Number(entry.reps) : null,
      weight_kg: entry.weight_kg ? Number(entry.weight_kg) : null,
      note: entry.note ? String(entry.note).trim() || null : null,
      metric_kind: entry.metric_kind ?? null,
      metric_value:
        entry.metric_value != null && entry.metric_value !== '' ? Number(entry.metric_value) : null,
      distance_km:
        entry.distance_km != null && entry.distance_km !== '' ? Number(entry.distance_km) : null,
    }

    const existingId = rowIdsRef.current[key]
    if (existingId) {
      const { error } = await supabase.from('workout_log_sets').update(row).eq('id', existingId)
      if (error) {
        setSaveState('error')
        return
      }
    } else {
      const { data, error } = await supabase.from('workout_log_sets').insert(row).select('id').single()
      if (error) {
        setSaveState('error')
        return
      }
      rowIdsRef.current[key] = data.id
    }
    setSaveState('saved')
  }

  function allDone(map) {
    return !day.exercises.some((ex, e) => {
      for (let s = 0; s < setCount(ex); s += 1) if (!map[`${e}-${s}`]) return true
      return false
    })
  }

  // Reprend l'EXERCICE COURANT à sa prochaine série non faite (ne saute jamais
  // vers un autre exercice « dans l'ordre »). Si l'exercice est terminé → liste.
  function resumeCurrentExercise() {
    const exIdx = selectedExRef.current
    const ex = day?.exercises[exIdx]
    if (!ex) {
      setPhase('list')
      return
    }
    if (isSupersetExercise(ex)) {
      const t = nextBlockTarget(entriesRef.current, ex.block_id)
      if (!t) {
        setPhase('list')
        return
      }
      setActiveSetIndex(t.setIdx)
      loadSupersetFieldsFor(day, ex.block_id, t.setIdx)
      setPhase('superset')
      return
    }
    for (let s = 0; s < setCount(ex); s += 1) {
      if (!entriesRef.current[`${exIdx}-${s}`]) {
        setSelectedExerciseIndex(exIdx)
        setActiveSetIndex(s)
        setEditingDoneSet(false)
        loadFieldsFor(day, exIdx, s, { sameExercise: true })
        setPhase('exercise')
        return
      }
    }
    setPhase('list')
  }

  function submitSet(idx) {
    const exercise = day.exercises[selectedExerciseIndex]
    const det = exercisesById[exercise.exercise_id]
    const running = isRunningExercise(det, exercise.reps, day.modality)
    let entry
    if (running) {
      let mk = null
      let mv = null
      if (metricValue !== '') {
        if (metricKind === 'pace') {
          const s = parsePace(metricValue)
          if (s != null) {
            mk = 'pace'
            mv = s
          }
        } else if (Number.isFinite(Number(metricValue))) {
          mk = metricKind
          mv = Number(metricValue)
        }
      }
      // Distance saisie, sinon distance prescrite par l'intervalle (ex. 1000m).
      const ic = intervalCount(exercise.reps)
      const multiInterval = ic && ic.count > 1 && hasDistanceUnit(ic.target)
      let dist = distanceKm !== '' && Number.isFinite(Number(distanceKm)) ? Number(distanceKm) : null
      if (dist == null && multiInterval) dist = distanceKmOf(ic.target)
      entry = { reps: null, weight_kg: '', note, metric_kind: mk, metric_value: mv, distance_km: dist }
    } else {
      entry = {
        reps: parseTargetReps(exercise.reps),
        weight_kg: weight,
        note,
        metric_kind: null,
        metric_value: null,
        distance_km: null,
      }
    }
    const key = `${selectedExerciseIndex}-${idx}`
    const wasDone = Boolean(entriesRef.current[key])
    const updated = { ...entriesRef.current, [key]: entry }
    syncEntries(updated)
    persistSet(selectedExerciseIndex, idx, entry)
    setEditingDoneSet(false)
    setNote('')

    const total = setCount(exercise)
    const exNowDone = countCompleted(updated, selectedExerciseIndex, total) === total

    if (allDone(updated)) {
      setFinalPercent(100)
      setPhase('summary')
      return
    }

    // Édition d'une série déjà validée : pas d'enchaînement ni de repos.
    if (wasDone) {
      if (exNowDone) setPhase('list')
      else resumeCurrentExercise()
      return
    }

    // Exercice terminé → retour à la LISTE (l'utilisateur choisit la suite).
    if (exNowDone) {
      setPhase('list')
      return
    }

    // Série suivante DU MÊME exercice → repos puis reprise du même exercice.
    let nextSet = idx + 1
    for (let s = 0; s < total; s += 1) {
      if (!updated[`${selectedExerciseIndex}-${s}`]) {
        nextSet = s
        break
      }
    }
    const rest = exercise.rest_seconds || 0
    if (rest > 0) {
      startRest(rest, `${det?.name ?? 'Exercice'} · série ${nextSet + 1}`)
      return
    }
    setActiveSetIndex(nextSet)
    loadFieldsFor(day, selectedExerciseIndex, nextSet, { sameExercise: true })
  }

  // Valide en une fois le tour affiché d'un superset/triset : tous les
  // membres sont enregistrés ensemble (les exercices sont affichés côte à
  // côte, un seul bouton pour le tour entier), puis on enchaîne — repos
  // (celui du dernier membre) avant le tour suivant, ou retour à la liste
  // si le bloc est terminé.
  function submitSupersetRound(blockId, roundIdx) {
    const members = blockMembers(day.exercises, blockId)
    const anchorIdx = members[0]?.index
    const wasDone = Boolean(entriesRef.current[`${anchorIdx}-${roundIdx}`])
    const updated = { ...entriesRef.current }
    for (const { exercise: me, index: mi } of members) {
      updated[`${mi}-${roundIdx}`] = {
        reps: parseTargetReps(me.reps),
        weight_kg: supersetWeights[mi] ?? '',
        note: '',
        metric_kind: null,
        metric_value: null,
        distance_km: null,
      }
    }
    syncEntries(updated)
    for (const { index: mi } of members) persistSet(mi, roundIdx, updated[`${mi}-${roundIdx}`])
    setEditingDoneSet(false)

    if (allDone(updated)) {
      setFinalPercent(100)
      setPhase('summary')
      return
    }
    if (wasDone) {
      setPhase('list')
      return
    }
    const nextTarget = nextBlockTarget(updated, blockId)
    if (!nextTarget) {
      setPhase('list')
      return
    }
    const last = members[members.length - 1].exercise
    const rest = last.rest_seconds || 0
    setActiveSetIndex(nextTarget.setIdx)
    if (rest > 0) {
      startRest(rest, `Superset · tour ${nextTarget.setIdx + 1}`)
      return
    }
    loadSupersetFieldsFor(day, blockId, nextTarget.setIdx)
  }

  // Termine un bloc AMRAP/EMOM : enregistre un unique résultat (nombre de
  // tours/rounds complétés) sur le premier exercice du bloc, comme une série
  // classique — c'est ce que setCount()/allDone() attendent pour ce bloc.
  function submitBlock(exIdx, roundsCompleted) {
    const entry = {
      reps: roundsCompleted,
      weight_kg: '',
      note: '',
      metric_kind: null,
      metric_value: null,
      distance_km: null,
    }
    const key = `${exIdx}-0`
    const updated = { ...entriesRef.current, [key]: entry }
    syncEntries(updated)
    persistSet(exIdx, 0, entry)
    if (allDone(updated)) {
      setFinalPercent(100)
      setPhase('summary')
      return
    }
    setPhase('list')
  }

  // Démarre le chrono d'effort d'une série chronométrée.
  function startEffort(seconds, exIdx, setIdx) {
    effortTargetRef.current = { exIdx, setIdx, seconds }
    effortFiredRef.current = false
    unlockAudio()
    setEffortRemaining(seconds)
    setEffortEndAt(Date.now() + seconds * 1000)
    setPhase('effort')
  }

  // Fin de l'effort : enregistre la série (temps d'effort) puis repos ou reprise.
  function finishEffort() {
    if (effortFiredRef.current) return
    effortFiredRef.current = true
    const target = effortTargetRef.current
    setEffortEndAt(null)
    if (!target) {
      resumeCurrentExercise()
      return
    }
    playRestDoneCue()
    const { exIdx, setIdx, seconds } = target
    const entry = {
      reps: null,
      weight_kg: '',
      note: '',
      metric_kind: 'effort_s',
      metric_value: seconds,
      distance_km: null,
    }
    const key = `${exIdx}-${setIdx}`
    const updated = { ...entriesRef.current, [key]: entry }
    syncEntries(updated)
    persistSet(exIdx, setIdx, entry)

    const ex = day.exercises[exIdx]
    const total = setCount(ex)
    const exNowDone = countCompleted(updated, exIdx, total) === total
    if (allDone(updated)) {
      setFinalPercent(100)
      setPhase('summary')
      return
    }
    if (exNowDone) {
      setPhase('list')
      return
    }
    let nextSet = setIdx + 1
    for (let s = 0; s < total; s += 1) {
      if (!updated[`${exIdx}-${s}`]) {
        nextSet = s
        break
      }
    }
    const rest = ex.rest_seconds || 0
    if (rest > 0) {
      const det = exercisesById[ex.exercise_id]
      startRest(rest, `${det?.name ?? 'Exercice'} · série ${nextSet + 1}`)
      return
    }
    resumeCurrentExercise()
  }

  // Débloque l'audio (doit être appelé depuis un geste utilisateur, ex. Valider).
  function unlockAudio() {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (Ctx) audioCtxRef.current = new Ctx()
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
    } catch {
      // audio indisponible
    }
  }

  // Bip sonore + vibration à la fin du repos.
  function playRestDoneCue() {
    try {
      const ctx = audioCtxRef.current
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume()
        const start = ctx.currentTime
        for (const offset of [0, 0.28]) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = 880
          gain.gain.setValueAtTime(0.0001, start + offset)
          gain.gain.exponentialRampToValueAtTime(0.35, start + offset + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.22)
          osc.connect(gain).connect(ctx.destination)
          osc.start(start + offset)
          osc.stop(start + offset + 0.24)
        }
      }
    } catch {
      // ignore
    }
    try {
      navigator.vibrate?.([200, 100, 200])
    } catch {
      // ignore
    }
  }

  // Notification système quand le repos se termine alors que l'app est en fond.
  function notifyRestDone() {
    try {
      if (
        'Notification' in window &&
        Notification.permission === 'granted' &&
        document.visibilityState !== 'visible'
      ) {
        const notif = new Notification('Repos terminé 💪', {
          body: restNext ? `À suivre : ${restNext}` : 'Reprends ta série.',
          tag: 'rouxperf-rest',
        })
        setTimeout(() => notif.close(), 8000)
      }
    } catch {
      // ignore
    }
  }

  function startRest(seconds, label) {
    const end = Date.now() + seconds * 1000
    restFiredRef.current = false
    setRestNext(label)
    setRestRemaining(seconds)
    setRestEndAt(end)
    try {
      localStorage.setItem(REST_KEY, JSON.stringify({ end, label }))
    } catch {
      // ignore
    }
    unlockAudio()
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } catch {
      // ignore
    }
    setPhase('resting')
  }

  function finishRest() {
    if (restFiredRef.current) return
    restFiredRef.current = true
    try {
      localStorage.removeItem(REST_KEY)
    } catch {
      // ignore
    }
    playRestDoneCue()
    notifyRestDone()
    setRestEndAt(null)
    resumeCurrentExercise()
  }

  function skipRest() {
    restFiredRef.current = true
    try {
      localStorage.removeItem(REST_KEY)
    } catch {
      // ignore
    }
    setRestEndAt(null)
    resumeCurrentExercise()
  }

  function quitSession() {
    // Tout est déjà sauvegardé série par série : on peut sortir sans risque.
    navigate('/program')
  }

  // Efface les séries enregistrées d'un exercice (mal rempli).
  async function resetExercise(exIdx) {
    const ex = day.exercises[exIdx]
    if (!ex) return
    if (!window.confirm('Réinitialiser cet exercice ? Les séries déjà enregistrées seront effacées.')) return
    const ids = []
    const nextEntries = { ...entriesRef.current }
    const nextRowIds = { ...rowIdsRef.current }
    for (let s = 0; s < setCount(ex); s += 1) {
      const key = `${exIdx}-${s}`
      if (nextRowIds[key]) ids.push(nextRowIds[key])
      delete nextEntries[key]
      delete nextRowIds[key]
    }
    if (ids.length) await supabase.from('workout_log_sets').delete().in('id', ids)
    rowIdsRef.current = nextRowIds
    syncEntries(nextEntries)
    openExercise(day, exIdx)
  }

  // Efface toute la séance (supprime le log → cascade sur les séries).
  async function resetSession() {
    if (!window.confirm('Réinitialiser toute la séance ? Toutes les séries enregistrées seront effacées.')) return
    const logId = logIdRef.current
    if (logId) await supabase.from('workout_logs').delete().eq('id', logId)
    logIdRef.current = null
    rowIdsRef.current = {}
    syncEntries({})
    setWeight('')
    setNote('')
    setMetricValue('')
    setDistanceKm('')
    try {
      localStorage.removeItem(REST_KEY)
    } catch {
      // ignore
    }
    setPhase('list')
  }

  // Remplace l'exercice partout dans le programme et persiste. Les séries déjà
  // loggées de l'ancien exercice dans cette séance sont effacées (ne comptent
  // pas pour le nouvel exercice).
  async function swapExercise(newId) {
    const exIdx = selectedExerciseIndex
    const oldEx = day.exercises[exIdx]
    const oldId = oldEx?.exercise_id
    if (!oldId || !program?.structure) return
    setSwapping(true)

    // 1. Efface les logs de cet exercice dans la séance courante + l'état local.
    const ids = []
    const nextEntries = { ...entriesRef.current }
    const nextRowIds = { ...rowIdsRef.current }
    for (let s = 0; s < setCount(oldEx); s += 1) {
      const key = `${exIdx}-${s}`
      if (nextRowIds[key]) ids.push(nextRowIds[key])
      delete nextEntries[key]
      delete nextRowIds[key]
    }
    if (ids.length) await supabase.from('workout_log_sets').delete().in('id', ids)
    rowIdsRef.current = nextRowIds
    syncEntries(nextEntries)

    // 2. Remplace l'exercice partout dans le programme et persiste.
    const next = JSON.parse(JSON.stringify(program.structure))
    for (const wk of next.weeks) {
      for (const d of wk.days) {
        for (const ex of d.exercises) {
          if (ex.exercise_id === oldId) ex.exercise_id = newId
        }
      }
    }
    const { error } = await supabase.from('user_programs').update({ structure: next }).eq('id', program.id)
    setSwapping(false)
    if (error) return
    setProgram((p) => ({ ...p, structure: next }))
    // 3. Rouvre l'exercice à neuf (première série vide).
    setActiveSetIndex(0)
    setEditingDoneSet(false)
    setWeight('')
    setNote('')
    setMetricValue('')
    setDistanceKm('')
  }

  // ---- Écran : résumé ----
  if (phase === 'summary') {
    return (
      <main className="session-run">
        <div className="card session-complete">
          <p className="eyebrow">{overallPercent === 100 ? 'Séance validée' : 'Séance enregistrée'}</p>
          <span className="completion-percent">{overallPercent}%</span>
          <h1>
            {day.name}
            {slotLabel}
          </h1>
          <p>
            {doneSets} / {totalSets} séries réalisées
          </p>
        </div>

        <div className="card session-summary">
          {groupDayExercises(day.exercises).map((item) => {
            const i = item.index
            const ex = day.exercises[i]
            const det = exercisesById[ex.exercise_id]

            if (item.type === 'block' && isSupersetExercise(ex)) {
              return (
                <div key={i} className="session-summary-exo session-summary-block">
                  <span className="session-block-tag">{intensificationLabel(ex)}</span>
                  <div className="session-summary-exo-head">
                    <strong>{blockLabel(ex, item.members)}</strong>
                  </div>
                  {item.members.map(({ exercise: me, index: mi }) => {
                    const mDet = exercisesById[me.exercise_id]
                    const mTotal = setCount(me)
                    const mDone = countCompleted(entries, mi, mTotal)
                    return (
                      <div key={mi} className="session-summary-block-member">
                        <p className="eyebrow">
                          {mDet?.name ?? 'Exercice'} — {mDone}/{mTotal} séries
                        </p>
                        <ul className="session-summary-sets">
                          {Array.from({ length: mTotal }).map((_, s) => {
                            const e = entries[`${mi}-${s}`]
                            return (
                              <li key={s} className={e ? 'session-summary-set' : 'session-summary-set session-summary-skipped'}>
                                <span className="session-summary-set-n">{s + 1}</span>
                                {e ? (
                                  <span>{setSummary(e, me, isRunningExercise(mDet, me.reps, day.modality))}</span>
                                ) : (
                                  <span>non réalisée</span>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )
            }

            const total = setCount(ex)
            const doneCount = countCompleted(entries, i, total)
            const label = item.type === 'block' ? blockLabel(ex) : (det?.name ?? 'Exercice')
            return (
              <div key={i} className="session-summary-exo">
                {isWarmupExercise(ex) && <span className="session-block-tag">🔸 Échauffement</span>}
                <div className="session-summary-exo-head">
                  <strong>{label}</strong>
                  <span className={`eyebrow${doneCount === total ? ' session-summary-done' : ''}`}>
                    {doneCount}/{total}{item.type === 'block' ? '' : ' séries'}
                  </span>
                </div>
                {item.type === 'block' && (
                  <p className="eyebrow">
                    {item.members.map(({ exercise: e }) => exercisesById[e.exercise_id]?.name ?? 'Exercice').join(' · ')}
                  </p>
                )}
                <ul className="session-summary-sets">
                  {Array.from({ length: total }).map((_, s) => {
                    const e = entries[`${i}-${s}`]
                    return (
                      <li key={s} className={e ? 'session-summary-set' : 'session-summary-set session-summary-skipped'}>
                        <span className="session-summary-set-n">{s + 1}</span>
                        {e ? (
                          <span>{setSummary(e, ex, isRunningExercise(det, ex.reps, day.modality))}</span>
                        ) : (
                          <span>non réalisée</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>

        <Link to="/program" className="btn-primary session-finish-btn">
          Retour au programme
        </Link>
        <div className="bottom-nav-spacer" />
      </main>
    )
  }

  // ---- Écran : repos (guidé) ----
  if (phase === 'resting') {
    return (
      <main className="session-run">
        <div className="card rest-timer">
          <p className="eyebrow">Repos</p>
          <span className="rest-countdown">{fmtCountdown(restRemaining)}</span>
          <p>À suivre : {restNext}</p>
          <button type="button" className="btn-secondary" onClick={skipRest}>
            Passer le repos
          </button>
        </div>
      </main>
    )
  }

  // ---- Écran : effort chronométré ----
  if (phase === 'effort') {
    return (
      <main className="session-run">
        <div className="card rest-timer">
          <p className="eyebrow">Effort en cours</p>
          <span className="rest-countdown">{fmtCountdown(effortRemaining)}</span>
          <p>Donne tout jusqu'au bip.</p>
          <button type="button" className="btn-secondary" onClick={finishEffort}>
            Terminer l'effort
          </button>
        </div>
      </main>
    )
  }

  // ---- Écran : superset/triset (exercices affichés ensemble) ----
  if (phase === 'superset') {
    if (selectedExerciseIndex == null || !day.exercises[selectedExerciseIndex]) return null
    const anchor = day.exercises[selectedExerciseIndex]
    const members = blockMembers(day.exercises, anchor.block_id)
    const totalRounds = Math.max(1, ...members.map((m) => setCount(m.exercise)))
    const roundIdx = activeSetIndex
    const roundDone = members.every(({ index: mi }) => Boolean(entries[`${mi}-${roundIdx}`]))
    const last = members[members.length - 1]?.exercise
    const restLabel = restLabelFor(last?.rest_seconds)

    function tapRound(r) {
      setActiveSetIndex(r)
      setEditingDoneSet(false)
      loadSupersetFieldsFor(day, anchor.block_id, r)
    }

    function onSupersetSubmit(e) {
      e.preventDefault()
      submitSupersetRound(anchor.block_id, roundIdx)
    }

    return (
      <main className="session-run">
        <div className="session-runner-header">
          <button type="button" className="link-button" onClick={() => setPhase('list')}>
            ‹ Exercices
          </button>
          <span className="eyebrow session-save-state">
            {saveState === 'saving' ? 'Enregistrement…' : saveState === 'saved' ? 'Enregistré ✓' : saveState === 'error' ? '⚠ non enregistré' : `${overallPercent}%`}
          </span>
        </div>

        <div className="week-progress-bar session-run-bar">
          <div className="week-progress-fill" style={{ width: `${overallPercent}%` }} />
        </div>

        <div className="card session-exo-card">
          <p className="eyebrow">
            {intensificationLabel(anchor)} · tour {roundIdx + 1}/{totalRounds} · repos {restLabel}
          </p>

          <div className="set-chips" role="tablist" aria-label="Tours">
            {Array.from({ length: totalRounds }).map((_, r) => {
              const isDone = members.every(({ index: mi }) => Boolean(entries[`${mi}-${r}`]))
              const isActive = r === roundIdx
              return (
                <button
                  key={r}
                  type="button"
                  className={`set-chip${isDone ? ' set-chip-done' : ''}${isActive ? ' set-chip-active' : ''}`}
                  onClick={() => tapRound(r)}
                  aria-label={`Tour ${r + 1}${isDone ? ', complété' : ''}`}
                >
                  {isDone ? <Icon name="check" size={14} /> : r + 1}
                </button>
              )
            })}
          </div>

          <form className="superset-round" onSubmit={onSupersetSubmit}>
            <div className="superset-members">
              {members.map(({ exercise: me, index: mi }) => {
                const mDet = exercisesById[me.exercise_id]
                const mMedia = mediaForSlug(mDet?.illustration_slug)
                return (
                  <div key={mi} className="superset-member">
                    <h3 className="session-exo-name">{mDet?.name ?? 'Exercice'}</h3>
                    <p className="eyebrow">objectif {me.reps} reps</p>

                    {mDet?.musclewiki_videos ? (
                      <div className="session-exo-media">
                        <ExerciseVideo videos={mDet.musclewiki_videos} label={mDet?.name ?? 'Exercice'} />
                      </div>
                    ) : (
                      mMedia && (
                        <div className="session-exo-media">
                          <ExerciseLoop media={mMedia} label={mDet?.name ?? 'Exercice'} />
                          <ExerciseAttribution media={mMedia} />
                        </div>
                      )
                    )}

                    <label htmlFor={`superset-weight-${mi}`}>Poids (kg)</label>
                    <input
                      id={`superset-weight-${mi}`}
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      value={supersetWeights[mi] ?? ''}
                      onChange={(e) => setSupersetWeights((w) => ({ ...w, [mi]: e.target.value }))}
                      autoComplete="off"
                    />

                    {me.notes && <p className="session-exo-coach-note">💬 {me.notes}</p>}

                    {mDet?.instructions && (
                      <details className="session-exo-instructions">
                        <summary>Consignes</summary>
                        <p>{mDet.instructions}</p>
                      </details>
                    )}
                  </div>
                )
              })}
            </div>

            <button type="submit" className="btn-primary">
              {roundDone ? `Mettre à jour le tour ${roundIdx + 1}` : `Valider la série ${roundIdx + 1}`}
            </button>
          </form>

          {roundDone && (
            <button
              type="button"
              className="link-button session-reset-link"
              onClick={() => setPhase('list')}
            >
              Retour aux exercices
            </button>
          )}
        </div>
      </main>
    )
  }

  // ---- Écran : bloc de conditionnement (AMRAP/EMOM) ----
  if (phase === 'block') {
    if (selectedExerciseIndex == null || !day.exercises[selectedExerciseIndex]) return null
    const first = day.exercises[selectedExerciseIndex]
    const members = day.exercises
      .filter((e) => e.block_id === first.block_id)
      .map((e) => ({ name: exercisesById[e.exercise_id]?.name ?? 'Exercice', reps: e.reps }))
    const blockDone = Boolean(entries[`${selectedExerciseIndex}-0`])
    return (
      <main className="session-run">
        <div className="session-runner-header">
          <button type="button" className="link-button" onClick={() => setPhase('list')}>
            ‹ Exercices
          </button>
          <span className="eyebrow">{overallPercent}%</span>
        </div>
        <p className="session-block-intro">
          <span className="session-block-tag">🔥 Finisher</span> — dernière partie de la séance
        </p>
        <BlockRunner
          format={first.block_format}
          timeCapSeconds={first.block_time_cap_seconds}
          intervalSeconds={first.block_interval_seconds}
          rounds={first.block_rounds}
          members={members}
          explainer={blockExplainer(first)}
          storageKey={`rouxperf-block-${weekNumber}-${dayNumber}-${first.block_id}`}
          onCancel={() => setPhase('list')}
          onComplete={(rounds) => submitBlock(selectedExerciseIndex, rounds)}
        />
        {blockDone && (
          <button
            type="button"
            className="link-button session-reset-link"
            onClick={() => resetExercise(selectedExerciseIndex)}
          >
            Réinitialiser ce bloc
          </button>
        )}
      </main>
    )
  }

  // ---- Écran : liste (libre) ----
  if (phase === 'list') {
    return (
      <main className="session-run">
        <div className="session-runner-header">
          <button type="button" className="link-button" onClick={quitSession}>
            × Quitter
          </button>
          <span className="eyebrow">
            {day.name}
            {slotLabel}
          </span>
        </div>

        <div className="session-hub-progress">
          <span className="completion-percent">{overallPercent}%</span>
          <div className="week-progress-bar">
            <div className="week-progress-fill" style={{ width: `${overallPercent}%` }} />
          </div>
          <p className="eyebrow week-progress-label">
            {doneSets} / {totalSets} séries complétées
          </p>
        </div>

        <p className="session-list-hint">Lance la séance, ou choisis directement un exercice.</p>

        <div className="session-exercise-list">
          {groupDayExercises(day.exercises).map((item) => {
            const i = item.index
            const exercise = day.exercises[i]
            const total = setCount(exercise)
            const completed = countCompleted(entries, i, total)
            const done = completed === total
            if (item.type === 'block' && isSupersetExercise(exercise)) {
              const blockTotal = item.members.reduce((sum, m) => sum + setCount(m.exercise), 0)
              const blockDone = item.members.reduce((sum, m) => sum + countCompleted(entries, m.index, setCount(m.exercise)), 0)
              return (
                <button
                  key={i}
                  type="button"
                  className="session-exercise-card session-exercise-card-block"
                  onClick={() => openExercise(day, i)}
                >
                  <span className={`session-status-badge${blockDone === blockTotal ? ' session-status-done' : ''}`}>
                    <Icon name={blockDone === blockTotal ? 'check' : 'bolt'} size={16} />
                  </span>
                  <span className="session-exercise-info">
                    <span className="session-block-tag">{intensificationLabel(exercise)}</span>
                    <strong>{blockLabel(exercise, item.members)}</strong>
                    <span className="eyebrow">
                      {item.members.map(({ exercise: e }) => exercisesById[e.exercise_id]?.name ?? 'Exercice').join(' · ')}
                    </span>
                    <span className="eyebrow">{blockDone} / {blockTotal} séries</span>
                  </span>
                  <span className="session-exercise-chevron">›</span>
                </button>
              )
            }
            if (item.type === 'block') {
              return (
                <button
                  key={i}
                  type="button"
                  className="session-exercise-card session-exercise-card-block"
                  onClick={() => openExercise(day, i)}
                >
                  <span className={`session-status-badge${done ? ' session-status-done' : ''}`}>
                    <Icon name={done ? 'check' : 'bolt'} size={16} />
                  </span>
                  <span className="session-exercise-info">
                    <span className="session-block-tag">🔥 Finisher</span>
                    <strong>{blockLabel(exercise)}</strong>
                    <span className="eyebrow">
                      {item.members.map(({ exercise: e }) => exercisesById[e.exercise_id]?.name ?? 'Exercice').join(' · ')}
                    </span>
                  </span>
                  <span className="session-exercise-chevron">›</span>
                </button>
              )
            }
            const details = exercisesById[exercise.exercise_id]
            return (
              <button
                key={i}
                type="button"
                className="session-exercise-card"
                onClick={() => openExercise(day, i)}
              >
                <span className={`session-status-badge${done ? ' session-status-done' : ''}`}>
                  <Icon name={done ? 'check' : 'bolt'} size={16} />
                </span>
                <span className="session-exercise-info">
                  {isWarmupExercise(exercise) && <span className="session-block-tag">🔸 Échauffement</span>}
                  <strong>{details?.name ?? 'Exercice'}</strong>
                  <span className="eyebrow">
                    {completed} / {total} séries
                  </span>
                </span>
                <span className="session-exercise-chevron">›</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="btn-primary session-finish-btn"
          onClick={() => (overallPercent === 100 ? setPhase('summary') : openCurrent())}
        >
          {overallPercent === 100 ? 'Voir le résumé' : doneSets > 0 ? 'Reprendre la séance' : 'Commencer'}
        </button>
        {doneSets > 0 && overallPercent < 100 && (
          <button
            type="button"
            className="btn-secondary session-finish-btn"
            onClick={() => {
              setFinalPercent(overallPercent)
              setPhase('summary')
            }}
          >
            Terminer la séance ({overallPercent}%)
          </button>
        )}
        {doneSets > 0 && (
          <button type="button" className="link-button session-reset-link" onClick={resetSession}>
            Réinitialiser la séance
          </button>
        )}
      </main>
    )
  }

  // ---- Écran : exercice (compact) ----
  if (selectedExerciseIndex == null || !day.exercises[selectedExerciseIndex]) return null
  const exercise = day.exercises[selectedExerciseIndex]
  const details = exercisesById[exercise.exercise_id]
  const media = mediaForSlug(details?.illustration_slug)
  const total = setCount(exercise)
  const completed = countCompleted(entries, selectedExerciseIndex, total)
  const exerciseDone = completed === total
  const fillIdx = activeSetIndex
  const fillEntry = entries[`${selectedExerciseIndex}-${fillIdx}`]
  const showContinue = exerciseDone && !editingDoneSet
  const restLabel = restLabelFor(exercise.rest_seconds)
  const running = isRunningExercise(details, exercise.reps, day.modality)
  const ic = intervalCount(exercise.reps)
  // Cible d'une série : la distance/durée d'UN intervalle si "Nx…".
  const targetLabel = running && ic && ic.count > 1 ? ic.target : exercise.reps
  // Chrono d'effort : uniquement pour un exercice chronométré NON course
  // (gainage, tenue…). La course se log toujours (distance/allure).
  const timeSeconds = repsSeconds(exercise.reps)
  const isTimeBased = timeSeconds != null && !running
  // On masque le champ distance seulement pour un intervalle multiple à distance
  // fixe (ex. 5×1000 m) ; une sortie longue garde le champ pour saisir le réel.
  const isMultiIntervalDist = running && ic && ic.count > 1 && hasDistanceUnit(ic.target)
  const showDistanceField = running && !isMultiIntervalDist

  function tapSet(i) {
    setActiveSetIndex(i)
    setEditingDoneSet(Boolean(entries[`${selectedExerciseIndex}-${i}`]))
    loadFieldsFor(day, selectedExerciseIndex, i, { sameExercise: true })
  }

  function onPrimary(e) {
    e.preventDefault()
    if (showContinue) {
      setPhase('list')
      return
    }
    submitSet(fillIdx)
  }

  return (
    <main className="session-run">
      <div className="session-runner-header">
        <button type="button" className="link-button" onClick={() => setPhase('list')}>
          ‹ Exercices
        </button>
        <span className="eyebrow session-save-state">
          {saveState === 'saving' ? 'Enregistrement…' : saveState === 'saved' ? 'Enregistré ✓' : saveState === 'error' ? '⚠ non enregistré' : `${overallPercent}%`}
        </span>
      </div>

      <div className="week-progress-bar session-run-bar">
        <div className="week-progress-fill" style={{ width: `${overallPercent}%` }} />
      </div>

      <div className="card session-exo-card">
        <p className="eyebrow">
          Exercice {selectedExerciseIndex + 1}/{day.exercises.length} · {completed}/{total} séries
        </p>
        {isWarmupExercise(exercise) && <span className="session-block-tag">🔸 Échauffement</span>}
        <h2 className="session-exo-name">{details?.name ?? 'Exercice'}</h2>

        {exercise.notes && <p className="session-exo-coach-note">💬 {exercise.notes}</p>}

        {details?.musclewiki_videos ? (
          <div className="session-exo-media">
            <ExerciseVideo videos={details.musclewiki_videos} label={details?.name ?? 'Exercice'} />
          </div>
        ) : (
          media && (
            <div className="session-exo-media">
              <ExerciseLoop media={media} label={details?.name ?? 'Exercice'} />
              <ExerciseAttribution media={media} />
            </div>
          )
        )}

        <div className="set-chips" role="tablist" aria-label="Séries">
          {Array.from({ length: total }).map((_, i) => {
            const isDone = Boolean(entries[`${selectedExerciseIndex}-${i}`])
            const isActive = i === fillIdx
            return (
              <button
                key={i}
                type="button"
                className={`set-chip${isDone ? ' set-chip-done' : ''}${isActive ? ' set-chip-active' : ''}`}
                onClick={() => tapSet(i)}
                aria-label={`Série ${i + 1}${isDone ? ', complétée' : ''}`}
              >
                {isDone ? <Icon name="check" size={14} /> : i + 1}
              </button>
            )
          })}
        </div>

        {showContinue ? (
          <div className="set-fill">
            <p className="set-fill-done">Exercice terminé.</p>
            <div className="set-fill-actions">
              <button type="button" className="btn-primary" onClick={() => setPhase('list')}>
                Retour aux exercices
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setFinalPercent(overallPercent)
                  setPhase('summary')
                }}
              >
                Terminer la séance
              </button>
            </div>
          </div>
        ) : isTimeBased ? (
          <div className="set-fill">
            <p className="set-fill-target">
              Série {fillIdx + 1} · effort <strong>{exercise.reps}</strong> · repos {restLabel}
            </p>
            {fillEntry && <p className="set-fill-done">Série {fillIdx + 1} déjà faite ✓</p>}
            <button
              type="button"
              className="btn-primary"
              onClick={() => startEffort(timeSeconds, selectedExerciseIndex, fillIdx)}
            >
              {fillEntry ? `Refaire la série ${fillIdx + 1}` : `Commencer la série ${fillIdx + 1}`}
            </button>
          </div>
        ) : (
          <form className="set-fill" onSubmit={onPrimary}>
            <p className="set-fill-target">
              Série {fillIdx + 1} · objectif <strong>{targetLabel}</strong>
              {running ? '' : ' reps'} · repos {restLabel}
            </p>

            {running ? (
              <div className="cardio-metric">
                {showDistanceField && (
                  <>
                    <label htmlFor="distance-km">Distance (km) — optionnel</label>
                    <input
                      id="distance-km"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(e.target.value)}
                      autoComplete="off"
                      placeholder="ex. 12.5"
                    />
                  </>
                )}

                <div className="chart-metric-switch" role="group" aria-label="Type de mesure">
                  {[
                    ['pace', 'Allure'],
                    ['speed', 'Vitesse'],
                    ['time', 'Temps'],
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      className={`chart-metric-btn${metricKind === k ? ' is-active' : ''}`}
                      aria-pressed={metricKind === k}
                      onClick={() => {
                        setMetricValue('')
                        setMetricKind(k)
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label htmlFor="metric-value">
                  {metricKind === 'pace'
                    ? 'Allure (min/km, ex. 5:30)'
                    : metricKind === 'speed'
                      ? 'Vitesse (km/h)'
                      : 'Temps (min)'}{' '}
                  — optionnel
                </label>
                <input
                  id="metric-value"
                  type={metricKind === 'pace' ? 'text' : 'number'}
                  inputMode={metricKind === 'pace' ? 'text' : 'decimal'}
                  step={metricKind === 'pace' ? undefined : '0.1'}
                  value={metricValue}
                  onChange={(e) => setMetricValue(e.target.value)}
                  autoComplete="off"
                  placeholder={metricKind === 'pace' ? '5:30' : ''}
                />
              </div>
            ) : (
              <>
                <label htmlFor="weight">Poids (kg)</label>
                <input
                  id="weight"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  autoComplete="off"
                />
              </>
            )}

            <label htmlFor="set-note">Note / appréciation (optionnel)</label>
            <input
              id="set-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex. bien senti, un peu lourd, gêne au genou…"
              autoComplete="off"
            />

            <button type="submit" className="btn-primary">
              {fillEntry ? `Mettre à jour la série ${fillIdx + 1}` : `Valider la série ${fillIdx + 1}`}
            </button>
          </form>
        )}

        {details?.instructions && (
          <details className="session-exo-instructions">
            <summary>Consignes</summary>
            <p>{details.instructions}</p>
          </details>
        )}

        <ExerciseAlternatives
          exercisesById={exercisesById}
          details={details}
          equipmentAccess={equipmentAccess}
          swapping={swapping}
          onSwap={swapExercise}
          label="↔ Cet exercice ne me convient pas — alternatives"
          triggerClassName="session-alt-toggle"
        />

        {completed > 0 && (
          <button
            type="button"
            className="link-button session-reset-link"
            onClick={() => resetExercise(selectedExerciseIndex)}
          >
            Réinitialiser cet exercice
          </button>
        )}
      </div>
    </main>
  )
}
