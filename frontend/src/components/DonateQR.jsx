import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ORG } from './SocialLinks'

const { upi } = ORG
const UPI_LINK = `upi://pay?pa=${encodeURIComponent(upi.id)}&pn=${encodeURIComponent(upi.name)}&cu=INR`

/** The organisation's SBI "Scan & Pay" card, with the UPI ID to copy and a pay link for phones. */
export default function DonateQR({ compact = false, className = '' }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(upi.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (e.g. insecure context) — the ID is still visible to copy by hand
    }
  }

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {!compact && (
        <>
          <h2 className="text-xl font-bold text-brand-700">{t('donateQr.title')}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('donateQr.body')}</p>
        </>
      )}

      <img
        src={upi.qr}
        alt={t('donateQr.alt')}
        width="984"
        height="1380"
        loading="lazy"
        className={`mx-auto rounded-lg ${compact ? 'w-48' : 'mt-4 w-full max-w-[16rem]'}`}
      />

      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-slate-500">{t('donateQr.merchant')}</dt>
          <dd className="font-medium text-slate-800">{upi.name}</dd>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-slate-500">{t('donateQr.upiId')}</dt>
          <dd className="flex items-center gap-2">
            <span className="font-mono font-medium text-slate-800">{upi.id}</span>
            <button type="button" onClick={copy} className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 hover:border-brand-500 hover:text-brand-600">
              {copied ? t('donateQr.copied') : t('donateQr.copy')}
            </button>
          </dd>
        </div>
      </dl>

      {/* On a phone the QR can't be scanned from its own screen, so offer a direct UPI link */}
      <a
        href={UPI_LINK}
        className="mt-4 block rounded-lg bg-brand-gradient px-4 py-2.5 text-center font-semibold text-white hover:brightness-110 md:hidden"
      >
        {t('donateQr.payOnPhone')}
      </a>
    </div>
  )
}
