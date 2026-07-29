/**
 * Tables de correspondance vers le français.
 *
 * Le vocabulaire ci-dessous est EXHAUSTIF : il a été extrait des deux sources
 * réelles, pas deviné. Si le script de build rencontre un terme absent d'une de
 * ces tables, il échoue bruyamment (voir buildExerciseLibrary) plutôt que de
 * laisser passer un terme non traduit.
 */

/** Muscles OpenTraining (allemand) — 9 valeurs distinctes dans les XML. */
export const MUSCLE_DE_FR: Record<string, string> = {
  Bizeps: 'biceps',
  Trizeps: 'triceps',
  Schulter: 'épaules',
  Brustmuskel: 'pectoraux',
  Bauchmuskeln: 'abdominaux',
  Bauchmuskel: 'abdominaux',
  Rückenmuskeln: 'dos',
  Oberschenkelmuskel: 'quadriceps',
  Po: 'fessiers',
};

/** Matériel OpenTraining (allemand) — 16 valeurs distinctes dans les XML. */
export const EQUIPMENT_DE_FR: Record<string, string> = {
  Kurzhantel: 'haltères',
  Langhantel: 'barre',
  Trainingsbank: 'banc',
  Hantelbank: 'banc',
  'Sit Up Bank': 'banc à abdominaux',
  'Swiss Ball': 'swiss ball',
  Keine: 'aucun',
  Kabelzug: 'poulie',
  Curlpult: 'pupitre à biceps',
  Hantelscheibe: 'disque',
  Rückenstrecker: 'banc à lombaires',
  Rudergerät: 'rameur',
  Medizinball: 'medecine ball',
  'Klimmzug Stange': 'barre de traction',
  'Dip Barren': 'barres à dips',
  Beinpresse: 'presse à cuisses',
};

/** Muscles free-exercise-db (anglais). */
export const MUSCLE_EN_FR: Record<string, string> = {
  abdominals: 'abdominaux',
  abductors: 'abducteurs',
  adductors: 'adducteurs',
  biceps: 'biceps',
  calves: 'mollets',
  chest: 'pectoraux',
  forearms: 'avant-bras',
  glutes: 'fessiers',
  hamstrings: 'ischio-jambiers',
  lats: 'grand dorsal',
  'lower back': 'lombaires',
  'middle back': 'dos (milieu)',
  neck: 'cou',
  quadriceps: 'quadriceps',
  shoulders: 'épaules',
  traps: 'trapèzes',
  triceps: 'triceps',
};

/** Matériel free-exercise-db (anglais). */
export const EQUIPMENT_EN_FR: Record<string, string> = {
  'body only': 'poids du corps',
  machine: 'machine',
  other: 'autre',
  'foam roll': 'rouleau de massage',
  kettlebells: 'kettlebell',
  dumbbell: 'haltères',
  cable: 'poulie',
  barbell: 'barre',
  bands: 'élastiques',
  'medicine ball': 'medecine ball',
  'exercise ball': 'swiss ball',
  'e-z curl bar': 'barre EZ',
};

/** Catégories free-exercise-db. */
export const CATEGORY_EN_FR: Record<string, string> = {
  strength: 'force',
  stretching: 'étirement',
  plyometrics: 'pliométrie',
  strongman: 'strongman',
  powerlifting: 'powerlifting',
  cardio: 'cardio',
  'olympic weightlifting': 'haltérophilie',
};

export const LEVEL_EN_FR: Record<string, string> = {
  beginner: 'débutant',
  intermediate: 'intermédiaire',
  expert: 'confirmé',
};

export const FORCE_EN_FR: Record<string, string> = {
  push: 'poussée',
  pull: 'tirage',
  static: 'statique',
};

export const MECHANIC_EN_FR: Record<string, string> = {
  compound: 'polyarticulaire',
  isolation: 'isolation',
};

/**
 * Traduit via une table en signalant les termes manquants.
 * On ne veut PAS de fallback silencieux : un terme non traduit qui atterrit en
 * production est plus coûteux à repérer qu'un build qui casse.
 */
export function translate(
  value: string,
  table: Record<string, string>,
  missing: Set<string>,
): string {
  const hit = table[value] ?? table[value.trim()];
  if (!hit) {
    missing.add(value);
    return value;
  }
  return hit;
}
