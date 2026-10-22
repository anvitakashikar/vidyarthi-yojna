import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { downloadReceipt, getMyDonations } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { formatDate, formatRupees } from '../../utils/format'

/** The donor's donation history with receipt downloads. */
export default function MyDonations({ onError }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [data, setData] = useState(null)

  useEffect(() => {
    getMyDonations()
      .then(setData)
      .catch((err) => onError?.(apiErrorMessage(err, t)))
  }, [t, onError])

  const receipt = (id) => downloadReceipt(id).catch((err) => onError?.(apiErrorMessage(err, t)))

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <h2 className="text-lg font-semibold">{t('myDonations.title')}</h2>
        {data?.items.length > 0 && <span className="text-sm text-slate-600">{t('myDonations.total', { amount: formatRupees(data.total, lang) })}</span>}
      </div>
      {data?.items.length ? (
        <ul className="divide-y divide-slate-100 text-sm">
          {data.items.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <span className="font-semibold text-brand-700">{formatRupees(d.amount, lang)}</span>
                <span className="block text-xs text-slate-500">
                  {formatDate(d.created_at, lang)} · {t(`donate.methods.${d.method}`)} · <span className="font-mono">{d.receipt_no}</span>
                </span>
              </div>
              <button type="button" onClick={() => receipt(d.id)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                ↓ {t('myDonations.receipt')}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-8 text-center text-sm text-slate-500">
          <p>{t('myDonations.empty')}</p>
          <Link to="/donor/donate" className="mt-2 inline-block font-medium text-brand-600 hover:underline">
            {t('home2.donateNow')} →
          </Link>
        </div>
      )}
    </section>
  )
}
