'use client'

// ============================================================
// app/contexts/AuthContext.tsx — Auth state management
// ============================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { PublicUser } from '@/lib/auth/types'

// ---- Context types ---------------------------------------------

interface AuthState {
  user: PublicUser | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
}

// ---- Context ---------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null)

// ---- Provider --------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [loading, setLoading] = useState(true)
  const handlingRevocation = useRef(false)

  /**
   * Handle session revocation: clear state and redirect to login.
   * Called on 401 SESSION_REVOKED / SESSION_EXPIRED responses.
   */
  const handleRevocation = useCallback(() => {
    if (handlingRevocation.current) return
    handlingRevocation.current = true
    setUser(null)
    // Give React a chance to render before redirecting
    setTimeout(() => {
      window.location.href = '/'
    }, 100)
  }, [])

  /**
   * Fetch the current user from the backend.
   * Returns null (no redirect) if not authenticated.
   */
  const fetchUser = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })

      if (res.ok) {
        const data = await res.json()
        setUser(data)
        handlingRevocation.current = false
        return
      }

      if (res.status === 401) {
        const data = await res.json().catch(() => ({}))
        if (
          data.error === 'SESSION_REVOKED' ||
          data.error === 'SESSION_EXPIRED' ||
          data.error === 'REFRESH_TOKEN_REUSE_DETECTED'
        ) {
          handleRevocation()
          return
        }
        // UNAUTHORIZED = simply not logged in
        setUser(null)
        return
      }

      setUser(null)
    } catch {
      // Network error — don't clear user state, it might be transient
    } finally {
      setLoading(false)
    }
  }, [handleRevocation])

  // Load user on mount
  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // ---- Auth actions ------------------------------------------

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      setUser(null)
      window.location.href = '/'
    }
  }, [])

  const logoutAll = useCallback(async () => {
    try {
      await fetch('/api/auth/logout-all', { method: 'POST', credentials: 'include' })
    } finally {
      setUser(null)
      window.location.href = '/'
    }
  }, [])

  const refreshUser = useCallback(async () => {
    setLoading(true)
    await fetchUser()
  }, [fetchUser])

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  )
}

// ---- Hook ------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth() must be used inside <AuthProvider>')
  }
  return ctx
}
