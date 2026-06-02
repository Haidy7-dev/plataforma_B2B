import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import SuperAdminLayout from '../role-pages/super-admin/SuperAdminLayout.jsx'
import AdminLayout from '../role-pages/admin/AdminLayout.jsx'
import GestorReservasLayout from "../role-pages/gestor-reservas/GestorReservasLayout.jsx";
import LogisticaLayout from '../role-pages/logistica/LogisticaLayout.jsx'

function normalizeRoleValueFrontend(value) {
  if (value == null) return ''
  const base = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')

  const aliases = {
    administrador: 'admin',
    'super-admin': 'super-admin',
    superadmin: 'super-admin'
  }

  return aliases[base] || base
}

function RequireRole({ allowed, children }) {
  const { user } = useAuth()
  const currentRole = normalizeRoleValueFrontend(user?.rol || user?.role)

  if (!user) return <Navigate to="/login" replace />
  if (!allowed.includes(currentRole)) return <Navigate to="/login" replace />
  return children
}

export default function RoleRouter() {
  return (
    <Routes>
      <Route
        path="/super-admin/*"
        element={
          <RequireRole allowed={['super-admin']}>
            <SuperAdminLayout />
          </RequireRole>
        }
      />
      <Route
        path="/admin/*"
        element={
          <RequireRole allowed={['admin']}>
            <AdminLayout />
          </RequireRole>
        }
      />
      <Route
        path="/gestor/*"
        element={
          <RequireRole allowed={['gestor']}>
            <GestorReservasLayout />
          </RequireRole>
        }
      />
      <Route
        path="/logistica/*"
        element={
          <RequireRole allowed={['logistica']}>
            <LogisticaLayout />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

