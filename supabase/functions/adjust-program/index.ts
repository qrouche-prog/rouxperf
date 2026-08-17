import { CORS, json, getUserId, serviceClient, isPremium } from '../_shared/intervals.ts'

const WEEK_MS = 7 * 86400000

// Ajustement de programme à la demande (Premium, 1×/semaine) : enregistre le
// prompt de l'utilisateur, crée un nouveau programme en génération et déclenche
// le worker (qui injectera la demande dans le prompt). Contrairement au flux
// initial, pas de validation admin : l'abonné paie sa génération.
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
    const prompt = String(body?.prompt ?? '').trim().slice(0, 1000)
    if (prompt.length < 3) return json({ error: 'Décris les changements souhaités.' }, 400)

    // Rate limit : une régénération RÉUSSIE par période glissante de 7 jours.
    // On ne compte que les ajustements appliqués (applied=true) : une génération
    // échouée ne doit pas consommer le quota.
    const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()
    const { data: recent } = await supabase
      .from('program_adjustments')
      .select('created_at')
      .eq('user_id', userId)
      .eq('applied', true)
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (recent) {
      const next = new Date(new Date(recent.created_at).getTime() + WEEK_MS).toISOString()
      return json({ error: 'Tu as déjà demandé un ajustement cette semaine.', next_available: next }, 429)
    }

    // Pas de nouvelle génération si une est déjà en cours.
    const { data: last } = await supabase
      .from('user_programs')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (last && (last.status === 'generating' || last.status === 'pending_approval')) {
      return json({ error: 'Une génération est déjà en cours. Réessaie quand elle est terminée.' }, 409)
    }

    // Enregistre la demande (le worker la lira et la marquera appliquée).
    const { error: adjErr } = await supabase
      .from('program_adjustments')
      .insert({ user_id: userId, prompt })
    if (adjErr) return json({ error: adjErr.message }, 500)

    // Crée le programme en génération et déclenche le worker.
    const { data: program, error: insErr } = await supabase
      .from('user_programs')
      .insert({ user_id: userId, status: 'generating', current_week: 1, structure: null })
      .select()
      .single()
    if (insErr || !program) return json({ error: insErr?.message ?? 'Création du programme impossible.' }, 500)

    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-program-worker`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ program_id: program.id, user_id: userId }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error ?? `worker a répondu ${res.status}`)
      }
    } catch (err) {
      await supabase
        .from('user_programs')
        .update({ status: 'failed', error_message: `Échec du déclenchement : ${err instanceof Error ? err.message : err}` })
        .eq('id', program.id)
      return json({ error: 'Échec du déclenchement de la génération.' }, 502)
    }

    return json({ ok: true, program_id: program.id })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erreur inattendue' }, 500)
  }
})
