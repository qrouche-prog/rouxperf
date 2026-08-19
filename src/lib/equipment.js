export const EQUIPMENT_TIERS = {
  bodyweight: ['bodyweight'],
  home_dumbbells: ['bodyweight', 'dumbbell'],
  home_full_gym: ['bodyweight', 'dumbbell', 'barbell', 'bench', 'pull_up_bar', 'kettlebell'],
  commercial_gym: ['bodyweight', 'dumbbell', 'barbell', 'bench', 'pull_up_bar', 'kettlebell', 'cable_machine', 'machine'],
}

export function allowedEquipment(access) {
  return EQUIPMENT_TIERS[access] ?? EQUIPMENT_TIERS.bodyweight
}

// Exercices de remplacement vraiment similaires : même groupe musculaire ET
// même catégorie (pas juste priorisé), compatibles avec le matériel. `limit`
// borne le nombre de suggestions (accès Premium limité, ou aperçu gratuit
// à 1 pour les non-abonnés — cf. ExerciseAlternatives.jsx).
export function alternativesFor(exercisesById, det, access, limit = 3) {
  if (!det) return []
  const allowed = allowedEquipment(access)
  const list = Object.values(exercisesById).filter(
    (c) =>
      c.id !== det.id &&
      c.muscle_group === det.muscle_group &&
      c.category === det.category &&
      !c.is_ai_generated &&
      (c.equipment_required ?? []).every((e) => allowed.includes(e))
  )
  list.sort((a, b) => a.name.localeCompare(b.name))
  return list.slice(0, limit)
}
