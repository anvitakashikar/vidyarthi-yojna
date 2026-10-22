import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = i18n.language?.startsWith('mr') ? 'mr' : 'en'

  return (
    <div role="group" aria-label={t('nav.language')} className="inline-flex rounded-lg border border-brand-100 bg-white p-0.5">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          lang={code}
          onClick={() => i18n.changeLanguage(code)}
          aria-pressed={current === code}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            current === code ? 'bg-brand-gradient text-white' : 'text-slate-600 hover:bg-brand-50'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
