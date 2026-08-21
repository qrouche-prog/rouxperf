// Regroupe les exercices d'une séance en éléments affichables : un exercice
// classique reste un élément seul, les exercices consécutifs qui partagent un
// même block_id (bloc AMRAP/EMOM) sont regroupés en un seul élément "block".
export function groupDayExercises(exercises) {
  const items = []
  const seen = new Set()
  exercises.forEach((exercise, index) => {
    if (exercise.block_id) {
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

export function isBlockExercise(exercise) {
  return Boolean(exercise?.block_id) && (exercise.block_format === 'amrap' || exercise.block_format === 'emom')
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
