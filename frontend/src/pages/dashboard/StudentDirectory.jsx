import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import AdminTabs from '../../components/dashboard/AdminTabs'
import { EligibilityBadge, EligibilityDetailsCard } from '../../components/dashboard/EligibilityAdmin'
import VerificationPanel, { VerificationBadge } from '../../components/dashboard/VerificationPanel'
import StudentProfileDetails from '../../components/student/StudentProfileDetails'
import { Alert, inputClass } from '../../components/ui/FormField'
import { exportStudentDirectory, getDocumentAsAdmin, getStudentAsAdmin, getStudentDirectory, getStudentFacets } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { formatNumber, formatRupees } from '../../utils/format'

const PAGE_SIZE = 25
const EMPTY_FILTERS = { search: '', taluka: '', district: '', complete: '', eligibility: '', status: '' }

/** Admin: searchable, filterable list of all students, exportable to Excel / CSV. */
export default function StudentDirectory() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [search, setSearch] = useState('') // debounced into filters.search
  const [page, setPage] = useState(0)
  const [data, setData] = useState({ total: 0, items: [] })
  const [facets, setFacets] = useState({ talukas: [], districts: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')
  const [selected, setSelected] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

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
    getStudentDirectory({ ...params, skip: page * PAGE_SIZE, limit: PAGE_SIZE })
      .then((d) => active && (setData(d), setError('')))
      .catch((err) => active && setError(apiErrorMessage(err, t)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [params, page, t, reloadKey])

  const setFilter = (e) => {
    setFilters((f) => ({ ...f, [e.target.name]: e.target.value }))
    setPage(0)
  }

  const onExport = async (format) => {
    setExporting(format)
    try {
      await exportStudentDirectory(format, params)
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setExporting('')
    }
  }

  const openStudent = (row) => {
    setSelected({ row, profile: null })
    getStudentAsAdmin(row.user_id)
      .then((profile) => setSelected({ row, profile }))
      .catch((err) => {
        setSelected(null)
        setError(apiErrorMessage(err, t))
      })
  }

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="space-y-6">
      <AdminTabs />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">{t('directory.title')}</h1>
          <p className="text-sm text-slate-600">{t('directory.count', { count: data.total, formatted: formatNumber(data.total, lang) })}</p>
        </div>
        <div className="flex gap-2">
          {['xlsx', 'csv'].map((format) => (
            <button
              key={format}
              type="button"
              disabled={Boolean(exporting)}
              onClick={() => onExport(format)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
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
      <p className="-mt-3 text-xs text-slate-500">{t('directory.exportNote')}</p>

      <Alert>{error}</Alert>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="text-sm font-medium text-slate-700">
          {t('directory.search')}
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('directory.searchPlaceholder')} className={inputClass} />
        </label>
        <FilterSelect label={t('aadhaar.taluka')} name="taluka" value={filters.taluka} onChange={setFilter} options={facets.talukas} allLabel={t('admin.allRoles')} />
        <FilterSelect label={t('aadhaar.district')} name="district" value={filters.district} onChange={setFilter} options={facets.districts} allLabel={t('admin.allRoles')} />
        <label className="text-sm font-medium text-slate-700">
          {t('directory.profile')}
          <select name="complete" value={filters.complete} onChange={setFilter} className={inputClass}>
            <option value="">{t('admin.allRoles')}</option>
            <option value="true">{t('directory.complete')}</option>
            <option value="false">{t('directory.incomplete')}</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          {t('eligibility.label')}
          <select name="eligibility" value={filters.eligibility} onChange={setFilter} className={inputClass}>
            <option value="">{t('admin.allRoles')}</option>
            {['eligible', 'not_eligible', 'pending'].map((s) => (
              <option key={s} value={s}>
                {t(`eligibility.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          {t('verification.label')}
          <select name="status" value={filters.status} onChange={setFilter} className={inputClass}>
            <option value="">{t('admin.allRoles')}</option>
            {['pending', 'verified', 'rejected'].map((s) => (
              <option key={s} value={s}>
                {t(`verification.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS)
              setSearch('')
              setPage(0)
            }}
            className="justify-self-start text-sm text-brand-600 hover:underline"
          >
            {t('directory.clearFilters')}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {['name', 'mobile', 'age', 'taluka', 'college', 'mess', 'abhyasika', 'total', 'eligibility', 'verification', 'profile'].map((c) => (
                  <th key={c} className={`whitespace-nowrap px-4 py-2 font-medium ${['age', 'mess', 'abhyasika', 'total'].includes(c) ? 'text-right' : ''}`}>
                    {t(`directory.col.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={loading ? 'opacity-60' : ''}>
              {data.items.map((s) => (
                <tr key={s.user_id} onClick={() => openStudent(s)} className="cursor-pointer border-t border-slate-100 hover:bg-brand-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.phone || '—'}</td>
                  <td className="px-4 py-2 text-right">{s.age ?? '—'}</td>
                  <td className="px-4 py-2">
                    {s.taluka || '—'}
                    {s.district && <span className="block text-xs text-slate-500">{s.district}</span>}
                  </td>
                  <td className="px-4 py-2">
                    {s.college_name || '—'}
                    {s.course && <span className="block text-xs text-slate-500">{s.course}</span>}
                  </td>
                  <td className="px-4 py-2 text-right">{formatRupees(s.mess_monthly_bill, lang)}</td>
                  <td className="px-4 py-2 text-right">{formatRupees(s.abhyasika_monthly_fee, lang)}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatRupees(s.monthly_total, lang)}</td>
                  <td className="px-4 py-2">
                    <EligibilityBadge status={s.eligibility} />
                  </td>
                  <td className="px-4 py-2">
                    <VerificationBadge status={s.verification} />
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.profile_complete === 'Yes' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {s.profile_complete === 'Yes' ? t('directory.complete') : t('directory.incomplete')}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && data.items.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                    {t('directory.empty')}
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
              <h2 className="text-lg font-semibold text-brand-700">{selected.row.name}</h2>
              <button type="button" onClick={() => setSelected(null)} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label={t('common.close')}>
                ✕
              </button>
            </div>
            {selected.profile ? (
              <>
                <VerificationPanel
                  userId={selected.row.user_id}
                  profile={selected.profile}
                  onUpdated={(profile) => {
                    setSelected((sel) => ({ ...sel, profile }))
                    setReloadKey((k) => k + 1)
                  }}
                />
                <EligibilityDetailsCard eligibility={selected.profile.eligibility} aadhaar={selected.profile.aadhaar} />
                <StudentProfileDetails profile={selected.profile} fetchDocument={getDocumentAsAdmin} onError={setError} showContact />
              </>
            ) : (
              <p className="rounded-xl bg-white p-8 text-center text-slate-500">{t('common.loading')}</p>
            )}
          </div>
        </div>
      )}
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
