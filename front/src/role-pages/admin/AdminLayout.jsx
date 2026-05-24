import React from 'react'
import { Route, Routes } from 'react-router-dom'
import PremiumRoleLayout from '../../components/layout/PremiumRoleLayout.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'

import AdminUsers from './pages/AdminUsers.jsx'
import ReservationsFlow from './pages/ReservationsFlow.jsx'
import AdminReports from './pages/AdminReports.jsx'
import InventoryImport from './pages/InventoryImport.jsx'

export default function AdminLayout() {
  return (
    <PremiumRoleLayout
      title="Plataforma ADMIN"
      roleLabel="Administrador"
      links={[
        { to: '/admin', label: 'Inicio' },
        { to: '/admin/users', label: 'Gestión de usuarios' },
        { to: '/admin/reservas', label: 'Reservas' },
        { to: '/admin/reports', label: 'Reportes' },
        { to: '/admin/inventario-csv', label: 'Inventario CSV' }
      ]}
    >
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/reservas" element={<ReservationsFlow />} />
        <Route path="/reports" element={<AdminReports />} />
        <Route path="/inventario-csv" element={<InventoryImport />} />
      </Routes>
    </PremiumRoleLayout>
  )
}





