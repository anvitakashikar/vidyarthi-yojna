import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import Navbar from './Navbar'
import Footer from './Footer'

export default function Layout() {
  const { t, i18n } = useTranslation()

  // Browser tab title follows the selected language
  useEffect(() => {
    document.title = t('app.name')
  }, [t, i18n.language])

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
