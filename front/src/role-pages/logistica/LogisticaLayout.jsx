import React from 'react'
import PremiumRoleLayout from '../../components/layout/PremiumRoleLayout.jsx'
import { Route, Routes } from 'react-router-dom'
import './LogisticaStyles.css'

const API_BASE = 'http://localhost:4000'


function Badge({ variant, children }) {
  const cls = {
    success: 'logi-badge logi-badge-success',
    info: 'logi-badge logi-badge-info',
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
      console.log('[logistica][frontend] request', {
        path,
        method: options?.method || 'GET',
        hasToken: Boolean(token)
      })
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
      console.error('[logistica][frontend] request error', {
        path,
        method: options?.method || 'GET',
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message
      })
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
  const { request, loading, error, setError } = useLogiApi()
  const [rows, setRows] = React.useState([])
  const [savingId, setSavingId] = React.useState(null)
  const [q, setQ] = React.useState('')

  const load = React.useCallback(async () => {
    try {
      const data = await request('/logistica/reservas-checklist')
      console.log('[logistica][frontend] /logistica/reservas-checklist response', data)
      console.log('[logistica][frontend] checklist response keys', Object.keys(data || {}))
      const reservations = Array.isArray(data?.reservations)
        ? data.reservations
        : (Array.isArray(data?.reservas) ? data.reservas : [])
      console.log('[logistica][frontend] reservations length', reservations.length)
      if (reservations.length) {
        console.log('[logistica][frontend] sample reservation', reservations[0])
      }
      setRows(reservations)
    } catch (e) {
      console.error('[logistica][frontend] error loading checklist', {
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data
      })
      throw e
    }
  }, [request])

  React.useEffect(() => {
    load().catch(() => {})
  }, [load])

  const updateEstado = async (idDetalle, estado, applyOptimistic) => {
    setSavingId(idDetalle)
    setError('')
    const snapshot = rows
    if (typeof applyOptimistic === 'function') {
      applyOptimistic()
      console.log('[logistica][frontend] optimistic update', { idDetalle, estado })
    }
    try {
      await request(`/logistica/reservas-checklist/${idDetalle}/estado`, {
        method: 'PATCH',
        data: { estado_logistica: estado }
      })
      console.log('[logistica][frontend] estado actualizado', { idDetalle, estado })
      await load()
    } catch (e) {
      console.error('[logistica][frontend] error updating estado', {
        idDetalle,
        estado,
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data
      })
      setRows(snapshot)
    } finally {
      setSavingId(null)
    }
  }

  const handleTogglePrepared = (reservaId, detalle, checked) => {
    const nextEstado = checked ? 'PREPARADO' : 'PENDIENTE'
    updateEstado(detalle.id_detalle, nextEstado, () => {
      setRows((prev) =>
        prev.map((r) =>
          r.id_reserva !== reservaId
            ? r
            : {
              ...r,
              recursos: r.recursos.map((it) =>
                it.id_detalle === detalle.id_detalle
                  ? { ...it, estado_logistica: nextEstado }
                  : it
              )
            }
        )
      )
    })
  }

  const handleChangeEstado = (reservaId, detalle, estado) => {
    updateEstado(detalle.id_detalle, estado, () => {
      setRows((prev) =>
        prev.map((r) =>
          r.id_reserva !== reservaId
            ? r
            : {
              ...r,
              recursos: r.recursos.map((it) =>
                it.id_detalle === detalle.id_detalle
                  ? { ...it, estado_logistica: estado }
                  : it
              )
            }
        )
      )
    })
  }

  const filtered = rows.filter((r) => {
    const text = `${r.id_reserva} ${r.cliente} ${r.espacio} ${r.fecha_evento}`.toLowerCase()
    return text.includes(String(q || '').toLowerCase())
  })

  return (
    <div className="logi-shell">
      <Toast message={error ? `Error: ${error}` : ''} />
      <div className="logi-panel">
        <div className="logi-panelHeader">
          <div>
            <div className="logi-panelTitle">Checklist Operativo de Reservas</div>
            <div className="logi-panelSub">Listado logístico por reserva con recursos, cantidades y estados</div>
          </div>
          <div className="logi-panelActions">
            <input
              className="logi-select"
              placeholder="Buscar reserva, cliente o espacio..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="logi-btn logi-btnGhost" onClick={() => load().catch(() => {})}>
              Actualizar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="logi-emptyStateCenter">Cargando checklist logístico…</div>
        ) : filtered.length === 0 ? (
          <div className="logi-emptyStateCenter">No hay reservas pendientes de logística</div>
        ) : (
          <div className="logi-operationalList">
            {filtered.map((r) => (
              <section key={r.id_reserva} className="logi-reservaBlock">
                <div className="logi-reservaHead">
                  <div className="logi-reservaTitle">RESERVA #{r.id_reserva}</div>
                  <Badge
                    variant={
                      r.estado_logistica === 'ENTREGADO'
                        ? 'success'
                        : r.estado_logistica === 'PREPARADO'
                          ? 'info'
                          : 'warning'
                    }
                  >
                    {r.estado_logistica}
                  </Badge>
                </div>

                <div className="logi-reservaMetaGrid">
                  <div><span className="logi-metaLabel">Cliente:</span> {r.cliente}</div>
                  <div><span className="logi-metaLabel">Espacio:</span> {r.espacio}</div>
                  <div><span className="logi-metaLabel">Fecha:</span> {String(r.fecha_evento).slice(0, 10)}</div>
                  <div>
                    <span className="logi-metaLabel">Horario:</span> {String(r.hora_inicio || '').slice(0, 5)} - {String(r.hora_fin || '').slice(0, 5)}
                  </div>
                </div>

                <div className="logi-recursosList">
                  {(r.recursos || []).map((det) => {
                    const checked = det.estado_logistica === 'PREPARADO' || det.estado_logistica === 'ENTREGADO'
                    return (
                        <div key={det.id_detalle} className="logi-recursoRow">
                        <label className="logi-recursoCheck">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => handleTogglePrepared(r.id_reserva, det, e.target.checked)}
                            disabled={savingId === det.id_detalle || det.estado_logistica === 'ENTREGADO'}
                          />
                          <span>{det.cantidad} {det.recurso}</span>
                        </label>

                        <div className="logi-recursoActions">
                          <select
                            className="logi-select logi-stateSelect"
                            value={det.estado_logistica}
                            onChange={(e) => handleChangeEstado(r.id_reserva, det, e.target.value)}
                            disabled={savingId === det.id_detalle}
                          >
                            <option value="PENDIENTE">PENDIENTE</option>
                            <option value="PREPARADO">PREPARADO</option>
                            <option value="ENTREGADO">ENTREGADO</option>
                          </select>
                          <span className={`logi-statusPill logi-status-${String(det.estado_logistica || '').toLowerCase()}`}>
                            {det.estado_logistica}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
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
