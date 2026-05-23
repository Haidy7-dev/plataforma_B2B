import React, { useCallback } from 'react'
import RoleLayout from '../../components/layout/RoleLayout.jsx'
import { Route, Routes } from 'react-router-dom'
import './LogisticaStyles.css'








function Proximos() {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Logística</h2>
      <p>Eventos próximos y listas de preparación (solo lectura, mock).</p>
    </div>
  )
}

function Icon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg'
  }

  switch (name) {
    case 'route':
      return (
        <svg {...common} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19l6-6" />
          <path d="M10 13l4 4" />
          <path d="M14 17l6-6" />
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="6" r="2" />
        </svg>
      )
    case 'truck':
      return (
        <svg {...common} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7h11v10H3z" />
          <path d="M14 10h4l3 3v4h-7z" />
          <circle cx="7" cy="19" r="2" />
          <circle cx="18" cy="19" r="2" />
        </svg>
      )
    case 'package':
      return (
        <svg {...common} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8l-9-5-9 5 9 5 9-5z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </svg>
      )
    case 'alert':
      return (
        <svg {...common} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10 3h4l8 18H2L10 3z" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      )
    default:
      return (
        <svg {...common} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
        </svg>
      )
  }
}

function Badge({ variant, children }) {
  const cls = {
    success: 'logi-badge logi-badge-success',
    danger: 'logi-badge logi-badge-danger',
    warning: 'logi-badge logi-badge-warning',
    neutral: 'logi-badge logi-badge-neutral'
  }[variant] || 'logi-badge logi-badge-neutral'

  return <span className={cls}>{children}</span>
}

function ProgressBar({ value, color }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="logi-progressTrack">
      <div
        className="logi-progressFill"
        style={{ width: `${v}%`, background: color }}
      />
    </div>
  )
}

function MockMap({ markers }) {
  return (
    <div className="logi-mapMock" aria-label="Mapa en tiempo real (mock)">
      <div className="logi-mapGrid" />
      <div className="logi-mapLegend">
        <div className="logi-mapLegendTitle">Mapa operativo</div>
        <div className="logi-mapLegendMeta">Actualización en vivo (mock)</div>
      </div>

      {markers.map((m) => (
        <div
          key={m.id}
          className={`logi-mapDot ${m.tone}`}
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
          title={`${m.label} - ${m.status}`}
        />
      ))}
    </div>
  )
}

