import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '../../utils/apiError'
import { formatDate, formatRupees, openBlobInNewTab } from '../../utils/format'

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700',
  verified: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
}

/**
 * Read-only view of a student's three sections. Used on the student dashboard
 * and in the admin directory (with `fetchDocument` pointing at the admin endpoint).
 */
export default function StudentProfileDetails({ profile, fetchDocument, editLink, onError, showContact = false }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { personal, aadhaar, bank, expenses } = profile

  const viewDoc = (id) => openBlobInNewTab(() => fetchDocument(id)).catch((err) => onError?.(apiErrorMessage(err, t)))
  const DocButton = ({ id, label }) =>
    id ? (
      <button type="button" onClick={() => viewDoc(id)} className="text-sm font-medium text-brand-600 hover:underline">
        {label}
      </button>
    ) : null

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('studentProfile.title')}</h2>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[profile.verification_status] || STATUS_STYLES.pending}`}>
            {t(`studentProfile.status.${profile.verification_status}`)}
          </span>
          {editLink && (
            <Link to={editLink} className="text-sm font-medium text-brand-600 hover:underline">
              {t('studentProfile.update')}
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title={t('signup.step.personal')}>
          {showContact && <Row label={t('auth.phone')} value={profile.phone} />}
          {showContact && <Row label={t('auth.email')} value={profile.email} />}
          {personal && (
            <>
              <Row label={t('details.gender')} value={t(`details.genders.${personal.gender}`)} />
              <Row label={t('details.guardianName')} value={personal.guardian_name} />
              {personal.guardian_phone && <Row label={t('details.guardianPhone')} value={personal.guardian_phone} />}
              <Row label={t('details.college')} value={personal.college_name} />
              <Row label={t('details.course')} value={`${personal.course} · ${t('details.yearN', { n: personal.year_of_study })}`} />
            </>
          )}
        </Panel>

        <Panel title={t('aadhaar.title')}>
          {aadhaar ? (
            <>
              <Row label={t('aadhaar.number')} value={<span className="font-mono">{aadhaar.masked_number}</span>} />
              <Row label={t('aadhaar.dob')} value={`${formatDate(aadhaar.dob, lang)} · ${t('aadhaar.ageYears', { age: aadhaar.age })}`} />
              <Row label={t('aadhaar.taluka')} value={aadhaar.taluka} />
              <Row label={t('aadhaar.district')} value={aadhaar.district} />
              {aadhaar.address && <Row label={t('aadhaar.address')} value={aadhaar.address} />}
              <Row label={t('aadhaar.readBy')} value={t(`aadhaar.methodShort.${aadhaar.read_method}`)} />
              {aadhaar.edited_fields?.length > 0 && (
                <Row
                  label={t('aadhaar.editedFields')}
                  value={<span className="text-amber-700">{aadhaar.edited_fields.map((f) => t(`aadhaar.fieldNames.${f}`)).join(', ')}</span>}
                />
              )}
              <DocButton id={aadhaar.document_id} label={t('studentProfile.viewAadhaar')} />
            </>
          ) : (
            <Missing />
          )}
        </Panel>

        <Panel title={t('bank.title')}>
          {bank ? (
            <>
              <Row label={t('bank.holder')} value={bank.account_holder_name} />
              <Row label={t('bank.account')} value={<span className="font-mono">{bank.account_number || bank.masked_account_number}</span>} />
              <Row label={t('bank.ifsc')} value={<span className="font-mono">{bank.ifsc}</span>} />
              <Row label={t('bank.bankName')} value={`${bank.bank_name}, ${bank.branch_name}`} />
              <DocButton id={bank.statement_document_id} label={t('studentProfile.viewStatement')} />
            </>
          ) : (
            <Missing />
          )}
        </Panel>

        <Panel title={t('signup.step.expenses')}>
          {expenses ? (
            <>
              <Row
                label={t('expenses.messTitle')}
                value={expenses.mess.uses_mess ? `${expenses.mess.name} · ${formatRupees(expenses.mess.monthly_bill, lang)}` : t('expenses.notUsing')}
              />
              <Row
                label={t('expenses.abhyasikaTitle')}
                value={
                  expenses.abhyasika.uses_abhyasika
                    ? `${expenses.abhyasika.name} · ${formatRupees(expenses.abhyasika.monthly_fee, lang)}`
                    : t('expenses.notUsing')
                }
              />
              <Row
                label={t('expenses.total')}
                value={formatRupees(
                  (expenses.mess.uses_mess ? expenses.mess.monthly_bill : 0) + (expenses.abhyasika.uses_abhyasika ? expenses.abhyasika.monthly_fee : 0),
                  lang,
                )}
              />
              <div className="flex flex-wrap gap-3">
                <DocButton id={expenses.mess.receipt_document_id} label={t('studentProfile.viewMessReceipt')} />
                <DocButton id={expenses.abhyasika.receipt_document_id} label={t('studentProfile.viewAbhyasikaReceipt')} />
              </div>
            </>
          ) : (
            <Missing />
          )}
        </Panel>
      </div>
    </section>
  )
}

function Panel({ title, children }) {
  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
      <h3 className="font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
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

function Missing() {
  const { t } = useTranslation()
  return <p className="text-slate-500">{t('studentProfile.notSubmitted')}</p>
}
