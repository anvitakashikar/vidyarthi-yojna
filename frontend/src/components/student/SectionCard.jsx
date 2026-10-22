/** White card wrapping one part of the sign-up, with a title and optional "saved" badge. */
export default function SectionCard({ title, description, saved, savedLabel, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-slate-600">{description}</p>}
        </div>
        {saved && <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">✓ {savedLabel}</span>}
      </div>
      {children}
    </div>
  )
}

export function SubmitButton({ saving, children, savingLabel }) {
  return (
    <button type="submit" disabled={saving} className="w-full rounded-lg bg-brand-gradient px-5 py-2.5 font-medium text-white hover:brightness-110 disabled:opacity-60">
      {saving ? savingLabel : children}
    </button>
  )
}