function Timeline({ items }) {
  return (
    <div className="logi-timeline">
      {items.map((it, idx) => (
        <div key={idx} className="logi-tlItem">
          <div className={`logi-tlDot ${it.tone}`} />
          <div className="logi-tlContent">
            <div className="logi-tlTitle">{it.title}</div>
            <div className="logi-tlMeta">{it.meta}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function useLiveLogisticsData() {
  const API_BASE = 'http://localhost:4000'

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)

  const [prepList, setPrepList] = React.useState([])

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await import('axios').then(({ default: axios }) =>
        axios.get(`${API_BASE}/logistica/preparation-list`)
      )
      setPrepList(res?.data?.list || [])
    } catch (e) {
      // fallback mock si el endpoint no existe o falla
      setError(String(e?.response?.data?.message || e?.message || e))
      setPrepList([
        { id: 'prep-1', eventId: 'ev-1', item: 'Sillas', qty: 50, status: 'Pendiente' },
        { id: 'prep-2', eventId: 'ev-2', item: 'Mesas', qty: 12, status: 'En ruta' },
        { id: 'prep-3', eventId: 'ev-3', item: 'Equipo audio', qty: 4, status: 'Incidencia' }
      ])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchData()

    const t = setInterval(() => {
      fetchData()
    }, 10000)

    return () => clearInterval(t)
  }, [fetchData])

  return { loading, error, prepList }
}

function DashboardLogistica() {
  const { loading, error, prepList } = useLiveLogisticsData()

  const activeDeliveries = prepList.filter((p) =>
    ['En ruta', 'Pendiente'].includes(p.status)
  ).length

  const pendingOrders = prepList.filter((p) => p.status === 'Pendiente').length

  const incidents = prepList.filter((p) => p.status === 'Incidencia').length

  const vehiclesAvailable = 6 // mock, reemplazable con endpoint real

  const avgDeliveryMinutes = 42 // mock

  const avgProgress = Math.round((avgDeliveryMinutes / 90) * 100)

  const markers = React.useMemo(() => {
    const base = [
      { id: 'm1', label: 'Vehículo A', status: 'En ruta', tone: 'positive', x: 28, y: 38 },
      { id: 'm2', label: 'Vehículo B', status: 'Pendiente', tone: 'info', x: 52, y: 56 },
      { id: 'm3', label: 'Vehículo C', status: 'Incidencia', tone: 'critical', x: 70, y: 30 }
    ]
    return base
  }, [])

  const timelineItems = React.useMemo(() => {
    const now = new Date()
    const fmt = (d) => {
      try {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      } catch {
        return String(d)
      }
    }

    return [
      { tone: 'critical', title: 'Incidencia registrada', meta: `Última actualización ${fmt(now)}` },
      { tone: 'info', title: 'Asignación de conductores', meta: `Control de cola (mock) • ${fmt(new Date(now.getTime() - 1000 * 60 * 18))}` },
      { tone: 'positive', title: 'Entregas en tránsito', meta: `Rutas monitorizadas (mock) • ${fmt(new Date(now.getTime() - 1000 * 60 * 42))}` }
    ]
  }, [])

  return (
    <div className="logi-shell">
      <div className="logi-topNotice">
        <div className="logi-topNoticeLeft">
          <div className="logi-livePill">
            <span className="logi-liveDot" /> LIVE
          </div>
          <div className="logi-topNoticeText">
            Operación, seguimiento y control logístico en tiempo real
          </div>
        </div>
        <div className="logi-topNoticeRight">
          {loading ? (
            <Badge variant="neutral">Sincronizando…</Badge>
          ) : error ? (
            <Badge variant="warning">Fallback activo</Badge>
          ) : (
            <Badge variant="success">OK</Badge>
          )}
        </div>
      </div>

      <div className="logi-grid2">
        <div className="logi-panel">
          <div className="logi-panelHeader">
            <div>
              <div className="logi-panelTitle">Mapa en tiempo real</div>
              <div className="logi-panelSub">Rutas y estado de vehículos (mock visual)</div>
            </div>
            <div className="logi-panelActions">
              <select className="logi-select" defaultValue="all">
                <option value="all">Todas</option>
                <option value="active">Activas</option>
                <option value="incidents">Incidencias</option>
              </select>
            </div>
          </div>
          <MockMap markers={markers} />

          <div className="logi-kpiRow">
            <div className="logi-kpi">
              <div className="logi-kpiLabel">Entregas activas</div>
              <div className="logi-kpiValue">{activeDeliveries}</div>
              <div className="logi-kpiHint">En curso / en cola</div>
            </div>
            <div className="logi-kpi">
              <div className="logi-kpiLabel">Vehículos disponibles</div>
              <div className="logi-kpiValue">{vehiclesAvailable}</div>
              <div className="logi-kpiHint">Asignación dinámica</div>
            </div>
            <div className="logi-kpi">
              <div className="logi-kpiLabel">Pedidos pendientes</div>
              <div className="logi-kpiValue">{pendingOrders}</div>
              <div className="logi-kpiHint">Preparación</div>
            </div>
          </div>
        </div>

        <div className="logi-panel">
          <div className="logi-panelHeader">
            <div>
              <div className="logi-panelTitle">Alertas logísticas</div>
              <div className="logi-panelSub">Incidencias y control SLA</div>
            </div>
            <div>
              <Badge variant="danger">{incidents} incidencias</Badge>
            </div>
          </div>

          <div className="logi-alertList">
            <div className="logi-alertItem">
              <div className="logi-alertIcon logi-alertIconDanger">●</div>
              <div>
                <div className="logi-alertTitle">Incidencias activas</div>
                <div className="logi-alertMeta">Priorización roja para resolver</div>
              </div>
            </div>

            <div className="logi-alertItem">
              <div className="logi-alertIcon logi-alertIconWarning">●</div>
              <div>
                <div className="logi-alertTitle">Riesgo de demora</div>
                <div className="logi-alertMeta">Monitoreo continuo (mock)</div>
              </div>
            </div>

            <div className="logi-alertItem">
              <div className="logi-alertIcon logi-alertIconPositive">●</div>
              <div>
                <div className="logi-alertTitle">Operación estable</div>
                <div className="logi-alertMeta">Flujo sin bloqueos (mock)</div>
              </div>
            </div>
          </div>

          <div className="logi-progressBlock">
            <div className="logi-progressTop">
              <div>
                <div className="logi-progressTitle">Tiempo promedio de entrega</div>
                <div className="logi-progressSub">Objetivo operativo: ≤ 60 min</div>
              </div>
              <div className="logi-progressValue">{avgDeliveryMinutes} min</div>
            </div>
            <ProgressBar value={avgProgress} color="linear-gradient(90deg, #F97316, #22C55E)" />
            <div className="logi-progressHint">Indicador visual de rendimiento</div>
          </div>
        </div>
      </div>

      <div className="logi-grid2 logi-bottomGrid">
        <div className="logi-panel">
          <div className="logi-panelHeader">
            <div>
              <div className="logi-panelTitle">Tabla operativa</div>
              <div className="logi-panelSub">Pedidos en seguimiento y asignación (datos del backend)</div>
            </div>
            <div className="logi-panelActions">
              <button className="logi-btn logi-btnGhost" type="button">
                Actualizar
              </button>
            </div>
          </div>

          <div className="logi-tableWrap">
            <table className="logi-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Ítem</th>
                  <th>Cantidad</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="logi-tdMuted">Cargando…</td>
                  </tr>
                ) : prepList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="logi-tdMuted">No hay pedidos para mostrar.</td>
                  </tr>
                ) : (
                  prepList.map((p) => (
                    <tr key={p.id}>
                      <td className="logi-tdStrong">{p.eventId || p.id}</td>
                      <td>{p.item}</td>
                      <td>{p.qty}</td>
                      <td>
                        {p.status === 'Incidencia' ? (
                          <Badge variant="danger">Incidencia</Badge>
                        ) : p.status === 'En ruta' ? (
                          <Badge variant="success">En ruta</Badge>
                        ) : (
                          <Badge variant="warning">Pendiente</Badge>
                        )}
                      </td>
                      <td>
                        <button className="logi-btn logi-btnPrimary" type="button">
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="logi-panel">
          <div className="logi-panelHeader">
            <div>
              <div className="logi-panelTitle">Timeline de entregas</div>
              <div className="logi-panelSub">Historial operativo (mock + live)</div>
            </div>
            <div>
              <Badge variant="neutral">Últimas 24h</Badge>
            </div>
          </div>

          <Timeline items={timelineItems} />

          <div className="logi-rowBtns">
            <button className="logi-btn logi-btnPrimary" type="button">
              Registrar incidencia
            </button>
            <button className="logi-btn logi-btnGhost" type="button">
              Historial de operaciones
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LogisticaLayout() {
  return (
    <RoleLayout
      title="LOGÍSTICA"
      roleLabel="Operaciones en tiempo real"
      links={[
        { to: '/logistica', label: 'Dashboard' },
        { to: '/logistica/rutas', label: 'Gestión de rutas' },
        { to: '/logistica/seguimiento', label: 'Seguimiento de pedidos' },
        { to: '/logistica/transportes', label: 'Transportes' },
        { to: '/logistica/inventario', label: 'Inventario' },
        { to: '/logistica/incidencias', label: 'Incidencias' },
        { to: '/logistica/historial', label: 'Historial' }
      ]}
    >
      <Routes>
        <Route path="/" element={<DashboardLogistica />} />
        <Route path="rutas" element={<DashboardLogistica />} />
        <Route path="seguimiento" element={<DashboardLogistica />} />
        <Route path="transportes" element={<DashboardLogistica />} />
        <Route path="inventario" element={<DashboardLogistica />} />
        <Route path="incidencias" element={<DashboardLogistica />} />
        <Route path="historial" element={<DashboardLogistica />} />
      </Routes>
    </RoleLayout>
  )
}


export function LogisticaRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Proximos />} />
    </Routes>
  )
}


