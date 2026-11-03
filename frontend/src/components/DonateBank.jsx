import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Shidori is run by this Section 8 company, set up by the founders of Angholichi Goli. */
export const FOUNDATION = {
  name: 'MAKE EARTH HAPPY FOUNDATION',
  darpanId: 'MH/2026/1229615',
}

// Donations go to the foundation's institutional current account
export const DONATION_ACCOUNT = {
  holder: FOUNDATION.name,
  bank: 'HDFC Bank',
  number: '50200124214274',
  ifsc: 'HDFC0004888',
  branch: 'Dhayari, Pune, Maharashtra',
}

function CopyButton({ value }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (e.g. insecure context) — the value is still visible to copy by hand
    }
  }

  return (
    <button type="button" onClick={copy} className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 hover:border-brand-500 hover:text-brand-600">
      {copied ? t('donateBank.copied') : t('donateBank.copy')}
    </button>
  )
}

/** Bank-transfer details for donations, with copy buttons for the account number and IFSC. */
export default function DonateBank({ className = '' }) {
  const { t } = useTranslation()
  const a = DONATION_ACCOUNT

  const rows = [
    [t('bank.holder'), a.holder],
    [t('bank.bankName'), a.bank],
    [t('bank.account'), a.number, true],
    [t('bank.ifsc'), a.ifsc, true],
    [t('donateBank.type'), t('donateBank.typeValue')],
    [t('bank.branch'), a.branch],
  ]

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h2 className="text-xl font-bold text-brand-700">{t('donateBank.title')}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('donateBank.body')}</p>

      <dl className="mt-4 divide-y divide-slate-100 text-sm">
        {rows.map(([label, value, copyable]) => (
          <div key={label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="flex items-center gap-2 text-right font-medium text-slate-800">
              <span className={copyable ? 'font-mono' : ''}>{value}</span>
              {copyable && <CopyButton value={value} />}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
