// Calcul déterministe des cibles de macros à partir du profil.
// Volontairement simple et transparent (pas d'IA) : BMR Mifflin-St Jeor,
// facteur d'activité déduit du nombre de séances/semaine, puis ajustement
// calorique selon l'objectif. Sert de repère indicatif, pas d'avis diététique.

function ageFrom(birthDate) {
  if (!birthDate) return null
  const b = new Date(birthDate)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1
  return age
}

// Mifflin-St Jeor. Pour 'other', moyenne des deux formules.
function basalMetabolicRate({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  if (sex === 'male') return base + 5
  if (sex === 'female') return base - 161
  return base - 78 // moyenne de +5 et -161
}

function activityFactor(sessionsPerWeek) {
  if (sessionsPerWeek >= 6) return 1.725
  if (sessionsPerWeek >= 4) return 1.55
  if (sessionsPerWeek >= 2) return 1.45
  return 1.3
}

// Ajustement calorique (fraction du TDEE) et protéines (g/kg) par objectif.
const GOAL_TUNING = {
  weight_loss: { kcal: -0.2, proteinPerKg: 2.0 },
  muscle_gain: { kcal: 0.1, proteinPerKg: 2.0 },
  recomposition: { kcal: -0.05, proteinPerKg: 2.0 },
  hybrid: { kcal: 0, proteinPerKg: 1.8 },
  strength: { kcal: 0.05, proteinPerKg: 1.8 },
  endurance: { kcal: 0, proteinPerKg: 1.6 },
  general_fitness: { kcal: 0, proteinPerKg: 1.6 },
}

// sessionsPerWeek : nombre de séances hebdo (sert de proxy d'activité).
export function sessionsPerWeekFrom(trainingProfile) {
  if (!trainingProfile) return 3
  const prefs = trainingProfile.focus_area_preferences
  if (prefs && typeof prefs === 'object') {
    let total = 0
    for (const value of Object.values(prefs)) {
      const f = Number(value?.frequency)
      if (Number.isFinite(f)) total += f
    }
    if (total > 0) return total
  }
  const days = trainingProfile.preferred_days
  if (Array.isArray(days) && days.length > 0) return days.length
  return 3
}

// Renvoie null si des données essentielles manquent (à compléter dans le profil).
export function computeMacroTargets({ sex, birthDate, heightCm, weightKg, goalType, sessionsPerWeek }) {
  const age = ageFrom(birthDate)
  const w = Number(weightKg)
  const h = Number(heightCm)
  if (!age || !Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) {
    return null
  }

  const bmr = basalMetabolicRate({ sex, weightKg: w, heightCm: h, age })
  const tdee = bmr * activityFactor(sessionsPerWeek ?? 3)
  const tuning = GOAL_TUNING[goalType] ?? GOAL_TUNING.general_fitness

  const kcal = Math.round(tdee * (1 + tuning.kcal))
  const proteinG = Math.round(w * tuning.proteinPerKg)
  const fatG = Math.round((kcal * 0.25) / 9) // 25% des calories en lipides
  const carbsKcal = Math.max(0, kcal - proteinG * 4 - fatG * 9)
  const carbsG = Math.round(carbsKcal / 4)

  return { kcal, protein_g: proteinG, carbs_g: carbsG, fat_g: fatG }
}

// Cibles en grammes à partir d'un total calorique et d'une répartition en %
// (protéines/glucides = 4 kcal/g, lipides = 9 kcal/g).
export function macrosFromSplit(kcal, { protein_pct, carbs_pct, fat_pct }) {
  const k = Number(kcal) || 0
  return {
    kcal: Math.round(k),
    protein_g: Math.round((k * (Number(protein_pct) || 0)) / 100 / 4),
    carbs_g: Math.round((k * (Number(carbs_pct) || 0)) / 100 / 4),
    fat_g: Math.round((k * (Number(fat_pct) || 0)) / 100 / 9),
  }
}

// Répartition en % (arrondie à 100) déduite de cibles en grammes.
// Sert à préremplir l'éditeur depuis les cibles calculées automatiquement.
export function splitFromMacros(targets) {
  const kcal = Number(targets?.kcal)
  if (!kcal || kcal <= 0) return { protein_pct: 30, carbs_pct: 40, fat_pct: 30 }
  const protein_pct = Math.round(((Number(targets.protein_g) || 0) * 4) / kcal * 100)
  const fat_pct = Math.round(((Number(targets.fat_g) || 0) * 9) / kcal * 100)
  const carbs_pct = Math.max(0, 100 - protein_pct - fat_pct)
  return { protein_pct, carbs_pct, fat_pct }
}

export function sumEntries(entries) {
  return (entries ?? []).reduce(
    (acc, e) => ({
      kcal: acc.kcal + Number(e.kcal || 0),
      protein_g: acc.protein_g + Number(e.protein_g || 0),
      carbs_g: acc.carbs_g + Number(e.carbs_g || 0),
      fat_g: acc.fat_g + Number(e.fat_g || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )
}
