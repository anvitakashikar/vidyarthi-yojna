import { useTranslation } from 'react-i18next'

import DonateQR from '../components/DonateQR'
import { BrandIcon, ORG, SocialLinks, WHATSAPP_ICON } from '../components/SocialLinks'

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

export default function Contact() {
  const { t } = useTranslation()

  // Placeholder form — submission will be wired to the backend later
  const handleSubmit = (e) => e.preventDefault()

  return (
    <section>
      <h1 className="text-3xl font-bold text-brand-700">{t('contact.title')}</h1>
      <p className="mt-2 text-slate-600">{t('contact.body')}</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-brand-700">{t('contact.detailsTitle')}</h2>
          <p className="text-slate-700">{t('contact.location')}</p>

          <div>
            <h3 className="text-sm font-medium text-slate-500">{t('contact.phones')}</h3>
            <ul className="mt-1 space-y-1">
              {ORG.phones.map(({ name, number }) => (
                <li key={number}>
                  <a href={`tel:+91${number}`} className="text-slate-800 hover:text-brand-600">
                    {name} — <span className="font-medium">{number}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-500">{t('contact.emails')}</h3>
            <ul className="mt-1 space-y-1">
              {ORG.emails.map((email) => (
                <li key={email}>
                  <a href={`mailto:${email}`} className="break-all font-medium text-slate-800 hover:text-brand-600">
                    {email}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <a
            href={ORG.whatsappGroup}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 font-medium text-white hover:bg-accent-700"
          >
            <BrandIcon path={WHATSAPP_ICON} />
            {t('contact.whatsapp')}
          </a>

          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-500">{t('social.title')}</h3>
            <SocialLinks />
          </div>
        </div>

        <DonateQR />

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-brand-700">{t('contact.formTitle')}</h2>
          <label className="block text-sm font-medium">
            {t('contact.name')}
            <input type="text" name="name" className={inputClass} />
          </label>
          <label className="block text-sm font-medium">
            {t('contact.email')}
            <input type="email" name="email" className={inputClass} />
          </label>
          <label className="block text-sm font-medium">
            {t('contact.message')}
            <textarea name="message" rows={4} className={inputClass} />
          </label>
          <button type="submit" className="rounded-lg bg-brand-gradient px-5 py-2 font-medium text-white hover:brightness-110">
            {t('contact.submit')}
          </button>
        </form>
      </div>
    </section>
  )
}
