import { createClient } from '@supabase/supabase-js'

export async function requireAdmin(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token manquant' })
    return null
  }
  const token = authHeader.slice(7)

  const callerClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const {
    data: { user },
    error: authError,
  } = await callerClient.auth.getUser(token)

  if (authError || !user) {
    res.status(401).json({ error: 'Session invalide' })
    return null
  }

  const { data: profile } = await callerClient.from('profiles').select('is_admin').eq('user_id', user.id).single()

  if (!profile?.is_admin) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' })
    return null
  }

  const adminClient = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  return { adminClient, callerId: user.id }
}
