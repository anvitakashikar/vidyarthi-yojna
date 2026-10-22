import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/** Tabs to switch between role portals, e.g. /login/student ↔ /login/donor. */
export default function RoleTabs({ basePath, roles }) {
  const { t } = useTranslation()

  return (
    <div className="mb-6 grid rounded-lg bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${roles.length}, 1fr)` }}>
      {roles.map((role) => (
        <NavLink
          key={role}
          to={`${basePath}/${role}`}
          replace
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-center text-sm font-medium transition-colors ${
              isActive ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-brand-600'
            }`
          }
        >
          {t(`roles.${role}`)}
        </NavLink>
      ))}
    </div>
  )
}
