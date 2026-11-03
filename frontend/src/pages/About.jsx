import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import DonateQR from '../components/DonateQR'
import { ORG, SocialLinks } from '../components/SocialLinks'

// Story sections in reading order; each pairs a heading and paragraphs with a photo
const STORY = [
  { key: 'drought', image: '/images/drought-landscape.jpg' },
  { key: 'meals', image: '/images/about/maharashtrian-thali.jpg' },
  { key: 'idea', image: '/brand/logo.png', contain: true, imageKey: 'logo' },
]

function Paragraphs({ items }) {
  return items.map((text) => (
    <p key={text} className="mt-4 leading-relaxed text-slate-700">
      {text}
    </p>
  ))
}

function TextCard({ id }) {
  const { t } = useTranslation()
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-bold text-brand-700">{t(`about.${id}.title`)}</h2>
      <Paragraphs items={t(`about.${id}.body`, { returnObjects: true })} />
    </section>
  )
}

export default function About() {
  const { t } = useTranslation()

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* Opening: who we are, beside the farmer whose children Shidori supports */}
      <section className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h1 className="text-3xl font-bold text-brand-700 sm:text-4xl">{t('about.title')}</h1>
          <p className="mt-3 border-l-4 border-accent-500 pl-4 text-xl font-semibold leading-snug text-accent-700 sm:text-2xl">
            {t('about.tagline')}
          </p>
          <Paragraphs items={t('about.intro', { returnObjects: true })} />
        </div>
        <img
          src="/images/about/farmer.jpg"
          alt={t('about.images.farmer')}
          width="960"
          height="1200"
          className="mx-auto aspect-[4/5] w-full max-w-sm rounded-2xl object-cover shadow-md"
        />
      </section>

      {STORY.map(({ key, image, contain, imageKey }, i) => (
        <section key={key} className="grid items-center gap-6 md:grid-cols-2 md:gap-10">
          <div className={i % 2 ? 'md:order-2' : ''}>
            <h2 className="text-2xl font-bold text-brand-700">{t(`about.${key}.title`)}</h2>
            <Paragraphs items={t(`about.${key}.body`, { returnObjects: true })} />
          </div>
          <img
            src={image}
            alt={t(`about.images.${imageKey ?? key}`)}
            loading="lazy"
            className={`aspect-[4/3] w-full rounded-2xl shadow-md ${contain ? 'border border-slate-200 bg-white object-contain p-4' : 'object-cover'}`}
          />
        </section>
      ))}

      <section className="rounded-2xl bg-accent-50 p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-accent-700">{t('about.plan.title')}</h2>
        <p className="mt-4 leading-relaxed text-slate-700">{t('about.plan.intro')}</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {t('about.plan.points', { returnObjects: true }).map((point) => (
            <li key={point} className="flex gap-3 rounded-xl bg-white p-4 text-slate-700 shadow-sm">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-600 text-sm text-white" aria-hidden="true">
                ✓
              </span>
              {point}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-6">
          <TextCard id="donors" />
          <TextCard id="spirit" />
        </div>
        <div id="donate" className="scroll-mt-24">
          <DonateQR className="md:sticky md:top-24 md:w-80" />
        </div>
      </div>

      <TextCard id="appeal" />

      {/* Closing tagline over the student whose determination Shidori backs */}
      <section
        className="relative overflow-hidden rounded-2xl bg-slate-800 bg-cover bg-center shadow-sm"
        style={{ backgroundImage: "url('/images/about/student-studying.jpg')" }}
        role="img"
        aria-label={t('about.images.student')}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/30" aria-hidden="true" />
        <div className="relative max-w-2xl px-6 py-14 sm:px-12 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-200">{t('about.title')}</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl">{t('about.closing.tagline')}</h2>
          <p className="mt-4 text-lg leading-relaxed text-white/90">{t('about.closing.body')}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/register" className="rounded-lg bg-brand-gradient px-5 py-3 font-semibold text-white shadow-sm hover:brightness-110">
              {t('about.cta.student')}
            </Link>
            <a href="#donate" className="rounded-lg bg-white px-5 py-3 font-semibold text-brand-700 shadow-sm hover:bg-brand-50">
              {t('about.cta.donor')}
            </a>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-xl font-bold text-brand-700">{t('about.org.title')}</h2>
          <p className="mt-2 leading-relaxed text-slate-700">{t('about.org.body')}</p>
          <a href={ORG.website} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-medium text-brand-600 hover:underline">
            {t('about.org.website')} ↗
          </a>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-500">{t('about.org.follow')}</p>
          <SocialLinks />
        </div>
      </section>
    </div>
  )
}
