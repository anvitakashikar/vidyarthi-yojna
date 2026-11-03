import { Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../context/AuthContext'

/** Public pages: logged-in users are sent straight to their own dashboard. */
export default function GuestRoute() {
  const { user, loading } = useAuth()
  const { t } = useTranslation()

  if (loading) return <p className="py-16 text-center text-slate-500">{t('common.loading')}</p>

  if (user) return <Navigate to={`/${user.role}`} replace />

  return <Outlet />
}
