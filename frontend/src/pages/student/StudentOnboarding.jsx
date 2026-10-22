import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import AadhaarSection from '../../components/student/AadhaarSection'
import BankSection from '../../components/student/BankSection'
import ExpensesStep from '../../components/student/ExpensesStep'
import PersonalStep from '../../components/student/PersonalStep'
import SignupSteps, { SIGNUP_STEPS } from '../../components/student/SignupSteps'
import { Alert } from '../../components/ui/FormField'
import { useAuth } from '../../context/AuthContext'
import { getStudentProfile, saveBank } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'

const stepsDone = (p) => ({
  personal: Boolean(p.sections_complete?.personal),
  documents: Boolean(p.sections_complete?.aadhaar && p.sections_complete?.bank),
  expenses: Boolean(p.sections_complete?.expenses),
})

export default function StudentOnboarding() {
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedStep = searchParams.get('step')

  const [profile, setProfile] = useState(null)
  const [step, setStep] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    getStudentProfile()
      .then((p) => {
        setProfile(p)
        const done = stepsDone(p)
        setStep(SIGNUP_STEPS.includes(requestedStep) ? requestedStep : SIGNUP_STEPS.find((s) => !done[s]) || 'personal')
      })
      .catch((err) => setLoadError(apiErrorMessage(err, t)))
  }, [t, requestedStep])

  // Every section save returns the updated profile
  const onSaved = async (p, nextStep) => {
    setProfile(p)
    if (p.onboarding_complete && !user.onboarding_complete) {
      await refreshUser()
      navigate('/student', { replace: true })
      return
    }
    if (nextStep) {
      setStep(nextStep)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (p.onboarding_complete) {
      navigate('/student')
    }
  }

  if (loadError) return <Alert>{loadError}</Alert>
  if (!profile || !step) return <p className="py-16 text-center text-slate-500">{t('common.loading')}</p>

  const done = stepsDone(profile)

  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-700">{t('onboarding.title')}</h1>
      <p className="mt-1 text-slate-600">{t('onboarding.subtitle')}</p>

      <div className="mt-6">
        <SignupSteps current={step} done={done} onSelect={setStep} />
      </div>

      <div className="mt-6 space-y-6">
        {step === 'personal' && <PersonalStep profile={profile} user={user} onSaved={(p) => onSaved(p, done.documents ? null : 'documents')} />}

        {step === 'documents' && (
          <>
            <AadhaarSection profile={profile} onSaved={(p) => onSaved(p)} />
            <BankSection
              existing={profile.bank}
              defaultHolder={profile.name || user.name}
              onSaved={(p) => onSaved(p)}
              save={saveBank}
              description={t('bank.desc')}
              proofField="statement_file"
              proofLabel={t('bank.statement')}
              proofRequired
              existingProofId={profile.bank?.statement_document_id}
            />
            <button
              type="button"
              disabled={!done.documents}
              onClick={() => setStep('expenses')}
              className="w-full rounded-lg bg-brand-gradient px-5 py-2.5 font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {done.documents ? t('onboarding.continueToExpenses') : t('onboarding.saveBothFirst')}
            </button>
          </>
        )}

        {step === 'expenses' && <ExpensesStep profile={profile} onSaved={(p) => onSaved(p)} />}
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
        <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        {t('onboarding.privacy')}
      </p>
    </section>
  )
}
