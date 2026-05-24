import React, { createContext, useContext, useMemo, useState } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

const ROLE_PATHS = {
  'super-admin': '/super-admin',
  admin: '/admin',
  'gestor': '/gestor',
  logistica: '/logistica'
}

export function AuthProvider({ children }) {

  const [user, setUser] = useState(null)

  const api = useMemo(() => {
    return axios.create({})
  }, [])

  const value = useMemo(
    () => ({
      user,
      login: ({ user: u, token }) => {
        setUser(u)

        if (token) localStorage.setItem('token', token)

        axios.defaults.headers.common.Authorization =
          token ? `Bearer ${token}` : ''
      },

      logout: () => {
        setUser(null)

        // Requested safe cleanup
        const keys = [
          'token',
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

        axios.defaults.headers.common.Authorization = ''
      },

      rolePath: (role) => ROLE_PATHS[role] || '/'
    }),
    [user]
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