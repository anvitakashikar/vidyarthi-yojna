import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import RoleTabs from '../../components/auth/RoleTabs'
import FormField, { Alert } from '../../components/ui/FormField'
import { ROLES, SELF_REGISTER_ROLES, useAuth } from '../../context/AuthContext'
import { apiErrorMessage } from '../../utils/apiError'
import NotFound from '../NotFound'

export default function Login() {
  const { role } = useParams()
  const { t } = useTranslation()
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ identifier: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!ROLES.includes(role)) return <NotFound />
  if (user) return <Navigate to={`/${user.role}`} replace />

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const u = await login(form.identifier, form.password, role)
      const from = location.state?.from
      navigate(from && from.startsWith(`/${u.role}`) ? from : `/${u.role}`, { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <RoleTabs basePath="/login" roles={ROLES} />

        <h1 className="text-2xl font-bold text-brand-700">{t('auth.loginTitle', { role: t(`roles.${role}`) })}</h1>
        <p className="mt-1 text-sm text-slate-600">{t(`auth.loginSubtitle.${role}`)}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <FormField
            label={t('auth.identifier')}
            name="identifier"
            autoComplete="username"
            placeholder={role === 'student' ? '98765 43210' : 'name@example.com'}
            required
            value={form.identifier}
            onChange={onChange}
          />
          <FormField
            label={t('auth.password')}
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={onChange}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-gradient px-5 py-2.5 font-medium text-white hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? t('auth.loggingIn') : t('auth.login')}
          </button>
        </form>

        {SELF_REGISTER_ROLES.includes(role) ? (
          <p className="mt-6 text-center text-sm text-slate-600">
            {t('auth.noAccount')}{' '}
            <Link to={`/register/${role}`} className="font-medium text-brand-600 hover:underline">
              {t('auth.registerHere')}
            </Link>
          </p>
        ) : (
          <p className="mt-6 text-center text-xs text-slate-500">{t('auth.adminNote')}</p>
        )}
      </div>
    </section>
  )
}
