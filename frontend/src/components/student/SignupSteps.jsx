import { useTranslation } from 'react-i18next'

export const SIGNUP_STEPS = ['personal', 'documents', 'expenses']
export const DONOR_STEPS = ['account', 'bankPan']

/**
 * The sections of the student (default) or donor sign-up.
 * `done` maps step → boolean; `onSelect` (optional) makes completed steps clickable.
 */
export default function SignupSteps({ steps = SIGNUP_STEPS, current, done = {}, onSelect }) {
  const { t } = useTranslation()

  return (
    <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((step, i) => {
        const active = current === step
        const reachable = onSelect && (done[step] || active || steps.slice(0, i).every((s) => done[s]))
        return (
          <li key={step}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onSelect?.(step)}
              aria-current={active ? 'step' : undefined}
              className={`flex h-full w-full flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left text-sm transition sm:flex-row sm:items-center sm:gap-3 ${
                active ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'
              } disabled:cursor-default`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  done[step] ? 'bg-green-600 text-white' : active ? 'bg-brand-gradient text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {done[step] ? '✓' : i + 1}
              </span>
              <span className="leading-tight">
                <span className="block text-xs text-slate-500">{t('signup.sectionN', { n: i + 1 })}</span>
                <span className="font-medium text-slate-800">{t(`signup.step.${step}`)}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
