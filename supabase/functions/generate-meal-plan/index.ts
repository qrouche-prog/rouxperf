import Anthropic from 'npm:@anthropic-ai/sdk@0.112.4'
import { CORS, json, getUserId, serviceClient, isPremium } from '../_shared/intervals.ts'

const anthropic = new Anthropic()

// Libellés objectif → orientation nutritionnelle (repère pour le prompt).
const GOAL_FR: Record<string, string> = {
  weight_loss: 'perte de poids',
  muscle_gain: 'prise de muscle',
  recomposition: 'recomposition corporelle',
  hybrid: 'objectif hybride',
  strength: 'force',
  endurance: 'endurance',
  general_fitness: 'forme générale',
}

// Schéma de sortie : une journée de repas. Les totaux sont recalculés côté client.
const planSchema = {
  type: 'object',
  properties: {
    meals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                food: { type: 'string' },
                quantity_g: { type: 'number' },
                kcal: { type: 'number' },
                protein_g: { type: 'number' },
                carbs_g: { type: 'number' },
                fat_g: { type: 'number' },
              },
              required: ['food', 'quantity_g', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'items'],
        additionalProperties: false,
      },
    },
    tips: { type: 'string' },
  },
  required: ['meals'],
  additionalProperties: false,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const userId = await getUserId(req)
  if (!userId) return json({ error: 'Non authentifié' }, 401)

  const supabase = serviceClient()
  if (!(await isPremium(supabase, userId))) {
    return json({ error: 'Fonctionnalité réservée aux membres Premium.' }, 402)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const targets = body?.targets
    if (!targets || !Number.isFinite(Number(targets.kcal)) || Number(targets.kcal) <= 0) {
      return json({ error: 'Cibles de macros manquantes. Complète ton profil.' }, 400)
    }
    const goalType = String(body?.goalType ?? '')
    const goalFr = GOAL_FR[goalType] ?? 'forme générale'
    const preferences = String(body?.preferences ?? '').slice(0, 500).trim()

    const kcal = Math.round(Number(targets.kcal))
    const protein = Math.round(Number(targets.protein_g))
    const carbs = Math.round(Number(targets.carbs_g))
    const fat = Math.round(Number(targets.fat_g))

    const system = `Tu es un coach nutrition. Tu composes une journée-type de repas (menu) qui atteint des cibles de macronutriments précises.
Contraintes :
- La somme des repas doit approcher les cibles à ±5 % sur les calories et les protéines.
- Aliments réalistes et courants (contexte suisse/européen), portions en grammes.
- Réponds en français.
- 3 à 5 repas : petit-déjeuner, déjeuner, dîner, et 1-2 collations si nécessaire pour atteindre les cibles.
- Pour chaque aliment, donne des macros cohérentes avec sa quantité (valeurs type CIQUAL/USDA).
- Respecte scrupuleusement les préférences/restrictions données (allergies, régime, aliments à éviter).
- "tips" : 1-2 phrases de conseils pratiques (hydratation, timing autour de l'entraînement). Pas d'avis médical.`

    const userPrompt = `Objectif : ${goalFr}.
Cibles quotidiennes : ${kcal} kcal, ${protein} g de protéines, ${carbs} g de glucides, ${fat} g de lipides.
${preferences ? `Préférences / restrictions : ${preferences}` : 'Aucune restriction particulière.'}
Compose le menu du jour.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 3000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: planSchema } },
      system,
      messages: [{ role: 'user', content: userPrompt }],
    })

    if (message.stop_reason === 'refusal') {
      return json({ error: 'Génération refusée.' }, 422)
    }

    const textBlock = message.content.find((b) => b.type === 'text')
    const plan = textBlock ? JSON.parse(textBlock.text) : null
    if (!plan || !Array.isArray(plan.meals) || plan.meals.length === 0) {
      return json({ error: "Le plan n'a pas pu être généré." }, 502)
    }

    const generatedAt = new Date().toISOString()
    await supabase
      .from('meal_plans')
      .upsert(
        { user_id: userId, content: plan, targets: { kcal, protein_g: protein, carbs_g: carbs, fat_g: fat }, generated_at: generatedAt },
        { onConflict: 'user_id' }
      )

    return json({ content: plan, targets: { kcal, protein_g: protein, carbs_g: carbs, fat_g: fat }, generated_at: generatedAt })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erreur inattendue' }, 500)
  }
})
