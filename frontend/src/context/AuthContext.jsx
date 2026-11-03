import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { getMe, getStoredToken, loginRequest, registerRequest, setStoredToken } from '../services/api'

const AuthContext = createContext(null)

// All account roles (admins can still create and filter donor records)
export const ROLES = ['student', 'donor', 'admin']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getStoredToken()))

  const logout = useCallback(() => {
    setStoredToken(null)
    setUser(null)
  }, [])

  // Restore the session on page load
  useEffect(() => {
    if (!getStoredToken()) return
    getMe()
      .then(setUser)
      .catch(logout)
      .finally(() => setLoading(false))
  }, [logout])

  useEffect(() => {
    window.addEventListener('vy:unauthorized', logout)
    return () => window.removeEventListener('vy:unauthorized', logout)
  }, [logout])

  const handleAuth = ({ access_token, user: u }) => {
    setStoredToken(access_token)
    setUser(u)
    return u
  }

  // identifier = mobile number or email; the account's own role decides where it lands
  const login = useCallback((identifier, password) => loginRequest({ identifier, password }).then(handleAuth), [])
  const register = useCallback((payload) => registerRequest(payload).then(handleAuth), [])

  // Re-fetch the user, e.g. after onboarding changes `onboarding_complete`
  const refreshUser = useCallback(() => getMe().then((u) => (setUser(u), u)), [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
