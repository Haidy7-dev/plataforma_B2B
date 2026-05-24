import React from 'react'
import PremiumRoleLayout from '../../components/layout/PremiumRoleLayout.jsx'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import './LogisticaStyles.css'

const API_BASE = 'http://localhost:4000'

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
      <div className="logi-progressFill" style={{ width: `${v}%`, background: color }} />
    </div>
  )
}

function Timeline({ items }) {
  return (
    <div className="logi-timeline">
      {items.map((it, idx) => (
        <div key={idx} className="logi-tlItem">
          <div className={`logi-tlDot ${it.tone || 'info'}`} />
          <div className="logi-tlContent">
            <div className="logi-tlTitle">{it.title}</div>
            <div className="logi-tlMeta">{it.meta}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function useLogiApi() {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const request = React.useCallback(async (path, options = {}) => {
    setLoading(true)
    setError('')
    try {
      const axios = (await import('axios')).default
      const token = localStorage.getItem('token')
      const res = await axios({
        baseURL: API_BASE,
        url: path,
        ...options,
        headers: {
          ...(options.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })
      return res.data
    } catch (e) {
      const msg = String(e?.response?.data?.message || e?.message || 'Error de red')
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return { request, loading, error, setError }
}

function Toast({ message }) {
  if (!message) return null
  return (
    <div className="logi-topNotice" style={{ marginBottom: 10 }}>
      <div className="logi-topNoticeText">{message}</div>
    </div>
  )
}

function DashboardLogistica() {
  const nav = useNavigate()
  const { request, loading, error } = useLogiApi()
  const [dashboard, setDashboard] = React.useState(null)

  const load = React.useCallback(async () => {
    const data = await request('/logistica/dashboard')
    setDashboard(data)
  }, [request])

  React.useEffect(() => {
    load().catch(() => {})
    const t = setInterval(() => load().catch(() => {}), 10000)
    return () => clearInterval(t)
  }, [load])

  const kpis = dashboard?.kpis || {}
  const alerts = dashboard?.alerts || []

  const timelineItems = (dashboard?.livePanel || []).slice(0, 3).map((x) => ({
    tone: x.status === 'retrasada' ? 'critical' : x.status === 'en curso' ? 'positive' : 'info',
    title: `${x.code} · ${x.status}`,
    meta: `${x.driver} · ${x.vehicle} · ETA ${x.etaMinutes} min`
  }))

  return (
    <div className="logi-shell">
      <Toast message={error ? `Error: ${error}` : ''} />
      <div className="logi-topNotice">
        <div className="logi-topNoticeLeft">
          <div className="logi-livePill"><span className="logi-liveDot" /> LIVE</div>
          <div className="logi-topNoticeText">Operación, seguimiento y control logístico en tiempo real</div>
        </div>
        <div className="logi-topNoticeRight">
          {loading ? <Badge variant="neutral">Sincronizando…</Badge> : <Badge variant="success">OK</Badge>}
        </div>
      </div>

      <div className="logi-grid2">
        <div className="logi-panel">
          <div className="logi-panelHeader">
            <div>
              <div className="logi-panelTitle">KPIs dinámicos</div>
              <div className="logi-panelSub">Datos operativos simulados en tiempo real</div>
            </div>
          </div>
          <div className="logi-kpiRow">
            <button className="logi-kpi" onClick={() => nav('/logistica/rutas')}>
              <div className="logi-kpiLabel">Rutas activas</div>
              <div className="logi-kpiValue">{kpis.rutas_activas ?? 0}</div>
              <div className="logi-kpiHint">Ver gestión de rutas</div>
            </button>
            <button className="logi-kpi" onClick={() => nav('/logistica/seguimiento')}>
              <div className="logi-kpiLabel">Pedidos pendientes</div>
              <div className="logi-kpiValue">{kpis.pedidos_pendientes ?? 0}</div>
              <div className="logi-kpiHint">Ver seguimiento</div>
            </button>
            <button className="logi-kpi" onClick={() => nav('/logistica/inventario')}>
              <div className="logi-kpiLabel">Inventario bajo</div>
              <div className="logi-kpiValue">{kpis.inventario_bajo ?? 0}</div>
              <div className="logi-kpiHint">Ver inventario</div>
            </button>
          </div>
          <div className="logi-rowBtns">
            <Link className="logi-btn logi-btnPrimary" to="/logistica/incidencias">Ir a incidencias</Link>
            <Link className="logi-btn logi-btnGhost" to="/logistica/historial">Ver historial</Link>
          </div>
        </div>

        <div className="logi-panel">
          <div className="logi-panelHeader">
            <div>
              <div className="logi-panelTitle">Alertas logísticas</div>
              <div className="logi-panelSub">Panel LIVE funcional</div>
            </div>
          </div>
          <div className="logi-alertList">
            {alerts.length === 0 ? (
              <div className="logi-alertItem"><div className="logi-alertTitle">Sin alertas activas</div></div>
            ) : alerts.map((a, i) => (
              <div className="logi-alertItem" key={`${a.message}-${i}`}>
                <div className={`logi-alertIcon ${a.level === 'danger' ? 'logi-alertIconDanger' : 'logi-alertIconWarning'}`}>●</div>
                <div>
                  <div className="logi-alertTitle">{a.message}</div>
                  <div className="logi-alertMeta">Monitoreo dinámico</div>
                </div>
              </div>
            ))}
          </div>
          <div className="logi-progressBlock">
            <div className="logi-progressTop">
              <div>
                <div className="logi-progressTitle">Cumplimiento operativo</div>
                <div className="logi-progressSub">Indicador de performance</div>
              </div>
              <div className="logi-progressValue">{kpis.pedidos_entregados ?? 0}</div>
            </div>
            <ProgressBar value={Math.min(100, (kpis.pedidos_entregados || 0) * 10)} color="linear-gradient(90deg, #F97316, #22C55E)" />
          </div>
        </div>
      </div>

      <div className="logi-grid2 logi-bottomGrid">
        <div className="logi-panel">
          <div className="logi-panelHeader">
            <div>
              <div className="logi-panelTitle">LIVE operacional</div>
              <div className="logi-panelSub">Rutas monitoreadas en tiempo real</div>
            </div>
          </div>
          <div className="logi-tableWrap">
            <table className="logi-table">
              <thead><tr><th>Ruta</th><th>Conductor</th><th>Vehículo</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody>
                {(dashboard?.livePanel || []).map((r) => (
                  <tr key={r.id}>
                    <td className="logi-tdStrong">{r.code}</td>
                    <td>{r.driver}</td>
                    <td>{r.vehicle}</td>
                    <td><Badge variant={r.status === 'retrasada' ? 'danger' : r.status === 'en curso' ? 'success' : 'warning'}>{r.status}</Badge></td>
                    <td><Link className="logi-btn logi-btnPrimary" to="/logistica/rutas">Ver seguimiento</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="logi-panel">
          <div className="logi-panelHeader">
            <div><div className="logi-panelTitle">Timeline de entregas</div><div className="logi-panelSub">Navegación a detalles</div></div>
          </div>
          <Timeline items={timelineItems} />
        </div>
      </div>
    </div>
  )
}

function ModuleStub({ title, endpoint, columns }) {
  const { request, loading, error } = useLogiApi()
  const [rows, setRows] = React.useState([])
  const [q, setQ] = React.useState('')

  const load = React.useCallback(async () => {
    const data = await request(`${endpoint}${q ? `?q=${encodeURIComponent(q)}` : ''}`)
    setRows(data.items || [])
  }, [request, endpoint, q])

  React.useEffect(() => { load().catch(() => {}) }, [load])

  return (
    <div className="logi-shell">
      <Toast message={error ? `Error: ${error}` : ''} />
      <div className="logi-panel">
        <div className="logi-panelHeader">
          <div><div className="logi-panelTitle">{title}</div><div className="logi-panelSub">Módulo funcional conectado a API</div></div>
          <div className="logi-panelActions">
            <input className="logi-select" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="logi-btn logi-btnGhost" onClick={() => load().catch(() => {})}>Actualizar</button>
          </div>
        </div>
        <div className="logi-tableWrap">
          <table className="logi-table">
            <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={columns.length}>Cargando…</td></tr> : rows.length === 0 ? <tr><td colSpan={columns.length}>Sin datos</td></tr> : rows.map((r) => (
                <tr key={r.id || JSON.stringify(r)}>
                  {columns.map((c) => <td key={c.key}>{String(r[c.key] ?? '-')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function InventarioView() {
  const { request, loading, error } = useLogiApi()
  const [rows, setRows] = React.useState([])
  const [csvText, setCsvText] = React.useState('')
  const [preview, setPreview] = React.useState(null)

  const load = React.useCallback(async () => {
    const data = await request('/logistica/inventory')
    setRows(data.items || [])
  }, [request])

  React.useEffect(() => { load().catch(() => {}) }, [load])

  const doPreview = async () => {
    const p = await request('/logistica/inventory/import/preview', { method: 'POST', data: { csvText } })
    setPreview(p)
  }

  const doImport = async () => {
    if (!preview) return
    const validRows = (preview.rows || []).filter((r) => r.valid).map((r) => r.row)
    await request('/logistica/inventory/import/commit', { method: 'POST', data: { rows: validRows } })
    setPreview(null)
    setCsvText('')
    load().catch(() => {})
  }

  return (
    <div className="logi-shell">
      <Toast message={error ? `Error: ${error}` : ''} />
      <div className="logi-panel">
        <div className="logi-panelHeader">
          <div><div className="logi-panelTitle">Inventario</div><div className="logi-panelSub">CRUD + carga masiva CSV</div></div>
          <div className="logi-panelActions">
            <a className="logi-btn logi-btnGhost" href={`${API_BASE}/logistica/inventory/template.csv`} target="_blank" rel="noreferrer">Descargar plantilla CSV</a>
            <button className="logi-btn logi-btnGhost" onClick={() => load().catch(() => {})}>Actualizar</button>
          </div>
        </div>

        <div className="logi-panel" style={{ marginBottom: 12 }}>
          <div className="logi-panelTitle">Importar CSV</div>
          <div className="logi-panelSub" style={{ marginBottom: 8 }}>
            Formato esperado (alineado a base de datos): <b>sku,nombre_producto,categoria,descripcion,stock,stock_minimo,precio,proveedor,ubicacion,estado</b>
          </div>
          <textarea
            className="logi-select"
            style={{ width: '100%', minHeight: 120 }}
            placeholder={'Pega aquí contenido CSV...\nEjemplo:\nsku,nombre_producto,categoria,descripcion,stock,stock_minimo,precio,proveedor,ubicacion,estado\nSKU-001,Silla ergonómica,mobiliario,Silla para oficina,25,5,180.50,Proveedor Centro,Bodega A,activo'}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div className="logi-rowBtns">
            <button className="logi-btn logi-btnPrimary" onClick={() => doPreview().catch(() => {})}>Validar vista previa</button>
            <button className="logi-btn logi-btnGhost" disabled={!preview} onClick={() => doImport().catch(() => {})}>Importar válidos</button>
          </div>
          {preview ? <div className="logi-panelSub">Total: {preview.total} · Válidos: {preview.valid} · Errores: {preview.invalid}</div> : null}
        </div>

        <div className="logi-tableWrap">
          <table className="logi-table">
            <thead><tr><th>SKU</th><th>Producto</th><th>Categoría</th><th>Stock</th><th>Stock mínimo</th><th>Estado</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6}>Cargando…</td></tr> : rows.length === 0 ? <tr><td colSpan={6}>Sin inventario</td></tr> : rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.sku}</td><td>{r.nombre_producto}</td><td>{r.categoria}</td><td>{r.stock}</td><td>{r.stock_minimo}</td><td>{r.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function LogisticaLayout() {
  return (
    <PremiumRoleLayout
      title="LOGÍSTICA"
      roleLabel="Operaciones en tiempo real"
      links={[
        { to: '/logistica', label: 'Dashboard' },
        { to: '/logistica/rutas', label: 'Gestión de rutas' },
        { to: '/logistica/seguimiento', label: 'Seguimiento de pedidos' },
        { to: '/logistica/inventario', label: 'Inventario' },
        { to: '/logistica/incidencias', label: 'Incidencias' },
        { to: '/logistica/historial', label: 'Historial' }
      ]}
    >
      <Routes>
        <Route path="/" element={<DashboardLogistica />} />
        <Route path="rutas" element={<ModuleStub title="Gestión de rutas" endpoint="/logistica/routes" columns={[{ key: 'code', label: 'Código' }, { key: 'origin', label: 'Origen' }, { key: 'destination', label: 'Destino' }, { key: 'status', label: 'Estado' }, { key: 'driver', label: 'Conductor' }, { key: 'vehicle', label: 'Vehículo' }]} />} />
        <Route path="seguimiento" element={<ModuleStub title="Seguimiento de pedidos" endpoint="/logistica/orders" columns={[{ key: 'id', label: 'Pedido' }, { key: 'customerName', label: 'Cliente' }, { key: 'customerPhone', label: 'Teléfono' }, { key: 'status', label: 'Estado' }, { key: 'routeId', label: 'Ruta' }]} />} />
        <Route path="inventario" element={<InventarioView />} />
        <Route path="incidencias" element={<ModuleStub title="Incidencias" endpoint="/logistica/tickets" columns={[{ key: 'id', label: 'ID' }, { key: 'title', label: 'Título' }, { key: 'priority', label: 'Prioridad' }, { key: 'status', label: 'Estado' }, { key: 'assignedTo', label: 'Responsable' }]} />} />
        <Route path="historial" element={<ModuleStub title="Historial" endpoint="/logistica/history" columns={[{ key: 'module', label: 'Módulo' }, { key: 'action', label: 'Acción' }, { key: 'user', label: 'Usuario' }, { key: 'details', label: 'Detalle' }, { key: 'at', label: 'Fecha' }]} />} />
      </Routes>
    </PremiumRoleLayout>
  )
}
