import { useTranslation } from 'react-i18next'

import { useAuth } from '../../context/AuthContext'

export default function DashboardHeader() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">{t('dashboard.welcome', { name: user.name })}</h1>
        <p className="text-sm text-slate-600">{t(`dashboard.subtitle.${user.role}`)}</p>
      </div>
      <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">{t(`roles.${user.role}`)}</span>
    </div>
  )
}

export function PlaceholderCards({ items }) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((key) => (
        <div key={key} className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
          <h2 className="font-semibold text-slate-800">{t(key)}</h2>
          <p className="mt-2 text-sm text-slate-500">{t('dashboard.comingSoon')}</p>
        </div>
      ))}
    </div>
  )
}
