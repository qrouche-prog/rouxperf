// Libellés FR (façon Garmin) pour les types d'activité importés d'intervals.icu
// / Strava, qui arrivent en anglais (Run, WeightTraining, VirtualRun…).

const LABELS = {
  run: 'Course à pied',
  trailrun: 'Trail',
  virtualrun: 'Course sur tapis',
  treadmill: 'Course sur tapis',
  ride: 'Vélo',
  virtualride: 'Vélo home-trainer',
  gravelride: 'Gravel',
  mountainbikeride: 'VTT',
  ebikeride: 'Vélo électrique',
  walk: 'Marche',
  hike: 'Randonnée',
  swim: 'Natation',
  weighttraining: 'Musculation',
  strengthtraining: 'Musculation',
  strength: 'Musculation',
  workout: 'Cardio',
  cardio: 'Cardio',
  hiit: 'HIIT',
  crossfit: 'Cross-training',
  elliptical: 'Elliptique',
  rowing: 'Aviron',
  yoga: 'Yoga',
  pilates: 'Pilates',
  stairstepper: 'Escaliers',
  ski: 'Ski',
  nordicski: 'Ski de fond',
  backcountryski: 'Ski de rando',
  snowboard: 'Snowboard',
  soccer: 'Football',
  tennis: 'Tennis',
  golf: 'Golf',
  rockclimbing: 'Escalade',
  climbing: 'Escalade',
  activity: 'Séance',
}

const EMOJI = {
  'course à pied': '🏃',
  'course sur tapis': '🏃',
  trail: '⛰️',
  vélo: '🚴',
  'vélo home-trainer': '🚴',
  gravel: '🚴',
  vtt: '🚵',
  'vélo électrique': '🚴',
  marche: '🚶',
  randonnée: '🥾',
  natation: '🏊',
  musculation: '🏋️',
  cardio: '❤️',
  hiit: '🔥',
  'cross-training': '🤸',
  elliptique: '🌀',
  aviron: '🚣',
  yoga: '🧘',
  pilates: '🧘',
  escaliers: '🪜',
  ski: '⛷️',
  'ski de fond': '🎿',
  'ski de rando': '🎿',
  snowboard: '🏂',
  football: '⚽',
  tennis: '🎾',
  golf: '⛳',
  escalade: '🧗',
}

function normalize(type) {
  return String(type ?? '')
    .toLowerCase()
    .replace(/[\s_-]/g, '')
}

export function frActivityLabel(type) {
  if (!type) return 'Séance'
  const key = normalize(type)
  if (LABELS[key]) return LABELS[key]
  // Fallback : espace avant les majuscules (WeightTraining → Weight Training)
  return String(type).replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function activityEmoji(type) {
  return EMOJI[frActivityLabel(type).toLowerCase()] ?? '💪'
}
