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
