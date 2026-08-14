import Anthropic from 'npm:@anthropic-ai/sdk@0.112.4'
import { CORS, json, getUserId, serviceClient, isPremium } from '../_shared/intervals.ts'

const anthropic = new Anthropic()

// Libellés FR minimalistes pour le prompt (l'IA répond en FR quoi qu'il arrive).
const FR: Record<string, string> = {
  run: 'course à pied',
  virtualrun: 'course sur tapis',
  treadmill: 'course sur tapis',
  ride: 'vélo',
  virtualride: 'vélo',
  walk: 'marche',
  hike: 'randonnée',
  swim: 'natation',
  weighttraining: 'musculation',
  strength: 'musculation',
  workout: 'cardio',
}
const frType = (t: string) => FR[String(t).toLowerCase().replace(/[\s_-]/g, '')] ?? t

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1) // lundi
  return date.toISOString().slice(0, 10)
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
    const since = new Date(Date.now() - 56 * 86400000).toISOString()
    const [{ data: acts }, { data: goal }, { data: measures }] = await Promise.all([
      supabase
        .from('wearable_activities')
        .select('activity_type, started_at, duration_s, distance_m, avg_hr, max_hr, elevation_gain_m, raw')
        .eq('user_id', userId)
        .gte('started_at', since)
        .order('started_at', { ascending: true }),
      supabase
        .from('goals')
        .select('goal_type, target_weight_kg, target_date')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('body_measurements')
        .select('weight_kg, measured_at')
        .eq('user_id', userId)
        .order('measured_at', { ascending: true }),
    ])

    if (!acts || acts.length < 3) {
      return json({ error: "Pas assez de séances importées pour une analyse (il en faut au moins 3)." }, 400)
    }

    // Agrégats par semaine et par type.
    const weekMap: Record<string, { sessions: number; min: number; km: number; load: number }> = {}
    const typeMap: Record<string, { sessions: number; min: number; km: number; hrSum: number; hrN: number }> = {}
    for (const a of acts) {
      const wk = a.started_at ? isoWeek(new Date(a.started_at)) : 'inconnu'
      const w = (weekMap[wk] = weekMap[wk] || { sessions: 0, min: 0, km: 0, load: 0 })
      w.sessions += 1
      w.min += Math.round(Number(a.duration_s || 0) / 60)
      w.km += Number(a.distance_m || 0) / 1000
      const tl = Number(a.raw?.icu_training_load)
      if (Number.isFinite(tl)) w.load += tl

      const t = frType(a.activity_type || 'activité')
      const tp = (typeMap[t] = typeMap[t] || { sessions: 0, min: 0, km: 0, hrSum: 0, hrN: 0 })
      tp.sessions += 1
      tp.min += Math.round(Number(a.duration_s || 0) / 60)
      tp.km += Number(a.distance_m || 0) / 1000
      if (a.avg_hr) {
        tp.hrSum += Number(a.avg_hr)
        tp.hrN += 1
      }
    }

    const weeks = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, v]) => ({ week, sessions: v.sessions, min: v.min, km: Math.round(v.km), load: Math.round(v.load) }))
    const types = Object.entries(typeMap).map(([type, v]) => ({
      type,
      sessions: v.sessions,
      min: v.min,
      km: Math.round(v.km),
      avg_hr: v.hrN ? Math.round(v.hrSum / v.hrN) : null,
    }))
    const weightTrend =
      measures && measures.length >= 2
        ? { from: measures[0].weight_kg, to: measures[measures.length - 1].weight_kg }
        : null

    const summary = { period_days: 56, weeks, types, goal, weightTrend }

    const system = `Tu es un coach sportif. Analyse les données d'entraînement RÉELLES de l'utilisateur (issues de sa montre) sur ~8 semaines. Réponds en français, concis et actionnable (max ~180 mots), en 4 courts blocs :
1) Tendance générale (volume, régularité).
2) Points forts.
3) Points de vigilance (surcharge, monotonie, manque de récup, déséquilibre entre disciplines).
4) 1 à 2 recommandations concrètes pour les prochaines semaines, cohérentes avec l'objectif.
Sois direct, pas de blabla, pas d'avis médical.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1200,
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: JSON.stringify(summary, null, 2) }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    const content = textBlock ? textBlock.text.trim() : ''
    if (!content) return json({ error: "L'analyse n'a pas pu être générée." }, 502)

    const generatedAt = new Date().toISOString()
    await supabase
      .from('training_insights')
      .upsert({ user_id: userId, content, generated_at: generatedAt }, { onConflict: 'user_id' })

    return json({ content, generated_at: generatedAt })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erreur inattendue' }, 500)
  }
})
