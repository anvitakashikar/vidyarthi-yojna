import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const TABS = [
  { to: '/admin', key: 'admin.tabs.overview', end: true },
  { to: '/admin/students', key: 'admin.tabs.students' },
  { to: '/admin/requirements', key: 'admin.tabs.requirements' },
  { to: '/admin/payments', key: 'admin.tabs.payments' },
  { to: '/admin/donations', key: 'admin.tabs.donations' },
  { to: '/admin/donors', key: 'admin.tabs.donors' },
]

export default function AdminTabs() {
  const { t } = useTranslation()
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map(({ to, key, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-brand-600'
            }`
          }
        >
          {t(key)}
        </NavLink>
      ))}
    </nav>
  )
}
