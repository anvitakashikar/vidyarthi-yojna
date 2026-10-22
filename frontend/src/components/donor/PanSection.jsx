import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import FileField from '../ui/FileField'
import FormField, { Alert } from '../ui/FormField'
import SectionCard, { SubmitButton } from '../student/SectionCard'
import { saveDonorPan } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { checkUploadFile, panError } from '../../utils/validators'

/** Donor PAN card: number (4th letter P, B, C, H or T), name as on PAN, optional copy. */
export default function PanSection({ existing, defaultName, onSaved }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ pan_number: '', name_on_pan: existing?.name_on_pan || (defaultName || '').toUpperCase() })
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value.toUpperCase() }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const errKey = panError(form.pan_number)
    if (errKey) return setError(t(errKey))
    if (form.name_on_pan.trim().length < 2) return setError(t('errors.donor.invalid_pan_name'))
    const fileError = checkUploadFile(file)
    if (fileError) return setError(t(fileError, { max_mb: 5 }))

    const data = new FormData()
    data.append('pan_number', form.pan_number.replace(/\s/g, ''))
    data.append('name_on_pan', form.name_on_pan.trim())
    if (file) data.append('pan_file', file)

    setSaving(true)
    try {
      const p = await saveDonorPan(data)
      setFile(null)
      setForm((f) => ({ ...f, pan_number: '' }))
      onSaved(p)
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title={t('pan.title')} description={t('pan.desc')} saved={Boolean(existing)} savedLabel={t('onboarding.saved')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Alert>{error}</Alert>
        <FormField
          label={t('pan.number')}
          name="pan_number"
          autoComplete="off"
          placeholder="ABCPE1234F"
          maxLength={10}
          required
          value={form.pan_number}
          onChange={onChange}
          hint={existing ? t('pan.savedAs', { value: existing.masked_pan }) : t('pan.numberHint')}
        />
        <FormField label={t('pan.name')} name="name_on_pan" required value={form.name_on_pan} onChange={onChange} hint={t('pan.nameHint')} />
        <FileField label={t('pan.file')} file={file} onChange={setFile} existingNote={existing?.document_id ? t('onboarding.fileUploaded') : null} />
        <SubmitButton saving={saving} savingLabel={t('onboarding.saving')}>
          {t('pan.save')}
        </SubmitButton>
      </form>
    </SectionCard>
  )
}
