export const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

/** Text input with label. `prefix` renders a fixed adornment such as "+91". */
export default function FormField({ label, hint, prefix, ...inputProps }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {prefix ? (
        <span className="mt-1 flex rounded-lg border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
          <span className="flex items-center border-r border-slate-200 px-3 text-slate-500">{prefix}</span>
          <input className="w-full rounded-r-lg px-3 py-2 focus:outline-none" {...inputProps} />
        </span>
      ) : (
        <input className={inputClass} {...inputProps} />
      )}
      {hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
    </label>
  )
}

export function Alert({ children }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  )
}

export function SuccessNote({ children }) {
  if (!children) return null
  return <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{children}</p>
}
