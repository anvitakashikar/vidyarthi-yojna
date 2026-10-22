import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import FileField from '../ui/FileField'
import FormField, { Alert, inputClass } from '../ui/FormField'
import SectionCard, { SubmitButton } from './SectionCard'
import { readAadhaar, saveAadhaar } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { calcAge, formatDate } from '../../utils/format'
import { checkUploadFile, formatAadhaar, isValidAadhaar } from '../../utils/validators'

const METHOD_STYLE = {
  qr_secure: 'border-green-200 bg-green-50 text-green-800',
  qr_xml: 'border-green-200 bg-green-50 text-green-800',
  ai: 'border-amber-200 bg-amber-50 text-amber-800',
  none: 'border-slate-200 bg-slate-50 text-slate-700',
}

const fromSaved = (a) => ({
  aadhaar_number: '',
  dob: a.dob,
  gender: a.gender || '',
  taluka: a.taluka,
  district: a.district,
  state: a.state || 'Maharashtra',
  pincode: a.pincode || '',
  address: a.address || '',
})

const fromRead = (r) => ({
  aadhaar_number: r.aadhaar_number ? formatAadhaar(r.aadhaar_number) : '',
  dob: r.dob || '',
  gender: r.gender || '',
  taluka: r.taluka || '',
  district: r.district || '',
  state: r.state || 'Maharashtra',
  pincode: r.pincode || '',
  address: r.address || '',
})

/**
 * Section 2a — upload the Aadhaar card; DOB (→ age) and taluka are read from it
 * automatically, and the student reviews them before saving.
 */
