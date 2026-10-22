import { useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import LanguageSwitcher from '../LanguageSwitcher'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/about', key: 'nav.about' },
  { to: '/contact', key: 'nav.contact' },
]

const linkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-brand-600'
  }`

export default function Navbar() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const items = user
    ? [
        ...NAV_ITEMS,
        { to: `/${user.role}`, key: 'nav.dashboard', end: true },
        ...(user.role === 'donor' ? [{ to: '/donor/donate', key: 'nav.donate' }] : []),
      ]
    : NAV_ITEMS

  const onLogout = () => {
    logout()
    setOpen(false)
    navigate('/')
  }

  const authActions = user ? (
    <>
      <span className="hidden text-sm text-slate-600 lg:inline">{user.name}</span>
      <button type="button" onClick={onLogout} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        {t('nav.logout')}
      </button>
    </>
  ) : (
    <Link to="/login/student" onClick={() => setOpen(false)} className="rounded-md bg-brand-gradient px-3 py-1.5 text-sm font-medium text-white hover:brightness-110">
      {t('nav.login')}
    </Link>
  )

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="h-1 bg-brand-gradient" aria-hidden="true" />
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="text-brand-gradient text-lg font-bold">
          {t('app.name')}
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {items.map(({ to, key, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              {t(key)}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <div className="hidden items-center gap-2 md:flex">{authActions}</div>
          <button
            type="button"
            className="rounded-md p-2 text-slate-600 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={t('nav.menu')}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="flex flex-col gap-1 border-t border-slate-200 px-4 py-2 md:hidden">
          {items.map(({ to, key, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass} onClick={() => setOpen(false)}>
              {t(key)}
            </NavLink>
          ))}
          <div className="flex items-center gap-2 py-2">{authActions}</div>
        </div>
      )}
    </header>
  )
}
