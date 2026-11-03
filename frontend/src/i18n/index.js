import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import mr from './locales/mr.json'
import hi from './locales/hi.json'

export const LANGUAGES = [
  { code: 'mr', label: 'मराठी' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      mr: { translation: mr },
      hi: { translation: hi },
    },
    fallbackLng: {
      mr: ['en'],
      en: ['en'],
      hi: ['en'],
      default: ['mr', 'en'],
    },
    supportedLngs: ['mr', 'en', 'hi'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'vy_language',
      caches: ['localStorage'],
    },
  })

// Keep <html lang> in sync so fonts, screen readers and CSS follow the language
const syncHtmlLang = (lng) => {
  const language = lng?.split('-')[0]
  document.documentElement.lang = ['mr', 'hi'].includes(language) ? language : 'en'
}
syncHtmlLang(i18n.language)
i18n.on('languageChanged', syncHtmlLang)

export default i18n
