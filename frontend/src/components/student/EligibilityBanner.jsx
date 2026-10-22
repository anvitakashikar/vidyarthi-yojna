import { useTranslation } from 'react-i18next'

const STYLES = {
  eligible: { box: 'border-accent-100 bg-accent-50', icon: 'bg-accent-500', title: 'text-accent-700', symbol: '✓' },
  not_eligible: { box: 'border-red-200 bg-red-50', icon: 'bg-red-500', title: 'text-red-700', symbol: '✕' },
  pending: { box: 'border-slate-200 bg-slate-50', icon: 'bg-slate-400', title: 'text-slate-700', symbol: '…' },
}

/** What the student sees about scheme eligibility — only the outcome, never the rules. */
export default function EligibilityBanner({ status }) {
  const { t } = useTranslation()
  const key = STYLES[status] ? status : 'pending'
  const s = STYLES[key]

  return (
    <section role="status" className={`flex items-start gap-4 rounded-xl border p-5 ${s.box}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${s.icon}`} aria-hidden="true">
        {s.symbol}
      </span>
      <div>
        <h2 className={`text-lg font-semibold ${s.title}`}>{t(`eligibility.student.${key}.title`)}</h2>
        <p className="mt-1 text-sm text-slate-700">{t(`eligibility.student.${key}.body`)}</p>
      </div>
    </section>
  )
}
