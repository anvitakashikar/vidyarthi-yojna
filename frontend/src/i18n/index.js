import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import mr from './locales/mr.json'

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'mr', label: 'मराठी' },
]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      mr: { translation: mr },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'mr'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'vy_language',
      caches: ['localStorage'],
    },
  })

// Keep <html lang> in sync so fonts, screen readers and CSS follow the language
const syncHtmlLang = (lng) => {
  document.documentElement.lang = lng?.startsWith('mr') ? 'mr' : 'en'
}
syncHtmlLang(i18n.language)
i18n.on('languageChanged', syncHtmlLang)

export default i18n
