import FOODS from '../data/foods_fr'

function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // enlève les accents
}

// Recherche locale d'aliments génériques (banane, riz, œuf…). Tous les mots de
// la requête doivent apparaître dans le nom. Classement : correspondance exacte,
// puis début de mot, puis inclusion.
export function searchGenericFoods(query) {
  const q = normalize(query).trim()
  if (!q) return []
  const tokens = q.split(/\s+/)

  const scored = []
  for (const food of FOODS) {
    const n = normalize(food.name)
    if (!tokens.every((t) => n.includes(t))) continue
    let score = 10
    if (n === q) score = 100
    else if (n.startsWith(q)) score = 60
    else if (n.split(/\s+/).some((w) => w.startsWith(q))) score = 40
    scored.push({ score, food })
  }

  scored.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
  return scored.slice(0, 8).map(({ food }) => ({
    name: food.name,
    kind: 'generic',
    per100: {
      kcal: food.kcal,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
    },
  }))
}
