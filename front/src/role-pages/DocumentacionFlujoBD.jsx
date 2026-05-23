import React from 'react'
import { useAuth } from '../auth/AuthContext.jsx'

const roles = [
  { role: 'super-admin', title: 'SUPER_ADMIN', color: '#0EA5E9' },
  { role: 'admin', title: 'ADMIN', color: '#22C55E' },
  { role: 'gestor', title: 'GESTOR', color: '#F59E0B' },
  { role: 'logistica', title: 'LOGISTICA', color: '#EF4444' }
]

function Card({ title, subtitle, children, tint }) {
  return (
    <div
      style={{
        border: '1px solid rgba(2,132,199,0.18)',
        borderRadius: 16,
        padding: 16,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.75))',
        boxShadow: '0 10px 35px rgba(2, 132, 199, 0.06)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 950, color: tint || 'var(--primary)' }}>{title}</div>
          {subtitle ? <div style={{ opacity: 0.75, fontWeight: 700, marginTop: 4 }}>{subtitle}</div> : null}
        </div>
        {tint ? (
          <div style={{ width: 12, height: 12, borderRadius: 999, background: tint }} />
        ) : null}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  )
}

function Pill({ label, color }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 999,
        border: '1px solid rgba(0,0,0,0.06)',
        background: 'rgba(255,255,255,0.85)',
        fontWeight: 850,
        fontSize: 12,
        color: color || 'var(--primary)'
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color || 'var(--primary)' }} />
      {label}
    </span>
  )
}

function RelationTable({ columns, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                style={{
                  textAlign: 'left',
                  fontSize: 12,
                  letterSpacing: 0.3,
                  color: 'rgba(15,23,42,0.8)',
                  borderBottom: '1px solid rgba(2,132,199,0.2)',
                  padding: '10px 8px'
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx}>
              {columns.map((c) => (
                <td key={c} style={{ borderBottom: '1px solid rgba(2,132,199,0.08)', padding: '10px 8px', verticalAlign: 'top' }}>
                  {r[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const DB_TABLES = ['empresa', 'usuario', 'cliente', 'espacio', 'recurso', 'reserva', 'detalle_reserva', 'pago', 'documento', 'incidente']

const ROLE_PERMISSIONS = {
  'super-admin': {
    tables: ['empresa', 'usuario', 'reserva', 'pago', 'incidente'],
    actions: 'Gestiona empresa y usuarios; supervisa reservas/pagos/incidentes'
  },
  admin: {
    tables: ['usuario', 'cliente', 'espacio', 'recurso', 'reserva', 'detalle_reserva', 'pago', 'documento'],
    actions: 'Gestiona usuarios internos, clientes, espacios y recursos; gestiona reservas y documentación'
  },
  gestor: {
    tables: ['cliente', 'reserva', 'detalle_reserva', 'documento', 'espacio', 'recurso'],
    actions: 'Gestiona clientes, reservas y detalle; genera documentos'
  },
  logistica: {
    tables: ['recurso', 'reserva', 'documento', 'incidente', 'espacio'],
    actions: 'Gestiona inventario/espacios (operación) y registra incidentes; consulta reservas/asignaciones'
  }
}

const FLOW = [
  'SUPER_ADMIN crea empresa',
  'SUPER_ADMIN crea ADMIN (usuario con rol ADMIN, asociado a id_empresa)',
  'ADMIN administra la data de su empresa (id_empresa como filtro)',
  'GESTOR crea/gestiona reservas y detalle_reserva, y genera documentos',
  'Reservas generan pagos y documentos (documento/pago vinculados a reserva)',
  'LOGISTICA consulta disponibilidad operativa, consulta reservas asignadas y registra incidentes'
]

export default function DocumentacionFlujoBD() {
  const { user } = useAuth()
  const activeRole = user?.role

  const active = roles.find((r) => r.role === activeRole) || null

  const columns = ['Rol (perfil)', 'Tablas relacionadas', 'Qué hace']
  const rows = roles.map((r) => ({
    'Rol (perfil)': (
      <span style={{ fontWeight: 950, color: r.color }}>
        {r.title}
        {activeRole === r.role ? <span style={{ marginLeft: 8, opacity: 0.8, fontSize: 12 }}>• actual</span> : null}
      </span>
    ),
    'Tablas relacionadas': (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ROLE_PERMISSIONS[r.role].tables.map((t) => (
          <Pill key={t} label={t} color={r.color} />
        ))}
      </div>
    ),
    'Qué hace': <div style={{ fontWeight: 700, opacity: 0.9 }}>{ROLE_PERMISSIONS[r.role].actions}</div>
  }))

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 1000, fontSize: 22, color: 'var(--primary)' }}>Documentación visual: flujo por rol</div>
        <div style={{ opacity: 0.75, marginTop: 6, fontWeight: 700 }}>
          Vista informativa complementaria (SIN modificar dashboards existentes). Filtrado por perfil: <b>{active?.title || '—'}</b>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(12, 1fr)' }}>
        <div style={{ gridColumn: 'span 12' }}>
          <Card title="Tablas de la base de datos" subtitle="Modelo actual (multiempresa)" tint="#0284C7">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {DB_TABLES.map((t) => (
                <Pill key={t} label={t} color="#0284C7" />
              ))}
            </div>
            <div style={{ marginTop: 10, opacity: 0.8, fontWeight: 700 }}>
              Regla de oro: el sistema guarda información por <b>id_empresa</b> (cuando aplique) usando el JWT.
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: 'span 7' }}>
          <Card title="Permisos por perfil" subtitle="Qué rol interactúa con qué tablas" tint="#0EA5E9">
            <RelationTable columns={columns} rows={rows} />
          </Card>
        </div>

        <div style={{ gridColumn: 'span 5' }}>
          <Card title="Timeline del flujo" subtitle="Cómo viaja la información" tint="#22C55E">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FLOW.map((line, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 10, background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950 }}>
                    {idx + 1}
                  </div>
                  <div style={{ fontWeight: 800, opacity: 0.92, paddingTop: 4 }}>{line}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: 'span 12' }}>
          <Card title="Jerarquía multiempresa" subtitle="Guía de permisos por JWT»" tint="#F59E0B">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12, alignItems: 'start' }}>
              <div style={{ gridColumn: 'span 4' }}>
                <div style={{ fontWeight: 1000, color: '#92400E' }}>1) SUPER_ADMIN</div>
                <div style={{ marginTop: 6, opacity: 0.85, fontWeight: 750 }}>
                  Crea empresa y asigna admins. Vista global.
                </div>
              </div>
              <div style={{ gridColumn: 'span 4' }}>
                <div style={{ fontWeight: 1000, color: '#166534' }}>2) ADMIN</div>
                <div style={{ marginTop: 6, opacity: 0.85, fontWeight: 750 }}>
                  Trabaja dentro del <b>id_empresa</b> del JWT.
                </div>
              </div>
              <div style={{ gridColumn: 'span 4' }}>
                <div style={{ fontWeight: 1000, color: '#7F1D1D' }}>3) GESTOR / LOGISTICA</div>
                <div style={{ marginTop: 6, opacity: 0.85, fontWeight: 750 }}>
                  Operan con datos filtrados por empresa (y/o consultas por relaciones).
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, opacity: 0.8, fontWeight: 700 }}>
              Esta vista documenta el flujo; no cambia rutas ni componentes existentes.
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

