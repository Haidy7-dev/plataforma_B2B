import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:4000'
const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=1200&auto=format&fit=crop'
const DEFAULT_IMAGE_URL = PLACEHOLDER_IMG

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

function toBool(v, fallback = true) {
  if (v === undefined || v === null || v === '') return fallback
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v === 1
  const s = String(v).trim().toLowerCase()
  if (['1', 'true', 'activo', 'activa', 'si', 'sí'].includes(s)) return true
  if (['0', 'false', 'inactivo', 'inactiva', 'no'].includes(s)) return false
  return fallback
}

function normalizeImageSrc(value) {
  const v = String(value || '').trim()
  if (!v) return PLACEHOLDER_IMG
  if (v.startsWith('/uploads/')) return `${API_BASE}${v}`
  return v
}

export default function AdminSpaces() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const [form, setForm] = useState({
    nombre: '',
    capacidad: '',
    precio: '',
    estado: true,
    imagen: ''
  })

  const filteredRows = useMemo(() => {
    const q = String(search || '').trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => `${r.nombre || ''} ${r.capacidad || ''}`.toLowerCase().includes(q))
  }, [rows, search])

  async function fetchSpaces() {
    setLoading(true)
    setError('')
    try {
      const res = await axios.get(`${API_BASE}/admin/spaces`, {
        params: { search: search || undefined }
      })
      setRows((res.data?.spaces || []).map((r) => ({
        ...r,
        imagen: r.imagen || ''
      })))
    } catch (e) {
      setError(String(e?.response?.data?.message || e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSpaces()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchSpaces(), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function openCreate() {
    setEditing(null)
    setForm({
      nombre: '',
      capacidad: '',
      precio: '',
      estado: true,
      imagen: ''
    })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      nombre: row.nombre || '',
      capacidad: row.capacidad ?? '',
      precio: row.precio ?? '',
      estado: toBool(row.estado, true),
      imagen: row.imagen || ''
    })
    setModalOpen(true)
  }

  async function onImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setSaving(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await axios.post(`${API_BASE}/admin/spaces/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const imageUrl = String(res?.data?.imageUrl || '').trim()
      if (!imageUrl) throw new Error('No se pudo obtener la URL de la imagen.')

      setForm((f) => ({ ...f, imagen: imageUrl }))
    } catch (e2) {
      setError(String(e2?.response?.data?.message || e2?.message || e2))
    } finally {
      setSaving(false)
    }
  }

  async function saveSpace() {
    setSaving(true)
    setError('')
    try {
      const imagenRaw = String(form.imagen || '').trim()
      const imagenFinal = imagenRaw ? imagenRaw : DEFAULT_IMAGE_URL

      const payload = {
        nombre: String(form.nombre || '').trim(),
        capacidad: Number(form.capacidad || 0),
        precio: Number(form.precio || 0),
        estado: Boolean(form.estado),
        imagen: imagenFinal
      }

      if (!payload.nombre) {
        throw new Error('El nombre es obligatorio.')
      }

      if (editing?.id) {
        await axios.put(`${API_BASE}/admin/spaces/${editing.id}`, payload)
      } else {
        await axios.post(`${API_BASE}/admin/spaces`, payload)
      }

      setModalOpen(false)
      await fetchSpaces()
    } catch (e) {
      setError(String(e?.response?.data?.message || e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function removeSpace(row) {
    const ok = window.confirm(`¿Eliminar espacio "${row?.nombre || ''}"?`)
    if (!ok) return
    setLoading(true)
    setError('')
    try {
      await axios.delete(`${API_BASE}/admin/spaces/${row.id}`)
      await fetchSpaces()
    } catch (e) {
      setError(String(e?.response?.data?.message || e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sa-content">
      <div className="sa-container">
        <div className="sa-stack">
          <div className="sa-panel">
            <div className="sa-panelHeader">
              <div>
                <div className="sa-panelTitle">Espacios</div>
                <div className="sa-panelSub">Administra espacios de tu empresa.</div>
              </div>

              <button className="sa-btn sa-btnPrimary" onClick={openCreate} disabled={loading || saving}>
                Crear espacio
              </button>
            </div>

            <div style={{ maxWidth: 320, marginBottom: 12 }}>
              <input
                className="sa-select"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre..."
              />
            </div>

            {error ? (
              <div style={{ marginBottom: 12, color: 'var(--danger)', fontWeight: 950 }}>{error}</div>
            ) : null}

            {loading ? (
              <div className="sa-tdMuted">Cargando...</div>
            ) : filteredRows.length === 0 ? (
              <div className="sa-tdMuted">No hay espacios creados.</div>
            ) : (
              <div className="sa-grid2">
                {filteredRows.map((r) => (
                  <div key={r.id} className="sa-card">
                    <img
                      src={r.imagen ? `${API_BASE}${r.imagen}` : PLACEHOLDER_IMG}
                      alt={r.nombre || 'Espacio'}
                      style={{
                        width: '100%',
                        height: 170,
                        objectFit: 'cover',
                        borderRadius: 12,
                        border: '1px solid rgba(148,163,184,0.25)'
                      }}
                    />
                    <div style={{ marginTop: 10, fontWeight: 1000, fontSize: 16 }}>{r.nombre || '-'}</div>
                    <div style={{ marginTop: 6, color: 'var(--muted)', fontWeight: 850 }}>
                      Capacidad: {Number(r.capacidad || 0)}
                    </div>

                    <div className="sa-rowBtns" style={{ marginTop: 12 }}>
                      <button className="sa-btn sa-btnGhost" onClick={() => openEdit(r)} disabled={loading || saving}>
                        Editar
                      </button>
                      <button className="sa-btn sa-btnGhost" onClick={() => removeSpace(r)} disabled={loading || saving}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title={editing ? 'Editar espacio' : 'Crear espacio'}
            subtitle={editing ? `id: ${editing?.id}` : 'Completa los datos para crear un espacio'}
            footer={
              <>
                <button className="sa-btn sa-btnGhost" onClick={() => setModalOpen(false)} disabled={saving}>
                  Cancelar
                </button>
                <button className="sa-btn sa-btnPrimary" onClick={saveSpace} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </>
            }
          >
            <div className="sa-grid2">
              <div>
                <div style={{ fontWeight: 950, fontSize: 12, color: 'var(--muted)' }}>Nombre</div>
                <input
                  className="sa-select"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  disabled={saving}
                />
              </div>

              <div>
                <div style={{ fontWeight: 950, fontSize: 12, color: 'var(--muted)' }}>Capacidad</div>
                <input
                  className="sa-select"
                  type="number"
                  value={form.capacidad}
                  onChange={(e) => setForm((f) => ({ ...f, capacidad: e.target.value }))}
                  disabled={saving}
                />
              </div>

              <div>
                <div style={{ fontWeight: 950, fontSize: 12, color: 'var(--muted)' }}>Precio</div>
                <input
                  className="sa-select"
                  type="number"
                  step="0.01"
                  value={form.precio}
                  onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                  disabled={saving}
                />
              </div>

              <div>
                <div style={{ fontWeight: 950, fontSize: 12, color: 'var(--muted)' }}>Estado</div>
                <select
                  className="sa-select"
                  value={form.estado ? '1' : '0'}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value === '1' }))}
                  disabled={saving}
                >
                  <option value="1">ACTIVO</option>
                  <option value="0">INACTIVO</option>
                </select>
              </div>

              

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontWeight: 950, fontSize: 12, color: 'var(--muted)' }}>Subir imagen</div>
                <input className="sa-select" type="file" accept="image/*" onChange={onImageUpload} disabled={saving} />
                
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <img
                  src={form.imagen ? `${API_BASE}${form.imagen}` : PLACEHOLDER_IMG}
                  alt="Vista previa"
                  style={{
                    width: '100%',
                    maxHeight: 230,
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.25)'
                  }}
                />
              </div>
            </div>
          </Modal>
        </div>
      </div>
    </div>
  )
}
