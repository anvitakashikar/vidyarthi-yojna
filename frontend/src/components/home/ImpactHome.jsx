import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { getImpact } from '../../services/api'
import { formatNumber, formatRupees } from '../../utils/format'

/**
 * Home page for donors and admins: what the scheme does, an appeal to donate,
 * and live figures — students supported and what they need each month.
 */
export default function ImpactHome({ showDonate = false }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [impact, setImpact] = useState(null)

  useEffect(() => {
    getImpact().then(setImpact).catch(() => setImpact(null))
  }, [])

  const rupees = (n) => (impact ? formatRupees(n, lang) : '—')
  const count = (n) => (impact ? formatNumber(n, lang) : '—')

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-brand-gradient text-white shadow-sm">
        <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-white/70">{t('home2.kicker')}</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{t('home2.title')}</h1>
            <p className="mt-4 text-white/90">{t('home2.about')}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-white/90">
              {['point1', 'point2', 'point3'].map((p) => (
                <li key={p} className="flex gap-2">
                  <span aria-hidden="true">✓</span>
                  {t(`home2.${p}`)}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-white/10 p-5 backdrop-blur">
            <h2 className="text-xl font-semibold">{t('home2.appealTitle')}</h2>
            <p className="mt-2 text-sm text-white/90">
              {impact && impact.monthly_need > 0
                ? t('home2.appealBody', { students: count(impact.students_supported), amount: rupees(impact.monthly_need) })
                : t('home2.appealBodyGeneric')}
            </p>
            {showDonate && (
              <Link
                to="/donor/donate"
                className="mt-4 inline-block rounded-lg bg-white px-6 py-2.5 font-semibold text-brand-700 shadow-sm hover:bg-accent-50"
              >
                {t('home2.donateNow')} →
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label={t('home2.cards.students')} value={count(impact?.students_supported)} hint={impact ? t('home2.cards.studentsHint', { count: impact.students_registered, formatted: count(impact.students_registered) }) : ''} />
        <Card label={t('home2.cards.monthlyNeed')} value={rupees(impact?.monthly_need)} hint={t('home2.cards.monthlyNeedHint')} highlight />
        <Card label={t('home2.cards.mess')} value={rupees(impact?.mess_need)} hint={impact ? t('home2.cards.forStudents', { count: impact.mess_students, formatted: count(impact.mess_students) }) : ''} />
        <Card
          label={t('home2.cards.abhyasika')}
          value={rupees(impact?.abhyasika_need)}
          hint={impact ? t('home2.cards.forStudents', { count: impact.abhyasika_students, formatted: count(impact.abhyasika_students) }) : ''}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card label={t('home2.cards.raised')} value={rupees(impact?.donations_total)} hint={impact ? t('home2.cards.donationsCount', { count: impact.donations_count, formatted: count(impact.donations_count) }) : ''} />
        <Card label={t('home2.cards.paidOut')} value={rupees(impact?.paid_out)} hint={t('home2.cards.paidOutHint')} />
      </section>
    </div>
  )
}

function Card({ label, value, hint, highlight }) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? 'border-accent-100 bg-accent-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? 'text-accent-700' : 'text-brand-700'}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
