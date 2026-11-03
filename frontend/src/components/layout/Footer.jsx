import { useTranslation } from 'react-i18next'

import { SocialLinks } from '../SocialLinks'

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="h-1 bg-brand-gradient" aria-hidden="true" />
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-600 sm:flex-row">
        <img src="/brand/logo-sm.png" alt={t('app.name')} width="219" height="144" className="h-14 w-auto" />
        <p>
          © {new Date().getFullYear()} {t('app.name')} · {t('footer.runBy')}. {t('footer.rights')}
        </p>
        <SocialLinks />

      </div>
    </footer>
  )
}
