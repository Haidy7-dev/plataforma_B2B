import React from 'react'
import PremiumRoleLayout from '../../components/layout/PremiumRoleLayout.jsx'
import './LogisticaStyles.css'

const API_BASE = 'http://localhost:4000'

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

  return { request, loading, error }
}

function Toast({ message }) {
  if (!message) return null
  return (
    <div className="logi-topNotice" style={{ marginBottom: 10 }}>
      <div className="logi-topNoticeText">{message}</div>
    </div>
  )
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function statusVariant(estado = '') {
  const e = String(estado || '').toUpperCase()
  if (e === 'ENTREGADO') return 'success'
  if (e === 'PREPARADO') return 'info'
  return 'warning'
}

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

function clampPct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

function ProgressBar({ value }) {
  const pct = clampPct(value)
  return (
    <div className="logi-progressTrack">
      <div className="logi-progressFill" style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function LogisticaLayout() {
  const { request, loading, error } = useLogiApi()

  const [fecha, setFecha] = React.useState(getTodayIsoDate())
  const [reservas, setReservas] = React.useState([])
  const [savingId, setSavingId] = React.useState(null)

  const load = React.useCallback(async () => {
    const data = await request(`/logistica/reservas-checklist?fecha=${encodeURIComponent(fecha)}`)
    const list = Array.isArray(data?.reservations)
      ? data.reservations
      : (Array.isArray(data?.reservas) ? data.reservas : [])
    setReservas(list)
  }, [request, fecha])

  React.useEffect(() => {
    load().catch(() => {})
  }, [load])

  const updateDetalle = async (idDetalle, nextEstado) => {
    if (!idDetalle) return
    setSavingId(idDetalle)
    const snapshot = reservas

    try {
      // optimismo mínimo: solo recargar al final (rápido por diseño)
      await request(`/logistica/reservas-checklist/${idDetalle}/estado`, {
        method: 'PATCH',
        data: { estado_logistica: nextEstado }
      })
      await load()
    } catch (e) {
      setReservas(snapshot)
    } finally {
      setSavingId(null)
    }
  }

  const toggleCheckbox = (idDetalle, estadoActual, action) => {
    // Mapeo operativo:
    // - checkbox PREPARADO/CARGADO (agrupado): marca PREPARADO cuando está pendiente
    // - checkbox ENTREGADO: marca ENTREGADO y bloquea otros
    // action: 'PREPARADO' | 'ENTREGADO'
    if (action === 'ENTREGADO') {
      const next = estadoActual === 'ENTREGADO' ? 'PREPARADO' : 'ENTREGADO'
      updateDetalle(idDetalle, next)
      return
    }

    // PREPARADO: si está ENTREGADO, no permite desmarcar (operativa)
    if (String(estadoActual || '').toUpperCase() === 'ENTREGADO') return

    const next = estadoActual === 'PREPARADO' ? 'PENDIENTE' : 'PREPARADO'
    updateDetalle(idDetalle, next)
  }

  return (
    <PremiumRoleLayout
      title="LOGÍSTICA"
      roleLabel="Ejecución de reservas"
      links={[{ to: '/logistica', label: 'Inicio' }]}
    >
      <div className="logi-shell">
        <Toast message={error ? `Error: ${error}` : ''} />

        <div className="logi-panel">
          <div className="logi-panelHeader">
            <div>
              <div className="logi-panelTitle">Checklist Operativo</div>
              <div className="logi-panelSub">Solo visualización y ejecución. Marca recursos como preparados/entregados.</div>
            </div>

            <div className="logi-panelActions">
              <input
                className="logi-select"
                style={{ padding: '10px 10px' }}
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                disabled={loading}
                aria-label="Seleccionar fecha"
              />
              <button className="logi-btn logi-btnGhost" onClick={() => load().catch(() => {})} disabled={loading}>
                Actualizar
              </button>
            </div>
          </div>

          {loading ? (
            <div className="logi-emptyStateCenter">Cargando reservas…</div>
          ) : reservas.length === 0 ? (
            <div className="logi-emptyStateCenter">No hay reservas para la fecha seleccionada.</div>
          ) : (
            <div className="logi-operationalList">
              {reservas.map((r) => (
                <section key={r.id_reserva} className="logi-reservaBlock">
                  <div className="logi-reservaHead">
                    <div>
                      <div className="logi-reservaTitle">Reserva #{r.id_reserva}</div>
                      <div className="logi-resSubLine">
                        {r.cliente} · {r.espacio}
                      </div>
                    </div>
                    <Badge variant={statusVariant(r.estado_logistica)}>{r.estado_logistica}</Badge>
                  </div>

                  <div className="logi-reservaMetaGrid">
                    <div>
                      <span className="logi-metaLabel">Fecha:</span> {String(r.fecha_evento || '').slice(0, 10)}
                    </div>
                    <div>
                      <span className="logi-metaLabel">Horario:</span> {String(r.hora_inicio || '').slice(0, 5)} - {String(r.hora_fin || '').slice(0, 5)}
                    </div>
                    <div>
                      <span className="logi-metaLabel">Progreso:</span> {clampPct(r.progreso)}%
                    </div>
                    <div>
                      <span className="logi-metaLabel">Recursos:</span> {r.total_recursos || 0}
                    </div>
                  </div>

                  <div className="logi-progressBlock">
                    <div className="logi-progressTop">
                      <div>
                        <div className="logi-progressTitle">Avance</div>
                        <div className="logi-progressSub">Se actualiza en tiempo real al marcar casillas.</div>
                      </div>
                      <div className="logi-progressValue">{clampPct(r.progreso)}%</div>
                    </div>
                    <ProgressBar value={r.progreso} />
                  </div>

                  <div className="logi-recursosList">
                    {(r.recursos || []).map((det) => {
                      const estado = String(det.estado_logistica || 'PENDIENTE').toUpperCase()
                      const isEntregado = estado === 'ENTREGADO'
                      const isPreparado = estado === 'PREPARADO' || estado === 'ENTREGADO'

                      return (
                        <div key={det.id_detalle} className="logi-recursoRow">
                          <div className="logi-recursoLeft">
                            <div className="logi-recursoNombre">
                              {det.cantidad} {det.recurso}
                            </div>
                            <div className="logi-recursoHint">
                              {isEntregado ? 'Entregado' : isPreparado ? 'Preparado' : 'Pendiente'}
                            </div>
                          </div>

                          <div className="logi-recursoActions">
                            <label className="logi-checkChip" title="Marcar preparado/cargado">
                              <input
                                type="checkbox"
                                checked={isPreparado}
                                disabled={savingId === det.id_detalle || isEntregado}
                                onChange={(e) => toggleCheckbox(det.id_detalle, estado, 'PREPARADO')}
                              />
                              <span>Preparado</span>
                            </label>

                            <label className="logi-checkChip" title="Marcar entregado">
                              <input
                                type="checkbox"
                                checked={isEntregado}
                                disabled={savingId === det.id_detalle}
                                onChange={(e) => toggleCheckbox(det.id_detalle, estado, 'ENTREGADO')}
                              />
                              <span>Entregado</span>
                            </label>
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
    </PremiumRoleLayout>
  )
}
