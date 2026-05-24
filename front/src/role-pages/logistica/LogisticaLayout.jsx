import React from 'react'
import PremiumRoleLayout from '../../components/layout/PremiumRoleLayout.jsx'
import { Route, Routes } from 'react-router-dom'
import './LogisticaStyles.css'

const API_BASE = 'http://localhost:4000'


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
  const [activeTab, setActiveTab] = React.useState('activa')
  const [inventory, setInventory] = React.useState([
    { id: 1, sku: 'INV-001', name: 'Tarima estándar', qty: 24, status: 'pendiente' },
    { id: 2, sku: 'INV-002', name: 'Caja térmica', qty: 12, status: 'listo' },
    { id: 3, sku: 'INV-003', name: 'Etiqueta QR', qty: 180, status: 'pendiente' },
    { id: 4, sku: 'INV-004', name: 'Precinto de seguridad', qty: 60, status: 'listo' }
  ])
  const [sentBatches, setSentBatches] = React.useState([])
  const [reservations, setReservations] = React.useState([
    { id: 'RES-100', resource: 'Muelle 2', date: 'Hoy · 15:00', status: 'disponible', holdUntil: null },
    { id: 'RES-101', resource: 'Camión FTL-7', date: 'Hoy · 17:30', status: 'disponible', holdUntil: null },
    { id: 'RES-102', resource: 'Zona de picking B', date: 'Mañana · 08:00', status: 'disponible', holdUntil: null }
  ])

  const upcomingEvents = [
    { id: 1, title: 'Despacho Ruta Norte', meta: 'Hoy · 16:00' },
    { id: 2, title: 'Corte de inventario', meta: 'Hoy · 18:30' },
    { id: 3, title: 'Consolidación de pedidos', meta: 'Mañana · 07:00' },
    { id: 4, title: 'Recepción proveedor primario', meta: 'Mañana · 09:30' }
  ]

  React.useEffect(() => {
    const timer = setInterval(() => {
      setReservations((prev) =>
        prev.map((res) => {
          if (res.status !== 'separado' || !res.holdUntil) return res
          if (res.holdUntil <= Date.now()) {
            return { ...res, status: 'disponible', holdUntil: null }
          }
          return res
        })
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const notifyBell = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent('logistica:inventory-pending'))
  }, [])

  const updateQty = (id, nextQty) => {
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const parsedQty = Math.max(0, Number(nextQty) || 0)
        if (parsedQty !== item.qty) {
          notifyBell()
          return { ...item, qty: parsedQty, status: 'pendiente' }
        }
        return item
      })
    )
  }

  const toggleReady = (id, checked) => {
    setInventory((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: checked ? 'listo' : 'pendiente' } : item
      )
    )
  }

  const sendReadyItems = () => {
    const readyItems = inventory.filter((it) => it.status === 'listo')
    if (readyItems.length === 0) return
    setSentBatches((prev) => [
      {
        id: `ENV-${Date.now()}`,
        sentAt: new Date().toLocaleString(),
        items: readyItems
      },
      ...prev
    ])
    setInventory((prev) => prev.map((it) => (it.status === 'listo' ? { ...it, status: 'enviado' } : it)))
    setActiveTab('historial')
  }

  const separateReservation = (id) => {
    const hold24h = Date.now() + 24 * 60 * 60 * 1000
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'separado', holdUntil: hold24h } : r))
    )
  }

  const confirmReservation = (id) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'confirmado', holdUntil: null } : r))
    )
  }

  const cancelReservation = (id) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'disponible', holdUntil: null } : r))
    )
  }

  const getCountdown = (holdUntil) => {
    if (!holdUntil) return '24:00:00'
    const diff = Math.max(0, holdUntil - Date.now())
    const h = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0')
    const m = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0')
    const s = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  return (
    <div className="logi-shell">
      <div className="logi-mainGrid">
        <div className="logi-panel">
          <div className="logi-panelHeader">
            <div>
              <div className="logi-panelTitle">Checklist de Alistamiento</div>
              <div className="logi-panelSub">Preparación activa de inventario por recurso</div>
            </div>
            <div className="logi-inlineTabs">
              <button className={`logi-miniTab ${activeTab === 'activa' ? 'isActive' : ''}`} onClick={() => setActiveTab('activa')}>Preparación activa</button>
              <button className={`logi-miniTab ${activeTab === 'historial' ? 'isActive' : ''}`} onClick={() => setActiveTab('historial')}>Consultar listas de preparación</button>
            </div>
          </div>

          {activeTab === 'activa' ? (
            <div className="logi-checklist">
              {inventory.map((item) => (
                <div key={item.id} className="logi-checkItem">
                  <label className="logi-checkLeft">
                    <input
                      type="checkbox"
                      checked={item.status === 'listo'}
                      onChange={(e) => toggleReady(item.id, e.target.checked)}
                      disabled={item.status === 'enviado'}
                    />
                    <div>
                      <div className="logi-checkTitle">{item.name}</div>
                      <div className="logi-checkMeta">{item.sku}</div>
                    </div>
                  </label>
                  <div className="logi-checkRight">
                    <input
                      className="logi-qtyInput"
                      type="number"
                      min="0"
                      value={item.qty}
                      onChange={(e) => updateQty(item.id, e.target.value)}
                    />
                    <Badge variant={item.status === 'listo' ? 'success' : item.status === 'enviado' ? 'neutral' : 'warning'}>
                      {item.status === 'listo' ? 'Listo' : item.status === 'enviado' ? 'Enviado' : 'Pendiente'}
                    </Badge>
                  </div>
                </div>
              ))}
              <div className="logi-rowBtns">
                <button className="logi-btn logi-btnPrimary" onClick={sendReadyItems}>Enviar lo que está listo</button>
              </div>
            </div>
          ) : (
            <div className="logi-historyList">
              {sentBatches.length === 0 ? (
                <div className="logi-emptyState">Sin envíos registrados aún.</div>
              ) : sentBatches.map((batch) => (
                <div key={batch.id} className="logi-historyCard">
                  <div className="logi-historyHead">
                    <span>{batch.id}</span>
                    <span>{batch.sentAt}</span>
                  </div>
                  <ul>
                    {batch.items.map((it) => (
                      <li key={`${batch.id}-${it.id}`}>{it.name} · {it.qty} uds</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="logi-panel">
          <div className="logi-panelHeader">
            <div>
              <div className="logi-panelTitle">Gestión de Reservas y Bloqueos</div>
              <div className="logi-panelSub">Bloqueo temporal de 24 horas con confirmación</div>
            </div>
          </div>
          <div className="logi-reservationList">
            {reservations.map((res) => (
              <div key={res.id} className="logi-resCard">
                <div className="logi-resTop">
                  <div>
                    <div className="logi-resTitle">{res.resource}</div>
                    <div className="logi-resMeta">{res.id} · {res.date}</div>
                  </div>
                  <Badge variant={res.status === 'confirmado' ? 'success' : res.status === 'separado' ? 'warning' : 'neutral'}>
                    {res.status}
                  </Badge>
                </div>

                {res.status === 'separado' ? (
                  <div className="logi-countdown">Expira en {getCountdown(res.holdUntil)}</div>
                ) : null}

                <div className="logi-resActions">
                  <button className="logi-btn logi-btnGhost" disabled={res.status !== 'disponible'} onClick={() => separateReservation(res.id)}>Separar</button>
                  <button className="logi-btn logi-btnPrimary" disabled={res.status === 'confirmado' || res.status === 'disponible'} onClick={() => confirmReservation(res.id)}>Confirmar</button>
                  <button className="logi-btn logi-btnGhost" disabled={res.status !== 'separado'} onClick={() => cancelReservation(res.id)}>Cancelar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="logi-panel logi-eventsPanel">
        <div className="logi-panelHeader">
          <div>
            <div className="logi-panelTitle">Eventos Próximos</div>
            <div className="logi-panelSub">Cronograma logístico inmediato</div>
          </div>
        </div>
        <div className="logi-eventList">
          {upcomingEvents.map((event, idx) => (
            <div key={event.id} className="logi-eventItem">
              <div className="logi-eventLine">
                <span className="logi-eventDot" />
                {idx < upcomingEvents.length - 1 ? <span className="logi-eventConnector" /> : null}
              </div>
              <div className="logi-eventContent">
                <div className="logi-eventTitle">{event.title}</div>
                <div className="logi-eventMeta">{event.meta}</div>
              </div>
            </div>
          ))}
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

function SeguimientoEventosMaterialesView() {
  const { request, loading, error } = useLogiApi()
  const [q, setQ] = React.useState('')
  const [rows, setRows] = React.useState([])
  const [materialsByReservation, setMaterialsByReservation] = React.useState({})

  const load = React.useCallback(async () => {
    const data = await request('/reservations/reservations')
    const mapped = (data?.reservations || []).map((r) => ({
      id: r.id_reserva,
      cliente: r.cliente || 'Cliente',
      evento: String(r.estado_evento || 'Evento'),
      recurso: r.espacio || 'Espacio',
      fechaHora: `${String(r.fecha_evento || '').slice(0, 10)} · ${String(r.hora_inicio || '').slice(0, 5)}`,
      status: String(r.estado_evento || '').toUpperCase(),
      materiales: []
    }))
    setRows(mapped)
  }, [request])

  React.useEffect(() => {
    load().catch(() => {})
  }, [load])

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true
    const text = `${r.id} ${r.cliente} ${r.evento} ${r.recurso}`.toLowerCase()
    return text.includes(q.toLowerCase())
  })

  const toggleMaterial = (rowId, materialId) => {
    setMaterialsByReservation((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [materialId]: !(prev[rowId] && prev[rowId][materialId])
      }
    }))
  }

  const separate = async (rowId) => {
    await request(`/reservations/reservations/${rowId}`, { method: 'PUT', data: { estado_evento: 'COTIZACION' } })
    load().catch(() => {})
  }

  const confirm = async (rowId) => {
    await request(`/reservations/reservations/${rowId}`, { method: 'PUT', data: { estado_evento: 'CONFIRMADO' } })
    load().catch(() => {})
  }

  return (
    <div className="logi-shell">
      <Toast message={error ? `Error: ${error}` : ''} />
      <div className="logi-panel">
        <div className="logi-panelHeader">
          <div>
            <div className="logi-panelTitle">Eventos Próximos y Materiales</div>
            <div className="logi-panelSub">Visualización de eventos programados, recursos apartados y control de materiales requeridos</div>
          </div>
          <div className="logi-panelActions">
            <input className="logi-select" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="logi-btn logi-btnGhost" onClick={() => load().catch(() => {})}>Actualizar</button>
          </div>
        </div>

        {loading ? (
          <div className="logi-emptyStateCenter">Cargando reservas…</div>
        ) : filtered.length === 0 ? (
          <div className="logi-emptyStateCenter">No hay reservas programadas en este momento</div>
        ) : (
          <div className="logi-tableWrap">
            <table className="logi-table">
              <thead>
                <tr>
                  <th>ID / Cliente</th>
                  <th>Evento y Recurso</th>
                  <th>Materiales Necesitados</th>
                  <th>Fecha y Hora</th>
                  <th>Estado y Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="logi-tdStrong">{`RSV-${r.id}`}</div>
                      <div className="logi-tdMuted">{r.cliente}</div>
                    </td>
                    <td>
                      <div className="logi-tdStrong">{r.evento}</div>
                      <div className="logi-tdMuted">{r.recurso}</div>
                    </td>
                    <td>
                      <div className="logi-materialsList">
                        {(r.materiales || []).length === 0 ? (
                          <span className="logi-tdMuted">Sin materiales asociados</span>
                        ) : r.materiales.map((m, idx) => {
                          const materialId = `${r.id}-${m.id_recurso || idx}`
                          const checked = Boolean(materialsByReservation[r.id]?.[materialId])
                          return (
                            <label key={materialId} className="logi-materialItem">
                              <input type="checkbox" checked={checked} onChange={() => toggleMaterial(r.id, materialId)} />
                              <span>{m.nombre || 'Material'}</span>
                            </label>
                          )
                        })}
                      </div>
                    </td>
                    <td>{r.fechaHora}</td>
                    <td>
                      <div className="logi-actionsCol">
                        <Badge variant={r.status === 'CONFIRMADO' ? 'success' : 'warning'}>{r.status || 'COTIZACION'}</Badge>
                        <div className="logi-inlineActions">
                          <button className="logi-btn logi-btnGhost" onClick={() => separate(r.id)}>Separar</button>
                          <button className="logi-btn logi-btnPrimary" onClick={() => confirm(r.id)}>Confirmar</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function InventarioView() {
  const { request, loading, error } = useLogiApi()
  const [rows, setRows] = React.useState([])

  const load = React.useCallback(async () => {
    const data = await request('/logistica/inventory')
    setRows(data.items || [])
  }, [request])

  React.useEffect(() => { load().catch(() => {}) }, [load])

  return (
    <div className="logi-shell">
      <Toast message={error ? `Error: ${error}` : ''} />
      <div className="logi-panel">
        <div className="logi-panelHeader">
          <div><div className="logi-panelTitle">Inventario</div><div className="logi-panelSub">Solo lectura · datos reales</div></div>
          <div className="logi-panelActions">
            <button className="logi-btn logi-btnGhost" onClick={() => load().catch(() => {})}>Actualizar</button>
          </div>
        </div>

        <div className="logi-tableWrap">
          <table className="logi-table">
            <thead><tr><th>ID</th><th>Producto</th><th>Categoría</th><th>Stock</th><th>Precio</th><th>Estado</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6}>Cargando…</td></tr> : rows.length === 0 ? <tr><td colSpan={6}>Sin inventario</td></tr> : rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td><td>{r.nombre}</td><td>{r.tipo}</td><td>{r.stock}</td><td>{r.precio}</td><td>{String(r.estado)}</td>
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
        { to: '/logistica', label: 'Inicio' }
      ]}
    >
      <Routes>
        <Route path="/" element={<DashboardLogistica />} />
        <Route path="rutas" element={<ModuleStub title="Gestión de rutas" endpoint="/logistica/routes" columns={[{ key: 'code', label: 'Código' }, { key: 'origin', label: 'Origen' }, { key: 'destination', label: 'Destino' }, { key: 'status', label: 'Estado' }, { key: 'driver', label: 'Conductor' }, { key: 'vehicle', label: 'Vehículo' }]} />} />
        <Route path="seguimiento" element={<SeguimientoEventosMaterialesView />} />
        <Route path="inventario" element={<InventarioView />} />
        <Route path="incidencias" element={<ModuleStub title="Incidencias" endpoint="/logistica/tickets" columns={[{ key: 'id', label: 'ID' }, { key: 'title', label: 'Título' }, { key: 'priority', label: 'Prioridad' }, { key: 'status', label: 'Estado' }, { key: 'assignedTo', label: 'Responsable' }]} />} />
        <Route path="historial" element={<ModuleStub title="Historial" endpoint="/logistica/history" columns={[{ key: 'module', label: 'Módulo' }, { key: 'action', label: 'Acción' }, { key: 'user', label: 'Usuario' }, { key: 'details', label: 'Detalle' }, { key: 'at', label: 'Fecha' }]} />} />
      </Routes>
    </PremiumRoleLayout>
  )
}
