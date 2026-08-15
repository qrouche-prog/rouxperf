import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  computeMacroTargets,
  sessionsPerWeekFrom,
  sumEntries,
  macrosFromSplit,
  splitFromMacros,
} from '../lib/nutrition'
import { MEALS, MEAL_KEYS, mealKeyFromName, todayIso } from '../lib/meals'
import TopNav from '../components/TopNav'
import BottomNav from '../components/BottomNav'
import PremiumGate from '../components/PremiumGate'
import WeeklyKcalChart from '../components/nutrition/WeeklyKcalChart'

function mealTotals(meal) {
  return (meal?.items ?? []).reduce(
    (a, it) => ({
      kcal: a.kcal + Math.round(Number(it.kcal) || 0),
      protein_g: a.protein_g + Math.round(Number(it.protein_g) || 0),
      carbs_g: a.carbs_g + Math.round(Number(it.carbs_g) || 0),
      fat_g: a.fat_g + Math.round(Number(it.fat_g) || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )
}

function MacroBar({ label, unit, consumed, target }) {
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0
  const over = target > 0 && consumed > target
  return (
    <div className="macro-bar">
      <div className="macro-bar-head">
        <span className="macro-bar-label">{label}</span>
        <span className="macro-bar-values">
          <strong>{Math.round(consumed)}</strong>
          {target ? ` / ${target}` : ''} {unit}
        </span>
      </div>
      <div className="macro-bar-track">
        <div className={`macro-bar-fill${over ? ' macro-bar-fill-over' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function NutritionPage() {
  const { user, profile, isPremium } = useAuth()
  const [weightKg, setWeightKg] = useState(null)
  const [goal, setGoal] = useState(null)
  const [trainingProfile, setTrainingProfile] = useState(null)
  const [entries, setEntries] = useState([])
  const [status, setStatus] = useState('loading')
  const [customTarget, setCustomTarget] = useState(null)
  const [editingTargets, setEditingTargets] = useState(false)
  const [tForm, setTForm] = useState({ kcal: '', protein_pct: '', carbs_pct: '', fat_pct: '' })
  const [tSaving, setTSaving] = useState(false)
  const [tError, setTError] = useState(null)
  const [mealPlan, setMealPlan] = useState(null)
  const [showPlan, setShowPlan] = useState(false)
  const [planBusy, setPlanBusy] = useState(false)
  const [planError, setPlanError] = useState(null)
  const [planPrefs, setPlanPrefs] = useState('')
  const [addingMeal, setAddingMeal] = useState(null)
  const [copyMeal, setCopyMeal] = useState(null)
  const [copyDate, setCopyDate] = useState('')
  const [copyMsg, setCopyMsg] = useState(null)
  const [weekDays, setWeekDays] = useState([])
  const [showWeek, setShowWeek] = useState(false)
  const [params] = useSearchParams()
  const dayParam = params.get('day')
  const [selectedDay, setSelectedDay] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(dayParam ?? '') ? dayParam : todayIso()
  )
  const day = selectedDay

  async function loadEntries(d) {
    const { data } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('consumed_on', d)
      .order('created_at', { ascending: true })
    setEntries(data ?? [])
  }

  function shiftDay(delta) {
    const d = new Date(`${selectedDay}T00:00:00`)
    d.setDate(d.getDate() + delta)
    const tz = d.getTimezoneOffset() * 60000
    setSelectedDay(new Date(d.getTime() - tz).toISOString().slice(0, 10))
  }

  function prevDayIso(iso) {
    const d = new Date(`${iso}T00:00:00`)
    d.setDate(d.getDate() - 1)
    const tz = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - tz).toISOString().slice(0, 10)
  }

  function toggleCopy(mealKey) {
    setCopyMsg(null)
    if (copyMeal === mealKey) {
      setCopyMeal(null)
      return
    }
    setCopyDate(prevDayIso(selectedDay))
    setCopyMeal(mealKey)
  }

  // Recopie un repas d'un autre jour vers le jour affiché.
  async function copyMealFrom(mealKey) {
    if (!copyDate) return
    setCopyMsg(null)
    const { data } = await supabase
      .from('food_entries')
      .select('name, quantity_g, kcal, protein_g, carbs_g, fat_g')
      .eq('user_id', user.id)
      .eq('consumed_on', copyDate)
      .eq('meal_type', mealKey)
    if (!data || data.length === 0) {
      setCopyMsg('Aucun aliment à copier pour ce repas ce jour-là.')
      return
    }
    const rows = data.map((e) => ({
      user_id: user.id,
      consumed_on: selectedDay,
      meal_type: mealKey,
      name: e.name,
      quantity_g: e.quantity_g,
      kcal: e.kcal,
      protein_g: e.protein_g,
      carbs_g: e.carbs_g,
      fat_g: e.fat_g,
      source: 'manual',
    }))
    const { error: insErr } = await supabase.from('food_entries').insert(rows)
    if (insErr) {
      setCopyMsg(insErr.message)
      return
    }
    setCopyMeal(null)
    await loadEntries(selectedDay)
  }

  function dayLabel(iso) {
    const today = todayIso()
    if (iso === today) return "Aujourd'hui"
    const diff = Math.round((new Date(`${iso}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
    if (diff === -1) return 'Hier'
    if (diff === 1) return 'Demain'
    return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-CH', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }

  async function loadWeek() {
    const today = todayIso()
    const sinceDate = new Date(`${today}T00:00:00`)
    sinceDate.setDate(sinceDate.getDate() - 6)
    const sinceIso = new Date(sinceDate.getTime() - sinceDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    const { data } = await supabase
      .from('food_entries')
      .select('consumed_on, kcal, protein_g, carbs_g, fat_g')
      .eq('user_id', user.id)
      .gte('consumed_on', sinceIso)
    const buckets = {}
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(`${today}T00:00:00`)
      d.setDate(d.getDate() - i)
      const key = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
      buckets[key] = { day: key, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    }
    for (const e of data ?? []) {
      const b = buckets[e.consumed_on]
      if (!b) continue
      b.kcal += Number(e.kcal) || 0
      b.protein_g += Number(e.protein_g) || 0
      b.carbs_g += Number(e.carbs_g) || 0
      b.fat_g += Number(e.fat_g) || 0
    }
    setWeekDays(
      Object.values(buckets).map((b) => ({
        day: b.day,
        kcal: Math.round(b.kcal),
        protein_g: Math.round(b.protein_g),
        carbs_g: Math.round(b.carbs_g),
        fat_g: Math.round(b.fat_g),
      }))
    )
  }

  async function loadTargets() {
    const { data } = await supabase
      .from('nutrition_targets')
      .select('kcal, protein_pct, carbs_pct, fat_pct')
      .eq('user_id', user.id)
      .maybeSingle()
    setCustomTarget(data ?? null)
  }

  async function loadMealPlan() {
    const { data } = await supabase
      .from('meal_plans')
      .select('content, targets, generated_at')
      .eq('user_id', user.id)
      .maybeSingle()
    setMealPlan(data ?? null)
  }

  useEffect(() => {
    async function load() {
      const [{ data: measurement }, { data: goalData }, { data: tp }] = await Promise.all([
        supabase
          .from('body_measurements')
          .select('weight_kg')
          .eq('user_id', user.id)
          .order('measured_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('goals')
          .select('goal_type')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('user_training_profile')
          .select('focus_area_preferences, preferred_days')
          .eq('user_id', user.id)
          .maybeSingle(),
      ])
      setWeightKg(measurement?.weight_kg ?? null)
      setGoal(goalData)
      setTrainingProfile(tp)
      await Promise.all([loadMealPlan(), loadTargets()])
      setStatus('idle')
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  useEffect(() => {
    loadEntries(selectedDay)
    loadWeek()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, selectedDay])

  if (status === 'loading') return null

  const computedTargets = computeMacroTargets({
    sex: profile?.sex,
    birthDate: profile?.birth_date,
    heightCm: profile?.height_cm,
    weightKg,
    goalType: goal?.goal_type,
    sessionsPerWeek: sessionsPerWeekFrom(trainingProfile),
  })
  const targets = customTarget ? macrosFromSplit(customTarget.kcal, customTarget) : computedTargets
  const consumed = sumEntries(entries)

  const mealBuckets = { breakfast: [], lunch: [], dinner: [], snack: [], other: [] }
  for (const e of entries) {
    const k = MEAL_KEYS.includes(e.meal_type) ? e.meal_type : 'other'
    mealBuckets[k].push(e)
  }

  const loggedWeek = weekDays.filter((d) => d.kcal > 0)
  const weekAvg = loggedWeek.length
    ? {
        kcal: Math.round(loggedWeek.reduce((s, d) => s + d.kcal, 0) / loggedWeek.length),
        protein_g: Math.round(loggedWeek.reduce((s, d) => s + d.protein_g, 0) / loggedWeek.length),
        carbs_g: Math.round(loggedWeek.reduce((s, d) => s + d.carbs_g, 0) / loggedWeek.length),
        fat_g: Math.round(loggedWeek.reduce((s, d) => s + d.fat_g, 0) / loggedWeek.length),
      }
    : null

  async function handleDelete(id) {
    await supabase.from('food_entries').delete().eq('id', id)
    await loadEntries(selectedDay)
  }

  function openTargetEditor() {
    const base =
      customTarget ??
      (computedTargets
        ? { kcal: computedTargets.kcal, ...splitFromMacros(computedTargets) }
        : { kcal: 2000, protein_pct: 30, carbs_pct: 40, fat_pct: 30 })
    setTForm({
      kcal: String(base.kcal),
      protein_pct: String(base.protein_pct),
      carbs_pct: String(base.carbs_pct),
      fat_pct: String(base.fat_pct),
    })
    setTError(null)
    setEditingTargets(true)
  }

  async function saveTargets() {
    const kcal = Math.round(Number(tForm.kcal))
    const p = Math.round(Number(tForm.protein_pct))
    const c = Math.round(Number(tForm.carbs_pct))
    const f = Math.round(Number(tForm.fat_pct))
    if (!Number.isFinite(kcal) || kcal <= 0) {
      setTError('Indique un total de calories valide.')
      return
    }
    if (p + c + f !== 100) {
      setTError(`Les pourcentages doivent totaliser 100 % (actuellement ${p + c + f} %).`)
      return
    }
    setTSaving(true)
    setTError(null)
    const { error: upErr } = await supabase.from('nutrition_targets').upsert(
      { user_id: user.id, kcal, protein_pct: p, carbs_pct: c, fat_pct: f, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    setTSaving(false)
    if (upErr) {
      setTError(upErr.message)
      return
    }
    setCustomTarget({ kcal, protein_pct: p, carbs_pct: c, fat_pct: f })
    setEditingTargets(false)
  }

  async function resetTargets() {
    setTSaving(true)
    await supabase.from('nutrition_targets').delete().eq('user_id', user.id)
    setTSaving(false)
    setCustomTarget(null)
    setEditingTargets(false)
  }

  async function generatePlan() {
    if (!targets) return
    setPlanBusy(true)
    setPlanError(null)
    const { data, error: fnError } = await supabase.functions.invoke('generate-meal-plan', {
      body: { targets, goalType: goal?.goal_type, preferences: planPrefs.trim() },
    })
    setPlanBusy(false)
    if (fnError || data?.error) {
      let msg = data?.error
      if (!msg && fnError?.context?.json) {
        try {
          const b = await fnError.context.json()
          msg = b?.error
        } catch {
          // ignore
        }
      }
      setPlanError(msg || 'Génération indisponible pour le moment.')
      return
    }
    setMealPlan({ content: data.content, targets: data.targets, generated_at: data.generated_at })
  }

  async function addPlanMeal(meal) {
    setAddingMeal(meal.name)
    const mealType = mealKeyFromName(meal.name, 'snack')
    const rows = (meal.items ?? []).map((it) => ({
      user_id: user.id,
      consumed_on: day,
      meal_type: mealType,
      name: (it.food || 'Aliment').trim(),
      quantity_g: Number(it.quantity_g) > 0 ? Number(it.quantity_g) : null,
      kcal: Number(it.kcal) || 0,
      protein_g: Number(it.protein_g) || 0,
      carbs_g: Number(it.carbs_g) || 0,
      fat_g: Number(it.fat_g) || 0,
      source: 'plan',
    }))
    if (rows.length > 0) await supabase.from('food_entries').insert(rows)
    setAddingMeal(null)
    await loadEntries(selectedDay)
  }

  return (
    <main>
      <TopNav />
      <h1>Nutrition</h1>
      <div className="day-nav">
        <button type="button" className="nav-arrow" onClick={() => shiftDay(-1)} aria-label="Jour précédent">
          ‹
        </button>
        <span className="day-nav-label">{dayLabel(selectedDay)}</span>
        <button type="button" className="nav-arrow" onClick={() => shiftDay(1)} aria-label="Jour suivant">
          ›
        </button>
      </div>

      <div className="card">
        {targets ? (
          <>
            <MacroBar label="Calories" unit="kcal" consumed={consumed.kcal} target={targets.kcal} />
            <MacroBar label="Protéines" unit="g" consumed={consumed.protein_g} target={targets.protein_g} />
            <MacroBar label="Glucides" unit="g" consumed={consumed.carbs_g} target={targets.carbs_g} />
            <MacroBar label="Lipides" unit="g" consumed={consumed.fat_g} target={targets.fat_g} />
          </>
        ) : (
          <p>
            Complète ton profil dans <Link to="/settings#infos">Réglages</Link> et enregistre un poids dans{' '}
            <Link to="/progress">Progression</Link> pour un calcul automatique — ou fixe tes cibles à la main.
          </p>
        )}

        {!editingTargets ? (
          <button type="button" className="btn-secondary target-edit-btn" onClick={openTargetEditor}>
            Ajuster mes cibles
          </button>
        ) : (
          (() => {
            const sum =
              (Math.round(Number(tForm.protein_pct)) || 0) +
              (Math.round(Number(tForm.carbs_pct)) || 0) +
              (Math.round(Number(tForm.fat_pct)) || 0)
            const preview = macrosFromSplit(tForm.kcal, tForm)
            return (
              <div className="target-editor">
                <label className="target-kcal">
                  <span>Calories (kcal)</span>
                  <input type="number" inputMode="numeric" value={tForm.kcal} onChange={(e) => setTForm((f) => ({ ...f, kcal: e.target.value }))} />
                </label>
                <div className="target-split">
                  <label>
                    <span>Protéines %</span>
                    <input type="number" inputMode="numeric" value={tForm.protein_pct} onChange={(e) => setTForm((f) => ({ ...f, protein_pct: e.target.value }))} />
                  </label>
                  <label>
                    <span>Glucides %</span>
                    <input type="number" inputMode="numeric" value={tForm.carbs_pct} onChange={(e) => setTForm((f) => ({ ...f, carbs_pct: e.target.value }))} />
                  </label>
                  <label>
                    <span>Lipides %</span>
                    <input type="number" inputMode="numeric" value={tForm.fat_pct} onChange={(e) => setTForm((f) => ({ ...f, fat_pct: e.target.value }))} />
                  </label>
                </div>
                <p className={`target-sum${sum !== 100 ? ' target-sum-bad' : ''}`}>
                  Total : {sum} % {sum === 100 ? '✓' : '— doit faire 100 %'}
                </p>
                <p className="eyebrow">
                  ≈ {preview.protein_g} g protéines · {preview.carbs_g} g glucides · {preview.fat_g} g lipides
                </p>
                {tError && <p role="alert">{tError}</p>}
                <div className="review-actions">
                  <button type="button" className="btn-primary" onClick={saveTargets} disabled={tSaving}>
                    {tSaving ? 'Enregistrement…' : 'Enregistrer mes cibles'}
                  </button>
                  {customTarget && (
                    <button type="button" className="link-button" onClick={resetTargets} disabled={tSaving}>
                      Revenir au calcul auto
                    </button>
                  )}
                  <button type="button" className="link-button" onClick={() => setEditingTargets(false)}>
                    Annuler
                  </button>
                </div>
              </div>
            )
          })()
        )}
      </div>

      {[...MEALS, { key: 'other', label: 'Autre' }].map((m) => {
        const items = mealBuckets[m.key]
        if (m.key === 'other' && items.length === 0) return null
        const t = sumEntries(items)
        return (
          <section key={m.key} className="card meal-section">
            <div className="meal-section-head">
              <h2>{m.label}</h2>
              <span className="eyebrow">{Math.round(t.kcal)} kcal</span>
            </div>
            {items.length === 0 ? (
              <p className="eyebrow meal-empty">Aucun aliment.</p>
            ) : (
              <ul className="food-entry-list">
                {items.map((entry) => (
                  <li key={entry.id} className="food-entry">
                    <span className="food-entry-info">
                      <strong>{entry.name}</strong>
                      <span className="eyebrow">
                        {entry.quantity_g ? `${entry.quantity_g} g · ` : ''}
                        {Math.round(entry.kcal)} kcal · P {Math.round(entry.protein_g)} · G{' '}
                        {Math.round(entry.carbs_g)} · L {Math.round(entry.fat_g)}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="food-entry-delete"
                      onClick={() => handleDelete(entry.id)}
                      aria-label={`Supprimer ${entry.name}`}
                    >
                      🗑
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {m.key !== 'other' && (
              <>
                <Link to={`/nutrition/add?meal=${m.key}&day=${selectedDay}`} className="btn-secondary meal-add-food">
                  + Ajouter un aliment
                </Link>
                <button type="button" className="link-button meal-copy-toggle" onClick={() => toggleCopy(m.key)}>
                  Copier un repas d'un autre jour
                </button>
                {copyMeal === m.key && (
                  <div className="meal-copy">
                    <input
                      type="date"
                      max={todayIso()}
                      value={copyDate}
                      onChange={(e) => setCopyDate(e.target.value)}
                      aria-label="Jour source"
                    />
                    <button type="button" className="btn-secondary" onClick={() => copyMealFrom(m.key)}>
                      Copier vers {m.label.toLowerCase()}
                    </button>
                    {copyMsg && <p className="eyebrow">{copyMsg}</p>}
                  </div>
                )}
              </>
            )}
          </section>
        )
      })}

      <section className="card">
        {!showPlan ? (
          <button type="button" className="btn-secondary meal-add-food" onClick={() => setShowPlan(true)}>
            🍽️ Plan repas du jour (IA)
          </button>
        ) : (
          <div className="meal-plan-card">
            <h2>Plan repas du jour</h2>
            {mealPlan?.content?.meals?.length ? (
              <>
                {mealPlan.content.meals.map((meal, mi) => {
                  const t = mealTotals(meal)
                  return (
                    <div key={mi} className="meal-block">
                      <div className="meal-block-head">
                        <strong>{meal.name}</strong>
                        <span className="eyebrow">
                          {t.kcal} kcal · P {t.protein_g} · G {t.carbs_g} · L {t.fat_g}
                        </span>
                      </div>
                      <ul className="meal-items">
                        {(meal.items ?? []).map((it, ii) => (
                          <li key={ii}>
                            <span>
                              {it.food} · {Math.round(Number(it.quantity_g) || 0)} g
                            </span>
                            <span className="eyebrow">{Math.round(Number(it.kcal) || 0)} kcal</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="btn-secondary meal-add-btn"
                        onClick={() => addPlanMeal(meal)}
                        disabled={addingMeal === meal.name}
                      >
                        {addingMeal === meal.name ? 'Ajout…' : 'Ajouter au journal'}
                      </button>
                    </div>
                  )
                })}
                {mealPlan.content.tips && <p className="nutrition-disclaimer">{mealPlan.content.tips}</p>}
              </>
            ) : (
              <p className="eyebrow">Un menu complet du jour, calé sur tes cibles de macros.</p>
            )}
            <textarea
              className="meal-plan-prefs"
              value={planPrefs}
              onChange={(e) => setPlanPrefs(e.target.value)}
              placeholder="Préférences (optionnel) : végétarien, sans lactose, aliments à éviter…"
              rows={2}
            />
            {planError && <p role="alert">{planError}</p>}
            <PremiumGate isPremium={isPremium} label="La génération de plan repas">
              <button type="button" className="btn-primary" onClick={generatePlan} disabled={planBusy}>
                {planBusy ? 'Génération…' : mealPlan ? 'Régénérer le plan' : 'Générer un plan repas'}
              </button>
            </PremiumGate>
            <button type="button" className="link-button" onClick={() => setShowPlan(false)}>
              Masquer
            </button>
          </div>
        )}
      </section>

      <section className="card">
        {!showWeek ? (
          <button type="button" className="btn-secondary meal-add-food" onClick={() => setShowWeek(true)}>
            📈 7 derniers jours
          </button>
        ) : (
          <div>
            <div className="meal-section-head">
              <h2>7 derniers jours</h2>
              <span className="eyebrow">{loggedWeek.length}/7 jours loggés</span>
            </div>
            <WeeklyKcalChart data={weekDays} target={targets?.kcal} />
            {weekAvg ? (
              <p className="eyebrow">
                Moyenne : {weekAvg.kcal} kcal · P {weekAvg.protein_g} · G {weekAvg.carbs_g} · L {weekAvg.fat_g}
                {targets ? ` — cible ${targets.kcal} kcal` : ''}
              </p>
            ) : (
              <p className="eyebrow">Logue tes repas pour voir ta moyenne.</p>
            )}
            <button type="button" className="link-button" onClick={() => setShowWeek(false)}>
              Masquer
            </button>
          </div>
        )}
      </section>

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
