import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import axios from 'axios'
import SuperAdminPremiumLayout from './SuperAdminPremiumLayout.jsx'
import EmpresasUsuarios from './pages/EmpresasUsuarios.jsx'
import SuperAdminEmpresas from './pages/SuperAdminEmpresas.jsx'

const API_BASE = 'http://localhost:4000'

function Badge({ kind, children }) {
  return <span className={`sa-badge sa-badge-${kind}`}>{children}</span>
}

function Card({ title, value, icon, hint, tone, onClick }) {
  return (
    <button type="button" className={`sa-card sa-card-${tone || 'neutral'}`} onClick={onClick} style={{ textAlign: 'left', cursor: 'pointer' }}>
      <div className="sa-cardTop">
        <div className="sa-cardTitle">{title}</div>
        <div className="sa-cardIcon" aria-hidden>
          {icon}
        </div>
      </div>
      <div className="sa-cardValue">{value}</div>
      {hint ? <div className="sa-cardHint">{hint}</div> : null}
    </button>
  )
}

function DataTable({ rows }) {
  return (
    <div className="sa-tableWrap">
      <table className="sa-table">
        <thead>
          <tr>
            <th>Actor</th>
            <th>Acción</th>
            <th>Empresa</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Tiempo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="sa-tdStrong">{r.actor}</td>
              <td>{r.action}</td>
              <td>{r.company}</td>
              <td>{r.role}</td>
              <td>
                <Badge kind={r.statusKind}>{r.status}</Badge>
              </td>
              <td className="sa-tdMuted">{r.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState({
    usuariosActivos: 0,
    empresasRegistradas: 0,
    alertasSistema: 0
  })

  useEffect(() => {
    async function loadStats() {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const [statsRes, activityRes] = await Promise.all([
          axios.get(`${API_BASE}/super-admin/dashboard/stats`, { headers }),
          axios.get(`${API_BASE}/super-admin/activity/recent`, { headers })
        ])

        setStats({
          usuariosActivos: Number(statsRes?.data?.usuariosActivos || 0),
          empresasRegistradas: Number(statsRes?.data?.empresasRegistradas || 0),
          alertasSistema: Number(statsRes?.data?.alertasSistema || 0)
        })

        const recent = (activityRes?.data?.rows || []).map((r) => ({
          ...r,
          statusKind: String(r?.status || '').toLowerCase().includes('crit') ? 'critical' : String(r?.status || '').toLowerCase().includes('ok') ? 'positive' : 'neutral'
        }))

        setRows(recent)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  const filtered = useMemo(() => {
    const needle = String(q || '').trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((r) => `${r.actor} ${r.action} ${r.company} ${r.role} ${r.status}`.toLowerCase().includes(needle))
  }, [rows, q])

  return (
    <div className="sa-stack">
      <section className="sa-grid4">
        <Card tone="primary" title="Usuarios activos" value={String(stats.usuariosActivos)} hint="Cantidad real en BD" icon="👥" onClick={() => navigate('/super-admin/usuarios')} />
        <Card tone="indigo" title="Empresas registradas" value={String(stats.empresasRegistradas)} hint="Cantidad real en BD" icon="🏢" onClick={() => navigate('/super-admin/empresas')} />
        <Card tone="critical" title="Alertas del sistema" value={String(stats.alertasSistema)} hint="Conteo real desde incidentes" icon="⛔" onClick={() => navigate('/super-admin/reportes')} />
      </section>

      <section className="sa-grid2 sa-grid2-full">
        <div className="sa-panel sa-panel-full">
          <div className="sa-panelHeader">
            <div>
              <div className="sa-panelTitle">Actividad reciente</div>
              <div className="sa-panelSub">Eventos reales desde auditoría/logs</div>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar actividad..."
              style={{ minWidth: 220, padding: 10, border: '1px solid #cbd5e1', borderRadius: 10, fontWeight: 700 }}
            />
          </div>
          {loading ? <div className="sa-mutedBox">Cargando actividad...</div> : <DataTable rows={filtered} />}
        </div>
      </section>
    </div>
  )
}

export default function SuperAdminLayout() {
  return (
    <SuperAdminPremiumLayout
      title="Inicio"
      roleLabel="Super Admin"
      links={[
        { to: '/super-admin', label: 'Inicio', icon: 'bolt' },
        { to: '/super-admin/usuarios', label: 'Usuarios/Empresa', icon: 'users' },
        { to: '/super-admin/empresas', label: 'Crear', icon: 'store' }
      ]}
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/usuarios" element={<EmpresasUsuarios />} />
        <Route path="/empresas" element={<SuperAdminEmpresas />} />
        <Route path="/reportes" element={<EmpresasUsuarios />} />
      </Routes>
    </SuperAdminPremiumLayout>
  )
}
