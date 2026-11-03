import { useTranslation } from 'react-i18next'

const DOT = {
  done: 'bg-accent-600 text-white',
  current: 'bg-brand-gradient text-white ring-4 ring-brand-100',
  problem: 'bg-amber-500 text-white ring-4 ring-amber-100',
  failed: 'bg-red-500 text-white ring-4 ring-red-100',
  upcoming: 'bg-slate-200 text-slate-500',
}
const SYMBOL = { done: '✓', problem: '!', failed: '✕' }
const SUB = {
  done: 'text-accent-700',
  current: 'text-brand-700',
  problem: 'text-amber-700',
  failed: 'text-red-700',
  upcoming: 'text-slate-500',
}
const OVERALL = {
  approved: 'bg-accent-50 text-accent-700 border-accent-100',
  review: 'bg-brand-50 text-brand-700 border-brand-100',
  action: 'bg-amber-50 text-amber-800 border-amber-200',
  not_eligible: 'bg-red-50 text-red-700 border-red-200',
}

/** Works out each step's state from the student's verification and eligibility outcome. */
function buildSteps(verification, eligibility) {
  const verified = verification === 'verified'
  const eligible = eligibility === 'eligible'

  const verificationStep =
    verification === 'verified' ? ['done', 'verified'] : verification === 'rejected' ? ['problem', 'rejected'] : ['current', 'pending']
  const eligibilityStep =
    eligibility === 'eligible'
      ? ['done', 'eligible']
      : eligibility === 'not_eligible'
        ? ['failed', 'not_eligible']
        : [verified ? 'current' : 'upcoming', 'pending']
  const supportStep = verified && eligible ? ['done', 'approved'] : ['upcoming', 'waiting']

  return [
    { key: 'submitted', state: 'done', sub: 'done' },
    { key: 'verification', state: verificationStep[0], sub: verificationStep[1] },
    { key: 'eligibility', state: eligibilityStep[0], sub: eligibilityStep[1] },
    { key: 'support', state: supportStep[0], sub: supportStep[1] },
  ]
}

function overallStatus(verification, eligibility) {
  if (eligibility === 'not_eligible') return 'not_eligible'
  if (verification === 'rejected') return 'action'
  if (verification === 'verified' && eligibility === 'eligible') return 'approved'
  return 'review'
}

/** A progress bar of the student's application, shown at the top of their dashboard. */
export default function ApplicationStatusBar({ verification, eligibility }) {
  const { t } = useTranslation()
  const steps = buildSteps(verification, eligibility)
  const overall = overallStatus(verification, eligibility)
  const doneCount = steps.filter((s) => s.state === 'done').length

  return (
    <section aria-labelledby="app-status-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="app-status-title" className="text-lg font-semibold text-slate-800">
          {t('appStatus.title')}
        </h2>
        <span role="status" className={`rounded-full border px-3 py-1 text-sm font-semibold ${OVERALL[overall]}`}>
          {t(`appStatus.overall.${overall}`)}
        </span>
      </div>

      {/* Overall progress, for a quick glance on small screens */}
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
        aria-label={t('appStatus.progress', { done: doneCount, total: steps.length })}
      >
        <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <ol className="mt-5 grid gap-4 sm:grid-cols-4">
        {steps.map(({ key, state, sub }, i) => (
          <li key={key} className="flex items-start gap-3 sm:flex-col sm:items-center sm:text-center">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${DOT[state]}`} aria-hidden="true">
              {SYMBOL[state] ?? i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800">{t(`appStatus.steps.${key}.label`)}</p>
              <p className={`text-xs font-medium ${SUB[state]}`}>{t(`appStatus.steps.${key}.${sub}`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
