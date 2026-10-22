import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import FormField, { Alert } from '../ui/FormField'
import SectionCard, { SubmitButton } from './SectionCard'
import StudentDetailsFields, { EMPTY_DETAILS, detailsPayload } from './StudentDetailsFields'
import { savePersonal } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { normalizeMobile } from '../../utils/validators'

/** Section 1 — editable after registration. */
export default function PersonalStep({ profile, user, onSaved }) {
  const { t } = useTranslation()
  const p = profile.personal
  const [form, setForm] = useState({
    ...EMPTY_DETAILS,
    name: profile.name || user.name || '',
    email: profile.email || user.email || '',
    ...(p ? { ...p, guardian_phone: p.guardian_phone || '', year_of_study: String(p.year_of_study) } : {}),
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const [details, errorKey] = detailsPayload(form, normalizeMobile)
    if (errorKey) return setError(t(errorKey))
    setSaving(true)
    try {
      onSaved(await savePersonal({ ...details, name: form.name.trim(), email: form.email.trim() || null }))
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title={t('signup.step.personal')} description={t('details.desc')} saved={Boolean(p)} savedLabel={t('onboarding.saved')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Alert>{error}</Alert>
        <FormField label={t('auth.fullName')} name="name" required minLength={2} value={form.name} onChange={onChange} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('auth.phone')} value={user.phone || ''} prefix="+91" disabled hint={t('details.phoneLocked')} />
          <FormField label={t('auth.emailOptional')} type="email" name="email" value={form.email} onChange={onChange} />
        </div>
        <StudentDetailsFields form={form} onChange={onChange} />
        <SubmitButton saving={saving} savingLabel={t('onboarding.saving')}>
          {t('onboarding.saveAndContinue')}
        </SubmitButton>
      </form>
    </SectionCard>
  )
}
