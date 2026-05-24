import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState({
    incidencias: 0,
    cumplimiento: 0,
    totalReservas: 0,
    financieros: { PENDIENTE: 0, PARCIAL: 0, PAGADO: 0, DEUDA: 0 },
    unpaidReservations: [],
    upcomingEvents: []
  })

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError('')
        const res = await axios.get(`${API_BASE}/admin/reports/summary`)
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
          upcomingEvents: Array.isArray(res?.data?.upcomingEvents) ? res.data.upcomingEvents : []
        })
      } catch (e) {
        setError(String(e?.message || e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const financialTotal = useMemo(
    () =>
      Number(data.financieros.PENDIENTE || 0) +
      Number(data.financieros.PARCIAL || 0) +
      Number(data.financieros.PAGADO || 0) +
      Number(data.financieros.DEUDA || 0),
    [data.financieros]
  )

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
                <div className="sa-cardHint">PENDIENTE + DEUDA</div>
              </div>
              <div className="sa-card sa-card-success">
                <div className="sa-cardTop">
                  <div className="sa-cardTitle">Cumplimiento</div>
                  <div className="sa-cardIcon">✅</div>
                </div>
                <div className="sa-cardValue">{loading ? '...' : `${data.cumplimiento}%`}</div>
                <div className="sa-cardHint">FINALIZADO / total reservas</div>
              </div>
              <div className="sa-card sa-card-indigo">
                <div className="sa-cardTop">
                  <div className="sa-cardTitle">Estados financieros</div>
                  <div className="sa-cardIcon">💳</div>
                </div>
                <div className="sa-cardValue">{loading ? '...' : financialTotal}</div>
                <div className="sa-cardHint">
                  P:{data.financieros.PENDIENTE} · Pa:{data.financieros.PARCIAL} · Pg:{data.financieros.PAGADO} · D:{data.financieros.DEUDA}
                </div>
              </div>
              <div className="sa-card sa-card-critical">
                <div className="sa-cardTop">
                  <div className="sa-cardTitle">Incidencias</div>
                  <div className="sa-cardIcon">⚠️</div>
                </div>
                <div className="sa-cardValue">{loading ? '...' : data.incidencias}</div>
                <div className="sa-cardHint">Conteo real por empresa</div>
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
                    {(data.unpaidReservations || []).length ? data.unpaidReservations.map((row) => (
                      <tr key={`unpaid-${row.id_reserva}`}>
                        <td>{row.id_reserva}</td>
                        <td>{row.cliente || '-'}</td>
                        <td>{row.espacio || '-'}</td>
                        <td>{formatDate(row.fecha_evento)}</td>
                        <td>{row.estado_evento || '-'}</td>
                        <td>{row.estado_financiero || '-'}</td>
                        <td>{formatMoney(row.total)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7}><div className="sa-mutedBox">Sin reservas sin pagar.</div></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="sa-panelTitle" style={{ marginBottom: 10 }}>Eventos próximos</div>
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
                    {(data.upcomingEvents || []).length ? data.upcomingEvents.map((row) => (
                      <tr key={`upcoming-${row.id_reserva}`}>
                        <td>{row.id_reserva}</td>
                        <td>{row.cliente || '-'}</td>
                        <td>{row.espacio || '-'}</td>
                        <td>{formatDate(row.fecha_evento)}</td>
                        <td>{row.estado_evento || '-'}</td>
                        <td>{row.estado_financiero || '-'}</td>
                        <td>{formatMoney(row.total)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7}><div className="sa-mutedBox">Sin eventos próximos.</div></td>
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

