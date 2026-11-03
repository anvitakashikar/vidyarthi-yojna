const locale = (lang) => {
  const language = lang?.split('-')[0]
  return language === 'mr' || language === 'hi' ? `${language}-IN` : 'en-IN'
}

export function formatRupees(amount, lang) {
  if (amount == null || amount === '') return '—'
  return new Intl.NumberFormat(locale(lang), { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

export function formatDate(iso, lang) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat(locale(lang), { dateStyle: 'medium' }).format(new Date(y, m - 1, d))
}

export function formatNumber(n, lang) {
  return n == null ? '—' : new Intl.NumberFormat(locale(lang)).format(n)
}

/** Age in completed years from an ISO date (yyyy-mm-dd). */
export function calcAge(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1
  return age
}

/** Opens a document blob (fetched with auth) in a new tab. */
export async function openBlobInNewTab(fetchBlob) {
  const win = window.open('', '_blank')
  try {
    const blob = await fetchBlob()
    if (win) win.location.href = URL.createObjectURL(blob)
  } catch (err) {
    win?.close()
    throw err
  }
}
