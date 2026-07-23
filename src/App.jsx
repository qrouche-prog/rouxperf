import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import RequireOnboarding from './components/RequireOnboarding'
import HomePage from './routes/HomePage'
import LoginPage from './routes/LoginPage'
import SignupPage from './routes/SignupPage'
import ResetPasswordPage from './routes/ResetPasswordPage'
import UpdatePasswordPage from './routes/UpdatePasswordPage'
import OnboardingPage from './routes/OnboardingPage'
import DashboardPage from './routes/DashboardPage'
import ProgramPage from './routes/ProgramPage'
import ProgressPage from './routes/ProgressPage'
import SessionRunnerPage from './routes/SessionRunnerPage'
import SettingsPage from './routes/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/update-password" element={<UpdatePasswordPage />} />
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
            path="/settings"
            element={
              <RequireAuth>
                <RequireOnboarding>
                  <SettingsPage />
                </RequireOnboarding>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
