import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = i18n.resolvedLanguage?.split('-')[0] || 'mr'

  return (
    <>
      <label className="sr-only" htmlFor="language-switcher">{t('nav.language')}</label>
      <select
        id="language-switcher"
        aria-label={t('nav.language')}
        value={current}
        onChange={(event) => i18n.changeLanguage(event.target.value)}
        className="rounded-lg border border-brand-100 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code} lang={code}>{label}</option>
        ))}
      </select>
    </>
  )
}
