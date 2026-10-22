import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import FileField from '../ui/FileField'
import FormField, { Alert } from '../ui/FormField'
import SectionCard, { SubmitButton } from './SectionCard'
import { saveExpenses } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { formatRupees } from '../../utils/format'
import { checkUploadFile } from '../../utils/validators'

const MAX_AMOUNT = 100000

/** Section 3 — monthly mess bill and abhyasika (study place). */
export default function ExpensesStep({ profile, onSaved }) {
  const { t, i18n } = useTranslation()
  const mess = profile.expenses?.mess
  const abhyasika = profile.expenses?.abhyasika

  const [form, setForm] = useState({
    uses_mess: mess ? mess.uses_mess : true,
    mess_name: mess?.name || '',
    mess_address: mess?.address || '',
    mess_monthly_bill: mess?.monthly_bill != null ? String(mess.monthly_bill) : '',
    uses_abhyasika: abhyasika ? abhyasika.uses_abhyasika : true,
    abhyasika_name: abhyasika?.name || '',
    abhyasika_address: abhyasika?.address || '',
    abhyasika_monthly_fee: abhyasika?.monthly_fee != null ? String(abhyasika.monthly_fee) : '',
  })
  const [messReceipt, setMessReceipt] = useState(null)
  const [abhyasikaReceipt, setAbhyasikaReceipt] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const onChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const amountOk = (v) => /^\d+$/.test(v.trim()) && Number(v) <= MAX_AMOUNT

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.uses_mess && (!form.mess_name.trim() || !form.mess_monthly_bill.trim())) return setError(t('errors.student.mess_details_required'))
    if (form.uses_mess && !amountOk(form.mess_monthly_bill)) return setError(t('errors.student.invalid_amount'))
    if (form.uses_abhyasika && (!form.abhyasika_name.trim() || !form.abhyasika_monthly_fee.trim()))
      return setError(t('errors.student.abhyasika_details_required'))
    if (form.uses_abhyasika && !amountOk(form.abhyasika_monthly_fee)) return setError(t('errors.student.invalid_amount'))
    for (const f of [messReceipt, abhyasikaReceipt]) {
      const fileError = checkUploadFile(f)
      if (fileError) return setError(t(fileError, { max_mb: 5 }))
    }

    const data = new FormData()
    Object.entries(form).forEach(([k, v]) => data.append(k, typeof v === 'boolean' ? String(v) : v.trim()))
    if (form.uses_mess && messReceipt) data.append('mess_receipt', messReceipt)
    if (form.uses_abhyasika && abhyasikaReceipt) data.append('abhyasika_receipt', abhyasikaReceipt)

    setSaving(true)
    try {
      onSaved(await saveExpenses(data))
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  const total = (form.uses_mess ? Number(form.mess_monthly_bill) || 0 : 0) + (form.uses_abhyasika ? Number(form.abhyasika_monthly_fee) || 0 : 0)

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Alert>{error}</Alert>

      <SectionCard title={t('expenses.messTitle')} description={t('expenses.messDesc')}>
        <Toggle name="uses_mess" checked={form.uses_mess} onChange={onChange} label={t('expenses.usesMess')} />
        {form.uses_mess && (
          <div className="mt-4 space-y-4">
            <FormField label={t('expenses.messName')} name="mess_name" required value={form.mess_name} onChange={onChange} />
            <FormField label={t('expenses.address')} name="mess_address" value={form.mess_address} onChange={onChange} />
            <FormField
              label={t('expenses.monthlyBill')}
              name="mess_monthly_bill"
              inputMode="numeric"
              prefix="₹"
              required
              value={form.mess_monthly_bill}
              onChange={onChange}
            />
            <FileField
              label={t('expenses.messReceipt')}
              file={messReceipt}
              onChange={setMessReceipt}
              existingNote={mess?.receipt_document_id ? t('onboarding.fileUploaded') : null}
            />
          </div>
        )}
      </SectionCard>

      <SectionCard title={t('expenses.abhyasikaTitle')} description={t('expenses.abhyasikaDesc')}>
        <Toggle name="uses_abhyasika" checked={form.uses_abhyasika} onChange={onChange} label={t('expenses.usesAbhyasika')} />
        {form.uses_abhyasika && (
          <div className="mt-4 space-y-4">
            <FormField label={t('expenses.abhyasikaName')} name="abhyasika_name" required value={form.abhyasika_name} onChange={onChange} />
            <FormField label={t('expenses.address')} name="abhyasika_address" value={form.abhyasika_address} onChange={onChange} />
            <FormField
              label={t('expenses.monthlyFee')}
              name="abhyasika_monthly_fee"
              inputMode="numeric"
              prefix="₹"
              required
              value={form.abhyasika_monthly_fee}
              onChange={onChange}
            />
            <FileField
              label={t('expenses.abhyasikaReceipt')}
              file={abhyasikaReceipt}
              onChange={setAbhyasikaReceipt}
              existingNote={abhyasika?.receipt_document_id ? t('onboarding.fileUploaded') : null}
            />
          </div>
        )}
      </SectionCard>

      <div className="flex items-center justify-between rounded-xl border border-brand-100 bg-brand-50 px-5 py-3">
        <span className="text-sm font-medium text-brand-700">{t('expenses.total')}</span>
        <span className="text-lg font-bold text-brand-700">{formatRupees(total, i18n.language)}</span>
      </div>

      <SubmitButton saving={saving} savingLabel={t('onboarding.saving')}>
        {t('onboarding.finish')}
      </SubmitButton>
    </form>
  )
}

function Toggle({ name, checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700">
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
      {label}
    </label>
  )
}
