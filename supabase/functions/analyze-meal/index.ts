import Anthropic from 'npm:@anthropic-ai/sdk@0.112.4'

const anthropic = new Anthropic()

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// Schéma de sortie : Claude renvoie une liste d'aliments estimés.
const mealSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity_g: { type: 'number' },
          kcal: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['name', 'quantity_g', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
        additionalProperties: false,
      },
    },
    note: { type: 'string' },
  },
  required: ['items'],
  additionalProperties: false,
}

const PROMPT = `Tu es un assistant nutrition. Analyse la photo de ce repas.
Identifie chaque aliment ou plat visible. Pour chacun, estime :
- la portion en grammes (quantity_g),
- les calories (kcal),
- les protéines, glucides et lipides en grammes.
Base-toi sur des valeurs nutritionnelles réalistes (type table CIQUAL/USDA).
Si une portion est difficile à estimer, donne ta meilleure estimation et
indique une confidence "low". Ne renvoie que des aliments réellement visibles.
Si l'image ne contient pas de nourriture, renvoie une liste vide et explique dans "note".`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { image_base64, media_type } = await req.json()

    if (!image_base64 || typeof image_base64 !== 'string') {
      return new Response(JSON.stringify({ error: 'Image manquante' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    const mediaType = ALLOWED_MEDIA.includes(media_type) ? media_type : 'image/jpeg'

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: mealSchema },
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image_base64 } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    if (message.stop_reason === 'refusal') {
      return new Response(JSON.stringify({ error: 'Analyse refusée pour cette image.' }), {
        status: 422,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const textBlock = message.content.find((b) => b.type === 'text')
    const parsed = textBlock ? JSON.parse(textBlock.text) : { items: [] }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur inattendue' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
