import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import RoleTabs from '../../components/auth/RoleTabs'
import SignupSteps, { DONOR_STEPS } from '../../components/student/SignupSteps'
import StudentDetailsFields, { EMPTY_DETAILS, detailsPayload } from '../../components/student/StudentDetailsFields'
import FormField, { Alert } from '../../components/ui/FormField'
import { SELF_REGISTER_ROLES, useAuth } from '../../context/AuthContext'
import { apiErrorMessage } from '../../utils/apiError'
import { normalizeMobile } from '../../utils/validators'
import NotFound from '../NotFound'

const EMPTY = { name: '', phone: '', email: '', password: '', confirmPassword: '', ...EMPTY_DETAILS }

export default function Register() {
  const { role } = useParams()
  const { t, i18n } = useTranslation()
  const { user, register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!SELF_REGISTER_ROLES.includes(role)) return <NotFound />
  if (user) return <Navigate to={`/${user.role}`} replace />

  // Students sign up with a mobile number; donors with an email
  const isStudent = role === 'student'

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const phone = form.phone.trim() ? normalizeMobile(form.phone) : null
    if ((isStudent || form.phone.trim()) && !phone) return setError(t('auth.invalidPhone'))
    if (!isStudent && !form.email.trim()) return setError(t('auth.emailRequired'))
    if (form.password.length < 8) return setError(t('auth.passwordTooShort'))
    if (form.password !== form.confirmPassword) return setError(t('auth.passwordMismatch'))

    let studentDetails = null
    if (isStudent) {
      const [payload, errorKey] = detailsPayload(form, normalizeMobile)
      if (errorKey) return setError(t(errorKey))
      studentDetails = payload
    }

    setSubmitting(true)
    try {
      const u = await register({
        name: form.name,
        phone,
        email: form.email.trim() || null,
        password: form.password,
        role,
        preferred_language: i18n.language?.startsWith('mr') ? 'mr' : 'en',
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

  const phoneField = (
    <FormField
      key="phone"
      label={isStudent ? t('auth.phone') : t('auth.phoneOptional')}
      type="tel"
      inputMode="numeric"
      name="phone"
      autoComplete="tel-national"
      prefix="+91"
      placeholder="98765 43210"
      maxLength={14}
      required={isStudent}
      hint={isStudent ? t('auth.phoneHint') : undefined}
      value={form.phone}
      onChange={onChange}
    />
  )
  const emailField = (
    <FormField
      key="email"
      label={isStudent ? t('auth.emailOptional') : t('auth.email')}
      type="email"
      name="email"
      autoComplete="email"
      required={!isStudent}
      value={form.email}
      onChange={onChange}
    />
  )

  return (
    <section className={`mx-auto ${isStudent ? 'max-w-2xl' : 'max-w-lg'}`}>
      <div className="mb-4">
        {isStudent ? <SignupSteps current="personal" /> : <SignupSteps steps={DONOR_STEPS} current="account" />}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <RoleTabs basePath="/register" roles={SELF_REGISTER_ROLES} />

        <h1 className="text-2xl font-bold text-brand-700">{t('auth.registerTitle', { role: t(`roles.${role}`) })}</h1>
        <p className="mt-1 text-sm text-slate-600">{t(`auth.registerSubtitle.${role}`)}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <FormField label={t('auth.fullName')} name="name" autoComplete="name" required minLength={2} value={form.name} onChange={onChange} />
          {isStudent ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {phoneField}
              {emailField}
            </div>
          ) : (
            [emailField, phoneField]
          )}
          {isStudent && <StudentDetailsFields form={form} onChange={onChange} />}
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
            {submitting ? t('auth.registering') : isStudent ? t('signup.createAndContinue') : t('auth.register')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          {t('auth.haveAccount')}{' '}
          <Link to={`/login/${role}`} className="font-medium text-brand-600 hover:underline">
            {t('auth.loginHere')}
          </Link>
        </p>
      </div>
    </section>
  )
}
