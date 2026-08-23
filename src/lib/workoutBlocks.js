// AMRAP/EMOM : bloc chronométré, suivi comme UNE seule "série" combinée (le
// nombre de tours), piloté par le minuteur interactif BlockRunner.
export function isTimedBlockExercise(exercise) {
  return Boolean(exercise?.block_id) && (exercise.block_format === 'amrap' || exercise.block_format === 'emom')
}

// Rétro-compatibilité : ancien nom, encore utilisé pour le routage vers BlockRunner.
export const isBlockExercise = isTimedBlockExercise

export function isWarmupExercise(exercise) {
  return exercise?.block_format === 'warmup'
}

// Superset/triset : mouvements réellement enchaînés (pas de repos entre eux,
// repos après le tour complet) mais CHAQUE exercice garde ses vraies
// séries/répétitions, suivies individuellement — contrairement à l'AMRAP/EMOM.
export function isSupersetExercise(exercise) {
  return Boolean(exercise?.block_id) && (exercise.block_format === 'superset' || exercise.block_format === 'triset')
}

export function intensificationLabel(exercise) {
  if (exercise?.block_format === 'superset') return '⚡ Superset'
  if (exercise?.block_format === 'triset') return '⚡ Triset'
  return ''
}

// Les membres (exercice + index dans la séance) d'un même block_id, dans l'ordre.
export function blockMembers(exercises, blockId) {
  return exercises
    .map((e, idx) => ({ exercise: e, index: idx }))
    .filter(({ exercise: e }) => e.block_id === blockId)
}

// Regroupe les exercices d'une séance en éléments affichables : un exercice
// classique reste un élément seul ; les exercices consécutifs partageant un
// block_id (AMRAP/EMOM chronométré, ou superset/triset enchaîné) sont
// regroupés en un seul élément "block", façon carte WOD — qu'ils soient
// suivis comme une série combinée (AMRAP/EMOM) ou comme de vraies séries
// individuelles enchaînées (superset/triset, voir isSupersetExercise).
export function groupDayExercises(exercises) {
  const items = []
  const seen = new Set()
  exercises.forEach((exercise, index) => {
    if (exercise?.block_id) {
      if (seen.has(exercise.block_id)) return
      seen.add(exercise.block_id)
      const members = blockMembers(exercises, exercise.block_id)
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

// Libellé court affiché sur la carte d'un bloc ("AMRAP · 12 min", "EMOM · 10 × 60s",
// "Superset · 4 tours"). Pour superset/triset, `members` (via blockMembers) sert
// à calculer le nombre de tours (le plus grand nombre de séries parmi les membres).
export function blockLabel(exercise, members) {
  if (exercise.block_format === 'amrap') {
    const min = Math.round((exercise.block_time_cap_seconds || 0) / 60)
    return `AMRAP · ${min} min`
  }
  if (exercise.block_format === 'emom') {
    return `EMOM · ${exercise.block_rounds || 0} × ${exercise.block_interval_seconds || 0}s`
  }
  if (exercise.block_format === 'superset' || exercise.block_format === 'triset') {
    const name = exercise.block_format === 'triset' ? 'Triset' : 'Superset'
    const rounds = Math.max(1, ...(members || [{ exercise }]).map((m) => Number(m?.exercise?.sets) || 0))
    return `${name} · ${rounds} tours`
  }
  return ''
}

// Explication en clair du principe du bloc, pour un utilisateur qui ne
// connaît pas le vocabulaire CrossFit (AMRAP/EMOM) ni de musculation (superset/triset).
export function blockExplainer(exercise) {
  if (exercise.block_format === 'amrap') {
    return 'Enchaîne ces mouvements en boucle, sans repos entre eux, et note le nombre de tours complétés avant la fin du temps imparti.'
  }
  if (exercise.block_format === 'emom') {
    return 'À chaque nouvelle minute, réalise ces mouvements puis récupère sur le temps restant de la minute.'
  }
  if (exercise.block_format === 'superset' || exercise.block_format === 'triset') {
    return 'Enchaîne ces mouvements sans repos entre eux, puis récupère une fois le tour complet terminé. Répète pour chaque tour.'
  }
  return ''
}
