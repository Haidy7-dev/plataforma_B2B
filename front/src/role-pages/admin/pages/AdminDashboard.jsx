import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../../../auth/AuthContext.jsx'

const API_BASE = 'http://localhost:4000'

function Badge({ variant = 'neutral', children }) {
  const cls = {
    positive: 'sa-badge sa-badge-positive',
    critical: 'sa-badge sa-badge-critical',
    info: 'sa-badge sa-badge-info',
    neutral: 'sa-badge sa-badge-neutral'
  }[variant]

  return <span className={cls}>{children}</span>
}

export default function AdminDashboard() {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    activeUsers: 0,
    processesInCourse: 0,
    pendingRequests: 0,
    recentActivities: []
  })

  const [error, setError] = useState(null)

  useEffect(() => {
    async function run() {
      try {
        // Por ahora mock en backend: si existe endpoint lo usaremos.
        const res = await axios.get(`${API_BASE}/admin/dashboard/stats`).catch(() => null)
        if (res?.data) {
          setStats({
            activeUsers: res.data.activeUsers ?? 0,
            processesInCourse: res.data.processesInCourse ?? 0,
            pendingRequests: res.data.pendingRequests ?? 0,
            recentActivities: res.data.recentActivities ?? []
          })
        } else {
          // Mock UI
          setStats({
            activeUsers: 0,
            processesInCourse: 3,
            pendingRequests: 2,
            recentActivities: []
          })
        }
      } catch (e) {
        setError(String(e?.message || e))
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [])

  return (
    <div className="sa-content">
      <div className="sa-container">
        <div className="sa-stack">
          <div className="sa-panel">
            <div className="sa-panelHeader">
              <div>
                <div className="sa-panelTitle">Dashboard corporativo (ADMIN)</div>
                <div className="sa-panelSub">
                  Empresa filtrada por <b>id_empresa</b> del ADMIN.
                </div>
              </div>
              <Badge variant="info">id_empresa: {user?.id_empresa ?? '-'}</Badge>
            </div>

            {error ? (
              <div style={{ color: 'var(--warning)', fontWeight: 950 }}>⚠️ {error}</div>
            ) : null}

            <div className="sa-kpis">
              <div className="sa-kpi">
                <div className="sa-kpiLabel">Usuarios activos</div>
                <div className="sa-kpiValue">{loading ? '...' : stats.activeUsers}</div>
                <div className="sa-kpiHint">Estado TRUE en tabla usuario.</div>
              </div>
              <div className="sa-kpi">
                <div className="sa-kpiLabel">Procesos en curso</div>
                <div className="sa-kpiValue">{loading ? '...' : stats.processesInCourse}</div>
                <div className="sa-kpiHint">Indicadores mock por ahora.</div>
              </div>
              <div className="sa-kpi">
                <div className="sa-kpiLabel">Solicitudes pendientes</div>
                <div className="sa-kpiValue">{loading ? '...' : stats.pendingRequests}</div>
                <div className="sa-kpiHint">Usa color naranja en UI.</div>
              </div>
            </div>

            <div style={{ marginTop: 14 }} className="sa-grid2">
              <div className="sa-card sa-card-primary">
                <div className="sa-cardTop">
                  <div className="sa-cardTitle">Calendario de tareas</div>
                  <div className="sa-cardIcon">🗓️</div>
                </div>
                <div className="sa-cardHint">
                  Mock: conectar con tareas internas por id_empresa.
                </div>
                <div className="sa-miniChart">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge variant="positive">Activo</Badge>
                    <Badge variant="neutral">En revisión</Badge>
                    <Badge variant="critical">Crítico</Badge>
                  </div>
                </div>
              </div>

              <div className="sa-card sa-card-critical">
                <div className="sa-cardTop">
                  <div className="sa-cardTitle">Indicadores operativos</div>
                  <div className="sa-cardIcon">📊</div>
                </div>
                <div className="sa-cardHint">Pendientes (naranja) y alertas (rojo).</div>
                <div className="sa-progressRow">
                  <div className="sa-progressTop">
                    <div className="sa-progressLabel">Pendientes</div>
                    <div className="sa-progressMeta">{loading ? '...' : stats.pendingRequests}</div>
                  </div>
                  <div className="sa-progressTrack">
                    <div className="sa-progressFill" style={{ width: `${Math.min(100, (stats.pendingRequests || 0) * 35)}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="sa-panelTitle" style={{ marginBottom: 10 }}>
                Actividades recientes
              </div>

              {stats.recentActivities?.length ? (
                <div className="sa-liveList">
                  {stats.recentActivities.slice(0, 5).map((a, idx) => (
                    <div key={a.id || idx} className={`sa-liveItem ${a.tone === 'positive' ? 'sa-live-positive' : a.tone === 'critical' ? 'sa-live-critical' : 'sa-live-info'}`}>
                      <div className="sa-liveDot" />
                      <div>
                        <div className="sa-liveTitle">{a.title || 'Actividad'}</div>
                        <div className="sa-liveMeta">{a.meta || ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sa-mutedBox">Sin actividades aún (mock). Conectar con auditoría por empresa.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

