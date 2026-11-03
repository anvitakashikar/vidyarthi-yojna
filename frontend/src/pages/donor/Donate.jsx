import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import DonateQR from '../../components/DonateQR'
import { ORG } from '../../components/SocialLinks'
import FormField, { Alert, inputClass } from '../../components/ui/FormField'
import { downloadReceipt, getDonationPayee, recordDonation } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { formatRupees } from '../../utils/format'

const PRESETS = [500, 1000, 2500, 5000, 10000]
const METHODS = ['upi', 'netbanking', 'card']
const BANKS = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Bank of Maharashtra', 'Bank of Baroda', 'Kotak Mahindra Bank', 'Punjab National Bank', 'Union Bank of India', 'Canara Bank']
const EMPTY = { upi_id: '', bank_name: '', other_bank: '', card_type: 'debit', card_last4: '', card_network: '', reference: '' }

/** Donor: choose an amount and payment method, record the donation, get a receipt. */
export default function Donate() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [amount, setAmount] = useState('1000')
  const [method, setMethod] = useState('upi')
  const [form, setForm] = useState(EMPTY)
  const [payee, setPayee] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null) // recorded donation
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    getDonationPayee().then(setPayee).catch(() => {})
  }, [])

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  const amountValue = Number(String(amount).replace(/,/g, ''))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!Number.isInteger(amountValue) || amountValue <= 0) return setError(t('errors.student.invalid_amount'))
    const bank = form.bank_name === 'other' ? form.other_bank.trim() : form.bank_name
    if (method === 'upi' && !/^[\w.-]{2,256}@[A-Za-z]{2,64}$/.test(form.upi_id.trim())) return setError(t('errors.donation.invalid_upi'))
    if (method === 'netbanking' && bank.length < 2) return setError(t('errors.donation.bank_required'))
    if (method === 'card' && !/^\d{4}$/.test(form.card_last4)) return setError(t('errors.donation.invalid_card'))

    setSaving(true)
    try {
      const payload = { amount: amountValue, method, reference: form.reference }
      if (method === 'upi') payload.upi_id = form.upi_id.trim()
      if (method === 'netbanking') payload.bank_name = bank
      if (method === 'card') Object.assign(payload, { card_type: form.card_type, card_last4: form.card_last4, card_network: form.card_network })
      setDone(await recordDonation(payload))
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  const getReceipt = async () => {
    setDownloading(true)
    try {
      await downloadReceipt(done.id)
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setDownloading(false)
    }
  }

  if (done) {
    return (
      <section className="mx-auto max-w-lg text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-2xl font-bold text-white">✓</div>
          <h1 className="mt-4 text-2xl font-bold text-brand-700">{t('donate.thankYou')}</h1>
          <p className="mt-2 text-slate-600">{t('donate.recorded', { amount: formatRupees(done.amount, lang) })}</p>
          <dl className="mt-5 space-y-1 rounded-lg bg-slate-50 p-4 text-left text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">{t('donate.receiptNo')}</dt>
              <dd className="font-mono font-medium">{done.receipt_no}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">{t('donate.method')}</dt>
              <dd className="font-medium">{t(`donate.methods.${done.method}`)}</dd>
            </div>
          </dl>
          <Alert>{error}</Alert>
          <button
            type="button"
            onClick={getReceipt}
            disabled={downloading}
            className="mt-5 w-full rounded-lg bg-brand-gradient px-5 py-2.5 font-medium text-white hover:brightness-110 disabled:opacity-60"
          >
            {downloading ? t('directory.exporting') : t('donate.downloadReceipt')}
          </button>
          <div className="mt-4 flex justify-center gap-4 text-sm">
            <button type="button" onClick={() => (setDone(null), setForm(EMPTY))} className="font-medium text-brand-600 hover:underline">
              {t('donate.again')}
            </button>
            <Link to="/donor" className="font-medium text-brand-600 hover:underline">
              {t('donate.backHome')}
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const hasPayee = payee && (payee.upi_id || payee.account_number)

  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-700">{t('donate.title')}</h1>
      <p className="mt-1 text-slate-600">{t('donate.subtitle')}</p>

      <form onSubmit={submit} className="mt-6 space-y-6">
        <Alert>{error}</Alert>

        {/* Amount */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">{t('donate.amount')}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                  amountValue === p ? 'border-transparent bg-brand-gradient text-white' : 'border-slate-300 text-slate-700 hover:border-brand-500'
                }`}
              >
                {formatRupees(p, lang)}
              </button>
            ))}
          </div>
          <div className="mt-3 max-w-xs">
            <FormField label={t('donate.otherAmount')} inputMode="numeric" prefix="₹" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ''))} required />
          </div>
        </div>

        {/* Method */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">{t('donate.method')}</h2>
          <div role="tablist" className="mt-3 grid grid-cols-3 rounded-lg bg-slate-100 p-1">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={method === m}
                onClick={() => setMethod(m)}
                className={`rounded-md px-3 py-2 text-sm font-medium ${method === m ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-brand-600'}`}
              >
                {t(`donate.methods.${m}`)}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-4">
            {method === 'upi' && (
              <>
                <DonateQR compact />
                {payee?.upi_id && payee.upi_id !== ORG.upi.id && <PayeeBox rows={[[t('donate.payToUpi'), payee.upi_id]]} />}
                <FormField label={t('donate.yourUpi')} name="upi_id" placeholder="name@okhdfcbank" value={form.upi_id} onChange={onChange} required />
              </>
            )}
            {method === 'netbanking' && (
              <>
                {payee?.account_number && (
                  <PayeeBox
                    rows={[
                      [t('bank.holder'), payee.account_name],
                      [t('bank.account'), payee.account_number],
                      [t('bank.ifsc'), payee.ifsc],
                      [t('bank.bankName'), payee.bank_name],
                    ].filter(([, v]) => v)}
                  />
                )}
                <label className="block text-sm font-medium text-slate-700">
                  {t('donate.yourBank')}
                  <select name="bank_name" value={form.bank_name} onChange={onChange} required className={inputClass}>
                    <option value="" disabled>
                      {t('common.select')}
                    </option>
                    {BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="other">{t('donate.otherBank')}</option>
                  </select>
                </label>
                {form.bank_name === 'other' && <FormField label={t('bank.bankName')} name="other_bank" value={form.other_bank} onChange={onChange} required />}
              </>
            )}
            {method === 'card' && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {t('donate.cardType')}
                    <select name="card_type" value={form.card_type} onChange={onChange} className={inputClass}>
                      <option value="debit">{t('donate.debit')}</option>
                      <option value="credit">{t('donate.credit')}</option>
                    </select>
                  </label>
                  <FormField
                    label={t('donate.cardLast4')}
                    name="card_last4"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1234"
                    value={form.card_last4}
                    onChange={(e) => setForm((f) => ({ ...f, card_last4: e.target.value.replace(/\D/g, '') }))}
                    required
                  />
                  <label className="block text-sm font-medium text-slate-700">
                    {t('donate.cardNetwork')}
                    <select name="card_network" value={form.card_network} onChange={onChange} className={inputClass}>
                      <option value="">—</option>
                      {['Visa', 'Mastercard', 'RuPay', 'American Express'].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-xs text-slate-500">{t('donate.cardSafety')}</p>
              </>
            )}
            <FormField label={t('donate.reference')} name="reference" maxLength={100} placeholder="UTR / UPI ref / transaction ID" value={form.reference} onChange={onChange} hint={t('donate.referenceHint')} />
          </div>
          {!hasPayee && <p className="mt-3 text-xs text-slate-500">{t('donate.noPayee')}</p>}
        </div>

        <button type="submit" disabled={saving} className="w-full rounded-lg bg-brand-gradient px-5 py-3 text-lg font-semibold text-white hover:brightness-110 disabled:opacity-60">
          {saving ? t('onboarding.saving') : t('donate.submit', { amount: amountValue > 0 ? formatRupees(amountValue, lang) : '' })}
        </button>
        <p className="text-center text-xs text-slate-500">{t('donate.recordNote')}</p>
      </form>
    </section>
  )
}

function PayeeBox({ rows }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border border-accent-100 bg-accent-50 p-4 text-sm">
      <p className="mb-2 font-medium text-accent-700">{t('donate.payTo')}</p>
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 py-0.5">
          <span className="text-slate-600">{label}</span>
          <span className="font-mono font-medium text-slate-800">{value}</span>
        </div>
      ))}
    </div>
  )
}
