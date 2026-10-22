import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

/** Students and donors must finish their sign-up sections before using their dashboard. */
export default function OnboardingGate() {
  const { user } = useAuth()
  if (['student', 'donor'].includes(user?.role) && !user.onboarding_complete) {
    return <Navigate to={`/${user.role}/onboarding`} replace />
  }
  return <Outlet />
}
