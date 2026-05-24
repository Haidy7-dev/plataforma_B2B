import React, { useMemo, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import SuperAdminPremiumLayout from './SuperAdminPremiumLayout.jsx'
import EmpresasUsuarios from './pages/EmpresasUsuarios.jsx'

function Badge({ kind, children }) {
  return <span className={`sa-badge sa-badge-${kind}`}>{children}</span>
}

function Card({ title, value, icon, hint, tone }) {
  return (
    <div className={`sa-card sa-card-${tone || 'neutral'}`}>
      <div className="sa-cardTop">
        <div className="sa-cardTitle">{title}</div>
        <div className="sa-cardIcon" aria-hidden>
          {icon}
        </div>
      </div>
      <div className="sa-cardValue">{value}</div>
      {hint ? <div className="sa-cardHint">{hint}</div> : null}
    </div>
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

function Modal({ open, title, children, onClose }) {
  if (!open) return null
  return (
    <div className="sa-modalOverlay" role="dialog" aria-modal="true">
      <div className="sa-modal">
        <div className="sa-modalHeader">
          <div>
            <div className="sa-modalTitle">{title}</div>
            <div className="sa-modalSub">Vista previa (datos mock)</div>
          </div>
          <button type="button" className="sa-modalClose" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="sa-modalBody">{children}</div>
        <div className="sa-modalFooter">
          <button type="button" className="sa-btn sa-btnGhost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="sa-btn sa-btnPrimary" onClick={onClose}>
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const [openModal, setOpenModal] = useState(false)

  const recent = useMemo(
    () => [
      {
        id: 1,
        actor: 'Sofía R.',
        action: 'Creó administrador',
        company: 'LogiNova',
        role: 'Admin',
        status: 'Aprobado',
        statusKind: 'positive',
        time: 'hace 12 min'
      },
      {
        id: 2,
        actor: 'Sistema',
        action: 'Detección de riesgo',
        company: 'Atlas Freight',
        role: 'SuperAdmin',
        status: 'Crítico',
        statusKind: 'critical',
        time: 'hace 38 min'
      },
      {
        id: 3,
        actor: 'Miguel P.',
        action: 'Actualizó permisos',
        company: 'TransWare',
        role: 'Admin',
        status: 'OK',
        statusKind: 'neutral',
        time: 'hace 2 h'
      },
      {
        id: 4,
        actor: 'Sistema',
        action: 'Audit trail generado',
        company: 'B2B Central',
        role: 'SuperAdmin',
        status: 'OK',
        statusKind: 'neutral',
        time: 'ayer'
      }
    ],
    []
  )

  return (
    <div className="sa-stack">
      <section className="sa-grid4">
        <Card
          tone="primary"
          title="Usuarios activos"
          value="1,284"
          hint="+3.1% vs semana anterior"
          icon="👥"
        />
        <Card
          tone="indigo"
          title="Empresas registradas"
          value="47"
          hint="12 sedes nuevas"
          icon="🏢"
        />
        <Card
          tone="success"
          title="Operaciones del día"
          value="268"
          hint="78% en SLA"
          icon="⚡"
        />
        <div className="sa-card sa-card-critical">
          <div className="sa-cardTop">
            <div className="sa-cardTitle">Alertas del sistema</div>
            <div className="sa-cardIcon" aria-hidden>
              ⛔
            </div>
          </div>
          <div className="sa-cardValue">3</div>
          <div className="sa-cardHint">
            1 crítico • 2 advertencias
          </div>
        </div>
      </section>

      <section className="sa-grid2 sa-grid2-full">
        <div className="sa-panel sa-panel-full">
          <div className="sa-panelHeader">
            <div>
              <div className="sa-panelTitle">Actividad reciente</div>
              <div className="sa-panelSub">Eventos más recientes del sistema</div>
            </div>
          </div>

          <DataTable rows={recent} />
        </div>
      </section>

      <Modal open={openModal} title="Detalle financiero" onClose={() => setOpenModal(false)}>
        <div className="sa-mutedBox">
          Vista de detalle financiero disponible para integración real con datos de producción.
        </div>
      </Modal>
    </div>
  )
}

export default function SuperAdminLayout() {
  return (
    <SuperAdminPremiumLayout
      title="Dashboard avanzado"
      roleLabel="Super Admin"
      links={[
        { to: '/super-admin', label: 'Dashboard', icon: 'bolt' },
        { to: '/super-admin/usuarios', label: 'Usuarios', icon: 'users' },
        { to: '/super-admin/empresas', label: 'Empresas', icon: 'store' }
      ]}
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/usuarios"
          element={
            <div className="sa-stack">
              <div className="sa-panel">
                <div className="sa-panelHeader">
                  <div>
                    <div className="sa-panelTitle">Gestión total de usuarios</div>
                    <div className="sa-panelSub">Crear/editar/eliminar administradores (mock)</div>
                  </div>
                </div>
                <div className="sa-mutedBox">
                  UI para CRUD de administradores + asignación de permisos/roles.
                </div>
              </div>
            </div>
          }
        />
        <Route path="/empresas" element={<EmpresasUsuarios />} />
      </Routes>
    </SuperAdminPremiumLayout>
  )
}
