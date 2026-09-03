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

// Les angles disponibles (face, profil) pour un genre donné parmi le tableau
// musclewiki_videos stocké sur l'exercice — pas de sélecteur de genre en v1,
// homme par défaut, mais les DEUX angles (face + profil) sont affichés.
export function pickMusclewikiVideos(videos, gender = 'male') {
  if (!Array.isArray(videos) || videos.length === 0) return []
  const byGender = videos.filter((v) => v.gender === gender)
  return byGender.length > 0 ? byGender : videos
}

// Cache mémoire des miniatures (URL og_image -> object URL local), pour de
// vrai un seul appel API par exercice PAR SESSION D'ONGLET — indépendant du
// cache HTTP du navigateur (constaté peu fiable ici sur les remontages
// répétés de l'écran d'exercice à chaque série). Leurs conditions autorisent
// explicitement la mise en cache des miniatures 24h "on-device" ; ce cache
// mémoire ne survit pas à la fermeture de l'onglet, donc reste bien en-deçà.
const thumbCache = new Map()

export async function getMusclewikiThumbnail(ogImageUrl) {
  if (!ogImageUrl) return null
  const cached = thumbCache.get(ogImageUrl)
  if (cached) return cached
  const token = await getMusclewikiToken()
  if (!token) return null
  try {
    const res = await fetch(`${ogImageUrl}?token=${token}`)
    if (!res.ok) return null
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    thumbCache.set(ogImageUrl, objectUrl)
    return objectUrl
  } catch {
    return null
  }
}
