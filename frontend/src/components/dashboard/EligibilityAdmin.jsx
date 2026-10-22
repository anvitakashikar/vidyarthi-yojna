import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getEligibilityCounts, getEligibilityRules } from '../../services/api'
import { formatDate, formatNumber } from '../../utils/format'

export const ELIGIBILITY_BADGE = {
  eligible: 'bg-accent-50 text-accent-700',
  not_eligible: 'bg-red-50 text-red-700',
  pending: 'bg-slate-100 text-slate-600',
}

export function EligibilityBadge({ status }) {
  const { t } = useTranslation()
  const key = ELIGIBILITY_BADGE[status] ? status : 'pending'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ELIGIBILITY_BADGE[key]}`}>{t(`eligibility.status.${key}`)}</span>
}

/** Admin-only: why a student is (not) eligible. */
export function EligibilityDetailsCard({ eligibility, aadhaar }) {
  const { t, i18n } = useTranslation()
  if (!eligibility) return null
  const params = { age: eligibility.age, min: eligibility.min_age, max: eligibility.max_age, taluka: aadhaar?.taluka || '', district: aadhaar?.district || '' }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-800">{t('eligibility.admin.title')}</h3>
        <EligibilityBadge status={eligibility.status} />
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        <Check ok={eligibility.age_ok} label={t('eligibility.admin.ageCheck', params)} />
        <Check
          ok={eligibility.taluka_ok}
          label={
            eligibility.taluka_ok
              ? t('eligibility.admin.talukaListed', { taluka: eligibility.matched_taluka, district: eligibility.matched_district })
              : t('eligibility.admin.talukaCheck', params)
          }
        />
      </ul>
      {eligibility.reasons.length > 0 && (
        <p className="mt-3 text-sm text-red-700">{eligibility.reasons.map((r) => t(`eligibility.reasons.${r}`, params)).join(' · ')}</p>
      )}
      {eligibility.checked_on && (
        <p className="mt-2 text-xs text-slate-500">{t('eligibility.admin.checkedOn', { date: formatDate(eligibility.checked_on, i18n.language) })}</p>
      )}
    </section>
  )
}

function Check({ ok, label }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${ok ? 'bg-accent-500' : 'bg-red-500'}`}>
        {ok ? '✓' : '✕'}
      </span>
      <span className="text-slate-700">{label}</span>
    </li>
  )
}

/** Admin overview: eligibility counts and the full rule list. */
export function EligibilityOverview() {
  const { t, i18n } = useTranslation()
  const [rules, setRules] = useState(null)
  const [counts, setCounts] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    getEligibilityRules().then(setRules).catch(() => {})
    getEligibilityCounts().then(setCounts).catch(() => {})
  }, [])

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-lg font-semibold">{t('eligibility.admin.overviewTitle')}</h2>
        {rules && (
          <p className="mt-1 text-sm text-slate-600">
            {t('eligibility.admin.ruleSummary', { min: rules.min_age, max: rules.max_age, count: rules.total_talukas })}
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {['eligible', 'not_eligible', 'pending'].map((s) => (
            <div key={s} className={`rounded-lg p-4 ${ELIGIBILITY_BADGE[s]}`}>
              <p className="text-sm">{t(`eligibility.status.${s}`)}</p>
              <p className="mt-1 text-2xl font-bold">{counts ? formatNumber(counts[s], i18n.language) : '—'}</p>
            </div>
          ))}
        </div>
      </div>
      {rules && (
        <div className="p-5">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-sm font-medium text-brand-600 hover:underline">
            {open ? t('eligibility.admin.hideTalukas') : t('eligibility.admin.showTalukas')}
          </button>
          {open && (
            <div className="mt-4 space-y-5">
              {rules.divisions.map((division) => (
                <div key={division.name}>
                  <h3 className="text-sm font-semibold text-brand-700">{division.name}</h3>
                  <dl className="mt-2 space-y-1.5 text-sm">
                    {division.districts.map((d) => (
                      <div key={d.name} className="grid gap-1 sm:grid-cols-[9rem_1fr]">
                        <dt className="font-medium text-slate-700">{d.name}</dt>
                        <dd className="text-slate-600">{d.talukas.join(', ')}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
