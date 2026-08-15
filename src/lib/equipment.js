export const EQUIPMENT_TIERS = {
  bodyweight: ['bodyweight'],
  home_dumbbells: ['bodyweight', 'dumbbell'],
  home_full_gym: ['bodyweight', 'dumbbell', 'barbell', 'bench', 'pull_up_bar', 'kettlebell'],
  commercial_gym: ['bodyweight', 'dumbbell', 'barbell', 'bench', 'pull_up_bar', 'kettlebell', 'cable_machine', 'machine'],
}

export function allowedEquipment(access) {
  return EQUIPMENT_TIERS[access] ?? EQUIPMENT_TIERS.bodyweight
}

// Exercices de remplacement « du même style » : même groupe musculaire,
// compatibles avec le matériel, même catégorie en priorité.
export function alternativesFor(exercisesById, det, access) {
  if (!det) return []
  const allowed = allowedEquipment(access)
  const list = Object.values(exercisesById).filter(
    (c) =>
      c.id !== det.id &&
      c.muscle_group === det.muscle_group &&
      !c.is_ai_generated &&
      (c.equipment_required ?? []).every((e) => allowed.includes(e))
  )
  list.sort((a, b) => Number(b.category === det.category) - Number(a.category === det.category))
  return list.slice(0, 15)
}
