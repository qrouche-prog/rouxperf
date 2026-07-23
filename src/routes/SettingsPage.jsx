import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PersonalInfoStep from '../components/onboarding/PersonalInfoStep'
import GoalsStep from '../components/onboarding/GoalsStep'
import SportGoalsStep from '../components/onboarding/SportGoalsStep'
import ExperienceStep from '../components/onboarding/ExperienceStep'
import PreferencesStep from '../components/onboarding/PreferencesStep'
import TopNav from '../components/TopNav'
import BottomNav from '../components/BottomNav'

export default function SettingsPage() {
  const { user } = useAuth()
  const [goal, setGoal] = useState(null)
  const [trainingProfile, setTrainingProfile] = useState(null)
  const [status, setStatus] = useState('loading')
  const [savedSection, setSavedSection] = useState(null)

  async function loadGoal() {
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setGoal(data)
  }

  async function loadTrainingProfile() {
    const { data } = await supabase.from('user_training_profile').select('*').eq('user_id', user.id).maybeSingle()
    setTrainingProfile(data)
  }

  useEffect(() => {
    async function load() {
      await Promise.all([loadGoal(), loadTrainingProfile()])
      setStatus('idle')
    }
    load()
  }, [user.id])

  function flashSaved(section) {
    setSavedSection(section)
    setTimeout(() => setSavedSection((current) => (current === section ? null : current)), 2500)
  }

  if (status === 'loading') return null

  return (
    <main>
      <TopNav />
      <h1>Réglages</h1>
      <p>
        Modifie tes informations, ton objectif et tes préférences à tout moment — ça n'affecte pas ton programme
        déjà généré, seules les prochaines générations en tiendront compte.
      </p>

      <section id="infos" className="card settings-section">
        <PersonalInfoStep submitLabel="Enregistrer" onNext={() => flashSaved('infos')} />
        {savedSection === 'infos' && <p className="settings-saved">Enregistré ✓</p>}
      </section>

      <section id="objectif" className="card settings-section">
        <GoalsStep
          initial={goal ?? undefined}
          submitLabel="Enregistrer"
          onNext={async () => {
            await loadGoal()
            flashSaved('objectif')
          }}
        />
        {savedSection === 'objectif' && <p className="settings-saved">Enregistré ✓</p>}
      </section>

      <section id="sport" className="card settings-section">
        <SportGoalsStep
          initial={trainingProfile ?? undefined}
          submitLabel="Enregistrer"
          onNext={async () => {
            await loadTrainingProfile()
            flashSaved('sport')
          }}
        />
        {savedSection === 'sport' && <p className="settings-saved">Enregistré ✓</p>}
      </section>

      <section id="experience" className="card settings-section">
        <ExperienceStep
          initial={trainingProfile ?? undefined}
          submitLabel="Enregistrer"
          onNext={async () => {
            await loadTrainingProfile()
            flashSaved('experience')
          }}
        />
        {savedSection === 'experience' && <p className="settings-saved">Enregistré ✓</p>}
      </section>

      <section id="preferences" className="card settings-section">
        <PreferencesStep
          initial={trainingProfile ?? undefined}
          submitLabel="Enregistrer"
          onNext={async () => {
            await loadTrainingProfile()
            flashSaved('preferences')
          }}
        />
        {savedSection === 'preferences' && <p className="settings-saved">Enregistré ✓</p>}
      </section>

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
