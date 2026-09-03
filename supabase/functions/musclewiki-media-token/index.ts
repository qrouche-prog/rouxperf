import { CORS, json, getUserId } from '../_shared/intervals.ts'

// Émet un jeton média MuscleWiki de courte durée (15 min par défaut) pour le
// client — jamais la clé API elle-même, qui reste côté serveur. À appeler
// UNE FOIS par séance (pas par vidéo) : le jeton se réutilise sur tous les
// /stream/ tant qu'il est valide (voir doc MuscleWiki, "mint per session").
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const userId = await getUserId(req)
  if (!userId) return json({ error: 'Non authentifié' }, 401)

  const apiKey = Deno.env.get('MUSCLEWIKI_API_KEY')
  if (!apiKey) return json({ error: 'MuscleWiki non configuré' }, 500)

  try {
    const res = await fetch('https://api.musclewiki.com/media/token', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return json({ error: `MuscleWiki a répondu ${res.status}`, detail: body.slice(0, 300) }, 502)
    }
    const data = await res.json()
    return json({ token: data.token, expires_in: data.expires_in })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erreur inattendue' }, 500)
  }
})
