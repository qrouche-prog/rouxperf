import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ONBOARDING_STEPS, stepIndex } from '../lib/onboardingSteps'
import PersonalInfoStep from '../components/onboarding/PersonalInfoStep'
import MeasurementsStep from '../components/onboarding/MeasurementsStep'
import GoalsStep from '../components/onboarding/GoalsStep'
import SportGoalsStep from '../components/onboarding/SportGoalsStep'
import ExperienceStep from '../components/onboarding/ExperienceStep'
import SpecialSituationStep from '../components/onboarding/SpecialSituationStep'
import PreferencesStep from '../components/onboarding/PreferencesStep'
import GenerationStep from '../components/onboarding/GenerationStep'

const STEP_COMPONENTS = {
  infos: PersonalInfoStep,
  mesures: MeasurementsStep,
  objectifs: GoalsStep,
  sport: SportGoalsStep,
  experience: ExperienceStep,
  situation: SpecialSituationStep,
  preferences: PreferencesStep,
  generation: GenerationStep,
}

export default function OnboardingPage() {
  const { step } = useParams()
  const navigate = useNavigate()
  const { profile, profileLoading } = useAuth()

  if (profileLoading) return null

  if (profile?.onboarding_completed_at) {
    return <Navigate to="/dashboard" replace />
  }

  const index = stepIndex(step)
  if (index === -1) {
    return <Navigate to={`/onboarding/${ONBOARDING_STEPS[0].slug}`} replace />
  }

  const StepComponent = STEP_COMPONENTS[step]
  const goToStep = (offset) => {
    const target = ONBOARDING_STEPS[index + offset]
    if (target) navigate(`/onboarding/${target.slug}`)
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
      <StepComponent onNext={() => goToStep(1)} onBack={() => goToStep(-1)} />
    </main>
  )
}
