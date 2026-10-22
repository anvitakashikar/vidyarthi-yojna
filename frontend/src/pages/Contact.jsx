import { useTranslation } from 'react-i18next'

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

export default function Contact() {
  const { t } = useTranslation()

  // Placeholder form — submission will be wired to the backend later
  const handleSubmit = (e) => e.preventDefault()

  return (
    <section className="max-w-xl">
      <h1 className="text-3xl font-bold text-brand-700">{t('contact.title')}</h1>
      <p className="mt-2 text-slate-600">{t('contact.body')}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
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
    </section>
  )
}
