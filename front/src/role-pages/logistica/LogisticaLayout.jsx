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

function computeReservaProgressFromRecursos(recursos = []) {
  const estados = (Array.isArray(recursos) ? recursos : []).map((x) => String(x?.estado_logistica || 'PENDIENTE').toUpperCase())
  const total = estados.length
  const preparados = estados.filter((s) => s === 'PREPARADO' || s === 'ENTREGADO').length
  const entregados = estados.filter((s) => s === 'ENTREGADO').length

  let estado_logistica = 'PENDIENTE'
  if (total > 0 && entregados === total) estado_logistica = 'ENTREGADO'
  else if (total > 0 && preparados === total) estado_logistica = 'PREPARADO'

  const progreso = total > 0 ? Math.round((preparados / total) * 100) : 0

  return { estado_logistica, progreso, total_recursos: total }
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
    console.debug('[logi][load] fetching checklist', { fecha })
    const data = await request(`/logistica/reservas-checklist?fecha=${encodeURIComponent(fecha)}`)
    const list = Array.isArray(data?.reservations)
      ? data.reservations
      : (Array.isArray(data?.reservas) ? data.reservas : [])
    console.debug('[logi][load] checklist received', { count: list.length, sample: list[0]?.id_reserva })

    // Asegurar forma consistente (evita render raro si backend manda tipos mixtos)
    const normalized = list.map((r) => ({
      ...r,
      id_reserva: Number(r.id_reserva),
      progreso: clampPct(r.progreso),
      total_recursos: Number(r.total_recursos || r.total_recursos === 0 ? r.total_recursos : 0),
      recursos: (Array.isArray(r.recursos) ? r.recursos : []).map((det) => ({
        ...det,
        id_detalle: Number(det.id_detalle),
        id_recurso: Number(det.id_recurso),
        cantidad: Number(det.cantidad || 0),
        recurso: String(det.recurso || ''),
        estado_logistica: String(det.estado_logistica || 'PENDIENTE').toUpperCase()
      }))
    }))

    setReservas(normalized)
  }, [request, fecha])

  React.useEffect(() => {
    load().catch((e) => {
      console.error('[logi][load] failed', e)
    })
  }, [load])

  const updateDetalle = React.useCallback(
    async (idDetalle, nextEstado) => {
      if (!idDetalle) return

      const idDetalleNum = Number(idDetalle)
      const estadoNext = String(nextEstado || '').toUpperCase()

      console.debug('[logi][patch] start', { idDetalle: idDetalleNum, estado_logistica: estadoNext })

      setSavingId(idDetalleNum)

      // Optimistic update (sin recargar página)
      // Snapshot deep-ish por id_detalle para poder revertir (tomado del estado actual)
      const snapshot = reservas.map((r) => ({
        ...r,
        recursos: (Array.isArray(r.recursos) ? r.recursos : []).map((det) => ({ ...det }))
      }))

      setReservas((prev) => {
        const nextReservas = prev.map((r) => {
          const recursos = (Array.isArray(r.recursos) ? r.recursos : []).map((det) => {
            if (Number(det.id_detalle) !== idDetalleNum) return det
            return { ...det, estado_logistica: estadoNext }
          })
          const { estado_logistica, progreso, total_recursos } = computeReservaProgressFromRecursos(recursos)
          return { ...r, recursos, estado_logistica, progreso, total_recursos }
        })
        return nextReservas
      })

      try {
        const payload = { estado_logistica: estadoNext }
        const serverData = await request(`/logistica/reservas-checklist/${idDetalleNum}/estado`, {
          method: 'PATCH',
          data: payload
        })
        console.debug('[logi][patch] ok', { idDetalle: idDetalleNum, serverData })

        // Reconciliación: asegurar estado con lo que devolvió el servidor
        setReservas((prev) => {
          const nextReservas = prev.map((r) => {
            const recursos = (Array.isArray(r.recursos) ? r.recursos : []).map((det) => {
              if (Number(det.id_detalle) !== idDetalleNum) return det
              return { ...det, estado_logistica: String(serverData?.item?.estado_logistica || estadoNext).toUpperCase() }
            })
            const { estado_logistica, progreso, total_recursos } = computeReservaProgressFromRecursos(recursos)
            return { ...r, recursos, estado_logistica, progreso, total_recursos }
          })
          return nextReservas
        })
      } catch (e) {
        console.error('[logi][patch] failed', {
          idDetalle: idDetalleNum,
          estado_logistica: estadoNext,
          message: String(e?.response?.data?.message || e?.message || e),
          responseData: e?.response?.data,
          stack: e?.stack
        })
        setReservas(snapshot)
      } finally {
        setSavingId(null)
      }
    },
    [request, reservas]
  )

  const toggleCheckbox = (idDetalle, estadoActual, action) => {
    const estadoActualNorm = String(estadoActual || 'PENDIENTE').toUpperCase()

    // Reglas para mantener consistencia con el UI:
    // - "Entregado" es (operativamente) irreversible: si ya está ENTREGADO, no hacemos nada.
    // - "Preparado" permite alternar PREPARADO <-> PENDIENTE, pero si está ENTREGADO no se puede desmarcar.
    if (action === 'ENTREGADO') {
      if (estadoActualNorm === 'ENTREGADO') return
      updateDetalle(idDetalle, 'ENTREGADO')
      return
    }

    // action !== 'ENTREGADO' => PREPARADO
    if (estadoActualNorm === 'ENTREGADO') return

    const next = estadoActualNorm === 'PREPARADO' ? 'PENDIENTE' : 'PREPARADO'
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
                <section key={`res-${r.id_reserva}`} className="logi-reservaBlock">
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
                        <div key={`det-${r.id_reserva}-${det.id_detalle}`} className="logi-recursoRow">
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
                                aria-label={`Preparado reserva ${r.id_reserva} detalle ${det.id_detalle}`}
                                type="checkbox"
                                checked={isPreparado}
                                disabled={savingId === det.id_detalle || isEntregado}
                                onClick={(e) => {
                                  // Evita que el último item/label ocasionalmente “pierda” el evento
                                  e.preventDefault()
                                  e.stopPropagation()
                                  toggleCheckbox(det.id_detalle, estado, 'PREPARADO')
                                }}
                              />
                              <span>Preparado</span>
                            </label>

                            <label className="logi-checkChip" title="Marcar entregado">
                              <input
                                aria-label={`Entregado reserva ${r.id_reserva} detalle ${det.id_detalle}`}
                                type="checkbox"
                                checked={isEntregado}
                                disabled={savingId === det.id_detalle}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  toggleCheckbox(det.id_detalle, estado, 'ENTREGADO')
                                }}
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
