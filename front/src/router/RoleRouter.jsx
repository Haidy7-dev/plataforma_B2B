import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import SuperAdminLayout from '../role-pages/super-admin/SuperAdminLayout.jsx'
import AdminLayout from '../role-pages/admin/AdminLayout.jsx'
import GestorReservasLayout from "../role-pages/gestor-reservas/GestorReservasLayout.jsx";
import LogisticaLayout from '../role-pages/logistica/LogisticaLayout.jsx'

function RequireRole({ allowed, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!allowed.includes(user.role)) return <Navigate to={user ? '/' : '/login'} replace />
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

