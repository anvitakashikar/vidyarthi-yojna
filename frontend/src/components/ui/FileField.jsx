import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { MAX_UPLOAD_MB } from '../../utils/validators'

/** File picker for JPG / PNG / PDF documents. */
export default function FileField({ label, file, onChange, existingNote, required }) {
  const { t } = useTranslation()
  const id = useId()

  return (
    <div className="text-sm">
      <label htmlFor={id} className="block font-medium text-slate-700">
        {label}
      </label>
      <label
        htmlFor={id}
        className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center hover:border-brand-500 hover:bg-brand-50"
      >
        <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
        <span className="mt-2 font-medium text-brand-700">{file ? file.name : t('upload.choose')}</span>
        <span className="mt-1 text-xs text-slate-500">{t('upload.hint', { max: MAX_UPLOAD_MB })}</span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="sr-only"
        required={required}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      {existingNote && !file && <p className="mt-1 text-xs text-green-700">{existingNote}</p>}
    </div>
  )
}
