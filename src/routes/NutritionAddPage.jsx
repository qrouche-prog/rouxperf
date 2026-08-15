import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { searchGenericFoods } from '../lib/genericFoods'
import { MEALS, MEAL_KEYS, MEAL_LABEL, todayIso } from '../lib/meals'
import BottomNav from '../components/BottomNav'
import BarcodeScanner from '../components/BarcodeScanner'
import PremiumGate from '../components/PremiumGate'

const EMPTY_FORM = { name: '', quantity_g: '', kcal: '', protein_g: '', carbs_g: '', fat_g: '' }

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

function FoodRow({ name, sub, onAdd }) {
  return (
    <button type="button" className="food-row" onClick={onAdd}>
      <span className="food-row-main">
        <strong>{name}</strong>
        <span className="food-row-sub">{sub}</span>
      </span>
      <span className="food-row-plus" aria-hidden="true">
        +
      </span>
    </button>
  )
}

export default function NutritionAddPage() {
  const { user, isPremium } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialMeal = MEAL_KEYS.includes(params.get('meal')) ? params.get('meal') : 'breakfast'

  const [targetMeal, setTargetMeal] = useState(initialMeal)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [review, setReview] = useState(null)
  const [reviewNote, setReviewNote] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [showScanner, setShowScanner] = useState(false)
  const [recents, setRecents] = useState([])
  const [frequents, setFrequents] = useState([])
  const [quickMode, setQuickMode] = useState('frequent')
  const [recipes, setRecipes] = useState([])
  const [recipeName, setRecipeName] = useState('')
  const [recipeServings, setRecipeServings] = useState('1')
  const [allFoods, setAllFoods] = useState([])
  const [tab, setTab] = useState('all') // all | meals | recipes | foods
  const [quickAdd, setQuickAdd] = useState(false)
  const [status, setStatus] = useState('loading')

  const day = todayIso()

  async function loadRecents() {
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    const { data } = await supabase
      .from('food_entries')
      .select('name, quantity_g, kcal, protein_g, carbs_g, fat_g')
      .eq('user_id', user.id)
      .gte('consumed_on', since)
      .order('created_at', { ascending: false })
      .limit(500)
    const byName = new Map()
    for (const e of data ?? []) {
      const key = (e.name ?? '').trim().toLowerCase()
      if (!key) continue
      const cur = byName.get(key)
      if (cur) cur.count += 1
      else byName.set(key, { entry: e, count: 1 })
    }
    const arr = [...byName.values()]
    setRecents(arr.slice(0, 12).map((x) => x.entry))
    setFrequents(
      [...arr]
        .sort((a, b) => b.count - a.count)
        .slice(0, 12)
        .map((x) => x.entry)
    )
    setAllFoods(arr.map((x) => x.entry))
  }

  async function loadRecipes() {
    const { data } = await supabase
      .from('recipes')
      .select('id, name, servings, kcal, protein_g, carbs_g, fat_g')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setRecipes(data ?? [])
  }

  useEffect(() => {
    async function load() {
      await Promise.all([loadRecents(), loadRecipes()])
      setStatus('idle')
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  function done() {
    navigate('/nutrition')
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)
    const { error: insErr } = await supabase.from('food_entries').insert({
      user_id: user.id,
      consumed_on: day,
      meal_type: targetMeal,
      name: form.name.trim(),
      quantity_g: form.quantity_g ? Number(form.quantity_g) : null,
      kcal: form.kcal ? Number(form.kcal) : 0,
      protein_g: form.protein_g ? Number(form.protein_g) : 0,
      carbs_g: form.carbs_g ? Number(form.carbs_g) : 0,
      fat_g: form.fat_g ? Number(form.fat_g) : 0,
      source: 'manual',
    })
    setSaving(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    done()
  }

  async function addRecent(r) {
    await supabase.from('food_entries').insert({
      user_id: user.id,
      consumed_on: day,
      meal_type: targetMeal,
      name: r.name,
      quantity_g: r.quantity_g ?? null,
      kcal: Number(r.kcal) || 0,
      protein_g: Number(r.protein_g) || 0,
      carbs_g: Number(r.carbs_g) || 0,
      fat_g: Number(r.fat_g) || 0,
      source: 'manual',
    })
    done()
  }

  async function addRecipe(rec) {
    const f = 1 / (rec.servings || 1)
    await supabase.from('food_entries').insert({
      user_id: user.id,
      consumed_on: day,
      meal_type: targetMeal,
      name: rec.name,
      quantity_g: null,
      kcal: Math.round((Number(rec.kcal) || 0) * f),
      protein_g: Math.round((Number(rec.protein_g) || 0) * f),
      carbs_g: Math.round((Number(rec.carbs_g) || 0) * f),
      fat_g: Math.round((Number(rec.fat_g) || 0) * f),
      source: 'recipe',
    })
    done()
  }

  async function deleteRecipe(id) {
    await supabase.from('recipes').delete().eq('id', id)
    await loadRecipes()
  }

  // Charge les ingrédients d'une recette dans la liste « à ajouter » (édition).
  async function editRecipe(rec) {
    const { data } = await supabase
      .from('recipe_items')
      .select('name, quantity_g, kcal, protein_g, carbs_g, fat_g')
      .eq('recipe_id', rec.id)
    const items = (data ?? []).map((it) => {
      const qty = Number(it.quantity_g) > 0 ? Number(it.quantity_g) : 100
      return {
        name: it.name,
        quantity_g: qty,
        kcal: Math.round(Number(it.kcal) || 0),
        protein_g: Math.round(Number(it.protein_g) || 0),
        carbs_g: Math.round(Number(it.carbs_g) || 0),
        fat_g: Math.round(Number(it.fat_g) || 0),
        per100: {
          kcal: ((Number(it.kcal) || 0) / qty) * 100,
          protein_g: ((Number(it.protein_g) || 0) / qty) * 100,
          carbs_g: ((Number(it.carbs_g) || 0) / qty) * 100,
          fat_g: ((Number(it.fat_g) || 0) / qty) * 100,
        },
      }
    })
    setReview(items)
    setReviewNote(`Recette : ${rec.name}`)
    setTab('all')
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
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
      meal_type: targetMeal,
      name: (it.name || 'Aliment').trim(),
      quantity_g: it.quantity_g ? Number(it.quantity_g) : null,
      kcal: Number(it.kcal || 0),
      protein_g: Number(it.protein_g || 0),
      carbs_g: Number(it.carbs_g || 0),
      fat_g: Number(it.fat_g || 0),
      source: 'manual',
    }))
    const { error: insErr } = await supabase.from('food_entries').insert(rows)
    setSaving(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    done()
  }

  async function saveAsRecipe() {
    const name = recipeName.trim()
    if (!name || !review || review.length === 0) return
    setSaving(true)
    setError(null)
    const servings = Math.max(1, Math.round(Number(recipeServings) || 1))
    const totals = review.reduce(
      (a, it) => ({
        kcal: a.kcal + (Number(it.kcal) || 0),
        protein_g: a.protein_g + (Number(it.protein_g) || 0),
        carbs_g: a.carbs_g + (Number(it.carbs_g) || 0),
        fat_g: a.fat_g + (Number(it.fat_g) || 0),
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    )
    const { data: rec, error: recErr } = await supabase
      .from('recipes')
      .insert({ user_id: user.id, name, servings, ...totals })
      .select('id')
      .single()
    if (recErr || !rec) {
      setSaving(false)
      setError(recErr?.message || 'Enregistrement de la recette impossible.')
      return
    }
    const items = review.map((it) => ({
      recipe_id: rec.id,
      user_id: user.id,
      name: (it.name || 'Aliment').trim(),
      quantity_g: it.quantity_g ? Number(it.quantity_g) : null,
      kcal: Number(it.kcal) || 0,
      protein_g: Number(it.protein_g) || 0,
      carbs_g: Number(it.carbs_g) || 0,
      fat_g: Number(it.fat_g) || 0,
    }))
    await supabase.from('recipe_items').insert(items)
    setSaving(false)
    setRecipeName('')
    setRecipeServings('1')
    await loadRecipes()
  }

  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const quickList = quickMode === 'frequent' ? frequents : recents

  if (status === 'loading') return null

  const TABS = [
    { key: 'all', label: 'Tous' },
    { key: 'meals', label: 'Mes repas' },
    { key: 'recipes', label: 'Mes recettes' },
    { key: 'foods', label: 'Mes aliments' },
  ]

  return (
    <main className="nutri-add">
      <div className="nutri-add-top">
        <button type="button" className="nutri-back" onClick={() => navigate('/nutrition')} aria-label="Retour">
          ‹
        </button>
        <div className="nutri-meal-select">
          <select value={targetMeal} onChange={(e) => setTargetMeal(e.target.value)} aria-label="Repas cible">
            {MEALS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <span className="nutri-top-spacer" />
      </div>

      <form className="nutri-search" onSubmit={searchFood}>
        <span className="nutri-search-icon" aria-hidden="true">
          🔍
        </span>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher"
          autoComplete="off"
        />
      </form>

      <div className="nutri-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`nutri-tab${tab === t.key ? ' is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="nutri-actions">
        <button
          type="button"
          className="nutri-action"
          onClick={() => {
            setSearchError(null)
            setShowScanner(true)
          }}
        >
          <span className="nutri-action-icon" aria-hidden="true">
            ▤
          </span>
          Scan de code-barres
        </button>
        <button type="button" className="nutri-action" onClick={() => setQuickAdd((v) => !v)}>
          <span className="nutri-action-icon" aria-hidden="true">
            ⊕
          </span>
          Ajout rapide
        </button>
        <PremiumGate isPremium={isPremium} label="L'analyse photo">
          <label className="nutri-action nutri-action-wide">
            <span className="nutri-action-icon" aria-hidden="true">
              📷
            </span>
            {analyzing ? 'Analyse…' : 'Photo du repas'}
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} disabled={analyzing} hidden />
          </label>
        </PremiumGate>
      </div>
      {analyzeError && <p role="alert">{analyzeError}</p>}
      {searching && <p className="eyebrow nutri-search-error">Recherche…</p>}
      {searchError && <p className="eyebrow nutri-search-error">{searchError}</p>}

      {quickAdd && (
        <section className="card">
          <h2>Ajout rapide</h2>
          <form className="nutrition-form" onSubmit={handleAdd}>
            <label htmlFor="food-name">Aliment</label>
            <input id="food-name" type="text" value={form.name} onChange={field('name')} placeholder="ex. Poulet grillé" autoComplete="off" />
            <div className="nutrition-form-grid">
              <label><span>Quantité (g)</span><input type="number" inputMode="decimal" value={form.quantity_g} onChange={field('quantity_g')} /></label>
              <label><span>Calories</span><input type="number" inputMode="decimal" value={form.kcal} onChange={field('kcal')} /></label>
              <label><span>Protéines (g)</span><input type="number" inputMode="decimal" value={form.protein_g} onChange={field('protein_g')} /></label>
              <label><span>Glucides (g)</span><input type="number" inputMode="decimal" value={form.carbs_g} onChange={field('carbs_g')} /></label>
              <label><span>Lipides (g)</span><input type="number" inputMode="decimal" value={form.fat_g} onChange={field('fat_g')} /></label>
            </div>
            {error && <p role="alert">{error}</p>}
            <button type="submit" className="btn-primary" disabled={saving || !form.name.trim()}>
              {saving ? 'Ajout…' : `Ajouter à ${MEAL_LABEL[targetMeal]}`}
            </button>
          </form>
        </section>
      )}

      {review !== null && (
        <section className="card">
          <h2>À ajouter</h2>
          {reviewNote && <p className="eyebrow">{reviewNote}</p>}
          {review.length === 0 ? (
            <p>Aucun aliment détecté.</p>
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
          {error && <p role="alert">{error}</p>}
          <div className="review-actions">
            <button type="button" className="btn-primary" onClick={saveReview} disabled={saving || review.length === 0}>
              {saving ? 'Ajout…' : `Ajouter à ${MEAL_LABEL[targetMeal]}`}
            </button>
            <button type="button" className="link-button" onClick={() => { setReview(null); setReviewNote('') }}>
              Vider
            </button>
          </div>
          {review.length > 0 && (
            <div className="recipe-save">
              <input
                className="recipe-name-input"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                placeholder="Nom de la recette (ex. Bowl poulet-riz)"
                autoComplete="off"
              />
              <label className="recipe-serv">
                <span>Portions</span>
                <input type="number" min="1" inputMode="numeric" value={recipeServings} onChange={(e) => setRecipeServings(e.target.value)} />
              </label>
              <button type="button" className="btn-secondary" onClick={saveAsRecipe} disabled={saving || !recipeName.trim()}>
                Enregistrer comme recette
              </button>
            </div>
          )}
        </section>
      )}

      {tab === 'all' &&
        (searchResults.length > 0 ? (
          <section className="card nutri-list">
            <h2>Résultats</h2>
            {searchResults.map((r, i) => (
              <FoodRow
                key={i}
                name={r.name}
                sub={`${Math.round(r.per100.kcal)} cal / 100 g · ${r.kind === 'generic' ? 'aliment' : 'produit'}`}
                onAdd={() => addFromSearch(r)}
              />
            ))}
          </section>
        ) : (
          <section className="card nutri-list">
            <div className="nutri-list-head">
              <h2>Histoire</h2>
              <button
                type="button"
                className="nutri-filter"
                onClick={() => setQuickMode(quickMode === 'frequent' ? 'recent' : 'frequent')}
              >
                {quickMode === 'frequent' ? 'Les plus fréquents' : 'Les plus récents'} ▾
              </button>
            </div>
            {quickList.length === 0 ? (
              <p className="eyebrow">Aucun historique pour l'instant.</p>
            ) : (
              quickList.map((r, i) => (
                <FoodRow
                  key={i}
                  name={r.name}
                  sub={`${Math.round(r.kcal)} cal${r.quantity_g ? `, ${r.quantity_g} g` : ''}`}
                  onAdd={() => addRecent(r)}
                />
              ))
            )}
          </section>
        ))}

      {tab === 'meals' && (
        <section className="card nutri-list">
          <h2>Mes repas</h2>
          {recipes.length === 0 ? (
            <p className="eyebrow">Enregistre une recette pour la retrouver ici comme repas rapide.</p>
          ) : (
            recipes.map((rec) => (
              <FoodRow
                key={rec.id}
                name={rec.name}
                sub={`${Math.round(rec.kcal / (rec.servings || 1))} cal / portion → ${MEAL_LABEL[targetMeal]}`}
                onAdd={() => addRecipe(rec)}
              />
            ))
          )}
        </section>
      )}

      {tab === 'recipes' && (
        <section className="card nutri-list">
          <h2>Mes recettes</h2>
          {recipes.length === 0 ? (
            <p className="eyebrow">Aucune recette. Ajoute des aliments (onglet Tous), puis « Enregistrer comme recette ».</p>
          ) : (
            recipes.map((rec) => (
              <div key={rec.id} className="food-row food-row-static">
                <button type="button" className="food-row-main food-row-tap" onClick={() => editRecipe(rec)}>
                  <strong>{rec.name}</strong>
                  <span className="food-row-sub">
                    {Math.round(rec.kcal / (rec.servings || 1))} cal / portion · {rec.servings} portion(s) · modifier
                  </span>
                </button>
                <span className="food-row-actions">
                  <button type="button" className="food-row-plus" onClick={() => addRecipe(rec)} aria-label="Ajouter au repas">
                    +
                  </button>
                  <button
                    type="button"
                    className="food-entry-delete"
                    onClick={() => deleteRecipe(rec.id)}
                    aria-label={`Supprimer ${rec.name}`}
                  >
                    🗑
                  </button>
                </span>
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'foods' && (
        <section className="card nutri-list">
          <h2>Mes aliments</h2>
          {allFoods.length === 0 ? (
            <p className="eyebrow">Aucun aliment enregistré pour l'instant.</p>
          ) : (
            allFoods.map((r, i) => (
              <FoodRow
                key={i}
                name={r.name}
                sub={`${Math.round(r.kcal)} cal${r.quantity_g ? `, ${r.quantity_g} g` : ''}`}
                onAdd={() => addRecent(r)}
              />
            ))
          )}
        </section>
      )}

      {showScanner && <BarcodeScanner onDetected={handleBarcode} onClose={() => setShowScanner(false)} />}

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
