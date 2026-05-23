import React from 'react'
import { Route, Routes } from 'react-router-dom'
import RoleLayout from '../../components/layout/RoleLayout.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminTasks from './pages/AdminTasks.jsx'
import AdminOperations from './pages/AdminOperations.jsx'
import AdminReports from './pages/AdminReports.jsx'
import AdminActivity from './pages/AdminActivity.jsx'
import InventoryImport from './pages/InventoryImport.jsx'
import DocumentacionFlujoBD from '../DocumentacionFlujoBD.jsx'

export default function AdminLayout() {
  return (
    <RoleLayout
      title="Plataforma ADMIN"
      roleLabel="Administrador"
      links={[
        { to: '/admin', label: 'Dashboard' },
        { to: '/admin/users', label: 'Gestión de usuarios' },
        { to: '/admin/tasks', label: 'Gestión de tareas' },
        { to: '/admin/operativa', label: 'Gestión operativa' },
        { to: '/admin/reports', label: 'Reportes' },
        { to: '/admin/inventario-csv', label: 'Inventario CSV' },
        { to: '/admin/actividad', label: 'Actividades recientes' },
        { to: '/admin/documentacion-flujo', label: 'Documentación de flujo (BD)' }
      ]}
    >
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/tasks" element={<AdminTasks />} />
        <Route path="/operativa" element={<AdminOperations />} />
        <Route path="/reports" element={<AdminReports />} />
        <Route path="/inventario-csv" element={<InventoryImport />} />
        <Route path="/actividad" element={<AdminActivity />} />
        <Route path="/documentacion-flujo" element={<DocumentacionFlujoBD />} />
      </Routes>
    </RoleLayout>
  )
}



