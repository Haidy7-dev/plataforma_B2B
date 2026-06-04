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

function toneClassByFinancialStatus(status) {
  const s = String(status || '').toUpperCase()
  if (s === 'DEUDA') return 'sa-badge sa-badge-critical'
  if (s === 'PARCIAL') return 'sa-badge sa-badge-warning'
  if (s === 'PAGADO') return 'sa-badge sa-badge-positive'
  if (s === 'FINALIZADO') return 'sa-badge sa-badge-positive'
  return 'sa-badge sa-badge-neutral'
}



export default function AdminDashboard() {
  const { user, token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({
    activeUsers: 0,
    confirmedEvents: 0,
    pendingPayments: 0,
    partialPayments: 0,
    finalizedEvents: 0,
    upcomingEvents: [],
    pendingPaymentsList: [],
    partialPaymentsList: [],
    recentReservations: []
  })

  useEffect(() => {
    if (!token) return

    let cancelled = false

    async function load() {
      try {
        if (cancelled) return
        setLoading(true)
        setError('')
        const res = await axios.get(`${API_BASE}/admin/dashboard/stats`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (cancelled) return

        setStats({
          activeUsers: Number(res?.data?.activeUsers || 0),
          confirmedEvents: Number(res?.data?.confirmedEvents || 0),
          pendingPayments: Number(res?.data?.pendingPayments || 0),
          partialPayments: Number(res?.data?.partialPayments || 0),
          finalizedEvents: Number(res?.data?.finalizedEvents || 0),
          upcomingEvents: Array.isArray(res?.data?.upcomingEvents) ? res.data.upcomingEvents : [],
          pendingPaymentsList: Array.isArray(res?.data?.pendingPaymentsList) ? res.data.pendingPaymentsList : [],
          partialPaymentsList: Array.isArray(res?.data?.partialPaymentsList) ? res.data.partialPaymentsList : [],
          recentReservations: Array.isArray(res?.data?.recentReservations) ? res.data.recentReservations : []
        })
      } catch (e) {
        const status = e?.response?.status
        const message = e?.response?.data?.message || e?.message || 'Error cargando dashboard'
        setError(status ? `${message} (HTTP ${status})` : String(message))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    // Actualización en tiempo real (polling suave)
    const intervalId = setInterval(() => {
      load()
    }, 15000)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [token])

  const upcomingTop5 = useMemo(() => (stats.upcomingEvents || []).slice(0, 5), [stats.upcomingEvents])

  return (
    <div className="sa-content">
      <div className="sa-container">
        <div className="sa-stack">
          <div className="sa-panel">
            <div className="sa-panelHeader">
              <div>
                <div className="sa-panelTitle">Inicio</div>
                <div className="sa-panelSub">Información </div>
              </div>
              <div className="sa-badge sa-badge-info">id_empresa: {user?.id_empresa ?? '-'}</div>
            </div>

            {error ? <div style={{ color: 'var(--warning)', fontWeight: 800 }}>⚠ {error}</div> : null}

            <div className="sa-kpis">
              <div className="sa-kpi">
                <div className="sa-kpiLabel">Usuarios activos</div>
                <div className="sa-kpiValue">{loading ? '...' : stats.activeUsers}</div>
              </div>

              <div className="sa-kpi">
                <div className="sa-kpiLabel">Pagos pendientes</div>
                <div className="sa-kpiValue">{loading ? '...' : stats.pendingPayments}</div>
              </div>

              <div className="sa-kpi">
                <div className="sa-kpiLabel">Pagos parciales</div>
                <div className="sa-kpiValue">{loading ? '...' : stats.partialPayments}</div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="sa-panelTitle" style={{ marginBottom: 10 }}>Pagos pendientes</div>
              <div className="sa-tableWrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Fecha</th>
                      <th>Total</th>
                      <th>Estado financiero</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.pendingPaymentsList || []).length ? stats.pendingPaymentsList.map((row) => (
                      <tr key={`pp-${row.id_reserva}`}>
                        <td>{row.cliente || '-'}</td>
                        <td>{formatDate(row.fecha_evento)}</td>
                        <td>{formatMoney(row.total)}</td>
                        <td><span className={toneClassByFinancialStatus(row.estado_financiero)}>{row.estado_financiero || '-'}</span></td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4}><div className="sa-mutedBox">Sin pagos pendientes.</div></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="sa-panelTitle" style={{ marginBottom: 10 }}>Pagos parciales</div>
              <div className="sa-tableWrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Fecha</th>
                      <th>Total</th>
                      <th>Valor Pagado</th>
                      <th>Saldo Pendiente</th>
                      <th>Estado Financiero</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.partialPaymentsList || []).length ? (stats.partialPaymentsList || []).map((row) => (
                      <tr key={`par-${row.id_reserva}`}>
                        <td>{row.cliente || '-'}</td>
                        <td>{formatDate(row.fecha_evento)}</td>
                        <td>{formatMoney(row.total)}</td>
                        <td>{formatMoney(row.valor_pagado)}</td>
                        <td>{formatMoney(row.saldo_pendiente)}</td>
                        <td><span className={toneClassByFinancialStatus(row.estado_financiero)}>{row.estado_financiero || '-'}</span></td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6}><div className="sa-mutedBox">Sin pagos parciales</div></td>
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
