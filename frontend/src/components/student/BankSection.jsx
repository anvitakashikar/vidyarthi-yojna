import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import FileField from '../ui/FileField'
import FormField, { Alert } from '../ui/FormField'
import SectionCard, { SubmitButton } from './SectionCard'
import { apiErrorMessage } from '../../utils/apiError'
import { checkUploadFile, isValidAccountNumber, isValidIfsc } from '../../utils/validators'

/**
 * Bank account details with a supporting document upload. Used by students
 * (bank statement, required) and donors (cancelled cheque, optional).
 */
export default function BankSection({
  existing,
  defaultHolder,
  onSaved,
  save,
  description,
  proofField,
  proofLabel,
  proofRequired,
  existingProofId,
  proofRequiredError = 'errors.student.statement_required',
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    account_holder_name: existing?.account_holder_name || defaultHolder || '',
    account_number: '',
    confirm_account_number: '',
    ifsc: existing?.ifsc || '',
    bank_name: existing?.bank_name || '',
    branch_name: existing?.branch_name || '',
  })
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: name === 'ifsc' ? value.toUpperCase() : value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.account_holder_name.trim().length < 2) return setError(t('errors.student.invalid_holder_name'))
    if (!isValidAccountNumber(form.account_number)) return setError(t('errors.student.invalid_account_number'))
    if (form.account_number !== form.confirm_account_number) return setError(t('bank.accountMismatch'))
    if (!isValidIfsc(form.ifsc)) return setError(t('errors.student.invalid_ifsc'))
    if (proofRequired && !file && !existingProofId) return setError(t(proofRequiredError))
    const fileError = checkUploadFile(file)
    if (fileError) return setError(t(fileError, { max_mb: 5 }))

    const data = new FormData()
    ;['account_holder_name', 'account_number', 'ifsc', 'bank_name', 'branch_name'].forEach((k) => data.append(k, form[k].trim()))
    if (file) data.append(proofField, file)

    setSaving(true)
    try {
      const p = await save(data)
      setFile(null)
      setForm((f) => ({ ...f, account_number: '', confirm_account_number: '' }))
      onSaved(p)
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title={t('bank.title')} description={description} saved={Boolean(existing)} savedLabel={t('onboarding.saved')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Alert>{error}</Alert>
        <FormField label={t('bank.holder')} name="account_holder_name" required value={form.account_holder_name} onChange={onChange} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t('bank.account')}
            name="account_number"
            inputMode="numeric"
            autoComplete="off"
            required
            value={form.account_number}
            onChange={onChange}
            hint={existing ? t('bank.savedAs', { value: existing.masked_account_number }) : undefined}
          />
          <FormField
            label={t('bank.confirmAccount')}
            name="confirm_account_number"
            inputMode="numeric"
            autoComplete="off"
            required
            onPaste={(e) => e.preventDefault()}
            value={form.confirm_account_number}
            onChange={onChange}
          />
        </div>
        <FormField label={t('bank.ifsc')} name="ifsc" placeholder="SBIN0001234" maxLength={11} required value={form.ifsc} onChange={onChange} hint={t('bank.ifscHint')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('bank.bankName')} name="bank_name" required value={form.bank_name} onChange={onChange} />
          <FormField label={t('bank.branch')} name="branch_name" required value={form.branch_name} onChange={onChange} />
        </div>
        <FileField
          label={proofLabel}
          file={file}
          onChange={setFile}
          required={proofRequired && !existingProofId}
          existingNote={existingProofId ? t('onboarding.fileUploaded') : null}
        />
        <SubmitButton saving={saving} savingLabel={t('onboarding.saving')}>
          {t('bank.save')}
        </SubmitButton>
      </form>
    </SectionCard>
  )
}
