export function isBlockExercise(exercise) {
  return Boolean(exercise?.block_id) && (exercise.block_format === 'amrap' || exercise.block_format === 'emom')
}

export function isWarmupExercise(exercise) {
  return exercise?.block_format === 'warmup'
}

export function isIntensificationExercise(exercise) {
  return exercise?.block_format === 'superset' || exercise?.block_format === 'triset'
}

export function intensificationLabel(exercise) {
  if (exercise?.block_format === 'superset') return '⚡ Superset'
  if (exercise?.block_format === 'triset') return '⚡ Triset'
  return ''
}

// Noms des autres exercices partageant le même block_id (superset/triset),
// pour afficher "avec : Rowing barre" à côté de l'exercice en cours.
export function blockPartnerNames(exercisesById, dayExercises, exercise) {
  if (!exercise?.block_id) return []
  return dayExercises
    .filter((e) => e.block_id === exercise.block_id && e !== exercise)
    .map((e) => exercisesById[e.exercise_id]?.name)
    .filter(Boolean)
}

// Regroupe les exercices d'une séance en éléments affichables : un exercice
// classique — et un mouvement d'échauffement, suivi individuellement, voir
// isWarmupExercise — reste un élément seul ; seuls les exercices consécutifs
// d'un même bloc AMRAP/EMOM (isBlockExercise) sont regroupés en un élément
// "block" avec un total combiné (ils sont comptés comme UNE seule série,
// contrairement à l'échauffement qui garde ses vraies séries/répétitions).
export function groupDayExercises(exercises) {
  const items = []
  const seen = new Set()
  exercises.forEach((exercise, index) => {
    if (isBlockExercise(exercise)) {
      if (seen.has(exercise.block_id)) return
      seen.add(exercise.block_id)
      const members = exercises
        .map((e, idx) => ({ exercise: e, index: idx }))
        .filter(({ exercise: e }) => e.block_id === exercise.block_id)
      items.push({ type: 'block', index, members })
    } else {
      items.push({ type: 'exercise', index })
    }
  })
  return items
}

export function firstIndexOfBlock(exercises, blockId) {
  return exercises.findIndex((e) => e.block_id === blockId)
}

// Libellé court affiché sur la carte d'un bloc ("AMRAP · 12 min", "EMOM · 10 × 60s").
export function blockLabel(exercise) {
  if (exercise.block_format === 'amrap') {
    const min = Math.round((exercise.block_time_cap_seconds || 0) / 60)
    return `AMRAP · ${min} min`
  }
  if (exercise.block_format === 'emom') {
    return `EMOM · ${exercise.block_rounds || 0} × ${exercise.block_interval_seconds || 0}s`
  }
  return ''
}

// Explication en clair du principe du bloc, pour un utilisateur qui ne
// connaît pas le vocabulaire CrossFit (AMRAP/EMOM).
export function blockExplainer(exercise) {
  if (exercise.block_format === 'amrap') {
    return 'Enchaîne ces mouvements en boucle, sans repos entre eux, et note le nombre de tours complétés avant la fin du temps imparti.'
  }
  if (exercise.block_format === 'emom') {
    return 'À chaque nouvelle minute, réalise ces mouvements puis récupère sur le temps restant de la minute.'
  }
  return ''
}
