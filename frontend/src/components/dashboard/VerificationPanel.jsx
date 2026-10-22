import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, inputClass } from '../ui/FormField'
import { setStudentVerification } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { formatDate } from '../../utils/format'

export const CORRECTION_REASONS = [
  'aadhaar_unclear',
  'aadhaar_mismatch',
  'bank_statement_unclear',
  'bank_details_mismatch',
  'mess_details',
  'abhyasika_details',
  'personal_details',
  'other',
]

export const VERIFICATION_BADGE = {
  verified: 'bg-accent-50 text-accent-700',
  rejected: 'bg-amber-50 text-amber-800',
  pending: 'bg-brand-50 text-brand-700',
}

export function VerificationBadge({ status }) {
  const { t } = useTranslation()
  const key = VERIFICATION_BADGE[status] ? status : 'pending'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VERIFICATION_BADGE[key]}`}>{t(`verification.status.${key}`)}</span>
}

/** Admin: verify a student or ask them to correct their details. */
export default function VerificationPanel({ userId, profile, onUpdated }) {
  const { t, i18n } = useTranslation()
  const [mode, setMode] = useState(null) // null | 'reject'
  const [reasons, setReasons] = useState([])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (status) => {
    setError('')
    if (status === 'rejected' && reasons.length === 0 && !note.trim()) return setError(t('errors.admin.rejection_reason_required'))
    setSaving(true)
    try {
      const updated = await setStudentVerification(userId, { status, reasons: status === 'rejected' ? reasons : [], note: status === 'rejected' ? note : '' })
      setMode(null)
      setReasons([])
      setNote('')
      onUpdated(updated)
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  const toggle = (r) => setReasons((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]))
  const resubmitted = profile.verification?.resubmitted

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-800">{t('verification.admin.title')}</h3>
        <div className="flex items-center gap-2">
          {resubmitted && <span className="text-xs font-medium text-brand-600">{t('verification.admin.resubmitted')}</span>}
          <VerificationBadge status={profile.verification_status} />
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <Alert>{error}</Alert>
        {!profile.onboarding_complete && <p className="text-sm text-slate-500">{t('errors.admin.profile_incomplete')}</p>}

        {mode !== 'reject' ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !profile.onboarding_complete || profile.verification_status === 'verified'}
              onClick={() => submit('verified')}
              className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
            >
              ✓ {t('verification.admin.verify')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setMode('reject')}
              className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
            >
              {t('verification.admin.requestCorrection')}
            </button>
            {profile.verification_status !== 'pending' && (
              <button type="button" disabled={saving} onClick={() => submit('pending')} className="px-2 text-sm text-slate-600 hover:underline">
                {t('verification.admin.resetPending')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">{t('verification.admin.chooseReasons')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CORRECTION_REASONS.map((r) => (
                <label key={r} className="flex items-start gap-2 text-sm text-slate-800">
                  <input type="checkbox" checked={reasons.includes(r)} onChange={() => toggle(r)} className="mt-0.5 h-4 w-4 accent-brand-600" />
                  {t(`verification.reasons.${r}`)}
                </label>
              ))}
            </div>
            <label className="block text-sm font-medium text-slate-700">
              {t('verification.admin.note')}
              <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('verification.admin.notePlaceholder')} className={inputClass} />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => submit('rejected')}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {t('verification.admin.sendToStudent')}
              </button>
              <button type="button" onClick={() => setMode(null)} className="px-3 text-sm text-slate-600 hover:underline">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {profile.verification_history?.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('verification.admin.history')}</p>
            <ol className="mt-2 space-y-2 text-sm">
              {profile.verification_history.map((h, i) => (
                <li key={i} className="border-l-2 border-slate-200 pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <VerificationBadge status={h.status} />
                    <span className="text-xs text-slate-500">
                      {formatDate(h.at, i18n.language)} · {h.by_name}
                    </span>
                  </div>
                  {h.reasons?.length > 0 && <p className="mt-1 text-slate-700">{h.reasons.map((r) => t(`verification.reasons.${r}`)).join(' · ')}</p>}
                  {h.note && <p className="mt-0.5 text-slate-600">“{h.note}”</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}
