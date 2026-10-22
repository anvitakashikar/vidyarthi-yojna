import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <section className="py-16 text-center">
      <p className="text-brand-gradient text-6xl font-bold">404</p>
      <h1 className="mt-4 text-2xl font-semibold">{t('notFound.title')}</h1>
      <p className="mt-2 text-slate-600">{t('notFound.body')}</p>
      <Link to="/" className="mt-6 inline-block rounded-lg bg-brand-gradient px-5 py-2 font-medium text-white hover:brightness-110">
        {t('notFound.back')}
      </Link>
    </section>
  )
}
