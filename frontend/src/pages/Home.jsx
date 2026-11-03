import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Home() {
  const { t } = useTranslation()

  return (
    <section
      className="relative overflow-hidden rounded-2xl bg-slate-800 bg-cover bg-center shadow-sm"
      style={{ backgroundImage: "url('/images/drought-landscape.jpg')" }}
    >
      {/* Darken the photo, most strongly behind the text, so white copy stays readable */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/20" aria-hidden="true" />

      <div className="relative flex min-h-[420px] max-w-2xl flex-col justify-center px-6 py-14 sm:min-h-[480px] sm:px-12 lg:min-h-[540px]">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-200">{t('app.name')}</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">{t('home.title')}</h1>
        <p className="mt-4 text-base leading-relaxed text-white/90 sm:text-lg">{t('home.subtitle')}</p>
        <div>
          <Link
            to="/register"
            className="mt-7 inline-block rounded-lg bg-brand-gradient px-6 py-3 font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            {t('home.cta')}
          </Link>
        </div>
      </div>
    </section>
  )
}
