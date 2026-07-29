import mediaBySlug from '../data/exerciseMedia.json'

// Carte slug → média, dérivée de data/exercises.json (régénérée par le build de
// la bibliothèque). Le slug est l'identité stable ; le média est
// interchangeable — on ne référence jamais un chemin d'image en dur ailleurs.
export function mediaForSlug(slug) {
  if (!slug) return null
  return mediaBySlug[slug] ?? null
}
