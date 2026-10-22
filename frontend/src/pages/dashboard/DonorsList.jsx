import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import AdminTabs from '../../components/dashboard/AdminTabs'
import { Alert, inputClass } from '../../components/ui/FormField'
import { downloadReceipt, exportDonors, getAdminDonations, getAdminDonors, getDocumentAsAdmin } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { formatDate, formatNumber, formatRupees, openBlobInNewTab } from '../../utils/format'
import { DonorDetails } from './DonorDashboard'
import { PaymentDetails } from './Donations'

const PAGE_SIZE = 25

/** Admin: all donors with their bank and PAN details (shown in full). */
export default function DonorsList() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ search: '', complete: '' })
  const [page, setPage] = useState(0)
  const [data, setData] = useState({ total: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')
  const [selected, setSelected] = useState(null)

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
    getAdminDonors({ ...params, skip: page * PAGE_SIZE, limit: PAGE_SIZE })
      .then((d) => active && (setData(d), setError('')))
      .catch((err) => active && setError(apiErrorMessage(err, t)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [params, page, t])

  const onExport = async (format) => {
    setExporting(format)
    try {
      await exportDonors(format, params)
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setExporting('')
    }
  }

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <AdminTabs />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">{t('donorsList.title')}</h1>
          <p className="text-sm text-slate-600">{t('donorsList.count', { count: data.total, formatted: formatNumber(data.total, lang) })}</p>
        </div>
        <div className="flex gap-2">
          {['xlsx', 'csv'].map((format) => (
            <button
              key={format}
              type="button"
              disabled={Boolean(exporting) || !data.total}
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

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          {t('directory.search')}
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('donorsList.searchPlaceholder')} className={inputClass} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          {t('donorsList.details')}
          <select
            value={filters.complete}
            onChange={(e) => {
              setFilters((f) => ({ ...f, complete: e.target.value }))
              setPage(0)
            }}
            className={inputClass}
          >
            <option value="">{t('admin.allRoles')}</option>
            <option value="true">{t('directory.complete')}</option>
            <option value="false">{t('directory.incomplete')}</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">{t('directory.col.name')}</th>
                <th className="px-4 py-2 font-medium">{t('donorsList.contact')}</th>
                <th className="px-4 py-2 font-medium">{t('pan.number')}</th>
                <th className="px-4 py-2 font-medium">{t('bank.title')}</th>
                <th className="px-4 py-2 font-medium">{t('donorsList.details')}</th>
              </tr>
            </thead>
            <tbody className={loading ? 'opacity-60' : ''}>
              {data.items.map((d) => (
                <tr key={d.user_id} onClick={() => setSelected(d)} className="cursor-pointer border-t border-slate-100 align-top hover:bg-brand-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{d.name}</td>
                  <td className="px-4 py-2 text-xs">
                    <span className="block font-mono">{d.phone || '—'}</span>
                    <span className="block text-slate-500">{d.email || ''}</span>
                  </td>
                  <td className="px-4 py-2">
                    {d.pan ? (
                      <>
                        <span className="font-mono">{d.pan.pan}</span>
                        <span className="block text-xs text-slate-500">{t(`pan.types.${d.pan.holder_type}`)}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {d.bank ? (
                      <>
                        <span className="block text-slate-700">{d.bank.bank_name}</span>
                        <span className="block font-mono text-slate-500">
                          {d.bank.ifsc} · {d.bank.account_number}
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.onboarding_complete ? 'bg-accent-50 text-accent-700' : 'bg-amber-50 text-amber-700'}`}>
                      {d.onboarding_complete ? t('directory.complete') : t('directory.incomplete')}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    {t('donorsList.empty')}
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

      {selected && (
        <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4" onClick={() => setSelected(null)} role="dialog" aria-modal="true">
          <div className="my-8 w-full max-w-3xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between rounded-xl bg-white px-5 py-3">
              <div>
                <h2 className="text-lg font-semibold text-brand-700">{selected.name}</h2>
                <p className="text-xs text-slate-500">
                  {[selected.phone, selected.email].filter(Boolean).join(' · ')}
                  {selected.bank?.submitted_at && ` · ${formatDate(selected.bank.submitted_at, lang)}`}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label={t('common.close')}>
                ✕
              </button>
            </div>
            <DonorDetails
              profile={selected}
              onViewDoc={(id) => openBlobInNewTab(() => getDocumentAsAdmin(id)).catch((err) => setError(apiErrorMessage(err, t)))}
            />
            <DonorDonations userId={selected.user_id} onError={setError} />
          </div>
        </div>
      )}
    </div>
  )
}

/** Admin: one donor's donations with payment details and receipts. */
function DonorDonations({ userId, onError }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [data, setData] = useState(null)

  useEffect(() => {
    getAdminDonations({ user_id: userId, limit: 200 })
      .then(setData)
      .catch((err) => onError(apiErrorMessage(err, t)))
  }, [userId, onError, t])

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h3 className="font-semibold">{t('adminDonations.title')}</h3>
        {data && <span className="text-sm font-medium text-brand-700">{formatRupees(data.amount, lang)}</span>}
      </div>
      {data?.items.length ? (
        <ul className="divide-y divide-slate-100 text-sm">
          {data.items.map((d) => (
            <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
              <div>
                <span className="font-semibold text-brand-700">{formatRupees(d.amount, lang)}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {formatDate(d.created_at, lang)} · <span className="font-mono">{d.receipt_no}</span>
                </span>
                <span className="block text-xs text-slate-700">{t(`donate.methods.${d.method}`)}</span>
                <PaymentDetails method={d.method} details={d.details} />
                {d.reference && <span className="block font-mono text-xs text-slate-500">{t('payments.ref')}: {d.reference}</span>}
              </div>
              <button
                type="button"
                onClick={() => downloadReceipt(d.id).catch((err) => onError(apiErrorMessage(err, t)))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                ↓ {t('myDonations.receipt')}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-6 text-center text-sm text-slate-500">{data ? t('adminDonations.noneForDonor') : t('common.loading')}</p>
      )}
    </section>
  )
}
