import React, { useMemo, useState } from 'react'
import Papa from 'papaparse'
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

function Modal({ open, title, subtitle, children, onClose, footer }) {
  if (!open) return null
  return (
    <div className="sa-modalOverlay" role="dialog" aria-modal="true">
      <div className="sa-modal">
        <div className="sa-modalHeader">
          <div>
            <div className="sa-modalTitle">{title}</div>
            {subtitle ? <div className="sa-modalSub">{subtitle}</div> : null}
          </div>
          <button className="sa-modalClose" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="sa-modalBody">{children}</div>
        {footer ? <div className="sa-modalFooter">{footer}</div> : null}
      </div>
    </div>
  )
}

const requiredHeaders = ['nombre', 'tipo', 'stock', 'precio', 'estado']


function normalizeTipoForDisplay(v) {
  if (v == null) return ''
  return String(v).trim()
}

export default function InventoryImport() {
  const { user } = useAuth()

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(false)

  const [parseError, setParseError] = useState(null)
  const [validation, setValidation] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [importSummary, setImportSummary] = useState(null)

  const errorIndexByRow = useMemo(() => {
    const map = new Map()
    if (!validation?.errors?.length) return map
    for (const e of validation.errors) {
      map.set(e.row_number, e.error_message)
    }
    return map
  }, [validation])

  async function downloadTemplate() {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setParseError('Sesión expirada o sin token. Inicia sesión nuevamente.')
        return
      }

      setParseError(null)

      const res = await axios.get(`${API_BASE}/admin/inventory/template`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      })

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'inventory_template.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setParseError(String(e?.response?.data?.message || e?.message || 'No se pudo descargar la plantilla CSV'))
    }
  }

  function parseFile(file) {
    setParseError(null)
    setValidation(null)
    setImportSummary(null)
    setRows([])

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => (h == null ? '' : String(h).trim().toLowerCase()),
      complete: (results) => {
        const parsed = results.data || []

        // Validar cabeceras (si el CSV no trae header correcto, Papa igual crea objetos vacíos)
        const first = results?.meta?.fields || []
        if (first && first.length) {
          const missing = requiredHeaders.filter((h) => !first.includes(h))
          if (missing.length) {
            setParseError(`CSV inválido. Faltan columnas: ${missing.join(', ')}`)
            setRows([])
            return
          }
        }

        setRows(parsed)
        setFileName(file.name)
        setSelectedFile(file)
      },
      error: (err) => setParseError(String(err))
    })
  }

  function onPickFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    parseFile(file)
  }

  async function validate() {
    setLoading(true)
    setParseError(null)
    setValidation(null)
    setImportSummary(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${API_BASE}/admin/inventory/validate`,
        { rows },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setValidation({
        ok: Boolean(res.data?.ok),
        total: res.data?.total ?? 0,
        validCount: res.data?.validCount ?? 0,
        errorCount: res.data?.errorCount ?? 0,
        errors: res.data?.errors || []
      })

      if ((res.data?.errorCount ?? 0) > 0) return
      setConfirmOpen(true)
    } catch (e) {
      setParseError(String(e?.response?.data?.message || e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  async function importNow() {
    setLoading(true)
    setImportSummary(null)

    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${API_BASE}/admin/inventory/import`,
        { originalFilename: fileName || null, rows },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setImportSummary({
        status: res.data?.status || (res.data?.ok ? 'SUCCESS' : 'ERROR'),
        createdCount: res.data?.createdCount ?? 0,
        updatedCount: res.data?.updatedCount ?? 0
      })
      setConfirmOpen(false)

      // limpiar validación para forzar re-subida si quiere otra
      setValidation(null)
    } catch (e) {
      setParseError(String(e?.response?.data?.message || e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  const validCount = validation?.validCount ?? 0
  const errorCount = validation?.errorCount ?? 0

  const progressPct = useMemo(() => {
    if (!validation) return 0
    const total = validation.total || 0
    if (!total) return 0
    return Math.round((validCount / total) * 100)
  }, [validation, validCount])

  function onDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    parseFile(file)
  }

  return (
    <div className="sa-content">
      <div className="sa-container">
        <div className="sa-stack">
          <div className="sa-panel">
            <div className="sa-panelHeader">
              <div>
                <div className="sa-panelTitle">Importación masiva CSV (ADMIN)</div>
                <div className="sa-panelSub">
                  Importa recursos CSV del módulo admin. Formato esperado por backend: nombre, tipo, stock, precio, estado.
                </div>
              </div>
              <Badge variant="info">id_empresa: {user?.id_empresa ?? '-'}</Badge>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              style={{
                border: '2px dashed rgba(37,99,235,0.35)',
                borderRadius: 18,
                padding: 18,
                background: 'rgba(37,99,235,0.04)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 1100, color: 'var(--text)' }}>Arrastra y suelta tu CSV aquí</div>
                  <div style={{ marginTop: 6, fontWeight: 850, color: 'var(--muted)', fontSize: 12 }}>
                    Columnas: {requiredHeaders.join(', ')}
                  </div>
                </div>

                <div className="sa-mutedActions">
                  <button className="sa-btn sa-btnGhost" type="button" onClick={downloadTemplate} disabled={loading}>
                    Descargar plantilla CSV
                  </button>
                  <label className="sa-btn sa-btnPrimary" style={{ cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                    Seleccionar archivo
                    <input type="file" accept=".csv" style={{ display: 'none' }} onChange={onPickFile} disabled={loading} />
                  </label>
                </div>
              </div>

              {fileName ? (
                <div style={{ marginTop: 12 }}>
                  <Badge variant="neutral">Archivo: {fileName}</Badge>
                </div>
              ) : null}
            </div>

            {parseError ? (
              <div style={{ marginTop: 12, color: 'var(--danger)', fontWeight: 950 }}>
                {parseError}
              </div>
            ) : null}

            {validation ? (
              <div style={{ marginTop: 14 }}>
                <div className="sa-progressTop">
                  <div className="sa-progressLabel">Validación</div>
                  <div className="sa-progressMeta">
                    {validCount} válidos • {errorCount} con error
                  </div>
                </div>
                <div className="sa-progressTrack">
                  <div className="sa-progressFill" style={{ width: `${progressPct}%` }} />
                </div>

                <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {errorCount === 0 ? (
                    <Badge variant="positive">Importación lista</Badge>
                  ) : (
                    <Badge variant="critical">Corrige errores para continuar</Badge>
                  )}
                  {errorCount > 0 ? <Badge variant="neutral">Errores resaltados</Badge> : null}
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 1000, color: 'var(--primaryElectric)' }}>Vista previa</div>
              <div style={{ marginTop: 8, border: '1px solid rgba(148,163,184,0.22)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ maxHeight: 320, overflow: 'auto' }}>
                  <table className="sa-table" style={{ minWidth: 980, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 90 }}>#</th>
                        <th>Nombre</th>
                        <th>Tipo</th>
                        <th style={{ width: 120 }}>Stock</th>
                        <th style={{ width: 140 }}>Precio</th>
                        <th style={{ width: 120 }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="sa-tdMuted">
                            No hay datos cargados.
                          </td>
                        </tr>
                      ) : (
                        rows.slice(0, 200).map((r, idx) => {
                          const rowNumber = idx + 1
                          const err = errorIndexByRow.get(rowNumber)
                          return (
                            <tr key={rowNumber} style={err ? { background: 'rgba(239,68,68,0.08)' } : undefined}>
                              <td className="sa-tdMuted">{rowNumber}</td>
                              <td>
                                <span style={{ fontWeight: 1000 }}>{String(r.nombre ?? '')}</span>
                                {err ? (
                                  <div style={{ color: 'var(--danger)', fontWeight: 900, fontSize: 11, marginTop: 4 }}>
                                    {err}
                                  </div>
                                ) : null}
                              </td>
                              <td className={err ? '' : 'sa-tdStrong'}>{normalizeTipoForDisplay(r.tipo)}</td>
                              <td>{String(r.stock ?? '')}</td>
                              <td>{String(r.precio ?? '')}</td>
                              <td>{String(r.estado ?? '')}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {rows.length > 200 ? (
                <div style={{ marginTop: 8, color: 'var(--muted)', fontWeight: 900, fontSize: 12 }}>
                  Mostrando 200 de {rows.length} filas para previsualización.
                </div>
              ) : null}
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="sa-btn sa-btnPrimary"
                type="button"
                onClick={validate}
                disabled={rows.length === 0 || loading}
              >
                {loading ? 'Procesando...' : 'Validar antes de importar'}
              </button>

              <button
                className="sa-btn sa-btnGhost"
                type="button"
                onClick={() => {
                  setFileName('')
                  setRows([])
                  setSelectedFile(null)
                  setValidation(null)
                  setImportSummary(null)
                  setParseError(null)
                }}
                disabled={loading || rows.length === 0}
              >
                Limpiar
              </button>

              {importSummary ? (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {importSummary.status === 'SUCCESS' ? (
                    <Badge variant="positive">Importación exitosa</Badge>
                  ) : importSummary.status === 'PARTIAL' ? (
                    <Badge variant="info">Importación parcial</Badge>
                  ) : (
                    <Badge variant="critical">Importación con errores</Badge>
                  )}
                  <Badge variant="neutral">Creados: {importSummary.createdCount}</Badge>
                  <Badge variant="neutral">Actualizados: {importSummary.updatedCount}</Badge>
                </div>
              ) : null}
            </div>

            <Modal
              open={confirmOpen}
              title="Confirmar importación"
              subtitle={fileName ? `Archivo: ${fileName}` : undefined}
              onClose={() => setConfirmOpen(false)}
              footer={
                <>
                  <button className="sa-btn sa-btnGhost" onClick={() => setConfirmOpen(false)} disabled={loading}>
                    Cancelar
                  </button>
                  <button className="sa-btn sa-btnPrimary" onClick={importNow} disabled={loading}>
                    {loading ? 'Importando...' : 'Confirmar e importar'}
                  </button>
                </>
              }
            >
              <div className="sa-grid2">
                <div className="sa-finItem">
                  <div className="sa-finLabel">Filas</div>
                  <div className="sa-finValue">{validation?.total ?? 0}</div>
                  <div className="sa-finHint">Total del CSV</div>
                </div>
                <div className="sa-finItem">
                  <div className="sa-finLabel">Válidas</div>
                  <div className="sa-finValue sa-finPositive">{validation?.validCount ?? 0}</div>
                  <div className="sa-finHint">Se guardarán en tabla recurso</div>
                </div>
              </div>
              {validation?.errorCount ? (
                <div style={{ marginTop: 12 }}>
                  <Badge variant="critical">Hay {validation.errorCount} errores (no se permiten para confirmar)</Badge>
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <Badge variant="positive">Sin errores • listo para importar</Badge>
                </div>
              )}
              <div style={{ marginTop: 12 }} className="sa-mutedBox">
                Al confirmar, el backend insertará únicamente filas válidas en la tabla <b>recurso</b>.
              </div>
            </Modal>
          </div>
        </div>
      </div>
    </div>
  )
}

