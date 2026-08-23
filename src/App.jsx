import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import RequireOnboarding from './components/RequireOnboarding'
import RequireAdmin from './components/RequireAdmin'
import InstallPrompt from './components/InstallPrompt'
// RootRedirect (page d'accueil "/") reste dans le bundle initial : c'est la
// toute première page vue par un visiteur, pas la peine d'ajouter un aller-
// retour réseau supplémentaire pour la charger. Le reste est chargé à la
// demande — pas besoin de tout l'app (admin, séance, nutrition…) avant que
// "Continuer avec Google" soit cliquable sur /login.
import RootRedirect from './routes/RootRedirect'
const LoginPage = lazy(() => import('./routes/LoginPage'))
const SignupPage = lazy(() => import('./routes/SignupPage'))
const ResetPasswordPage = lazy(() => import('./routes/ResetPasswordPage'))
const UpdatePasswordPage = lazy(() => import('./routes/UpdatePasswordPage'))
const OnboardingPage = lazy(() => import('./routes/OnboardingPage'))
const DashboardPage = lazy(() => import('./routes/DashboardPage'))
const ProgramPage = lazy(() => import('./routes/ProgramPage'))
const ProgressPage = lazy(() => import('./routes/ProgressPage'))
const NutritionPage = lazy(() => import('./routes/NutritionPage'))
const NutritionAddPage = lazy(() => import('./routes/NutritionAddPage'))
const SessionRunnerPage = lazy(() => import('./routes/SessionRunnerPage'))
const SettingsPage = lazy(() => import('./routes/SettingsPage'))
const AdminPage = lazy(() => import('./routes/AdminPage'))
const CreditsPage = lazy(() => import('./routes/CreditsPage'))
const PremiumPage = lazy(() => import('./routes/PremiumPage'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/update-password" element={<UpdatePasswordPage />} />
            <Route path="/credits" element={<CreditsPage />} />
            <Route
              path="/onboarding/:step"
              element={
                <RequireAuth>
                  <OnboardingPage />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <RequireOnboarding>
                    <DashboardPage />
                  </RequireOnboarding>
                </RequireAuth>
              }
            />
            <Route
              path="/program"
              element={
                <RequireAuth>
                  <RequireOnboarding>
                    <ProgramPage />
                  </RequireOnboarding>
                </RequireAuth>
              }
            />
            <Route
              path="/progress"
              element={
                <RequireAuth>
                  <RequireOnboarding>
                    <ProgressPage />
                  </RequireOnboarding>
                </RequireAuth>
              }
            />
            <Route
              path="/nutrition"
              element={
                <RequireAuth>
                  <RequireOnboarding>
                    <NutritionPage />
                  </RequireOnboarding>
                </RequireAuth>
              }
            />
            <Route
              path="/nutrition/add"
              element={
                <RequireAuth>
                  <RequireOnboarding>
                    <NutritionAddPage />
                  </RequireOnboarding>
                </RequireAuth>
              }
            />
            <Route
              path="/session/:weekNumber/:dayNumber"
              element={
                <RequireAuth>
                  <RequireOnboarding>
                    <SessionRunnerPage />
                  </RequireOnboarding>
                </RequireAuth>
              }
            />
            <Route
              path="/premium"
              element={
                <RequireAuth>
                  <RequireOnboarding>
                    <PremiumPage />
                  </RequireOnboarding>
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <RequireOnboarding>
                    <SettingsPage />
                  </RequireOnboarding>
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <AdminPage />
                  </RequireAdmin>
                </RequireAuth>
              }
            />
          </Routes>
        </Suspense>
        <InstallPrompt />
      </AuthProvider>
    </BrowserRouter>
  )
}
