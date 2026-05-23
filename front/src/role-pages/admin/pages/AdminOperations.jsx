import React from 'react'

export default function AdminOperations() {
  return (
    <div className="sa-content">
      <div className="sa-container">
        <div className="sa-stack">
          <div className="sa-panel">
            <div className="sa-panelHeader">
              <div>
                <div className="sa-panelTitle">Gestión operativa</div>
                <div className="sa-panelSub">Vista inicial (mock) — operaciones internas de tu empresa.</div>
              </div>
            </div>

            <div className="sa-grid2">
              <div className="sa-card sa-card-primary">
                <div className="sa-cardTop">
                  <div className="sa-cardTitle">Capacidad utilizada</div>
                  <div className="sa-cardIcon">📦</div>
                </div>
                <div className="sa-cardValue">62%</div>
                <div className="sa-cardHint">Indicador mock por proceso interno.</div>
              </div>

              <div className="sa-card sa-card-critical">
                <div className="sa-cardTop">
                  <div className="sa-cardTitle">Alertas operativas</div>
                  <div className="sa-cardIcon">⚠️</div>
                </div>
                <div className="sa-cardValue">2</div>
                <div className="sa-cardHint">Procesos pendientes (naranja) y críticos (rojo).</div>
              </div>
            </div>

            <div className="sa-mutedActions">
              <button className="sa-btn sa-btnPrimary">+ Registrar operación</button>
              <button className="sa-btn sa-btnGhost">Ver detalle</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

