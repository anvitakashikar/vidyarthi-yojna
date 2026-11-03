import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../context/AuthContext'

/** Renders child routes only for logged-in users whose role is in `roles`. */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  if (loading) return <p className="py-16 text-center text-slate-500">{t('common.loading')}</p>

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  // Logged in but wrong role → send them to their own dashboard
  if (!roles.includes(user.role)) return <Navigate to={`/${user.role}`} replace />

  return <Outlet />
}
