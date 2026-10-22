/**
 * Turns a backend error into a message in the current UI language.
 * The backend (English-only) returns { code, message, data }; we translate
 * `code` via the `errors.*` keys and fall back to the English `message`.
 */
export function apiErrorMessage(error, t) {
  const body = error?.response?.data
  if (!error?.response) return t('errors.network')
  if (!body?.code) return t('common.error')

  const params = { ...(body.data && !Array.isArray(body.data) ? body.data : {}) }
  if (params.role) params.role = t(`roles.${params.role}`)

  return t(`errors.${body.code}`, { ...params, defaultValue: body.message || t('common.error') })
}
