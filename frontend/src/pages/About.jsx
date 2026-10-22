import { useTranslation } from 'react-i18next'

export default function About() {
  const { t } = useTranslation()

  return (
    <section className="max-w-3xl">
      <h1 className="text-3xl font-bold text-brand-700">{t('about.title')}</h1>
      <p className="mt-4 text-slate-600">{t('about.body')}</p>
    </section>
  )
}
