import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PremiumGate from './PremiumGate'

const WEEK_MS = 7 * 86400000

// Carte « ajuster mon programme » : un abonné Premium décrit ses changements,
// l'IA régénère le programme en conséquence. Limité à 1×/semaine.
export default function ProgramAdjustment({ isPremium, disabled = false, onSubmitted }) {
  const { user } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [lastAt, setLastAt] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase
      .from('program_adjustments')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('applied', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setLastAt(data?.created_at ?? null)
        setLoaded(true)
      })
  }, [user.id])

  const nextAvailable = lastAt ? new Date(new Date(lastAt).getTime() + WEEK_MS) : null
  const locked = nextAvailable ? nextAvailable > new Date() : false

  async function submit() {
    setBusy(true)
    setError(null)
    const { data, error: fnErr } = await supabase.functions.invoke('adjust-program', {
      body: { prompt: prompt.trim() },
    })
    setBusy(false)
    if (fnErr || data?.error) {
      let msg = data?.error
      if (!msg && fnErr?.context?.json) {
        try {
          const b = await fnErr.context.json()
          msg = b?.error
          if (b?.next_available) setLastAt(new Date(new Date(b.next_available).getTime() - WEEK_MS).toISOString())
        } catch {
          // ignore
        }
      }
      setError(msg || 'Demande impossible pour le moment.')
      return
    }
    setPrompt('')
    setLastAt(new Date().toISOString())
    onSubmitted?.()
  }

  if (!loaded) return null

  return (
    <section className="card program-adjust">
      <h2>Ajuster mon programme</h2>
      <p className="eyebrow">
        Décris à l’IA ce que tu veux changer — elle régénère ton programme en conséquence. Une fois par semaine.
      </p>

      {locked ? (
        <p className="eyebrow">
          Déjà utilisé cette semaine. Prochaine demande possible le{' '}
          {nextAvailable.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}.
        </p>
      ) : (
        <>
          <textarea
            className="program-adjust-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="ex. ajoute une séance de course, remplace le squat qui gêne mon genou, réduis le volume sur les jambes…"
            rows={3}
            disabled={!isPremium || busy || disabled}
          />
          {error && <p role="alert">{error}</p>}
          <PremiumGate isPremium={isPremium} label="L’ajustement de programme par l’IA">
            <button
              type="button"
              className="btn-primary"
              onClick={submit}
              disabled={busy || disabled || !prompt.trim()}
            >
              {busy ? 'Envoi…' : 'Demander l’ajustement'}
            </button>
          </PremiumGate>
          {disabled && <p className="eyebrow">Attends la fin de la génération en cours pour demander un ajustement.</p>}
        </>
      )}
    </section>
  )
}
