import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ONBOARDING_STEPS, stepIndex } from '../lib/onboardingSteps'
import PersonalInfoStep from '../components/onboarding/PersonalInfoStep'
import GoalsStep from '../components/onboarding/GoalsStep'
import SportGoalsStep from '../components/onboarding/SportGoalsStep'
import ExperienceStep from '../components/onboarding/ExperienceStep'
import SpecialSituationStep from '../components/onboarding/SpecialSituationStep'
import PreferencesStep from '../components/onboarding/PreferencesStep'
import GenerationStep from '../components/onboarding/GenerationStep'

export default function OnboardingPage() {
  const { step } = useParams()
  const navigate = useNavigate()
  const { user, profile, profileLoading } = useAuth()

  const [goal, setGoal] = useState(null)
  const [trainingProfile, setTrainingProfile] = useState(null)
  const [measurement, setMeasurement] = useState(null)
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function loadSavedData() {
      const [{ data: goalData }, { data: profileData }, { data: measurementData }] = await Promise.all([
        supabase
          .from('goals')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('user_training_profile').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('body_measurements')
          .select('*')
          .eq('user_id', user.id)
          .order('measured_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (cancelled) return
      setGoal(goalData ?? null)
      setTrainingProfile(profileData ?? null)
      setMeasurement(measurementData ?? null)
      setDataLoaded(true)
    }
    loadSavedData()
    return () => {
      cancelled = true
    }
    // Rechargé à chaque changement d'étape pour refléter les saisies au retour.
  }, [user, step])

  if (profileLoading) return null

  if (profile?.onboarding_completed_at) {
    return <Navigate to="/dashboard" replace />
  }

  const index = stepIndex(step)
  if (index === -1) {
    return <Navigate to={`/onboarding/${ONBOARDING_STEPS[0].slug}`} replace />
  }

  if (!dataLoaded) return null

  const goToStep = (offset) => {
    const target = ONBOARDING_STEPS[index + offset]
    if (target) navigate(`/onboarding/${target.slug}`)
  }

  const commonProps = { onNext: () => goToStep(1), onBack: () => goToStep(-1) }

  let stepEl = null
  switch (step) {
    case 'infos':
      stepEl = <PersonalInfoStep {...commonProps} includeMeasurements initialMeasurement={measurement} />
      break
    case 'objectifs':
      stepEl = <GoalsStep {...commonProps} initial={goal ?? undefined} />
      break
    case 'sport':
      stepEl = <SportGoalsStep {...commonProps} initial={trainingProfile ?? undefined} />
      break
    case 'experience':
      stepEl = <ExperienceStep {...commonProps} initial={trainingProfile ?? undefined} />
      break
    case 'situation':
      stepEl = <SpecialSituationStep {...commonProps} initial={trainingProfile ?? undefined} />
      break
    case 'preferences':
      stepEl = <PreferencesStep {...commonProps} initial={trainingProfile ?? undefined} />
      break
    case 'generation':
      stepEl = <GenerationStep {...commonProps} />
      break
    default:
      stepEl = null
  }

  return (
    <main>
      <div className="onboarding-progress">
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={ONBOARDING_STEPS.length}
          aria-label={`Étape ${index + 1} sur ${ONBOARDING_STEPS.length}`}
        >
          {ONBOARDING_STEPS.map((s, i) => (
            <span key={s.slug} className={`progress-segment${i <= index ? ' progress-segment-filled' : ''}`} />
          ))}
        </div>
        <span className="eyebrow">
          Étape {index + 1} / {ONBOARDING_STEPS.length} — {ONBOARDING_STEPS[index].label}
        </span>
      </div>
      {stepEl}
    </main>
  )
}
