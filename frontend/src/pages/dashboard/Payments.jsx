import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import AdminTabs from '../../components/dashboard/AdminTabs'
import FormField, { Alert, SuccessNote, inputClass } from '../../components/ui/FormField'
import { addFunds, downloadReceipt, getFunds, getPaymentsDue, getPaymentsMade, getPaymentsSummary, recordPayment } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { formatDate, formatNumber, formatRupees } from '../../utils/format'

const thisMonth = () => new Date().toISOString().slice(0, 7)

/**
 * Admin: money left, how much is due this month, and the list of accepted
 * students still to be paid — each with a Pay button.
 */
export default function Payments() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const rupees = (n) => formatRupees(n, lang)

  const [period, setPeriod] = useState(thisMonth())
  const [summary, setSummary] = useState(null)
  const [due, setDue] = useState([])
  const [paid, setPaid] = useState([])
  const [funds, setFunds] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [paying, setPaying] = useState(null) // student being paid
  const [addingFunds, setAddingFunds] = useState(false)

  const load = useCallback(() => {
    setError('')
    Promise.all([getPaymentsSummary({ period }), getPaymentsDue({ period }), getPaymentsMade({ period }), getFunds()])
      .then(([s, d, p, f]) => {
        setSummary(s)
        setDue(d.items)
        setPaid(p.items)
        setFunds(f.items)
      })
      .catch((err) => setError(apiErrorMessage(err, t)))
  }, [period, t])

  useEffect(load, [load])

  const monthLabel = new Intl.DateTimeFormat(lang?.startsWith('mr') ? 'mr-IN' : 'en-IN', { month: 'long', year: 'numeric' }).format(
    new Date(`${period}-01T00:00:00`),
  )
  const q = search.trim().toLowerCase()
  const visibleDue = q ? due.filter((s) => s.name.toLowerCase().includes(q) || s.phone.includes(q)) : due

  return (
    <div className="space-y-6">
      <AdminTabs />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">{t('payments.title')}</h1>
          <p className="text-sm text-slate-600">{t('payments.subtitle')}</p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          {t('payments.month')}
          <input type="month" value={period} max={thisMonth()} onChange={(e) => e.target.value && setPeriod(e.target.value)} className={inputClass} />
        </label>
      </div>

      <Alert>{error}</Alert>
      <SuccessNote>{notice}</SuccessNote>

      {/* Money left / to pay / paid */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-brand-gradient p-5 text-white shadow-sm">
          <p className="text-sm text-white/80">{t('payments.moneyLeft')}</p>
          <p className="mt-1 text-3xl font-bold">{summary ? rupees(summary.balance) : '—'}</p>
          <p className="mt-1 text-xs text-white/80">
            {summary ? t('payments.receivedPaid', { received: rupees(summary.received), paid: rupees(summary.paid) }) : ''}
          </p>
          <button type="button" onClick={() => setAddingFunds(true)} className="mt-3 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25">
            + {t('payments.addFunds')}
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">{t('payments.toPay', { month: monthLabel })}</p>
          <p className="mt-1 text-3xl font-bold text-brand-700">{summary ? rupees(summary.due_total) : '—'}</p>
          <p className="mt-1 text-xs text-slate-500">{summary ? t('payments.studentsCount', { count: summary.due_count, formatted: formatNumber(summary.due_count, lang) }) : ''}</p>
          {summary?.shortfall > 0 && <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">{t('payments.shortfall', { amount: rupees(summary.shortfall) })}</p>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">{t('payments.paidIn', { month: monthLabel })}</p>
          <p className="mt-1 text-3xl font-bold text-accent-600">{summary ? rupees(summary.paid_total) : '—'}</p>
          <p className="mt-1 text-xs text-slate-500">{summary ? t('payments.studentsCount', { count: summary.paid_count, formatted: formatNumber(summary.paid_count, lang) }) : ''}</p>
        </div>
      </section>

      {/* Students to pay */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold">{t('payments.studentsToPay', { month: monthLabel })}</h2>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('payments.searchPlaceholder')} className={`${inputClass} mt-0 max-w-xs`} />
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2 font-medium">{t('payments.col.name')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('payments.col.amount')}</th>
              <th className="px-4 py-2 text-right font-medium">
                <span className="sr-only">{t('payments.pay')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleDue.map((s) => {
              const enough = summary && summary.balance >= s.amount
              return (
                <tr key={s.user_id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">{s.name}</span>
                    <span className="block text-xs text-slate-500">
                      {s.phone} · {s.taluka}, {s.district}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-brand-700">{rupees(s.amount)}</span>
                    <span className="block text-xs text-slate-500">{t('payments.breakdown', { mess: rupees(s.mess), abhyasika: rupees(s.abhyasika) })}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setPaying(s)}
                      disabled={!enough}
                      title={enough ? undefined : t('payments.notEnoughShort')}
                      className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t('payments.pay')}
                    </button>
                  </td>
                </tr>
              )
            })}
            {summary && visibleDue.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                  {due.length === 0 ? t('payments.allPaid', { month: monthLabel }) : t('directory.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Paid this month */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">{t('payments.paidList', { month: monthLabel })}</h2>
          {paid.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {paid.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div>
                    <span className="font-medium text-slate-800">{p.student_name}</span>
                    <span className="block text-xs text-slate-500">
                      {formatDate(p.created_at, lang)} · {p.by_name}
                      {p.reference && ` · ${t('payments.ref')}: ${p.reference}`}
                    </span>
                  </div>
                  <span className="font-semibold text-accent-600">{rupees(p.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-500">{t('payments.nonePaid')}</p>
          )}
        </section>

        {/* Funds received */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">{t('payments.fundsReceived')}</h2>
          {funds.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {funds.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div>
                    <span className="font-medium text-slate-800">{f.source || t('payments.unnamedSource')}</span>
                    <span className="block text-xs text-slate-500">
                      {formatDate(f.created_at, lang)} · {f.by_name}
                      {f.note && ` · ${f.note}`}
                    </span>
                  </div>
                  <span className="text-right">
                    <span className="block font-semibold text-brand-700">+{rupees(f.amount)}</span>
                    {f.donation_id && (
                      <button
                        type="button"
                        onClick={() => downloadReceipt(f.donation_id).catch((err) => setError(apiErrorMessage(err, t)))}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        {t('myDonations.receipt')}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-500">{t('payments.noFunds')}</p>
          )}
        </section>
      </div>

      {paying && (
        <PayDialog
          student={paying}
          period={period}
          monthLabel={monthLabel}
          onClose={() => setPaying(null)}
          onPaid={(p) => {
            setPaying(null)
            setNotice(t('payments.paidNotice', { name: p.student_name, amount: rupees(p.amount), month: monthLabel }))
            load()
          }}
        />
      )}
      {addingFunds && (
        <AddFundsDialog
          onClose={() => setAddingFunds(false)}
          onAdded={(amount) => {
            setAddingFunds(false)
            setNotice(t('payments.fundsNotice', { amount: rupees(amount) }))
            load()
          }}
        />
      )}
    </div>
  )
}

function Dialog({ title, onClose, children }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="my-12 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-700">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Shows the bank details to transfer to, then records the payment. */
function PayDialog({ student, period, monthLabel, onClose, onPaid }) {
  const { t, i18n } = useTranslation()
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')
  const b = student.bank

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 1500)
    })
  }

  const confirm = async () => {
    setError('')
    setSaving(true)
    try {
      onPaid(await recordPayment({ user_id: student.user_id, period, reference }))
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  const Row = ({ label, value, copyKey }) => (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="flex items-center gap-2 font-medium text-slate-800">
        <span className={copyKey ? 'font-mono' : ''}>{value}</span>
        {copyKey && (
          <button type="button" onClick={() => copy(value, copyKey)} className="text-xs text-brand-600 hover:underline">
            {copied === copyKey ? t('payments.copied') : t('payments.copy')}
          </button>
        )}
      </span>
    </div>
  )

  return (
    <Dialog title={t('payments.payTitle', { name: student.name })} onClose={onClose}>
      <div className="rounded-xl bg-brand-gradient p-4 text-center text-white">
        <p className="text-sm text-white/80">{t('payments.amountFor', { month: monthLabel })}</p>
        <p className="text-3xl font-bold">{formatRupees(student.amount, i18n.language)}</p>
      </div>

      <p className="mt-4 text-sm font-medium text-slate-700">{t('payments.transferTo')}</p>
      <div className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200 px-3 text-sm">
        <Row label={t('bank.holder')} value={b.account_holder_name} />
        <Row label={t('bank.account')} value={b.account_number} copyKey="account" />
        <Row label={t('bank.ifsc')} value={b.ifsc} copyKey="ifsc" />
        <Row label={t('bank.bankName')} value={`${b.bank_name}, ${b.branch_name}`} />
      </div>

      <div className="mt-4 space-y-3">
        <FormField
          label={t('payments.reference')}
          value={reference}
          maxLength={100}
          onChange={(e) => setReference(e.target.value)}
          placeholder="UTR / transaction ID"
          hint={t('payments.referenceHint')}
        />
        <Alert>{error}</Alert>
        <button
          type="button"
          disabled={saving}
          onClick={confirm}
          className="w-full rounded-lg bg-brand-gradient px-5 py-2.5 font-medium text-white hover:brightness-110 disabled:opacity-60"
        >
          {saving ? t('onboarding.saving') : t('payments.markPaid', { amount: formatRupees(student.amount, i18n.language) })}
        </button>
        <p className="text-center text-xs text-slate-500">{t('payments.markPaidNote')}</p>
      </div>
    </Dialog>
  )
}

function AddFundsDialog({ onClose, onAdded }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ amount: '', source: '', note: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const amount = Number(form.amount.replace(/,/g, ''))
    if (!Number.isInteger(amount) || amount <= 0) return setError(t('errors.student.invalid_amount'))
    setSaving(true)
    try {
      await addFunds({ amount, source: form.source, note: form.note })
      onAdded(amount)
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog title={t('payments.addFunds')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <FormField label={t('payments.fundAmount')} name="amount" inputMode="numeric" prefix="₹" required value={form.amount} onChange={onChange} />
        <FormField label={t('payments.fundSource')} name="source" maxLength={150} placeholder={t('payments.fundSourcePlaceholder')} value={form.source} onChange={onChange} />
        <FormField label={t('payments.fundNote')} name="note" maxLength={300} value={form.note} onChange={onChange} />
        <button type="submit" disabled={saving} className="w-full rounded-lg bg-brand-gradient px-5 py-2.5 font-medium text-white hover:brightness-110 disabled:opacity-60">
          {saving ? t('onboarding.saving') : t('payments.addFunds')}
        </button>
      </form>
    </Dialog>
  )
}
