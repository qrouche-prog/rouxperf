import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { alternativesFor } from '../lib/equipment'

const WEEK_MS = 7 * 86400000
const PREMIUM_LIMIT = 3
const FREE_LIMIT = 1

// Alternatives d'exercice : accès Premium (limité, vraiment similaire) vs
// aperçu gratuit d'une seule alternative, 1×/semaine, pour les non-abonnés —
// pour qu'ils se rendent compte de la possibilité sans en faire un outil
// complet gratuit.
export default function ExerciseAlternatives({
  exercisesById,
  details,
  equipmentAccess,
  onSwap,
  swapping,
  label = '↔ alternatives',
  triggerClassName = '',
}) {
  const { isPremium, profile, refreshProfile } = useAuth()
  const [show, setShow] = useState(false)
  const [consuming, setConsuming] = useState(false)

  if (!details) return null

  const lastFreeAt = profile?.last_free_alternative_at ?? null
  const freeAvailable = !lastFreeAt || Date.now() - new Date(lastFreeAt).getTime() >= WEEK_MS
  const nextFreeAt = lastFreeAt ? new Date(new Date(lastFreeAt).getTime() + WEEK_MS) : null

  async function reveal() {
    if (isPremium) {
      setShow(true)
      return
    }
    if (!freeAvailable || consuming) return
    setConsuming(true)
    const { error } = await supabase
      .from('profiles')
      .update({ last_free_alternative_at: new Date().toISOString() })
      .eq('user_id', profile.user_id)
    setConsuming(false)
    if (error) return
    await refreshProfile()
    setShow(true)
  }

  const alts = show
    ? alternativesFor(exercisesById, details, equipmentAccess, isPremium ? PREMIUM_LIMIT : FREE_LIMIT)
    : []

  return (
    <div className="exercise-alternatives">
      {isPremium || freeAvailable ? (
        <button
          type="button"
          className={`link-button ${triggerClassName}`.trim()}
          onClick={() => (show ? setShow(false) : reveal())}
          disabled={consuming}
        >
          {show ? 'Masquer les alternatives' : isPremium ? label : '↔ Essayer une alternative (gratuit, 1×/semaine)'}
        </button>
      ) : (
        <p className="exercise-alt-locked">
          Alternative gratuite déjà utilisée cette semaine
          {nextFreeAt ? ` — prochaine le ${nextFreeAt.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}` : ''}
          {' · '}
          <Link to="/premium">Passe Premium pour un accès illimité</Link>
        </p>
      )}
      {show && (
        <div className="alt-list">
          {alts.length === 0 ? (
            <p className="eyebrow">Aucune alternative compatible avec ton matériel.</p>
          ) : (
            alts.map((alt) => (
              <button
                key={alt.id}
                type="button"
                className="alt-item"
                disabled={swapping}
                onClick={() => {
                  onSwap(alt.id)
                  setShow(false)
                }}
              >
                <span className="alt-item-name">{alt.name}</span>
                <span className="alt-item-action">Remplacer</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
