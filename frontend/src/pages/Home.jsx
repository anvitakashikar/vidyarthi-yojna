import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const STEP_ICONS = ['📝', '🔍', '🍱']

export default function Home() {
  const { t } = useTranslation()
  const facts = t('home.facts', { returnObjects: true })
  const steps = t('home.steps.items', { returnObjects: true })

  return (
    <div className="space-y-12 sm:space-y-16">
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
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/register" className="rounded-lg bg-brand-gradient px-6 py-3 font-semibold text-white shadow-sm transition hover:brightness-110">
              {t('home.cta')}
            </Link>
            <Link to="/about#donate" className="rounded-lg bg-white/95 px-6 py-3 font-semibold text-brand-700 shadow-sm transition hover:bg-white">
              {t('home.donateCta')}
            </Link>
          </div>
        </div>
      </section>

      {/* Key facts at a glance */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(({ value, label }) => (
          <div key={value} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-2xl font-bold text-brand-700">{value}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{label}</p>
          </div>
        ))}
      </section>

      {/* What a shidori is */}
      <section className="grid items-center gap-8 md:grid-cols-2">
        <img
          src="/brand/logo.png"
          alt={t('about.images.logo')}
          width="1000"
          height="658"
          loading="lazy"
          className="w-full rounded-2xl border border-slate-200 bg-white object-contain p-4 shadow-sm"
        />
        <div>
          <h2 className="text-2xl font-bold text-brand-700 sm:text-3xl">{t('home.meaning.title')}</h2>
          <p className="mt-4 leading-relaxed text-slate-700">{t('home.meaning.body')}</p>
          <p className="mt-4 border-l-4 border-accent-500 pl-4 font-semibold text-accent-700">{t('home.meaning.quote')}</p>
          <Link to="/about" className="mt-5 inline-block font-medium text-brand-600 hover:underline">
            {t('home.meaning.link')} →
          </Link>
        </div>
      </section>

      {/* How students get support */}
      <section>
        <h2 className="text-2xl font-bold text-brand-700 sm:text-3xl">{t('home.steps.title')}</h2>
        <p className="mt-2 max-w-2xl text-slate-600">{t('home.steps.intro')}</p>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map(({ title, body }, i) => (
            <li key={title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-xl" aria-hidden="true">
                  {STEP_ICONS[i]}
                </span>
                <span className="text-sm font-semibold text-slate-400">{t('home.steps.stepLabel', { number: i + 1 })}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-800">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
        <Link to="/register" className="mt-6 inline-block rounded-lg bg-brand-gradient px-6 py-3 font-semibold text-white shadow-sm hover:brightness-110">
          {t('home.cta')}
        </Link>
      </section>

      {/* Appeal to donors, over a home-cooked thali */}
      <section className="grid overflow-hidden rounded-2xl bg-accent-50 shadow-sm md:grid-cols-2">
        <img
          src="/images/about/maharashtrian-thali.jpg"
          alt={t('about.images.meals')}
          loading="lazy"
          className="h-64 w-full object-cover md:h-full"
        />
        <div className="p-6 sm:p-10">
          <h2 className="text-2xl font-bold text-accent-700 sm:text-3xl">{t('home.donate.title')}</h2>
          <p className="mt-4 leading-relaxed text-slate-700">{t('home.donate.body')}</p>
          <p className="mt-3 text-sm text-slate-600">{t('home.donate.trust')}</p>
          <Link to="/about#donate" className="mt-6 inline-block rounded-lg bg-accent-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-accent-700">
            {t('home.donateCta')}
          </Link>
        </div>
      </section>

      {/* Who runs Shidori */}
      <section className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 md:flex-row md:items-center">
        <img src="/images/about/farmer.jpg" alt={t('about.images.farmer')} loading="lazy" className="h-40 w-40 shrink-0 rounded-full object-cover shadow" />
        <div>
          <h2 className="text-xl font-bold text-brand-700 sm:text-2xl">{t('home.foundation.title')}</h2>
          <p className="mt-2 leading-relaxed text-slate-700">{t('home.foundation.body')}</p>
          <Link to="/about" className="mt-3 inline-block font-medium text-brand-600 hover:underline">
            {t('home.foundation.link')} →
          </Link>
        </div>
      </section>
    </div>
  )
}
