import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import DashboardHeader from '../../components/dashboard/DashboardHeader'
import MyDonations from '../../components/donor/MyDonations'
import ImpactHome from '../../components/home/ImpactHome'
import { Alert } from '../../components/ui/FormField'
import { getDonorDocument, getDonorProfile } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { openBlobInNewTab } from '../../utils/format'

export default function DonorDashboard() {
  const { t } = useTranslation()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getDonorProfile()
      .then(setProfile)
      .catch((err) => setError(apiErrorMessage(err, t)))
  }, [t])

  const viewDoc = (id) => openBlobInNewTab(() => getDonorDocument(id)).catch((err) => setError(apiErrorMessage(err, t)))

  return (
    <div className="space-y-8">
      <DashboardHeader />
      <Alert>{error}</Alert>
      <ImpactHome showDonate />
      <MyDonations onError={setError} />
      {profile && <DonorDetails profile={profile} onViewDoc={viewDoc} editLink="/donor/onboarding" />}
    </div>
  )
}

/** Bank + PAN summary. Admin responses include the full numbers; donors see them masked. */
export function DonorDetails({ profile, onViewDoc, editLink }) {
  const { t } = useTranslation()
  const { bank, pan } = profile

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('donorProfile.title')}</h2>
        {editLink && (
          <Link to={editLink} className="text-sm font-medium text-brand-600 hover:underline">
            {t('studentProfile.update')}
          </Link>
        )}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
          <h3 className="font-semibold text-slate-700">{t('bank.title')}</h3>
          {bank ? (
            <>
              <Row label={t('bank.holder')} value={bank.account_holder_name} />
              <Row label={t('bank.account')} value={<span className="font-mono">{bank.account_number || bank.masked_account_number}</span>} />
              <Row label={t('bank.ifsc')} value={<span className="font-mono">{bank.ifsc}</span>} />
              <Row label={t('bank.bankName')} value={`${bank.bank_name}, ${bank.branch_name}`} />
              {bank.proof_document_id && (
                <button type="button" onClick={() => onViewDoc(bank.proof_document_id)} className="font-medium text-brand-600 hover:underline">
                  {t('donorProfile.viewBankProof')}
                </button>
              )}
            </>
          ) : (
            <p className="text-slate-500">{t('studentProfile.notSubmitted')}</p>
          )}
        </div>
        <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
          <h3 className="font-semibold text-slate-700">{t('pan.title')}</h3>
          {pan ? (
            <>
              <Row label={t('pan.number')} value={<span className="font-mono">{pan.pan || pan.masked_pan}</span>} />
              <Row label={t('pan.holderType')} value={t(`pan.types.${pan.holder_type}`)} />
              <Row label={t('pan.name')} value={pan.name_on_pan} />
              {pan.document_id && (
                <button type="button" onClick={() => onViewDoc(pan.document_id)} className="font-medium text-brand-600 hover:underline">
                  {t('donorProfile.viewPan')}
                </button>
              )}
            </>
          ) : (
            <p className="text-slate-500">{t('studentProfile.notSubmitted')}</p>
          )}
        </div>
      </div>
    </section>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value || '—'}</span>
    </div>
  )
}
