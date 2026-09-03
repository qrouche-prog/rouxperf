import { supabase } from './supabase'

// Jeton média MuscleWiki mis en cache en mémoire (partagé par toute la page) :
// un seul par séance plutôt qu'un par vidéo, comme demandé par leur doc.
let cache = { token: null, expiresAt: 0 }

export async function getMusclewikiToken({ force = false } = {}) {
  const now = Date.now()
  if (!force && cache.token && cache.expiresAt > now + 30_000) return cache.token
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/musclewiki-media-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    cache = { token: data.token, expiresAt: now + (data.expires_in ?? 900) * 1000 }
    return cache.token
  } catch {
    return null
  }
}

// Choisit une vidéo par défaut (homme, vue de face) parmi le tableau
// musclewiki_videos stocké sur l'exercice — pas de sélecteur genre/angle en v1.
export function pickMusclewikiVideo(videos) {
  if (!Array.isArray(videos) || videos.length === 0) return null
  return videos.find((v) => v.gender === 'male' && v.angle === 'front') || videos.find((v) => v.angle === 'front') || videos[0]
}
