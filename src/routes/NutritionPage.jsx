import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { computeMacroTargets, sessionsPerWeekFrom, sumEntries } from '../lib/nutrition'
import TopNav from '../components/TopNav'
import BottomNav from '../components/BottomNav'

function todayIso() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

const EMPTY_FORM = { name: '', quantity_g: '', kcal: '', protein_g: '', carbs_g: '', fat_g: '' }

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
  const { user, profile } = useAuth()
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

  const day = todayIso()

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
      await loadEntries()
      setStatus('idle')
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  if (status === 'loading') return null

  const targets = computeMacroTargets({
    sex: profile?.sex,
    birthDate: profile?.birth_date,
    heightCm: profile?.height_cm,
    weightKg,
    goalType: goal?.goal_type,
    sessionsPerWeek: sessionsPerWeekFrom(trainingProfile),
  })

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

      {targets ? (
        <div className="card">
          <MacroBar label="Calories" unit="kcal" consumed={consumed.kcal} target={targets.kcal} />
          <MacroBar label="Protéines" unit="g" consumed={consumed.protein_g} target={targets.protein_g} />
          <MacroBar label="Glucides" unit="g" consumed={consumed.carbs_g} target={targets.carbs_g} />
          <MacroBar label="Lipides" unit="g" consumed={consumed.fat_g} target={targets.fat_g} />
          <p className="nutrition-disclaimer">
            Cibles calculées à partir de ton profil (poids, taille, âge, objectif) — un repère indicatif, pas un
            avis diététique.
          </p>
        </div>
      ) : (
        <div className="card">
          <p>
            Complète ton profil (poids, taille, date de naissance, sexe) dans{' '}
            <Link to="/settings#infos">Réglages</Link> et enregistre un poids dans{' '}
            <Link to="/progress">Progression</Link> pour calculer tes cibles de macros.
          </p>
        </div>
      )}

      <section className="card">
        <h2>Ajouter par photo</h2>
        <p className="eyebrow">
          Prends ton repas en photo : l'IA estime les aliments et les macros. Tu ajustes avant d'enregistrer.
        </p>
        <label className={`btn-primary photo-btn${analyzing ? ' photo-btn-loading' : ''}`}>
          {analyzing ? 'Analyse en cours…' : '📷 Photographier un repas'}
          <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} disabled={analyzing} hidden />
        </label>
        {analyzeError && <p role="alert">{analyzeError}</p>}
      </section>

      {review !== null && (
        <section className="card">
          <h2>Vérifie l'estimation</h2>
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

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
