import axios from 'axios'

export const TOKEN_KEY = 'vy_token'

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable — session lasts until reload */
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Let the AuthContext know when the session is no longer valid
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const code = error.response?.data?.code
    if (code === 'auth.invalid_token' || code === 'auth.inactive') {
      window.dispatchEvent(new Event('vy:unauthorized'))
    }
    return Promise.reject(error)
  },
)

export const getHealth = () => api.get('/health').then((res) => res.data)

// Auth
export const loginRequest = (payload) => api.post('/auth/login', payload).then((res) => res.data)
export const registerRequest = (payload) => api.post('/auth/register', payload).then((res) => res.data)
export const getMe = () => api.get('/auth/me').then((res) => res.data)

// Student sign-up sections (file uploads take a FormData)
export const getStudentProfile = () => api.get('/students/me/profile').then((res) => res.data)
export const savePersonal = (payload) => api.put('/students/me/personal', payload).then((res) => res.data)
// Reading a card can take a while when the AI fallback runs
export const readAadhaar = (formData) =>
  api.post('/students/me/aadhaar/read', formData, { timeout: 120000 }).then((res) => res.data)
export const saveAadhaar = (payload) => api.put('/students/me/aadhaar', payload).then((res) => res.data)
export const saveBank = (formData) => api.put('/students/me/bank', formData).then((res) => res.data)
export const saveExpenses = (formData) => api.put('/students/me/expenses', formData).then((res) => res.data)
export const getStudentDocument = (id) =>
  api.get(`/students/me/documents/${id}`, { responseType: 'blob' }).then((res) => res.data)

// Donor sign-up (file uploads take a FormData)
export const getDonorProfile = () => api.get('/donors/me/profile').then((res) => res.data)
export const saveDonorBank = (formData) => api.put('/donors/me/bank', formData).then((res) => res.data)
export const saveDonorPan = (formData) => api.put('/donors/me/pan', formData).then((res) => res.data)
export const getDonorDocument = (id) => api.get(`/donors/me/documents/${id}`, { responseType: 'blob' }).then((res) => res.data)

// Home page figures (donors + admins) and donations
export const getImpact = () => api.get('/impact').then((res) => res.data)
export const getDonationPayee = () => api.get('/donations/payee').then((res) => res.data)
export const recordDonation = (payload) => api.post('/donations', payload).then((res) => res.data)
export const getMyDonations = () => api.get('/donations/me').then((res) => res.data)
export const downloadReceipt = (id) => downloadBlob(`/donations/${id}/receipt`, {}, 'receipt.pdf')

// Admin
export const getAdminStats = () => api.get('/admin/stats').then((res) => res.data)
export const getAdminUsers = (params) => api.get('/admin/users', { params }).then((res) => res.data)
export const createUserAsAdmin = (payload) => api.post('/admin/users', payload).then((res) => res.data)
export const getStudentDirectory = (params) => api.get('/admin/students', { params }).then((res) => res.data)
export const getStudentFacets = () => api.get('/admin/students/facets').then((res) => res.data)
export const getStudentAsAdmin = (userId) => api.get(`/admin/students/${userId}`).then((res) => res.data)
export const setStudentVerification = (userId, payload) =>
  api.patch(`/admin/students/${userId}/verification`, payload).then((res) => res.data)
export const getEligibilityRules = () => api.get('/admin/eligibility/rules').then((res) => res.data)
export const getEligibilityCounts = () => api.get('/admin/eligibility/counts').then((res) => res.data)
export const getDocumentAsAdmin = (id) =>
  api.get(`/admin/documents/${id}`, { responseType: 'blob' }).then((res) => res.data)

export const getAdminDonations = (params) => api.get('/admin/donations', { params }).then((res) => res.data)
export const exportDonations = (format, params) => downloadExport('/admin/donations/export', format, params)
export const getAdminDonors = (params) => api.get('/admin/donors', { params }).then((res) => res.data)
export const exportDonors = (format, params) => downloadExport('/admin/donors/export', format, params)
// Payments
export const getPaymentsSummary = (params) => api.get('/admin/payments/summary', { params }).then((res) => res.data)
export const getPaymentsDue = (params) => api.get('/admin/payments/due', { params }).then((res) => res.data)
export const getPaymentsMade = (params) => api.get('/admin/payments', { params }).then((res) => res.data)
export const recordPayment = (payload) => api.post('/admin/payments', payload).then((res) => res.data)
export const getFunds = () => api.get('/admin/funds').then((res) => res.data)
export const addFunds = (payload) => api.post('/admin/funds', payload).then((res) => res.data)

export const getRequirements = (params) => api.get('/admin/requirements', { params }).then((res) => res.data)

/** Downloads the student directory as .xlsx or .csv with the current filters. */
export const exportStudentDirectory = (format, params) => downloadExport('/admin/students/export', format, params)

/** Downloads the requirements of accepted students as .xlsx or .csv. */
export const exportRequirements = (format, params) => downloadExport('/admin/requirements/export', format, params)

const downloadExport = (path, format, params) => downloadBlob(path, { ...params, format }, `export.${format}`)

/** Fetches a file with the auth header and saves it under the server-provided filename. */
async function downloadBlob(path, params, fallbackName) {
  const res = await api.get(path, { params, responseType: 'blob', timeout: 120000 })
  const match = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = match ? match[1] : fallbackName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default api
