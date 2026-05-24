import React, { useEffect, useState } from 'react'
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

function clsByStatus(status) {
  const s = String(status || '').toUpperCase()
  if (s === 'DEUDA') return 'sa-live-critical'
  if (s === 'PARCIAL') return 'sa-live-info'
  if (s === 'PAGADO' || s === 'FINALIZADO') return 'sa-live-positive'
  return ''
}

export default function AdminActivity() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError('')
        const res = await axios.get(`${API_BASE}/admin/dashboard/stats`)
        setRows(Array.isArray(res?.data?.recentReservations) ? res.data.recentReservations : [])
      } catch (e) {
        setError(String(e?.message || e))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <div className="sa-content">
      <div className="sa-container">
        <div className="sa-stack">
          <div className="sa-panel">
            <div className="sa-panelHeader">
              <div>
                <div className="sa-panelTitle">Actividades recientes</div>
                <div className="sa-panelSub">Últimas reservas creadas.</div>
              </div>
              <div className="sa-badge sa-badge-info">ADMIN</div>
            </div>

            {error ? <div style={{ color: 'var(--warning)', fontWeight: 800 }}>⚠ {error}</div> : null}
            {loading ? <div className="sa-mutedBox">Cargando...</div> : null}

            {!loading && !rows.length ? (
              <div className="sa-mutedBox">Sin actividad reciente.</div>
            ) : null}

            {!loading && rows.length ? (
              <div className="sa-liveList">
                {rows.map((it) => (
                  <div key={it.id_reserva} className={`sa-liveItem ${clsByStatus(it.estado)}`}>
                    <div className="sa-liveDot" />
                    <div>
                      <div className="sa-liveTitle">{it.cliente || 'Cliente'}</div>
                      <div className="sa-liveMeta">
                        {formatDate(it.fecha)} · {formatMoney(it.total)} · {it.estado || '-'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
