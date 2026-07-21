import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ONBOARDING_STEPS, stepIndex } from '../lib/onboardingSteps'
import PersonalInfoStep from '../components/onboarding/PersonalInfoStep'
import MeasurementsStep from '../components/onboarding/MeasurementsStep'
import GoalsStep from '../components/onboarding/GoalsStep'
import ExperienceStep from '../components/onboarding/ExperienceStep'
import PreferencesStep from '../components/onboarding/PreferencesStep'
import GenerationStep from '../components/onboarding/GenerationStep'

const STEP_COMPONENTS = {
  infos: PersonalInfoStep,
  mesures: MeasurementsStep,
  objectifs: GoalsStep,
  experience: ExperienceStep,
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
      <p>
        Étape {index + 1} / {ONBOARDING_STEPS.length} — {ONBOARDING_STEPS[index].label}
      </p>
      <StepComponent onNext={() => goToStep(1)} onBack={() => goToStep(-1)} />
    </main>
  )
}
