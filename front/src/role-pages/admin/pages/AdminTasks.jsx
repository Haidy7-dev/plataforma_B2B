import React from 'react'

export default function AdminTasks() {
  return (
    <div className="sa-content">
      <div className="sa-container">
        <div className="sa-stack">
          <div className="sa-panel">
            <div className="sa-panelHeader">
              <div>
                <div className="sa-panelTitle">Gestión de tareas</div>
                <div className="sa-panelSub">Vista inicial (mock) — listo para conectar con la BD por id_empresa.</div>
              </div>
            </div>

            <div className="sa-liveList">
              <div className="sa-liveItem sa-live-info">
                <div className="sa-liveDot" />
                <div>
                  <div className="sa-liveTitle">Pendiente de validación</div>
                  <div className="sa-liveMeta">Proceso interno · color naranja para pendientes</div>
                </div>
              </div>
              <div className="sa-liveItem sa-live-positive">
                <div className="sa-liveDot" />
                <div>
                  <div className="sa-liveTitle">Tarea completada</div>
                  <div className="sa-liveMeta">Proceso interno · color verde para activos</div>
                </div>
              </div>
            </div>

            <div className="sa-mutedActions">
              <button className="sa-btn sa-btnPrimary">+ Crear tarea</button>
              <button className="sa-btn sa-btnGhost">Filtrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

