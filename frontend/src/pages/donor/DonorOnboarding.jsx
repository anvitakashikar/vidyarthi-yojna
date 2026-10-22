import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import PanSection from '../../components/donor/PanSection'
import BankSection from '../../components/student/BankSection'
import SignupSteps, { DONOR_STEPS } from '../../components/student/SignupSteps'
import { Alert } from '../../components/ui/FormField'
import { useAuth } from '../../context/AuthContext'
import { getDonorProfile, saveDonorBank } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'

/** Donor sign-up, section 2: bank details and PAN card. */
export default function DonorOnboarding() {
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getDonorProfile()
      .then(setProfile)
      .catch((err) => setError(apiErrorMessage(err, t)))
  }, [t])

  const onSaved = async (p) => {
    setProfile(p)
    if (p.onboarding_complete) {
      if (!user.onboarding_complete) await refreshUser()
      navigate('/donor', { replace: true })
    }
  }

  if (error) return <Alert>{error}</Alert>
  if (!profile) return <p className="py-16 text-center text-slate-500">{t('common.loading')}</p>

  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-700">{t('donorOnboarding.title')}</h1>
      <p className="mt-1 text-slate-600">{t('donorOnboarding.subtitle')}</p>

      <div className="mt-6">
        <SignupSteps steps={DONOR_STEPS} current="bankPan" done={{ account: true, bankPan: profile.onboarding_complete }} />
      </div>

      <div className="mt-6 space-y-6">
        <BankSection
          existing={profile.bank}
          defaultHolder={profile.name || user.name}
          onSaved={onSaved}
          save={saveDonorBank}
          description={t('bank.donorDesc')}
          proofField="proof_file"
          proofLabel={t('bank.donorProof')}
          proofRequired={false}
          existingProofId={profile.bank?.proof_document_id}
        />
        <PanSection existing={profile.pan} defaultName={profile.name || user.name} onSaved={onSaved} />
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
        <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        {t('donorOnboarding.privacy')}
      </p>
    </section>
  )
}
