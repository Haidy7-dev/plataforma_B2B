import React from 'react'

export default function AdminReports() {
  return (
    <div className="sa-content">
      <div className="sa-container">
        <div className="sa-stack">
          <div className="sa-panel">
            <div className="sa-panelHeader">
              <div>
                <div className="sa-panelTitle">Reportes</div>
                <div className="sa-panelSub">Vista inicial (mock) — reportes de tu empresa.</div>
              </div>
              <div className="sa-badge sa-badge-info">Empresa filtrada por id_empresa</div>
            </div>

            <div className="sa-grid4">
              <div className="sa-card sa-card-primary">
                <div className="sa-cardTop">
                  <div className="sa-cardTitle">Volumen mensual</div>
                  <div className="sa-cardIcon">📈</div>
                </div>
                <div className="sa-cardValue">+18%</div>
                <div className="sa-cardHint">Mock. Conectar con BD real.</div>
              </div>
              <div className="sa-card sa-card-success">
                <div className="sa-cardTop">
                  <div className="sa-cardTitle">Operación estable</div>
                  <div className="sa-cardIcon">✅</div>
                </div>
                <div className="sa-cardValue">98%</div>
                <div className="sa-cardHint">Indicador mock.</div>
              </div>
              <div className="sa-card sa-card-indigo">
                <div className="sa-cardTop">
                  <div className="sa-cardTitle">Cumplimiento</div>
                  <div className="sa-cardIcon">🎯</div>
                </div>
                <div className="sa-cardValue">91%</div>
                <div className="sa-cardHint">Mock. Por rango fechas.</div>
              </div>
              <div className="sa-card sa-card-critical">
                <div className="sa-cardTop">
                  <div className="sa-cardTitle">Incidencias</div>
                  <div className="sa-cardIcon">⚠️</div>
                </div>
                <div className="sa-cardValue">2</div>
                <div className="sa-cardHint">Pendientes por resolver.</div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="sa-mutedBox">
                Pronto: implementar filtros por rango de fechas y exportación (PDF/CSV) por empresa.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

