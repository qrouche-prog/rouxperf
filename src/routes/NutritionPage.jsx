import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  computeMacroTargets,
  sessionsPerWeekFrom,
  sumEntries,
  macrosFromSplit,
  splitFromMacros,
} from '../lib/nutrition'
import { searchGenericFoods } from '../lib/genericFoods'
import TopNav from '../components/TopNav'
import BottomNav from '../components/BottomNav'
import BarcodeScanner from '../components/BarcodeScanner'
import PremiumGate from '../components/PremiumGate'

function todayIso() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

const EMPTY_FORM = { name: '', quantity_g: '', kcal: '', protein_g: '', carbs_g: '', fat_g: '' }

// Convertit un produit Open Food Facts en densité macros / 100 g.
function mapOffProduct(p) {
  if (!p?.product_name) return null
  const n = p.nutriments || {}
  let kcal100 = Number(n['energy-kcal_100g'])
  if (!Number.isFinite(kcal100)) {
    const kj = Number(n['energy_100g'])
    kcal100 = Number.isFinite(kj) ? kj / 4.184 : 0
  }
  const brand = String(p.brands ?? '').split(',')[0]?.trim()
  return {
    name: [p.product_name, brand].filter(Boolean).join(' · '),
    per100: {
      kcal: Number.isFinite(kcal100) ? kcal100 : 0,
      protein_g: Number(n['proteins_100g']) || 0,
      carbs_g: Number(n['carbohydrates_100g']) || 0,
      fat_g: Number(n['fat_100g']) || 0,
    },
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve({ base64: result.slice(comma + 1), mediaType: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

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

function planTotals(meals) {
  return (meals ?? []).reduce(
    (a, m) => {
      const t = mealTotals(m)
      return {
        kcal: a.kcal + t.kcal,
        protein_g: a.protein_g + t.protein_g,
        carbs_g: a.carbs_g + t.carbs_g,
        fat_g: a.fat_g + t.fat_g,
      }
    },
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
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [review, setReview] = useState(null)
  const [reviewNote, setReviewNote] = useState('')
  const [analyzeError, setAnalyzeError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [showScanner, setShowScanner] = useState(false)
  const [mealPlan, setMealPlan] = useState(null)
  const [planBusy, setPlanBusy] = useState(false)
  const [planError, setPlanError] = useState(null)
  const [planPrefs, setPlanPrefs] = useState('')
  const [addingMeal, setAddingMeal] = useState(null)
  const [customTarget, setCustomTarget] = useState(null)
  const [editingTargets, setEditingTargets] = useState(false)
  const [tForm, setTForm] = useState({ kcal: '', protein_pct: '', carbs_pct: '', fat_pct: '' })
  const [tSaving, setTSaving] = useState(false)
  const [tError, setTError] = useState(null)

  const day = todayIso()

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

  async function loadEntries() {
    const { data } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('consumed_on', day)
      .order('created_at', { ascending: true })
    setEntries(data ?? [])
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
      await Promise.all([loadEntries(), loadMealPlan(), loadTargets()])
      setStatus('idle')
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  if (status === 'loading') return null

  const computedTargets = computeMacroTargets({
    sex: profile?.sex,
    birthDate: profile?.birth_date,
    heightCm: profile?.height_cm,
    weightKg,
    goalType: goal?.goal_type,
    sessionsPerWeek: sessionsPerWeekFrom(trainingProfile),
  })
  // L'override utilisateur prime sur le calcul auto quand il existe.
  const targets = customTarget ? macrosFromSplit(customTarget.kcal, customTarget) : computedTargets

  const consumed = sumEntries(entries)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)
    const { error: insertError } = await supabase.from('food_entries').insert({
      user_id: user.id,
      consumed_on: day,
      name: form.name.trim(),
      quantity_g: form.quantity_g ? Number(form.quantity_g) : null,
      kcal: form.kcal ? Number(form.kcal) : 0,
      protein_g: form.protein_g ? Number(form.protein_g) : 0,
      carbs_g: form.carbs_g ? Number(form.carbs_g) : 0,
      fat_g: form.fat_g ? Number(form.fat_g) : 0,
      source: 'manual',
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setForm(EMPTY_FORM)
    await loadEntries()
  }

  async function handleDelete(id) {
    await supabase.from('food_entries').delete().eq('id', id)
    await loadEntries()
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

  async function addMealToJournal(meal) {
    setAddingMeal(meal.name)
    const rows = (meal.items ?? []).map((it) => ({
      user_id: user.id,
      consumed_on: day,
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
    await loadEntries()
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner la même photo
    if (!file) return
    setAnalyzing(true)
    setAnalyzeError(null)
    setReview(null)
    setReviewNote('')
    try {
      const { base64, mediaType } = await fileToBase64(file)
      const { data, error: fnError } = await supabase.functions.invoke('analyze-meal', {
        body: { image_base64: base64, media_type: mediaType },
      })
      if (fnError) {
        let msg = fnError.message
        try {
          const body = await fnError.context?.json?.()
          if (body?.error) msg = body.error
        } catch {
          // ignore
        }
        throw new Error(msg)
      }
      if (data?.error) throw new Error(data.error)
      const items = (data?.items ?? []).map((it) => {
        const qty = Number(it.quantity_g) > 0 ? Number(it.quantity_g) : 100
        const macros = {
          kcal: Number(it.kcal ?? 0),
          protein_g: Number(it.protein_g ?? 0),
          carbs_g: Number(it.carbs_g ?? 0),
          fat_g: Number(it.fat_g ?? 0),
        }
        // Densité par 100 g : sert de base pour recalculer les macros quand on
        // ajuste la portion.
        const per100 = {
          kcal: (macros.kcal / qty) * 100,
          protein_g: (macros.protein_g / qty) * 100,
          carbs_g: (macros.carbs_g / qty) * 100,
          fat_g: (macros.fat_g / qty) * 100,
        }
        return {
          name: it.name ?? '',
          quantity_g: qty,
          kcal: Math.round(macros.kcal),
          protein_g: Math.round(macros.protein_g),
          carbs_g: Math.round(macros.carbs_g),
          fat_g: Math.round(macros.fat_g),
          per100,
        }
      })
      setReview(items)
      setReviewNote(data?.note ?? '')
    } catch (err) {
      setAnalyzeError(err.message || 'Analyse impossible')
    } finally {
      setAnalyzing(false)
    }
  }

  async function searchFood(e) {
    if (e) e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    setSearching(true)
    setSearchError(null)
    // Aliments génériques CIQUAL (banane, riz…) d'abord.
    const generics = await searchGenericFoods(q)
    setSearchResults(generics)
    try {
      const url =
        'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=12' +
        '&fields=product_name,brands,nutriments&search_terms=' +
        encodeURIComponent(q)
      const res = await fetch(url)
      const json = res.ok ? await res.json() : { products: [] }
      const offResults = (json.products ?? [])
        .map(mapOffProduct)
        .filter(Boolean)
        .map((r) => ({ ...r, kind: 'off' }))
        .slice(0, 8)
      const all = [...generics, ...offResults]
      setSearchResults(all)
      if (all.length === 0) setSearchError('Aucun aliment trouvé.')
    } catch {
      // OFF indisponible : on garde au moins les aliments génériques.
      if (generics.length === 0) setSearchError('Recherche indisponible.')
    } finally {
      setSearching(false)
    }
  }

  async function handleBarcode(code) {
    setShowScanner(false)
    setSearchError(null)
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,nutriments`
      )
      const json = await res.json()
      if (json.status !== 1 || !json.product) {
        setSearchError(`Code ${code} introuvable dans Open Food Facts.`)
        return
      }
      const mapped = mapOffProduct(json.product)
      if (!mapped) {
        setSearchError('Produit trouvé mais sans données nutritionnelles.')
        return
      }
      addFromSearch(mapped)
    } catch (err) {
      setSearchError(err.message || 'Lecture du code-barres impossible')
    }
  }

  function addFromSearch(result) {
    const item = {
      name: result.name,
      quantity_g: 100,
      kcal: Math.round(result.per100.kcal),
      protein_g: Math.round(result.per100.protein_g),
      carbs_g: Math.round(result.per100.carbs_g),
      fat_g: Math.round(result.per100.fat_g),
      per100: { ...result.per100 },
    }
    setReview((r) => [...(r ?? []), item])
    setReviewNote('')
    setSearchResults([])
    setSearchQuery('')
  }

  function updateReviewItem(index, key, value) {
    setReview((r) =>
      r.map((it, i) => {
        if (i !== index) return it
        if (key === 'name') return { ...it, name: value }

        if (key === 'quantity_g') {
          // La portion pilote les macros : on recalcule depuis la densité/100 g.
          const qty = Number(value)
          const next = { ...it, quantity_g: value }
          if (Number.isFinite(qty) && qty >= 0) {
            next.kcal = Math.round((it.per100.kcal * qty) / 100)
            next.protein_g = Math.round((it.per100.protein_g * qty) / 100)
            next.carbs_g = Math.round((it.per100.carbs_g * qty) / 100)
            next.fat_g = Math.round((it.per100.fat_g * qty) / 100)
          }
          return next
        }

        // Édition directe d'un macro → on met à jour sa densité pour rester
        // cohérent lors des prochains changements de portion.
        const next = { ...it, [key]: value }
        const qty = Number(it.quantity_g)
        const v = Number(value)
        if (Number.isFinite(qty) && qty > 0 && Number.isFinite(v)) {
          next.per100 = { ...it.per100, [key]: (v / qty) * 100 }
        }
        return next
      })
    )
  }

  function removeReviewItem(index) {
    setReview((r) => r.filter((_, i) => i !== index))
  }

  async function saveReview() {
    if (!review || review.length === 0) {
      setReview(null)
      return
    }
    setSaving(true)
    setError(null)
    const rows = review.map((it) => ({
      user_id: user.id,
      consumed_on: day,
      name: (it.name || 'Aliment').trim(),
      quantity_g: it.quantity_g ? Number(it.quantity_g) : null,
      kcal: Number(it.kcal || 0),
      protein_g: Number(it.protein_g || 0),
      carbs_g: Number(it.carbs_g || 0),
      fat_g: Number(it.fat_g || 0),
      source: 'photo',
    }))
    const { error: insErr } = await supabase.from('food_entries').insert(rows)
    setSaving(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setReview(null)
    setReviewNote('')
    await loadEntries()
  }

  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <main>
      <TopNav />
      <h1>Nutrition</h1>
      <p className="eyebrow">Aujourd'hui</p>

      <div className="card">
        {targets ? (
          <>
            <MacroBar label="Calories" unit="kcal" consumed={consumed.kcal} target={targets.kcal} />
            <MacroBar label="Protéines" unit="g" consumed={consumed.protein_g} target={targets.protein_g} />
            <MacroBar label="Glucides" unit="g" consumed={consumed.carbs_g} target={targets.carbs_g} />
            <MacroBar label="Lipides" unit="g" consumed={consumed.fat_g} target={targets.fat_g} />
            <p className="nutrition-disclaimer">
              {customTarget
                ? 'Cibles personnalisées (répartition que tu as fixée) — un repère indicatif, pas un avis diététique.'
                : 'Cibles calculées à partir de ton profil (poids, taille, âge, objectif) — un repère indicatif, pas un avis diététique.'}
            </p>
          </>
        ) : (
          <p>
            Complète ton profil (poids, taille, date de naissance, sexe) dans{' '}
            <Link to="/settings#infos">Réglages</Link> et enregistre un poids dans{' '}
            <Link to="/progress">Progression</Link> pour un calcul automatique — ou fixe tes cibles à la main
            ci-dessous.
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
                  <input
                    type="number"
                    inputMode="numeric"
                    value={tForm.kcal}
                    onChange={(e) => setTForm((f) => ({ ...f, kcal: e.target.value }))}
                  />
                </label>
                <div className="target-split">
                  <label>
                    <span>Protéines %</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={tForm.protein_pct}
                      onChange={(e) => setTForm((f) => ({ ...f, protein_pct: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Glucides %</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={tForm.carbs_pct}
                      onChange={(e) => setTForm((f) => ({ ...f, carbs_pct: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Lipides %</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={tForm.fat_pct}
                      onChange={(e) => setTForm((f) => ({ ...f, fat_pct: e.target.value }))}
                    />
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

      {targets && (
        <section className="card meal-plan-card">
          <h2>Plan repas du jour</h2>
          {mealPlan?.content?.meals?.length ? (
            <>
              {(() => {
                const t = planTotals(mealPlan.content.meals)
                return (
                  <p className="meal-plan-total eyebrow">
                    Total du menu : {t.kcal} kcal · P {t.protein_g} · G {t.carbs_g} · L {t.fat_g}
                    {mealPlan.targets ? ` (cibles ${mealPlan.targets.kcal} / ${mealPlan.targets.protein_g} / ${mealPlan.targets.carbs_g} / ${mealPlan.targets.fat_g})` : ''}
                  </p>
                )
              })()}
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
                      onClick={() => addMealToJournal(meal)}
                      disabled={addingMeal === meal.name}
                    >
                      {addingMeal === meal.name ? 'Ajout…' : 'Ajouter au journal'}
                    </button>
                  </div>
                )
              })}
              {mealPlan.content.tips && <p className="nutrition-disclaimer">{mealPlan.content.tips}</p>}
              <p className="eyebrow">
                Généré le {new Date(mealPlan.generated_at).toLocaleDateString('fr-CH')}
              </p>
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
        </section>
      )}

      <section className="card">
        <h2>Ajouter par photo</h2>
        <p className="eyebrow">
          Prends ton repas en photo : l'IA estime les aliments et les macros. Tu ajustes avant d'enregistrer.
        </p>
        <PremiumGate isPremium={isPremium} label="L'analyse photo">
          <label className={`btn-primary photo-btn${analyzing ? ' photo-btn-loading' : ''}`}>
            {analyzing ? 'Analyse en cours…' : '📷 Photographier un repas'}
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} disabled={analyzing} hidden />
          </label>
        </PremiumGate>
        {analyzeError && <p role="alert">{analyzeError}</p>}
      </section>

      <section className="card">
        <h2>Rechercher un aliment</h2>
        <form className="food-search" onSubmit={searchFood}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ex. yaourt nature, banane…"
            autoComplete="off"
          />
          <button type="submit" className="btn-primary" disabled={searching || !searchQuery.trim()}>
            {searching ? '…' : 'Chercher'}
          </button>
        </form>
        <button
          type="button"
          className="btn-secondary food-scan-btn"
          onClick={() => {
            setSearchError(null)
            setShowScanner(true)
          }}
        >
          🔦 Scanner un code-barres
        </button>
        {searchError && <p className="eyebrow">{searchError}</p>}
        {searchResults.length > 0 && (
          <ul className="search-results">
            {searchResults.map((r, i) => (
              <li key={i}>
                <button type="button" className="search-result" onClick={() => addFromSearch(r)}>
                  <span className="search-result-name">
                    {r.name}
                    <span className={`search-result-tag${r.kind === 'generic' ? ' search-result-tag-generic' : ''}`}>
                      {r.kind === 'generic' ? 'aliment' : 'produit'}
                    </span>
                  </span>
                  <span className="eyebrow">
                    {Math.round(r.per100.kcal)} kcal · P {Math.round(r.per100.protein_g)} · G{' '}
                    {Math.round(r.per100.carbs_g)} · L {Math.round(r.per100.fat_g)} / 100 g
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="nutrition-disclaimer">
          Sources : table CIQUAL (ANSES) pour les aliments génériques, Open Food Facts pour les produits de
          marque. Ajoute un aliment, puis ajuste la portion.
        </p>
      </section>

      {review !== null && (
        <section className="card">
          <h2>À enregistrer</h2>
          {reviewNote && <p className="eyebrow">{reviewNote}</p>}
          {review.length === 0 ? (
            <p>Aucun aliment détecté sur la photo.</p>
          ) : (
            <ul className="review-list">
              {review.map((it, i) => (
                <li key={i} className="review-item">
                  <div className="review-item-head">
                    <input
                      className="review-name"
                      value={it.name}
                      onChange={(e) => updateReviewItem(i, 'name', e.target.value)}
                      placeholder="Aliment"
                    />
                    <button
                      type="button"
                      className="food-entry-delete"
                      onClick={() => removeReviewItem(i)}
                      aria-label="Retirer"
                    >
                      🗑
                    </button>
                  </div>
                  <div className="review-macros">
                    <label>
                      <span>g</span>
                      <input type="number" inputMode="decimal" value={it.quantity_g} onChange={(e) => updateReviewItem(i, 'quantity_g', e.target.value)} />
                    </label>
                    <label>
                      <span>kcal</span>
                      <input type="number" inputMode="decimal" value={it.kcal} onChange={(e) => updateReviewItem(i, 'kcal', e.target.value)} />
                    </label>
                    <label>
                      <span>P</span>
                      <input type="number" inputMode="decimal" value={it.protein_g} onChange={(e) => updateReviewItem(i, 'protein_g', e.target.value)} />
                    </label>
                    <label>
                      <span>G</span>
                      <input type="number" inputMode="decimal" value={it.carbs_g} onChange={(e) => updateReviewItem(i, 'carbs_g', e.target.value)} />
                    </label>
                    <label>
                      <span>L</span>
                      <input type="number" inputMode="decimal" value={it.fat_g} onChange={(e) => updateReviewItem(i, 'fat_g', e.target.value)} />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="review-actions">
            <button type="button" className="btn-primary" onClick={saveReview} disabled={saving || review.length === 0}>
              {saving ? 'Enregistrement…' : `Enregistrer${review.length > 1 ? ` (${review.length})` : ''}`}
            </button>
            <button type="button" className="link-button" onClick={() => { setReview(null); setReviewNote('') }}>
              Annuler
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Ajouter un aliment</h2>
        <form className="nutrition-form" onSubmit={handleAdd}>
          <label htmlFor="food-name">Aliment</label>
          <input
            id="food-name"
            type="text"
            value={form.name}
            onChange={field('name')}
            placeholder="ex. Poulet grillé"
            autoComplete="off"
          />

          <div className="nutrition-form-grid">
            <label>
              <span>Quantité (g)</span>
              <input type="number" inputMode="decimal" value={form.quantity_g} onChange={field('quantity_g')} />
            </label>
            <label>
              <span>Calories</span>
              <input type="number" inputMode="decimal" value={form.kcal} onChange={field('kcal')} />
            </label>
            <label>
              <span>Protéines (g)</span>
              <input type="number" inputMode="decimal" value={form.protein_g} onChange={field('protein_g')} />
            </label>
            <label>
              <span>Glucides (g)</span>
              <input type="number" inputMode="decimal" value={form.carbs_g} onChange={field('carbs_g')} />
            </label>
            <label>
              <span>Lipides (g)</span>
              <input type="number" inputMode="decimal" value={form.fat_g} onChange={field('fat_g')} />
            </label>
          </div>

          {error && <p role="alert">{error}</p>}
          <button type="submit" className="btn-primary" disabled={saving || !form.name.trim()}>
            {saving ? 'Ajout…' : 'Ajouter'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Journal du jour</h2>
        {entries.length === 0 ? (
          <p className="eyebrow">Aucun aliment enregistré aujourd'hui.</p>
        ) : (
          <ul className="food-entry-list">
            {entries.map((entry) => (
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
      </section>

      {showScanner && <BarcodeScanner onDetected={handleBarcode} onClose={() => setShowScanner(false)} />}

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
