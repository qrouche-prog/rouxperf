// Résout le jour de la semaine (day_of_week, 1=lundi..7=dimanche) de chaque
// séance d'une semaine de programme.
//
// Les programmes générés depuis l'ajout du champ day_of_week le portent
// directement. Les anciens programmes (générés avant ce changement) n'ont
// pas ce champ : on retombe alors sur l'ancienne logique positionnelle —
// la i-ème séance de la semaine correspond au i-ème jour préféré trié.
export function withResolvedDayOfWeek(days, preferredDays) {
  if (!Array.isArray(days)) return []
  if (days.every((d) => Number.isInteger(d.day_of_week))) return days

  const sorted = [...(preferredDays ?? [])].sort((a, b) => a - b)
  return days.map((d, i) => ({
    ...d,
    day_of_week: Number.isInteger(d.day_of_week) ? d.day_of_week : sorted[i] ?? null,
  }))
}
