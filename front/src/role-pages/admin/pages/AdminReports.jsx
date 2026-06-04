import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../../../auth/AuthContext.jsx'

const API_BASE = 'http://localhost:4000'

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('es-CO')
}

function formatMoney(value) {
  const n = Number(value || 0)
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

export default function AdminReports() {
  const { token } = useAuth() || {}
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState({
  incidencias: 0,
  cumplimiento: 0,
  totalReservas: 0,
  financieros: { PENDIENTE: 0, PARCIAL: 0, PAGADO: 0, DEUDA: 0 },
  unpaidReservations: [],
  pendingPayments: [],
  partialPayments: []
})

  useEffect(() => {
    if (!token) return

    async function load() {
      try {
        setLoading(true)
        setError('')

        const res = await axios.get(`${API_BASE}/admin/reports/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        })

        setData({
          incidencias: Number(res?.data?.incidencias || 0),
          cumplimiento: Number(res?.data?.cumplimiento || 0),
          totalReservas: Number(res?.data?.totalReservas || 0),
          financieros: {
            PENDIENTE: Number(res?.data?.financieros?.PENDIENTE || 0),
            PARCIAL: Number(res?.data?.financieros?.PARCIAL || 0),
            PAGADO: Number(res?.data?.financieros?.PAGADO || 0),
            DEUDA: Number(res?.data?.financieros?.DEUDA || 0)
          },
          unpaidReservations: Array.isArray(res?.data?.unpaidReservations) ? res.data.unpaidReservations : [],
          pendingPayments: Array.isArray(res?.data?.pendingPayments) ? res.data.pendingPayments : [],
          partialPayments: Array.isArray(res?.data?.partialPayments) ? res.data.partialPayments : []
        })
      } catch (e) {
        const status = e?.response?.status
        const message = e?.response?.data?.message || e?.message || 'Error cargando reportes'
        const detail = e?.response?.data?.error || e?.response?.data?.stack || null
        setError(
          status
            ? detail
              ? `${message} (HTTP ${status}): ${detail}`
              : `${message} (HTTP ${status})`
            : detail
              ? `${message}: ${detail}`
              : String(message)
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  const financialTotal = useMemo(
    () =>
      Number(data.financieros.PENDIENTE || 0) +
      Number(data.financieros.PARCIAL || 0) +
      Number(data.financieros.PAGADO || 0) +
      Number(data.financieros.DEUDA || 0),
    [data.financieros]
  )

  const [updatingEstados, setUpdatingEstados] = useState({})

  const updateEstadoFinanciero = async (id_reserva, estado_financiero) => {
    if (!id_reserva) return
    const key = String(id_reserva)

    setUpdatingEstados((prev) => ({ ...prev, [key]: true }))
    try {
      const res = await axios.put(
        `${API_BASE}/admin/reports/reservations/${id_reserva}/financiero`,
        { estado_financiero },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res?.data?.ok) throw new Error(res?.data?.message || 'No se pudo actualizar')

      // recargar para reflejar cambios
      const refreshed = await axios.get(`${API_BASE}/admin/reports/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setData({
  incidencias: Number(refreshed?.data?.incidencias || 0),
  cumplimiento: Number(refreshed?.data?.cumplimiento || 0),
  totalReservas: Number(refreshed?.data?.totalReservas || 0),
  financieros: {
    PENDIENTE: Number(refreshed?.data?.financieros?.PENDIENTE || 0),
    PARCIAL: Number(refreshed?.data?.financieros?.PARCIAL || 0),
    PAGADO: Number(refreshed?.data?.financieros?.PAGADO || 0),
    DEUDA: Number(refreshed?.data?.financieros?.DEUDA || 0)
  },
  unpaidReservations: Array.isArray(refreshed?.data?.unpaidReservations)
    ? refreshed.data.unpaidReservations
    : [],
  pendingPayments: Array.isArray(refreshed?.data?.pendingPayments)
    ? refreshed.data.pendingPayments
    : [],
  partialPayments: Array.isArray(refreshed?.data?.partialPayments)
    ? refreshed.data.partialPayments
    : []
})
      setError('')
    } catch (e) {
      const status = e?.response?.status
      const message = e?.response?.data?.message || e?.message || 'Error actualizando estado financiero'
      setError(status ? `${message} (HTTP ${status})` : String(message))
    } finally {
      setUpdatingEstados((prev) => ({ ...prev, [key]: false }))
    }
  }

  return (
    <div className="sa-content">
      <div className="sa-container">
        <div className="sa-stack">
          <div className="sa-panel">
            <div className="sa-panelHeader">
              <div>
                <div className="sa-panelTitle">Reportes</div>
                <div className="sa-panelSub">Métricas en tiempo real desde base de datos.</div>
              </div>
            </div>

            {error ? <div style={{ color: 'var(--warning)', fontWeight: 800 }}>⚠ {error}</div> : null}

            <div className="sa-grid4">
              <div className="sa-card sa-card-primary">
                <div className="sa-cardTop">
                  <div className="sa-cardTitle">Reservas sin pagar</div>
                  <div className="sa-cardIcon">📉</div>
                </div>
                <div className="sa-cardValue">{loading ? '...' : Number(data.financieros.PENDIENTE || 0) + Number(data.financieros.DEUDA || 0)}</div>
                <div className="sa-cardHint">PENDIENTE</div>
              </div>
             
              <div className="sa-card sa-card-indigo">
                <div className="sa-cardTop">
                  <div className="sa-cardTitle">Estados financieros</div>
                  <div className="sa-cardIcon">💳</div>
                </div>
                <div className="sa-cardValue">{loading ? '...' : financialTotal}</div>
                <div className="sa-cardHint">
                  Pendiente:{data.financieros.PENDIENTE} · Parcial:{data.financieros.PARCIAL} · Pagado:{data.financieros.PAGADO}
                </div>
              </div>
            
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="sa-panelTitle" style={{ marginBottom: 10 }}>Reservas sin pagar</div>
              <div className="sa-tableWrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Cliente</th>
                      <th>Espacio</th>
                      <th>Fecha</th>
                      <th>Estado evento</th>
                      <th>Estado financiero</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.unpaidReservations || []).length ? data.unpaidReservations.map((row) => {
                      const id = row.id_reserva
                      const isUpdating = Boolean(updatingEstados[String(id)])
                      const current = String(row.estado_financiero || '').toUpperCase()
                      return (
                        <tr key={`unpaid-${row.id_reserva}`}>
                          <td>{row.id_reserva}</td>
                          <td>{row.cliente || '-'}</td>
                          <td>{row.espacio || '-'}</td>
                          <td>{formatDate(row.fecha_evento)}</td>
                          <td>{row.estado_evento || '-'}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 900 }}>{current || '-'}</span>
                              <button
                                style={{ padding: '6px 10px', cursor: isUpdating ? 'not-allowed' : 'pointer' }}
                                disabled={isUpdating || current === 'PENDIENTE'}
                                onClick={() => updateEstadoFinanciero(id, 'PENDIENTE')}
                              >
                                PENDIENTE
                              </button>
                              <button
                                style={{ padding: '6px 10px', cursor: isUpdating ? 'not-allowed' : 'pointer' }}
                                disabled={isUpdating || current === 'PARCIAL'}
                                onClick={() => updateEstadoFinanciero(id, 'PARCIAL')}
                              >
                                PARCIAL
                              </button>
                              <button
                                style={{ padding: '6px 10px', cursor: isUpdating ? 'not-allowed' : 'pointer' }}
                                disabled={isUpdating || current === 'PAGADO'}
                                onClick={() => updateEstadoFinanciero(id, 'PAGADO')}
                              >
                                PAGADO
                              </button>
                            </div>
                          </td>
                          <td>{formatMoney(row.total)}</td>
                        </tr>
                      )
                    }) : (
                      <tr>
                        <td colSpan={7}><div className="sa-mutedBox">Sin reservas sin pagar.</div></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="sa-panelTitle" style={{ marginBottom: 10 }}>Pagos Pendientes</div>
              <div className="sa-tableWrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Fecha del Evento</th>
                      <th>Espacio</th>
                      <th>Estado de Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.pendingPayments || []).length ? (data.pendingPayments || []).map((row) => (
                      <tr key={`pending-${row.id_reserva ?? `${row.fecha_evento}-${row.espacio}`}`}>
                        <td>{formatDate(row.fecha_evento)}</td>
                        <td>{row.espacio || '-'}</td>
                        <td>{row.estado_financiero || '-'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3}><div className="sa-mutedBox">Sin pagos pendientes.</div></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="sa-panelTitle" style={{ marginBottom: 10 }}>Pagos Parciales</div>
              <div className="sa-tableWrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Fecha del Evento</th>
                      <th>Espacio</th>
                      <th>Estado de Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.partialPayments || []).length ? (data.partialPayments || []).map((row) => (
                      <tr key={`partial-${row.id_reserva ?? `${row.fecha_evento}-${row.espacio}`}`}>
                        <td>{formatDate(row.fecha_evento)}</td>
                        <td>{row.espacio || '-'}</td>
                        <td>{row.estado_financiero || '-'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3}><div className="sa-mutedBox">Sin pagos parciales.</div></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

