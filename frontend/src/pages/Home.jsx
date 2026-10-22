import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { ROLES } from '../context/AuthContext'
import { getHealth } from '../services/api'

const FEATURES = ['feature1', 'feature2', 'feature3']

export default function Home() {
  const { t } = useTranslation()
  const [health, setHealth] = useState('loading')

  useEffect(() => {
    let active = true
    getHealth()
      .then((res) => active && setHealth(res.success ? 'ok' : 'dbDown'))
      .catch(() => active && setHealth('offline'))
    return () => {
      active = false
    }
  }, [])

  const status = {
    loading: { dot: 'bg-slate-400', text: t('home.apiChecking') },
    ok: { dot: 'bg-green-500', text: t('home.apiOnline') },
    dbDown: { dot: 'bg-amber-500', text: t('home.apiDbDown') },
    offline: { dot: 'bg-red-500', text: t('home.apiOffline') },
  }[health]

  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-brand-gradient px-6 py-14 text-center text-white sm:px-12">
        <h1 className="text-3xl font-bold sm:text-4xl">{t('home.title')}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-brand-100">{t('home.subtitle')}</p>
        <Link
          to="/register/student"
          className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 shadow-sm hover:bg-accent-50"
        >
          {t('home.cta')}
        </Link>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-semibold">{t('home.portalsTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {ROLES.map((role) => (
            <Link
              key={role}
              to={`/login/${role}`}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow"
            >
              <h3 className="font-semibold text-brand-700">{t(`home.portal.${role}.title`)}</h3>
              <p className="mt-2 text-sm text-slate-600">{t(`home.portal.${role}.desc`)}</p>
              <span className="mt-4 inline-block text-sm font-medium text-brand-600 group-hover:underline">
                {t('auth.loginTitle', { role: t(`roles.${role}`) })} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-semibold">{t('home.featuresTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-brand-700">{t(`home.${f}Title`)}</h3>
              <p className="mt-2 text-sm text-slate-600">{t(`home.${f}Desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
        <span className="font-medium">{t('home.apiStatus')}:</span>
        <span className="text-slate-600">{status.text}</span>
      </section>
    </div>
  )
}
