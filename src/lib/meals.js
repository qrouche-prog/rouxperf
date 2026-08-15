export const MEALS = [
  { key: 'breakfast', label: 'Petit déjeuner' },
  { key: 'lunch', label: 'Déjeuner' },
  { key: 'dinner', label: 'Dîner' },
  { key: 'snack', label: 'Collation' },
]

export const MEAL_KEYS = MEALS.map((m) => m.key)
export const MEAL_LABEL = Object.fromEntries(MEALS.map((m) => [m.key, m.label]))

// Devine le type de repas à partir d'un nom libre (plan repas généré).
export function mealKeyFromName(name, fallback) {
  const n = String(name ?? '').toLowerCase()
  if (n.includes('petit')) return 'breakfast'
  if (n.includes('déjeuner') || n.includes('dejeuner') || n.includes('midi')) return 'lunch'
  if (n.includes('dîner') || n.includes('diner') || n.includes('soir')) return 'dinner'
  if (
    n.includes('collation') ||
    n.includes('snack') ||
    n.includes('en-cas') ||
    n.includes('encas') ||
    n.includes('goûter') ||
    n.includes('gouter')
  ) {
    return 'snack'
  }
  return fallback
}

export function todayIso() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}
