import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(undefined)

// Premium actif = abonnement 'premium', statut vivant, période non expirée.
function computeIsPremium(sub) {
  if (!sub || sub.tier !== 'premium') return false
  if (sub.status && !['active', 'trialing'].includes(sub.status)) return false
  if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) return false
  return true
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

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    profile,
    profileLoading,
    subscription,
    isPremium: computeIsPremium(subscription),
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
