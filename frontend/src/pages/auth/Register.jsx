import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import SignupSteps from '../../components/student/SignupSteps'
import StudentDetailsFields, { EMPTY_DETAILS, detailsPayload } from '../../components/student/StudentDetailsFields'
import FormField, { Alert } from '../../components/ui/FormField'
import { useAuth } from '../../context/AuthContext'
import { apiErrorMessage } from '../../utils/apiError'
import { normalizeMobile } from '../../utils/validators'

const EMPTY = { name: '', phone: '', email: '', password: '', confirmPassword: '', ...EMPTY_DETAILS }

/** Self-registration is open to students only; they sign up with a mobile number. */
export default function Register() {
  const { t, i18n } = useTranslation()
  const { user, register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={`/${user.role}`} replace />

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const phone = normalizeMobile(form.phone)
    if (!phone) return setError(t('auth.invalidPhone'))
    if (form.password.length < 8) return setError(t('auth.passwordTooShort'))
    if (form.password !== form.confirmPassword) return setError(t('auth.passwordMismatch'))

    const [studentDetails, errorKey] = detailsPayload(form, normalizeMobile)
    if (errorKey) return setError(t(errorKey))

    setSubmitting(true)
    try {
      const u = await register({
        name: form.name,
        phone,
        email: form.email.trim() || null,
        password: form.password,
        role: 'student',
        preferred_language: i18n.resolvedLanguage?.split('-')[0] || 'mr',
        student_details: studentDetails,
      })
      // Students continue to sections 2 and 3 via the onboarding route guard
      navigate(`/${u.role}`, { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-4">
        <SignupSteps current="personal" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-brand-700">{t('auth.registerTitle', { role: t('roles.student') })}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('auth.registerSubtitle.student')}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <FormField label={t('auth.fullName')} name="name" autoComplete="name" required minLength={2} value={form.name} onChange={onChange} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('auth.phone')}
              type="tel"
              inputMode="numeric"
              name="phone"
              autoComplete="tel-national"
              prefix="+91"
              placeholder="98765 43210"
              maxLength={14}
              required
              hint={t('auth.phoneHint')}
              value={form.phone}
              onChange={onChange}
            />
            <FormField label={t('auth.emailOptional')} type="email" name="email" autoComplete="email" value={form.email} onChange={onChange} />
          </div>
          <StudentDetailsFields form={form} onChange={onChange} />
          <FormField
            label={t('auth.password')}
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={64}
            hint={t('auth.passwordHint')}
            value={form.password}
            onChange={onChange}
          />
          <FormField
            label={t('auth.confirmPassword')}
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            value={form.confirmPassword}
            onChange={onChange}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-gradient px-5 py-2.5 font-medium text-white hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? t('auth.registering') : t('signup.createAndContinue')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            {t('auth.loginHere')}
          </Link>
        </p>
      </div>
    </section>
  )
}
