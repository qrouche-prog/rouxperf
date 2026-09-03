import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { frActivityLabel, activityEmoji } from '../lib/activityLabels'
import { useAuth } from '../context/AuthContext'
import MeasurementCard from '../components/progress/MeasurementCard'
import MeasurementSummaryRow from '../components/progress/MeasurementSummaryRow'
import WeeklyLoadChart from '../components/progress/WeeklyLoadChart'
import WeeklyHrChart from '../components/progress/WeeklyHrChart'
import BottomNav from '../components/BottomNav'
import TopNav from '../components/TopNav'
import PremiumGate from '../components/PremiumGate'
import PremiumBanner from '../components/PremiumBanner'

const CHART_METRICS = {
  min: { key: 'min', label: 'Minutes', unit: 'min' },
  km: { key: 'km', label: 'Kilomètres', unit: 'km' },
  sessions: { key: 'sessions', label: 'Séances', unit: '' },
}

function fmtPaceFromSpeed(speedMs) {
  if (!speedMs || speedMs <= 0) return null
  const secPerKm = 1000 / speedMs
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

// Sous-ensemble sûr du JSON brut remonté par la montre (intervals.icu) —
// uniquement les champs dont l'unité/l'interprétation est certaine, pas les
// 150+ champs bruts (souvent nuls ou trop techniques pour être utiles ici).
function activityDetailRows(raw, activity) {
  if (!raw || typeof raw !== 'object') return []
  const rows = []
  if (raw.name && raw.name.trim().toLowerCase() !== frActivityLabel(activity.activity_type).toLowerCase()) {
    rows.push(['Titre', raw.name])
  }
  if (raw.description) rows.push(['Description', raw.description])
  if (raw.moving_time && raw.elapsed_time && raw.elapsed_time !== raw.moving_time) {
    rows.push(['Temps total (avec pauses)', `${Math.round(raw.elapsed_time / 60)} min`])
  }
  const speed = Number(raw.average_speed)
  if (speed > 0) {
    const kmh = (speed * 3.6).toFixed(1)
    const pace = fmtPaceFromSpeed(speed)
    rows.push(['Vitesse moyenne', pace ? `${kmh} km/h · ${pace}` : `${kmh} km/h`])
  }
  const watts = Number(raw.icu_average_watts)
  if (watts > 0) rows.push(['Puissance moyenne', `${Math.round(watts)} W`])
  const rpe = raw.icu_rpe ?? raw.perceived_exertion
  if (rpe != null) rows.push(['RPE (ressenti d\'effort)', `${rpe}/10`])
  if (raw.feel != null) rows.push(['Ressenti général', `${raw.feel}/5`])
  const elevLoss = Number(raw.total_elevation_loss)
  if (elevLoss > 0) rows.push(['Dénivelé négatif', `${Math.round(elevLoss)} m`])
  const load = Number(raw.icu_training_load)
  if (load > 0) rows.push(["Charge d'entraînement", Math.round(load)])
  const temp = Number(raw.average_temp)
  if (raw.average_temp != null && Number.isFinite(temp)) rows.push(['Température', `${Math.round(temp)}°C`])
  if (Array.isArray(raw.interval_summary) && raw.interval_summary.length > 0) {
    rows.push(['Intervalles', raw.interval_summary.join(' · ')])
  }
  return rows
}

const MEASUREMENT_FIELDS = [
  { value: 'weight_kg', label: 'Poids', unit: 'kg' },
  { value: 'body_fat_pct', label: 'Masse grasse', unit: '%' },
  { value: 'waist_cm', label: 'Tour de taille', unit: 'cm' },
  { value: 'hips_cm', label: 'Tour de hanches', unit: 'cm' },
  { value: 'chest_cm', label: 'Tour de poitrine', unit: 'cm' },
  { value: 'arm_cm', label: 'Tour de bras', unit: 'cm' },
  { value: 'thigh_cm', label: 'Tour de cuisse', unit: 'cm' },
]

export default function ProgressPage() {
  const { user, isPremium } = useAuth()
  const [measurements, setMeasurements] = useState([])
  const [activities, setActivities] = useState([])
  const [showAllActivities, setShowAllActivities] = useState(false)
  const [activityDetails, setActivityDetails] = useState({}) // id -> détail brut (chargé à l'ouverture, pas d'emblée)
  const [insight, setInsight] = useState(null)
  const [insightBusy, setInsightBusy] = useState(false)
  const [insightError, setInsightError] = useState(null)
  const [notes, setNotes] = useState([])
  const [status, setStatus] = useState('loading')
  const [measureView, setMeasureView] = useState('hidden') // hidden | filled | all
  const [chartMetric, setChartMetric] = useState('min') // min | km | sessions

  async function loadInsight() {
    const { data } = await supabase
      .from('training_insights')
      .select('content, generated_at')
      .eq('user_id', user.id)
      .maybeSingle()
    setInsight(data ?? null)
  }

  async function generateInsight() {
    setInsightBusy(true)
    setInsightError(null)
    const { data, error } = await supabase.functions.invoke('training-insights', {})
    setInsightBusy(false)
    if (error || data?.error) {
      let msg = data?.error
      if (!msg && error?.context?.json) {
        try {
          const body = await error.context.json()
          msg = body?.error
        } catch {
          // ignore
        }
      }
      setInsightError(msg || 'Analyse indisponible pour le moment.')
      return
    }
    setInsight({ content: data.content, generated_at: data.generated_at })
  }

  async function loadActivities() {
    const { data } = await supabase
      .from('wearable_activities')
      .select('id, activity_type, started_at, duration_s, distance_m, calories, avg_hr, max_hr, elevation_gain_m')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(120)
    setActivities(data ?? [])
  }

  // Détail complet chargé à la demande (à l'ouverture de la carte) plutôt
  // qu'avec la liste : le JSON brut de la montre peut être volumineux et la
  // plupart des séances ne sont jamais dépliées.
  async function loadActivityDetail(id) {
    if (activityDetails[id] !== undefined) return
    setActivityDetails((prev) => ({ ...prev, [id]: 'loading' }))
    const { data } = await supabase.from('wearable_activities').select('raw').eq('id', id).single()
    setActivityDetails((prev) => ({ ...prev, [id]: data?.raw ?? null }))
  }

  async function loadMeasurements() {
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: true })
    setMeasurements(data ?? [])
  }

  async function loadNotes() {
    const { data } = await supabase
      .from('workout_log_sets')
      .select('note, created_at, exercises(name)')
      .eq('user_id', user.id)
      .not('note', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotes(data ?? [])
  }

  useEffect(() => {
    async function load() {
      await Promise.all([loadMeasurements(), loadActivities(), loadInsight(), loadNotes()])
      setStatus('idle')
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  if (status === 'loading') return null

  const [weightField, ...otherFields] = MEASUREMENT_FIELDS
  // Mensurations secondaires : on ne garde à l'écran que celles qui ont au moins une valeur.
  const filledOther = otherFields.filter((f) => measurements.some((m) => m[f.value] != null))
  const shownFields = measureView === 'all' ? otherFields : filledOther

  // Résumé hebdo des séances de montre sur 4 semaines.
  const now = Date.now()
  const recent = activities.filter((a) => a.started_at && now - new Date(a.started_at).getTime() < 28 * 86400000)
  const byType = {}
  for (const a of recent) {
    const t = a.activity_type || 'activité'
    const b = (byType[t] = byType[t] || { n: 0, dur: 0, dist: 0, hrSum: 0, hrN: 0 })
    b.n += 1
    b.dur += Number(a.duration_s || 0)
    b.dist += Number(a.distance_m || 0)
    if (a.avg_hr) {
      b.hrSum += Number(a.avg_hr)
      b.hrN += 1
    }
  }
  const weeklySummary = Object.entries(byType).map(([t, b]) => ({
    type: frActivityLabel(t),
    perWeek: (b.n / 4).toFixed(1),
    km: b.dist ? (b.dist / 1000 / 4).toFixed(1) : null,
    min: b.dur ? Math.round(b.dur / 60 / 4) : null,
    hr: b.hrN ? Math.round(b.hrSum / b.hrN) : null,
  }))

  // Volume hebdomadaire (min) sur 10 semaines pour le graphe (semaines vides à 0).
  function mondayOf(dt) {
    const x = new Date(dt)
    x.setHours(0, 0, 0, 0)
    const day = x.getDay() || 7
    x.setDate(x.getDate() - (day - 1))
    return x
  }
  const chartBuckets = {}
  const thisMonday = mondayOf(new Date())
  for (let i = 9; i >= 0; i -= 1) {
    const m = new Date(thisMonday)
    m.setDate(m.getDate() - i * 7)
    chartBuckets[m.toISOString().slice(0, 10)] = { min: 0, km: 0, sessions: 0, hrSum: 0, hrN: 0 }
  }
  for (const a of activities) {
    if (!a.started_at) continue
    const key = mondayOf(new Date(a.started_at)).toISOString().slice(0, 10)
    const b = chartBuckets[key]
    if (!b) continue
    b.min += Math.round(Number(a.duration_s || 0) / 60)
    b.km += Number(a.distance_m || 0) / 1000
    b.sessions += 1
    if (a.avg_hr) {
      b.hrSum += Number(a.avg_hr)
      b.hrN += 1
    }
  }
  const weeklyChart = Object.entries(chartBuckets).map(([week, v]) => ({
    week,
    min: v.min,
    km: Math.round(v.km * 10) / 10,
    sessions: v.sessions,
    hr: v.hrN ? Math.round(v.hrSum / v.hrN) : null,
  }))
  const hrWeeks = weeklyChart.filter((w) => w.hr != null).length
  const metric = CHART_METRICS[chartMetric]

  return (
    <main>
      <TopNav />
      <h1>Ta progression</h1>

      <PremiumBanner />

      <MeasurementSummaryRow measurements={measurements} />

      <MeasurementCard
        field={weightField.value}
        label={weightField.label}
        unit={weightField.unit}
        data={measurements}
        onAdded={loadMeasurements}
        featured
      />

      {measureView === 'hidden' ? (
        <button
          type="button"
          className="btn-secondary measurements-toggle"
          onClick={() => setMeasureView(filledOther.length ? 'filled' : 'all')}
        >
          {filledOther.length
            ? `Voir mes mensurations (${filledOther.length})`
            : '+ Ajouter une mensuration'}
        </button>
      ) : (
        <div className="measurements-panel">
          {shownFields.length > 0 && (
            <div className="measurement-grid">
              {shownFields.map((field) => (
                <MeasurementCard
                  key={field.value}
                  field={field.value}
                  label={field.label}
                  unit={field.unit}
                  data={measurements}
                  onAdded={loadMeasurements}
                />
              ))}
            </div>
          )}
          <div className="measurements-actions">
            {measureView === 'filled' && (
              <button type="button" className="btn-secondary" onClick={() => setMeasureView('all')}>
                + Ajouter une autre mesure
              </button>
            )}
            {measureView === 'all' && filledOther.length > 0 && (
              <button type="button" className="btn-secondary" onClick={() => setMeasureView('filled')}>
                Masquer les mesures vides
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={() => setMeasureView('hidden')}>
              Masquer mes mensurations
            </button>
          </div>
        </div>
      )}

      <h2>Séances de ta montre</h2>
      {activities.length === 0 ? (
        <p>
          Aucune séance importée. Connecte ta montre dans <Link to="/settings#objets">Réglages</Link>.
        </p>
      ) : (
        <>
          <div className="card">
            <div className="chart-metric-head">
              <p className="eyebrow wearable-list-title" style={{ marginTop: 0 }}>
                Volume hebdomadaire
              </p>
              <div className="chart-metric-switch" role="group" aria-label="Métrique du graphe">
                {Object.values(CHART_METRICS).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`chart-metric-btn${chartMetric === m.key ? ' is-active' : ''}`}
                    aria-pressed={chartMetric === m.key}
                    onClick={() => setChartMetric(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <WeeklyLoadChart data={weeklyChart} metricKey={metric.key} unit={metric.unit} />
          </div>
          {hrWeeks >= 2 && (
            <div className="card">
              <p className="eyebrow wearable-list-title" style={{ marginTop: 0 }}>
                FC moyenne par semaine (bpm)
              </p>
              <WeeklyHrChart data={weeklyChart} />
            </div>
          )}
          {weeklySummary.length > 0 && (
            <div className="card wearable-summary">
              <p className="eyebrow">Charge des 4 dernières semaines (par semaine)</p>
              <ul className="wearable-summary-list">
                {weeklySummary.map((s) => (
                  <li key={s.type}>
                    <strong>{s.type}</strong> : {s.perWeek} séance(s)
                    {s.min ? ` · ${s.min} min` : ''}
                    {s.km ? ` · ${s.km} km` : ''}
                    {s.hr ? ` · FC ${s.hr}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className="activity-cards">
            {activities.slice(0, showAllActivities ? 40 : 5).map((a) => {
              const raw = activityDetails[a.id]
              const detailRows = activityDetailRows(raw, a)
              return (
                <li key={a.id}>
                  <details className="activity-card" onToggle={(e) => e.target.open && loadActivityDetail(a.id)}>
                    <summary>
                      <span className="activity-emoji">{activityEmoji(a.activity_type)}</span>
                      <div className="activity-card-body">
                        <div className="activity-card-top">
                          <strong>{frActivityLabel(a.activity_type)}</strong>
                          <span className="eyebrow">
                            {a.started_at
                              ? new Date(a.started_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
                              : ''}
                          </span>
                        </div>
                        <div className="activity-chips">
                          {a.duration_s ? <span className="activity-chip">{Math.round(a.duration_s / 60)} min</span> : null}
                          {a.distance_m ? <span className="activity-chip">{(a.distance_m / 1000).toFixed(1)} km</span> : null}
                          {a.avg_hr ? <span className="activity-chip">❤️ {a.avg_hr}</span> : null}
                          {a.max_hr ? <span className="activity-chip">❤️max {a.max_hr}</span> : null}
                          {a.elevation_gain_m ? (
                            <span className="activity-chip">↑ {Math.round(a.elevation_gain_m)} m</span>
                          ) : null}
                          {a.calories ? <span className="activity-chip">{Math.round(a.calories)} kcal</span> : null}
                        </div>
                      </div>
                    </summary>
                    <div className="activity-card-detail">
                      {raw === 'loading' ? (
                        <p className="eyebrow">Chargement…</p>
                      ) : detailRows.length > 0 ? (
                        <ul className="activity-detail-rows">
                          {detailRows.map(([label, value]) => (
                            <li key={label}>
                              <span className="eyebrow">{label}</span>
                              <span>{value}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="eyebrow">Pas d'information supplémentaire pour cette séance.</p>
                      )}
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
          {activities.length > 5 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowAllActivities((v) => !v)}
            >
              {showAllActivities ? 'Afficher moins' : `Afficher plus (${activities.length - 5})`}
            </button>
          )}
        </>
      )}

      {activities.length >= 3 && (
        <>
          <h2>Analyse de ta charge</h2>
          <div className="card insight-card">
            {insight ? (
              <>
                <div className="insight-content">{insight.content}</div>
                <p className="eyebrow insight-date">
                  Généré le {new Date(insight.generated_at).toLocaleDateString('fr-CH')}
                </p>
              </>
            ) : (
              <p className="eyebrow">Une lecture IA de tes tendances : volume, fréquence cardiaque, charge, récup.</p>
            )}
            {insightError && <p role="alert">{insightError}</p>}
            <PremiumGate isPremium={isPremium} label="L'analyse de charge">
              <button type="button" className="btn-secondary" onClick={generateInsight} disabled={insightBusy}>
                {insightBusy ? 'Analyse en cours…' : insight ? 'Régénérer l’analyse' : 'Générer l’analyse'}
              </button>
            </PremiumGate>
          </div>
        </>
      )}


      {notes.length > 0 && (
        <>
          <h2>Notes de séance</h2>
          <ul className="notes-list">
            {notes.map((n, i) => (
              <li key={i} className="note-row">
                <span className="note-row-head">
                  <strong>{n.exercises?.name ?? 'Exercice'}</strong>
                  <span className="eyebrow">{new Date(n.created_at).toLocaleDateString('fr-CH')}</span>
                </span>
                <span className="note-row-text">{n.note}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