export default function AadhaarSection({ profile, onSaved }) {
  const { t, i18n } = useTranslation()
  const saved = profile.aadhaar

  // view: summary (already saved) → upload → review
  const [view, setView] = useState(saved ? 'summary' : 'upload')
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [reading, setReading] = useState(false)
  const [readResult, setReadResult] = useState(null)
  const [form, setForm] = useState(saved ? fromSaved(saved) : fromRead({}))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const runRead = async (selected, pdfPassword) => {
    setError('')
    const fileError = checkUploadFile(selected)
    if (fileError) return setError(t(fileError, { max_mb: 5 }))

    const data = new FormData()
    data.append('aadhaar_file', selected)
    if (pdfPassword) data.append('pdf_password', pdfPassword)
    setReading(true)
    try {
      const result = await readAadhaar(data)
      if (result.warnings.includes('pdf_locked')) {
        setNeedsPassword(true)
        if (pdfPassword) setError(t('aadhaar.wrongPassword'))
        return
      }
      setNeedsPassword(false)
      setReadResult(result)
      setForm(fromRead(result))
      setView('review')
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setReading(false)
    }
  }

  const onFile = (selected) => {
    setFile(selected)
    setPassword('')
    setNeedsPassword(false)
    if (selected) runRead(selected)
  }

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: name === 'aadhaar_number' ? formatAadhaar(value) : value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!isValidAadhaar(form.aadhaar_number)) return setError(t('errors.student.invalid_aadhaar'))
    const age = calcAge(form.dob)
    if (age == null || age < 10 || age > 60) return setError(t('errors.student.invalid_dob'))
    if (form.taluka.trim().length < 2 || form.district.trim().length < 2) return setError(t('errors.student.taluka_required'))
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) return setError(t('aadhaar.invalidPincode'))

    setSaving(true)
    try {
      const p = await saveAadhaar({
        document_id: readResult?.document_id || null,
        aadhaar_number: form.aadhaar_number.replace(/\s/g, ''),
        dob: form.dob,
        gender: form.gender || null,
        taluka: form.taluka,
        district: form.district,
        state: form.state,
        pincode: form.pincode || null,
        address: form.address,
      })
      setReadResult(null)
      setFile(null)
      setView('summary')
      onSaved(p)
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  const age = calcAge(form.dob)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <SectionCard title={t('aadhaar.title')} description={t('aadhaar.desc')} saved={Boolean(saved)} savedLabel={t('onboarding.saved')}>
      <Alert>{error}</Alert>

      {view === 'summary' && saved && (
        <div className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Info label={t('aadhaar.number')} value={<span className="font-mono">{saved.masked_number}</span>} />
            <Info label={t('aadhaar.dob')} value={`${formatDate(saved.dob, i18n.language)} · ${t('aadhaar.ageYears', { age: saved.age })}`} />
            <Info label={t('aadhaar.taluka')} value={saved.taluka} />
            <Info label={t('aadhaar.district')} value={saved.district} />
          </dl>
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" onClick={() => setView('review')} className="font-medium text-brand-600 hover:underline">
              {t('aadhaar.editDetails')}
            </button>
            <button type="button" onClick={() => setView('upload')} className="font-medium text-brand-600 hover:underline">
              {t('aadhaar.replaceCard')}
            </button>
          </div>
        </div>
      )}

      {view === 'upload' && (
        <div className="space-y-4">
          <FileField label={t('aadhaar.file')} file={file} onChange={onFile} required />
          <p className="text-xs text-slate-500">{t('aadhaar.fileTip')}</p>
          {reading && (
            <p className="flex items-center gap-2 text-sm text-brand-700" role="status">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              {t('aadhaar.reading')}
            </p>
          )}
          {needsPassword && !reading && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">{t('aadhaar.pdfLocked')}</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  className={`${inputClass} mt-0`}
                  aria-label={t('aadhaar.pdfPassword')}
                  placeholder={t('aadhaar.pdfPassword')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  disabled={!password}
                  onClick={() => runRead(file, password)}
                  className="shrink-0 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
                >
                  {t('aadhaar.unlock')}
                </button>
              </div>
            </div>
          )}
          {saved && (
            <button type="button" onClick={() => setView('summary')} className="text-sm text-slate-600 hover:underline">
              {t('common.cancel')}
            </button>
          )}
        </div>
      )}

      {view === 'review' && (
        <form onSubmit={onSubmit} className="space-y-4">
          {readResult && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${METHOD_STYLE[readResult.method] || METHOD_STYLE.none}`}>
              <p className="font-medium">{t(`aadhaar.method.${readResult.method}`)}</p>
              {readResult.warnings
                .filter((w) => w !== 'pdf_locked')
                .map((w) => (
                  <p key={w} className="mt-1">
                    {t(`aadhaar.warning.${w}`)}
                  </p>
                ))}
            </div>
          )}

          <FormField
            label={t('aadhaar.number')}
            name="aadhaar_number"
            inputMode="numeric"
            autoComplete="off"
            placeholder="1234 5678 9012"
            required
            value={form.aadhaar_number}
            onChange={onChange}
            hint={saved && !readResult ? t('aadhaar.reenterNumber', { value: saved.masked_number }) : t('aadhaar.numberHint')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('aadhaar.dob')}
              type="date"
              name="dob"
              max={today}
              required
              value={form.dob}
              onChange={onChange}
              hint={age != null && age >= 0 ? t('aadhaar.ageYears', { age }) : undefined}
            />
            <label className="block text-sm font-medium text-slate-700">
              {t('details.gender')}
              <select name="gender" value={form.gender} onChange={onChange} className={inputClass}>
                <option value="">{t('common.select')}</option>
                {['female', 'male', 'other'].map((g) => (
                  <option key={g} value={g}>
                    {t(`details.genders.${g}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('aadhaar.taluka')} name="taluka" required value={form.taluka} onChange={onChange} />
            <FormField label={t('aadhaar.district')} name="district" required value={form.district} onChange={onChange} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('aadhaar.state')} name="state" value={form.state} onChange={onChange} />
            <FormField label={t('aadhaar.pincode')} name="pincode" inputMode="numeric" maxLength={6} value={form.pincode} onChange={onChange} />
          </div>
          <label className="block text-sm font-medium text-slate-700">
            {t('aadhaar.address')}
            <textarea name="address" rows={2} maxLength={500} value={form.address} onChange={onChange} className={inputClass} />
          </label>

          <SubmitButton saving={saving} savingLabel={t('onboarding.saving')}>
            {t('aadhaar.confirmSave')}
          </SubmitButton>
          <button type="button" onClick={() => setView(saved ? 'summary' : 'upload')} className="w-full text-sm text-slate-600 hover:underline">
            {saved ? t('common.cancel') : t('aadhaar.uploadDifferent')}
          </button>
        </form>
      )}
    </SectionCard>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
    </div>
  )
}
