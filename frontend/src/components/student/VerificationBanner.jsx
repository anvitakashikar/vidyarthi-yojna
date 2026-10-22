import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { formatDate } from '../../utils/format'

// Which sign-up step to open to fix each correction reason
const REASON_STEP = {
  aadhaar_unclear: 'documents',
  aadhaar_mismatch: 'documents',
  bank_statement_unclear: 'documents',
  bank_details_mismatch: 'documents',
  mess_details: 'expenses',
  abhyasika_details: 'expenses',
  personal_details: 'personal',
}

const STYLES = {
  verified: { box: 'border-accent-100 bg-accent-50', icon: 'bg-accent-500', title: 'text-accent-700', symbol: '✓' },
  rejected: { box: 'border-amber-200 bg-amber-50', icon: 'bg-amber-500', title: 'text-amber-800', symbol: '!' },
  pending: { box: 'border-brand-100 bg-brand-50', icon: 'bg-brand-gradient', title: 'text-brand-700', symbol: '…' },
}

/** The student's view of the admin's document verification. */
export default function VerificationBanner({ status, verification }) {
  const { t, i18n } = useTranslation()

  let key = STYLES[status] ? status : 'pending'
  const resubmitted = key === 'pending' && verification?.resubmitted
  const s = STYLES[key]
  const messageKey = resubmitted ? 'resubmitted' : key

  const reasons = key === 'rejected' ? verification?.reasons || [] : []
  const steps = [...new Set(reasons.map((r) => REASON_STEP[r]).filter(Boolean))]
  const fixStep = steps[0]

  return (
    <section role="status" className={`flex items-start gap-4 rounded-xl border p-5 ${s.box}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${s.icon}`} aria-hidden="true">
        {s.symbol}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className={`text-lg font-semibold ${s.title}`}>{t(`verification.student.${messageKey}.title`)}</h2>
        <p className="mt-1 text-sm text-slate-700">{t(`verification.student.${messageKey}.body`)}</p>

        {reasons.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {reasons.map((r) => (
              <li key={r}>{t(`verification.reasons.${r}`)}</li>
            ))}
          </ul>
        )}
        {key === 'rejected' && verification?.note && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm">
            <p className="text-xs font-medium text-slate-500">{t('verification.student.noteFromOffice')}</p>
            <p className="mt-0.5 whitespace-pre-line text-slate-800">{verification.note}</p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {key === 'rejected' && (
            <Link
              to={fixStep ? `/student/onboarding?step=${fixStep}` : '/student/onboarding'}
              className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-medium text-white hover:brightness-110"
            >
              {t('verification.student.fixNow')}
            </Link>
          )}
          {verification?.decided_at && !resubmitted && (
            <span className="text-xs text-slate-500">{t('verification.student.decidedOn', { date: formatDate(verification.decided_at, i18n.language) })}</span>
          )}
        </div>
      </div>
    </section>
  )
}
