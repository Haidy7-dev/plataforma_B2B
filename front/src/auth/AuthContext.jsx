import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

const ROLE_PATHS = {
  'super-admin': '/super-admin',
  admin: '/admin',
  gestor: '/gestor',
  logistica: '/logistica'
}

function normalizeRole(role) {
  if (role == null) return ''
  return String(role).trim().toLowerCase().replace(/_/g, '-')
}

export function AuthProvider({ children }) {

  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('auth_user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('token') || ''
    } catch {
      return ''
    }
  })

  useEffect(() => {
    axios.defaults.headers.common.Authorization =
      token ? `Bearer ${token}` : ''
  }, [token])

  const api = useMemo(() => {
    return axios.create({})
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      login: ({ user: u, token: newToken }) => {
        setUser(u || null)

        const safeToken = newToken || ''

        if (safeToken) localStorage.setItem('token', safeToken)
        if (u) localStorage.setItem('auth_user', JSON.stringify(u))
        setToken(safeToken)
      },

      logout: () => {
        setUser(null)
        setToken('')

        // Requested safe cleanup
        const keys = [
          'token',
          'auth_user',
          'accessToken',
          'userData',
          'authStorage'
        ]

        keys.forEach((k) => {
          try {
            localStorage.removeItem(k)
          } catch {
            // ignore
          }
          try {
            sessionStorage.removeItem(k)
          } catch {
            // ignore
          }
        })

      },

      rolePath: (role) => ROLE_PATHS[normalizeRole(role)] || '/'
    }),
    [user, token]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return ctx
}
