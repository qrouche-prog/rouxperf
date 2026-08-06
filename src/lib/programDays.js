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

// Attribue à chaque séance un day_number unique et stable, basé sur sa position
// dans la semaine (1-based). Certains programmes générés par l'IA donnent le même
// day_number à deux séances du même jour (matin/soir) : le lien et la recherche
// se faisant sur ce numéro, les deux séances devenaient indistinguables. En
// renumérotant par position (déterministe, car la structure est figée), chaque
// séance a un identifiant unique — utilisé partout : lien, recherche, log.
export function withStableDayNumbers(days) {
  if (!Array.isArray(days)) return []
  return days.map((d, i) => ({ ...d, day_number: i + 1 }))
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_WEEK = 7 * MS_PER_DAY

// Lundi (00:00) de la semaine contenant la date donnée.
export function mondayOf(dateLike) {
  const d = new Date(dateLike)
  d.setHours(0, 0, 0, 0)
  const iso = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (iso - 1))
  return d
}

// Calendrier réel du programme : la semaine 1 démarre le lundi de la semaine de
// création, puis chaque semaine du programme suit une semaine calendaire.
//   currentWeek  : semaine du programme correspondant à aujourd'hui (bornée 1..N)
//   weeksElapsed : nombre de semaines pleines écoulées depuis le départ
//   expired      : le programme a couvert toutes ses semaines (plus disponible)
//   endDate      : dernier jour couvert (dimanche de la dernière semaine)
export function programSchedule(program) {
  if (!program) return null
  const totalWeeks = program.structure?.weeks?.length ?? 0
  const startMonday = mondayOf(program.created_at)
  const todayMonday = mondayOf(new Date())
  const weeksElapsed = Math.floor((todayMonday.getTime() - startMonday.getTime()) / MS_PER_WEEK)
  const currentWeek = Math.min(Math.max(weeksElapsed + 1, 1), Math.max(totalWeeks, 1))
  const expired = totalWeeks > 0 && weeksElapsed >= totalWeeks
  const endDate = new Date(startMonday.getTime() + totalWeeks * MS_PER_WEEK - MS_PER_DAY)
  return { totalWeeks, startMonday, weeksElapsed, currentWeek, expired, endDate }
}
