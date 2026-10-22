import { useTranslation } from 'react-i18next'

/**
 * Picks the right language from bilingual data coming from MongoDB,
 * e.g. { en: "Scholarship", mr: "शिष्यवृत्ती" }.
 *
 *   const localized = useLocalized()
 *   <h2>{localized(scheme.title)}</h2>
 */
export default function useLocalized() {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('mr') ? 'mr' : 'en'

  return (value) => {
    if (value == null) return ''
    if (typeof value === 'string') return value
    return value[lang] ?? value.en ?? ''
  }
}
