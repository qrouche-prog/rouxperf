// Recherche d'aliments génériques dans la table CIQUAL 2020 (ANSES, ~2300
// aliments). Le jeu de données est chargé dynamiquement (chunk séparé) au
// premier usage puis mis en cache — il reste hors du bundle initial.

import { guessPortion } from './portions'

let cache = null
async function loadFoods() {
  if (!cache) {
    const mod = await import('../data/ciqual.json')
    cache = mod.default
  }
  return cache
}

function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // enlève les accents
}

// Tous les mots de la requête doivent apparaître dans le nom. Classement :
// correspondance exacte, préfixe, début de mot, puis inclusion ; à score égal,
// le nom le plus court d'abord (souvent l'aliment le plus simple).
export async function searchGenericFoods(query) {
  const q = normalize(query).trim()
  if (!q) return []
  const tokens = q.split(/\s+/)
  const foods = await loadFoods()

  const scored = []
  for (const food of foods) {
    const n = normalize(food.name)
    if (!tokens.every((t) => n.includes(t))) continue
    const words = n.split(/[\s,]+/)
    let score = 10
    if (n === q) score = 100
    else if (n.startsWith(q)) score = 60
    else if (tokens.every((t) => words.some((w) => w.startsWith(t)))) score = 40
    scored.push({ score, food, len: n.length })
  }

  scored.sort((a, b) => b.score - a.score || a.len - b.len)
  return scored.slice(0, 10).map(({ food }) => ({
    name: food.name,
    kind: 'generic',
    per100: {
      kcal: food.kcal,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
    },
    portion: guessPortion(food.name),
  }))
}
