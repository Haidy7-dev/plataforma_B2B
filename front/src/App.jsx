import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RoleRouter from './router/RoleRouter.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />
        <Route path="/*" element={<RoleRouter />} />
      </Routes>
    </AuthProvider>
  )
}

