import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import AdminTabs from '../../components/dashboard/AdminTabs'
import { Alert, inputClass } from '../../components/ui/FormField'
import { downloadReceipt, exportDonations, getAdminDonations } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { formatDate, formatNumber, formatRupees } from '../../utils/format'

const PAGE_SIZE = 25
const METHODS = ['upi', 'netbanking', 'card']
const METHOD_STYLE = {
  upi: 'bg-accent-50 text-accent-700',
  netbanking: 'bg-brand-50 text-brand-700',
  card: 'bg-amber-50 text-amber-800',
}

/** Admin: every donation with how it was paid, the reference and the receipt. */
export default function Donations() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const rupees = (n) => formatRupees(n, lang)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ search: '', method: '', period: '' })
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')

  const params = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')), [filters])

  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((f) => ({ ...f, search }))
      setPage(0)
    }, 300)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    let active = true
    setLoading(true)
    getAdminDonations({ ...params, skip: page * PAGE_SIZE, limit: PAGE_SIZE })
      .then((d) => active && (setData(d), setError('')))
      .catch((err) => active && setError(apiErrorMessage(err, t)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [params, page, t])

  const setFilter = (name, value) => {
    setFilters((f) => ({ ...f, [name]: value }))
    setPage(0)
  }

  const onExport = async (format) => {
    setExporting(format)
    try {
      await exportDonations(format, params)
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setExporting('')
    }
  }

  const pages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <AdminTabs />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">{t('adminDonations.title')}</h1>
          <p className="text-sm text-slate-600">{t('adminDonations.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {['xlsx', 'csv'].map((format) => (
            <button
              key={format}
              type="button"
              disabled={Boolean(exporting) || !data?.total}
              onClick={() => onExport(format)}
              className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                format === 'xlsx' ? 'bg-accent-600 text-white hover:bg-accent-700' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {exporting === format ? t('directory.exporting') : t(`directory.export.${format}`)}
            </button>
          ))}
        </div>
      </div>

      <Alert>{error}</Alert>

      {/* Totals by method — click to filter */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-brand-gradient p-5 text-white shadow-sm">
          <p className="text-sm text-white/80">{t('adminDonations.totalReceived')}</p>
          <p className="mt-1 text-2xl font-bold">{data ? rupees(data.amount) : '—'}</p>
          <p className="mt-1 text-xs text-white/80">{data ? t('home2.cards.donationsCount', { count: data.total, formatted: formatNumber(data.total, lang) }) : ''}</p>
        </div>
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setFilter('method', filters.method === m ? '' : m)}
            aria-pressed={filters.method === m}
            className={`rounded-xl border p-5 text-left transition ${filters.method === m ? 'border-brand-500 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-200'} bg-white`}
          >
            <p className="text-sm text-slate-500">{t(`donate.methods.${m}`)}</p>
            <p className="mt-1 text-2xl font-bold text-brand-700">{data ? rupees(data.by_method[m].amount) : '—'}</p>
            <p className="mt-1 text-xs text-slate-500">
              {data ? t('home2.cards.donationsCount', { count: data.by_method[m].count, formatted: formatNumber(data.by_method[m].count, lang) }) : ''}
            </p>
          </button>
        ))}
      </section>

      {/* Filters */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          {t('directory.search')}
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('adminDonations.searchPlaceholder')} className={inputClass} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          {t('donate.method')}
          <select value={filters.method} onChange={(e) => setFilter('method', e.target.value)} className={inputClass}>
            <option value="">{t('admin.allRoles')}</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`donate.methods.${m}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          {t('payments.month')}
          <div className="flex gap-2">
            <input type="month" value={filters.period} onChange={(e) => setFilter('period', e.target.value)} className={inputClass} />
            {filters.period && (
              <button type="button" onClick={() => setFilter('period', '')} className="mt-1 shrink-0 px-2 text-sm text-brand-600 hover:underline">
                {t('directory.clearFilters')}
              </button>
            )}
          </div>
        </label>
      </div>

      {/* Donations */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">{t('adminDonations.col.date')}</th>
                <th className="px-4 py-2 font-medium">{t('adminDonations.col.donor')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('adminDonations.col.amount')}</th>
                <th className="px-4 py-2 font-medium">{t('adminDonations.col.payment')}</th>
                <th className="px-4 py-2 font-medium">{t('adminDonations.col.reference')}</th>
                <th className="px-4 py-2 font-medium">
                  <span className="sr-only">{t('myDonations.receipt')}</span>
                </th>
              </tr>
            </thead>
            <tbody className={loading ? 'opacity-60' : ''}>
              {data?.items.map((d) => (
                <tr key={d.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">
                    {formatDate(d.created_at, lang)}
                    <span className="block font-mono text-xs text-slate-500">{d.receipt_no}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">{d.donor_name}</span>
                    <span className="block text-xs text-slate-500">{[d.phone, d.email].filter(Boolean).join(' · ')}</span>
                    {d.pan && <span className="block font-mono text-xs text-slate-500">PAN {d.pan}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-brand-700">{rupees(d.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${METHOD_STYLE[d.method]}`}>{t(`donate.methods.${d.method}`)}</span>
                    <PaymentDetails method={d.method} details={d.details} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{d.reference || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => downloadReceipt(d.id).catch((err) => setError(apiErrorMessage(err, t)))}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      ↓ {t('myDonations.receipt')}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {t('adminDonations.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-sm">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="text-brand-600 disabled:text-slate-300">
              ← {t('directory.prev')}
            </button>
            <span className="text-slate-600">{t('directory.page', { page: formatNumber(page + 1, lang), pages: formatNumber(pages, lang) })}</span>
            <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="text-brand-600 disabled:text-slate-300">
              {t('directory.next')} →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** UPI ID / bank / card type + last 4, labelled in the current language. */
export function PaymentDetails({ method, details = {} }) {
  const { t } = useTranslation()
  let text = ''
  if (method === 'upi') text = `${t('donate.payToUpi')}: ${details.upi_id}`
  if (method === 'netbanking') text = details.bank_name
  if (method === 'card')
    text = `${details.card_type === 'credit' ? t('donate.credit') : t('donate.debit')} •••• ${details.card_last4}${details.card_network ? ` (${details.card_network})` : ''}`
  return <span className="mt-1 block text-xs text-slate-600">{text}</span>
}
