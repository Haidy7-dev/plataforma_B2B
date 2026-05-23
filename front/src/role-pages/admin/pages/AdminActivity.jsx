import React from 'react'

export default function AdminActivity() {
  const items = [
    { id: 'a1', title: 'Usuario LOGISTICA creado', meta: 'Hace 10 min · id_empresa filtrado', tone: 'info' },
    { id: 'a2', title: 'Solicitud pendiente revisada', meta: 'Hace 1 h · proceso interno', tone: 'neutral' },
    { id: 'a3', title: 'Usuario desactivado', meta: 'Hace 3 h · acción administrativa', tone: 'critical' },
    { id: 'a4', title: 'Tarea de operación completada', meta: 'Ayer · indicador mock verde', tone: 'positive' }
  ]

  const clsByTone = {
    positive: 'sa-live-positive',
    critical: 'sa-live-critical',
    info: 'sa-live-info',
    neutral: ''
  }

  return (
    <div className="sa-content">
      <div className="sa-container">
        <div className="sa-stack">
          <div className="sa-panel">
            <div className="sa-panelHeader">
              <div>
                <div className="sa-panelTitle">Actividades recientes</div>
                <div className="sa-panelSub">Registro operativo (mock). Conectar con tabla de auditoría si existe.</div>
              </div>
              <div className="sa-badge sa-badge-info">ADMIN · Empresa propia</div>
            </div>

            <div className="sa-liveList">
              {items.map((it) => (
                <div key={it.id} className={`sa-liveItem ${clsByTone[it.tone] || ''}`}>
                  <div className="sa-liveDot" />
                  <div>
                    <div className="sa-liveTitle">{it.title}</div>
                    <div className="sa-liveMeta">{it.meta}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }} className="sa-mutedBox">
              Pendiente: paginación, filtros por tipo de actividad y exportación.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

