// Client-side mirrors of backend/app/core/validators.py — the backend still re-checks everything.

export function normalizeMobile(value) {
  let digits = (value || '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

/** 12 digits, not starting with 0/1, valid Verhoeff check digit. */
export function isValidAadhaar(value) {
  const digits = (value || '').replace(/[\s-]/g, '')
  if (!/^[2-9]\d{11}$/.test(digits)) return false
  let check = 0
  digits
    .split('')
    .reverse()
    .forEach((ch, i) => {
      check = D[check][P[i % 8][Number(ch)]]
    })
  return check === 0
}

/** Formats as "1234 5678 9012" while typing. */
export function formatAadhaar(value) {
  return (value || '')
    .replace(/\D/g, '')
    .slice(0, 12)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
}

export const isValidIfsc = (value) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test((value || '').trim().toUpperCase())
export const isValidAccountNumber = (value) => /^\d{9,18}$/.test((value || '').replace(/\s/g, ''))

export const MAX_UPLOAD_MB = 5
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

/** Returns an i18n error key, or null if the file is acceptable. */
export function checkUploadFile(file) {
  if (!file) return null
  if (!ALLOWED_TYPES.includes(file.type)) return 'errors.upload.invalid_type'
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return 'errors.upload.too_large'
  return null
}

/**
 * PAN: 5 letters, 4 digits, 1 letter; the 4th letter (holder type) must be
 * P individual, B body of individuals, C company, H HUF or T trust.
 * Returns an i18n error key, or null if valid.
 */
export const PAN_TYPES = ['P', 'B', 'C', 'H', 'T']

export function panError(value) {
  const pan = (value || '').replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) return 'pan.invalidFormat'
  if (!PAN_TYPES.includes(pan[3])) return 'pan.invalidType'
  return null
}
