import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import AdminTabs from '../../components/dashboard/AdminTabs'
import { Alert, inputClass } from '../../components/ui/FormField'
import { exportRequirements, getRequirements, getStudentFacets } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { formatNumber, formatRupees } from '../../utils/format'

const PAGE_SIZE = 25
const EMPTY_FILTERS = { search: '', taluka: '', district: '' }

/**
 * Admin: monthly requirement (mess bill + abhyasika fee) of every accepted
 * student — eligible for the scheme AND verified by an admin.
 */
export default function Requirements() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)
  const [facets, setFacets] = useState({ talukas: [], districts: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')

  const params = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')), [filters])

  useEffect(() => {
    getStudentFacets()
      .then(setFacets)
      .catch(() => {})
  }, [])

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
    getRequirements({ ...params, skip: page * PAGE_SIZE, limit: PAGE_SIZE })
      .then((d) => active && (setData(d), setError('')))
      .catch((err) => active && setError(apiErrorMessage(err, t)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [params, page, t])

  const setFilter = (e) => {
    setFilters((f) => ({ ...f, [e.target.name]: e.target.value }))
    setPage(0)
  }

  const onExport = async (format) => {
    setExporting(format)
    try {
      await exportRequirements(format, params)
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setExporting('')
    }
  }

  const s = data?.summary
  const pages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE))
  const rupees = (n) => formatRupees(n, lang)

  return (
    <div className="space-y-6">
      <AdminTabs />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">{t('requirements.title')}</h1>
          <p className="text-sm text-slate-600">{t('requirements.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {['xlsx', 'csv'].map((format) => (
            <button
              key={format}
              type="button"
              disabled={Boolean(exporting) || !s?.students}
              onClick={() => onExport(format)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                format === 'xlsx' ? 'bg-accent-600 text-white hover:bg-accent-700' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
              </svg>
              {exporting === format ? t('directory.exporting') : t(`directory.export.${format}`)}
            </button>
          ))}
        </div>
      </div>

      <Alert>{error}</Alert>

      {/* Totals */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-brand-gradient p-5 text-white shadow-sm">
          <p className="text-sm text-white/80">{t('requirements.totalMonthly')}</p>
          <p className="mt-1 text-3xl font-bold">{s ? rupees(s.total) : '—'}</p>
          <p className="mt-1 text-xs text-white/80">{s ? t('requirements.averagePerStudent', { amount: rupees(s.average) }) : ''}</p>
        </div>
        <Stat label={t('requirements.acceptedStudents')} value={s ? formatNumber(s.students, lang) : '—'} />
        <Stat
          label={t('requirements.messTotal')}
          value={s ? rupees(s.mess) : '—'}
          hint={s ? t('requirements.usingCount', { count: s.mess_users, formatted: formatNumber(s.mess_users, lang) }) : ''}
        />
        <Stat
          label={t('requirements.abhyasikaTotal')}
          value={s ? rupees(s.abhyasika) : '—'}
          hint={s ? t('requirements.usingCount', { count: s.abhyasika_users, formatted: formatNumber(s.abhyasika_users, lang) }) : ''}
        />
      </section>

      {/* Filters */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          {t('directory.search')}
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('directory.searchPlaceholder')} className={inputClass} />
        </label>
        <FilterSelect label={t('aadhaar.district')} name="district" value={filters.district} onChange={setFilter} options={facets.districts} allLabel={t('admin.allRoles')} />
        <FilterSelect label={t('aadhaar.taluka')} name="taluka" value={filters.taluka} onChange={setFilter} options={facets.talukas} allLabel={t('admin.allRoles')} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Students */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2 font-medium">{t('directory.col.name')}</th>
                  <th className="px-4 py-2 font-medium">{t('directory.col.taluka')}</th>
                  <th className="px-4 py-2 font-medium">{t('requirements.col.mess')}</th>
                  <th className="px-4 py-2 font-medium">{t('requirements.col.abhyasika')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('requirements.col.total')}</th>
                  <th className="px-4 py-2 font-medium">{t('requirements.col.bank')}</th>
                </tr>
              </thead>
              <tbody className={loading ? 'opacity-60' : ''}>
                {data?.items.map((r) => (
                  <tr key={r.user_id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-2">
                      <span className="font-medium text-slate-800">{r.name}</span>
                      <span className="block font-mono text-xs text-slate-500">{r.phone}</span>
                    </td>
                    <td className="px-4 py-2">
                      {r.taluka}
                      <span className="block text-xs text-slate-500">{r.district}</span>
                    </td>
                    <td className="px-4 py-2">
                      {r.mess_monthly_bill ? (
                        <>
                          {rupees(r.mess_monthly_bill)}
                          <span className="block text-xs text-slate-500">{r.mess_name}</span>
                        </>
                      ) : (
                        <span className="text-slate-400">{t('expenses.notUsing')}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {r.abhyasika_monthly_fee ? (
                        <>
                          {rupees(r.abhyasika_monthly_fee)}
                          <span className="block text-xs text-slate-500">{r.abhyasika_name}</span>
                        </>
                      ) : (
                        <span className="text-slate-400">{t('expenses.notUsing')}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-brand-700">{rupees(r.monthly_total)}</td>
                    <td className="px-4 py-2 text-xs">
                      <span className="block text-slate-700">{r.bank_name}</span>
                      <span className="block font-mono text-slate-500">
                        {r.ifsc} · {r.account}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && data?.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      {t('requirements.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
              {s?.students > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  <tr>
                    <td className="px-4 py-2" colSpan={2}>
                      {t('requirements.totalRow', { count: s.students, formatted: formatNumber(s.students, lang) })}
                    </td>
                    <td className="px-4 py-2">{rupees(s.mess)}</td>
                    <td className="px-4 py-2">{rupees(s.abhyasika)}</td>
                    <td className="px-4 py-2 text-right text-brand-700">{rupees(s.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
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

        {/* By district */}
        <aside className="h-fit rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">{t('requirements.byDistrict')}</h2>
          {data?.by_district.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.by_district.map((d) => (
                <li key={d.district} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-800">{d.district}</span>
                    <span className="font-semibold text-brand-700">{rupees(d.total)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${s.total ? (d.total / s.total) * 100 : 0}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('requirements.studentsCount', { count: d.students, formatted: formatNumber(d.students, lang) })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-500">{t('requirements.empty')}</p>
          )}
        </aside>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-700">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function FilterSelect({ label, name, value, onChange, options, allLabel }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <select name={name} value={value} onChange={onChange} className={inputClass}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}
