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

function MiniChart({ points, color = '#2563EB' }) {
  const w = 240
  const h = 56
  const pad = 6
  const xs = points.map((_, i) => (i / (points.length - 1)) * (w - pad * 2) + pad)
  const min = Math.min(...points)
  const max = Math.max(...points)
  const ys = points.map((p) => {
    if (max === min) return h / 2
    const t = (p - min) / (max - min)
    return h - pad - t * (h - pad * 2)
  })

  const d = points
    .map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`)
    .join(' ')

  return (
    <div className="sa-miniChart" aria-hidden>
      <svg width={w} height={h}>
        <path d={`M ${pad} ${h - pad} L ${w - pad} ${h - pad}`} stroke="rgba(15,23,42,0.08)" />
        <path d={d} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={xs[i]} cy={ys[i]} r="2.8" fill={color} opacity="0.95" />
        ))}
      </svg>
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
      },
    ],
    []
  )

  const chartPoints = useMemo(() => [22, 30, 28, 44, 39, 55, 49, 62, 58, 73], [])

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

      <section className="sa-grid2">
        <div className="sa-panel">
          <div className="sa-panelHeader">
            <div>
              <div className="sa-panelTitle">Rendimiento (global)</div>
              <div className="sa-panelSub">Últimos 10 periodos • rendimiento & consistencia</div>
            </div>
            <div className="sa-panelActions">
              <select className="sa-select" defaultValue="10d">
                <option value="10d">Últimos 10 días</option>
                <option value="30d">Últimos 30 días</option>
              </select>
            </div>
          </div>

          <MiniChart points={chartPoints} color="#2563EB" />
          <div className="sa-kpis">
            <div className="sa-kpi">
              <div className="sa-kpiLabel">SLA</div>
              <div className="sa-kpiValue">94.2%</div>
              <div className="sa-kpiHint">Objetivo 92%</div>
            </div>
            <div className="sa-kpi">
              <div className="sa-kpiLabel">Latencia</div>
              <div className="sa-kpiValue">182ms</div>
              <div className="sa-kpiHint">Estable</div>
            </div>
            <div className="sa-kpi">
              <div className="sa-kpiLabel">Éxito</div>
              <div className="sa-kpiValue">99.1%</div>
              <div className="sa-kpiHint">Operaciones limpias</div>
            </div>
          </div>
        </div>

        <div className="sa-panel">
          <div className="sa-panelHeader">
            <div>
              <div className="sa-panelTitle">Estadísticas financieras</div>
              <div className="sa-panelSub">Ingresos, costos y margen (mock)</div>
            </div>
            <div className="sa-panelActions">
              <button type="button" className="sa-btn sa-btnGhost" onClick={() => setOpenModal(true)}>
                Ver auditoría
              </button>
            </div>
          </div>

          <div className="sa-finGrid">
            <div className="sa-finItem">
              <div className="sa-finLabel">Ingresos</div>
              <div className="sa-finValue sa-finPositive">$ 238,420</div>
              <div className="sa-finHint">+6.4% MoM</div>
            </div>
            <div className="sa-finItem">
              <div className="sa-finLabel">Costos</div>
              <div className="sa-finValue sa-finNeutral">$ 97,680</div>
              <div className="sa-finHint">-1.1% MoM</div>
            </div>
            <div className="sa-finItem">
              <div className="sa-finLabel">Margen</div>
              <div className="sa-finValue sa-finPositive">59.1%</div>
              <div className="sa-finHint">Optimización</div>
            </div>
          </div>

          <div className="sa-progressRow">
            <div className="sa-progressTop">
              <div className="sa-progressLabel">Objetivo de automatización</div>
              <div className="sa-progressMeta">72% completado</div>
            </div>
            <div className="sa-progressTrack">
              <div className="sa-progressFill" style={{ width: '72%' }} />
            </div>
          </div>
        </div>
      </section>

      <section className="sa-grid2">
        <div className="sa-panel">
          <div className="sa-panelHeader">
            <div>
              <div className="sa-panelTitle">Actividad reciente</div>
              <div className="sa-panelSub">Auditoría y cambios en tiempo real (mock)</div>
            </div>
          </div>

          <DataTable rows={recent} />
        </div>

        <div className="sa-panel">
          <div className="sa-panelHeader">
            <div>
              <div className="sa-panelTitle">Monitoreo en tiempo real</div>
              <div className="sa-panelSub">Operaciones + seguridad</div>
            </div>
          </div>

          <div className="sa-liveList">
            {[
              { kind: 'positive', title: 'Integridad de inventario', meta: 'OK • Sin desvíos' },
              { kind: 'critical', title: 'Acceso anómalo detectado', meta: 'Bloqueo temporal (2 min)' },
              { kind: 'neutral', title: 'Procesos en cola', meta: '1,024 tareas • 6 en espera' },
              { kind: 'info', title: 'Sincronización de sedes', meta: 'Completado • 0 errores' },
            ].map((x, idx) => (
              <div key={idx} className={`sa-liveItem sa-live-${x.kind}`}>
                <div className="sa-liveDot" />
                <div>
                  <div className="sa-liveTitle">{x.title}</div>
                  <div className="sa-liveMeta">{x.meta}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="sa-rowBtns">
            <button type="button" className="sa-btn sa-btnPrimary" onClick={() => setOpenModal(true)}>
              Configurar seguridad
            </button>
            <button type="button" className="sa-btn sa-btnGhost" onClick={() => setOpenModal(true)}>
              Generar reporte
            </button>
          </div>
        </div>
      </section>
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
        { to: '/super-admin/auditoria', label: 'Auditoría', icon: 'activity' },
        { to: '/super-admin/seguridad', label: 'Seguridad', icon: 'lock' },
        { to: '/super-admin/usuarios', label: 'Usuarios', icon: 'users' },
        { to: '/super-admin/empresas', label: 'Empresas', icon: 'store' },

      ]}
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/auditoria"
          element={
            <div className="sa-stack">
              <div className="sa-panel">
                <div className="sa-panelHeader">
                  <div>
                    <div className="sa-panelTitle">Auditoría y registros</div>
                    <div className="sa-panelSub">Filtros, exportación y detalle (mock)</div>
                  </div>
                </div>
                <div className="sa-mutedBox">
                  Aquí iría la tabla de auditoría avanzada (acciones, entidad afectada, IP, dispositivo, hash, etc.).
                  <div className="sa-mutedActions">
                    <button type="button" className="sa-btn sa-btnPrimary">Exportar CSV</button>
                    <button type="button" className="sa-btn sa-btnGhost">Filtrar eventos</button>
                  </div>
                </div>
              </div>
            </div>
          }
        />
        <Route
          path="/seguridad"
          element={
            <div className="sa-stack">
              <div className="sa-panel">
                <div className="sa-panelHeader">
                  <div>
                    <div className="sa-panelTitle">Seguridad y accesos</div>
                    <div className="sa-panelSub">Roles, permisos, políticas globales (mock)</div>
                  </div>
                </div>
                <div className="sa-securityGrid">
                  <div className="sa-securityTile">
                    <div className="sa-securityTileTitle">Políticas globales</div>
                    <div className="sa-securityTileMeta">MFA • IP allowlist • Rate limit</div>
                    <div className="sa-securityTileHint">Estado: <Badge kind="positive">Activo</Badge></div>
                  </div>
                  <div className="sa-securityTile">
                    <div className="sa-securityTileTitle">Roles y permisos</div>
                    <div className="sa-securityTileMeta">Control granular por empresa/sede</div>
                    <div className="sa-securityTileHint">Estado: <Badge kind="neutral">OK</Badge></div>
                  </div>
                  <div className="sa-securityTile">
                    <div className="sa-securityTileTitle">Accesos sospechosos</div>
                    <div className="sa-securityTileMeta">Detección y bloqueo automático</div>
                    <div className="sa-securityTileHint">Estado: <Badge kind="critical">Crítico</Badge></div>
                  </div>
                </div>
              </div>
            </div>
          }
        />
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


