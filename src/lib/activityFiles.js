// Parseur de fichiers de séance exportés depuis une montre (Garmin, etc.).
// Gère le TCX (résumé riche : durée, distance, calories, FC) et le GPX
// (calculé depuis les points de trace). Retourne un tableau de séances
// prêtes à insérer dans wearable_activities.

// Récupère les éléments par nom local, quel que soit le namespace.
function byLocal(root, name) {
  return Array.from(root.getElementsByTagNameNS('*', name))
}

function textOf(root, name) {
  const el = byLocal(root, name)[0]
  return el ? el.textContent.trim() : null
}

function numOf(root, name) {
  const t = textOf(root, name)
  const n = t == null ? NaN : Number(t)
  return Number.isFinite(n) ? n : null
}

// Valeur numérique sous un enfant nommé qui contient <Value> (TCX FC).
function hrValue(root, name) {
  const el = byLocal(root, name)[0]
  if (!el) return null
  const v = el.getElementsByTagNameNS('*', 'Value')[0]
  const n = v ? Number(v.textContent) : NaN
  return Number.isFinite(n) ? Math.round(n) : null
}

function elevationGain(altitudes) {
  let gain = 0
  for (let i = 1; i < altitudes.length; i += 1) {
    const d = altitudes[i] - altitudes[i - 1]
    if (d > 0) gain += d
  }
  return altitudes.length > 1 ? Math.round(gain) : null
}

function haversine(a, b) {
  const R = 6371000
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function parseTcx(doc) {
  const out = []
  for (const act of byLocal(doc, 'Activity')) {
    const sport = act.getAttribute('Sport') || 'Activité'
    const id = textOf(act, 'Id')
    const laps = byLocal(act, 'Lap')
    if (laps.length === 0) continue

    let duration = 0
    let distance = 0
    let calories = 0
    let hrWeighted = 0
    let hrDur = 0
    let maxHr = 0
    for (const lap of laps) {
      const t = numOf(lap, 'TotalTimeSeconds') ?? 0
      duration += t
      distance += numOf(lap, 'DistanceMeters') ?? 0
      calories += numOf(lap, 'Calories') ?? 0
      const avg = hrValue(lap, 'AverageHeartRateBpm')
      if (avg != null) {
        hrWeighted += avg * (t || 1)
        hrDur += t || 1
      }
      const mx = hrValue(lap, 'MaximumHeartRateBpm')
      if (mx != null && mx > maxHr) maxHr = mx
    }
    const altitudes = byLocal(act, 'AltitudeMeters')
      .map((n) => Number(n.textContent))
      .filter(Number.isFinite)

    const start = laps[0].getAttribute('StartTime') || id
    out.push({
      external_id: `tcx-${id || start}`,
      activity_type: sport,
      started_at: start || null,
      duration_s: duration ? Math.round(duration) : null,
      distance_m: distance || null,
      calories: calories || null,
      avg_hr: hrDur > 0 ? Math.round(hrWeighted / hrDur) : null,
      max_hr: maxHr || null,
      elevation_gain_m: elevationGain(altitudes),
    })
  }
  return out
}

function parseGpx(doc) {
  const out = []
  for (const trk of byLocal(doc, 'trk')) {
    const name = textOf(trk, 'name') || textOf(trk, 'type') || 'Activité'
    const pts = byLocal(trk, 'trkpt')
    if (pts.length === 0) continue

    const coords = []
    const alts = []
    const times = []
    const hrs = []
    for (const p of pts) {
      const lat = Number(p.getAttribute('lat'))
      const lon = Number(p.getAttribute('lon'))
      if (Number.isFinite(lat) && Number.isFinite(lon)) coords.push({ lat, lon })
      const ele = numOf(p, 'ele')
      if (ele != null) alts.push(ele)
      const time = textOf(p, 'time')
      if (time) times.push(time)
      const hr = numOf(p, 'hr')
      if (hr != null) hrs.push(hr)
    }

    let distance = 0
    for (let i = 1; i < coords.length; i += 1) distance += haversine(coords[i - 1], coords[i])

    const start = times[0] || null
    const end = times[times.length - 1] || null
    const duration = start && end ? Math.round((new Date(end) - new Date(start)) / 1000) : null

    out.push({
      external_id: `gpx-${start || Math.random().toString(36).slice(2)}`,
      activity_type: name,
      started_at: start,
      duration_s: duration && duration > 0 ? duration : null,
      distance_m: distance ? Math.round(distance) : null,
      calories: null,
      avg_hr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
      max_hr: hrs.length ? Math.max(...hrs) : null,
      elevation_gain_m: elevationGain(alts),
    })
  }
  return out
}

export function parseActivityFile(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) return []
  const root = doc.documentElement?.localName
  if (root === 'TrainingCenterDatabase') return parseTcx(doc)
  if (root === 'gpx') return parseGpx(doc)
  return []
}
