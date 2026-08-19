import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(undefined)

// Essai Premium offert à tous les nouveaux comptes : 7 jours complets dès la
// création du profil, sans carte bancaire. Passé ce délai, l'utilisateur
// retombe automatiquement sur son statut réel (abonné ou gratuit).
const TRIAL_DAYS = 7
const TRIAL_MS = TRIAL_DAYS * 86400000

// Premium payant = abonnement 'premium', statut vivant, période non expirée.
function computeIsPremium(sub) {
  if (!sub || sub.tier !== 'premium') return false
  if (sub.status && !['active', 'trialing'].includes(sub.status)) return false
  if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) return false
  return true
}

function computeTrial(profileCreatedAt) {
  if (!profileCreatedAt) return { isTrialing: false, trialEndsAt: null, trialDaysLeft: 0 }
  const trialEndsAt = new Date(new Date(profileCreatedAt).getTime() + TRIAL_MS)
  const msLeft = trialEndsAt.getTime() - Date.now()
  const isTrialing = msLeft > 0
  const trialDaysLeft = isTrialing ? Math.max(1, Math.ceil(msLeft / 86400000)) : 0
  return { isTrialing, trialEndsAt, trialDaysLeft }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [subscription, setSubscription] = useState(null)

  async function refreshProfile(userId) {
    if (!userId) {
      setProfile(null)
      setSubscription(null)
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    const [{ data }, { data: sub }] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).single(),
      supabase
        .from('subscriptions')
        .select('tier, status, current_period_end')
        .eq('user_id', userId)
        .maybeSingle(),
    ])
    setProfile(data ?? null)
    setSubscription(sub ?? null)
    setProfileLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      refreshProfile(data.session?.user?.id)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      refreshProfile(newSession?.user?.id)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const isSubscribed = computeIsPremium(subscription)
  const trial = computeTrial(profile?.created_at)

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    profile,
    profileLoading,
    subscription,
    // Premium payant OU dans les 7 jours d'essai gratuit — c'est ce booléen
    // que tous les gates (PremiumGate, ExerciseAlternatives, Réglages…)
    // consomment déjà, donc l'essai s'applique automatiquement partout.
    isPremium: isSubscribed || trial.isTrialing,
    isSubscribed,
    isTrialing: trial.isTrialing,
    trialDaysLeft: trial.trialDaysLeft,
    trialEndsAt: trial.trialEndsAt,
    refreshProfile: () => refreshProfile(session?.user?.id),
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signInWithGoogle: () =>
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/dashboard` },
      }),
    signOut: () => supabase.auth.signOut(),
    resetPasswordForEmail: (email) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé à l\'intérieur de AuthProvider')
  }
  return context
}
