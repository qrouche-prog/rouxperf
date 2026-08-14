import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import RequireOnboarding from './components/RequireOnboarding'
import RequireAdmin from './components/RequireAdmin'
import InstallPrompt from './components/InstallPrompt'
import RootRedirect from './routes/RootRedirect'
import LoginPage from './routes/LoginPage'
import SignupPage from './routes/SignupPage'
import ResetPasswordPage from './routes/ResetPasswordPage'
import UpdatePasswordPage from './routes/UpdatePasswordPage'
import OnboardingPage from './routes/OnboardingPage'
import DashboardPage from './routes/DashboardPage'
import ProgramPage from './routes/ProgramPage'
import ProgressPage from './routes/ProgressPage'
import NutritionPage from './routes/NutritionPage'
import SessionRunnerPage from './routes/SessionRunnerPage'
import SettingsPage from './routes/SettingsPage'
import AdminPage from './routes/AdminPage'
import CreditsPage from './routes/CreditsPage'
import PremiumPage from './routes/PremiumPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
        <InstallPrompt />
      </AuthProvider>
    </BrowserRouter>
  )
}
