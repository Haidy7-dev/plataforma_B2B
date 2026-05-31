import React, { useEffect, useMemo, useState } from 'react'
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

function normalizeRoleLabel(r) {
  if (!r) return '-'
  const normalized = String(r).trim().toUpperCase()
  if (normalized === 'LOGISTICA' || normalized === 'GESTOR') return normalized
  return normalized
}

function normalizeRoleForSelect(r) {
  const normalized = String(r || '').trim().toUpperCase()
  if (normalized === 'GESTOR') return 'GESTOR'
  return 'LOGISTICA'
}

function normalizeRoleForApi(r) {
  const normalized = String(r || '').trim().toUpperCase()
  if (normalized === 'GESTOR' || normalized === 'LOGISTICA') return normalized.toLowerCase()
  return 'logistica'
}

export default function AdminUsers() {
  const { user, token } = useAuth()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null) // row

  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    passwordTemporal: '',
    // edición de contraseña (ADMIN)
    nuevaPassword: '',
    confirmarPassword: '',
    rol: 'LOGISTICA',
    estado: true
  })

  const canEdit = useMemo(() => {
    // solo admin
    return Boolean(user?.id_empresa)
  }, [user])

  async function fetchUsers() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const params = {
        search: search || undefined,
        role: roleFilter || undefined
      }

      const res = await axios.get(`${API_BASE}/admin/users`, {
        params,
        headers: user?.token ? { Authorization: `Bearer ${user.token}` } : undefined
      })
      setRows(res.data?.users || [])
    } catch (e) {
      setError(String(e?.response?.data?.message || e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Debounce simple
    const t = setTimeout(() => {
      fetchUsers()
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter])

  function openCreate() {
    setEditing(null)
    setForm({
      nombre: '',
      correo: '',
      passwordTemporal: '',
      nuevaPassword: '',
      confirmarPassword: '',
      rol: 'LOGISTICA',
      estado: true
    })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      nombre: row.nombre || '',
      correo: row.correo || '',
      passwordTemporal: '',
      nuevaPassword: '',
      confirmarPassword: '',
      rol: normalizeRoleForSelect(row.rol),
      estado: Boolean(row.estado)
    })
    setModalOpen(true)
  }

  async function saveUser() {
    setLoading(true)
    setError(null)
    try {
      if (!canEdit) throw new Error('ADMIN no autenticado o sin id_empresa')

      if (editing) {
        // PUT /admin/users/:id (sin tocar contraseña desde aquí)
        const payload = {
          nombre: form.nombre,
          correo: form.correo,
          rol: normalizeRoleForApi(form.rol),
          estado: form.estado
        }
        await axios.put(`${API_BASE}/admin/users/${editing.id}`, payload, {
          headers: user?.token
  ? { Authorization: `Bearer ${user.token}` }
  : {}
        })
      } else {
        // POST /admin/users
        const payload = {
          nombre: form.nombre,
          correo: form.correo,
          passwordTemporal: form.passwordTemporal,
          rol: normalizeRoleForApi(form.rol),
          estado: form.estado
        }
        await axios.post(`${API_BASE}/admin/users`, payload, {
          headers: user?.token
  ? { Authorization: `Bearer ${user.token}` }
  : {}
        })
      }

      setModalOpen(false)
      await fetchUsers()
    } catch (e) {
      setError(String(e?.response?.data?.message || e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  function passwordOkForAdminChange(password) {
    if (typeof password !== 'string') return false
    const p = password.trim()
    // Requisito del usuario: máximo 6 caracteres (ej: "123456")
    return p.length > 0 && p.length <= 6
  }

  async function changePassword() {
    if (!editing) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      if (!canEdit) throw new Error('ADMIN no autenticado o sin id_empresa')

      if (!passwordOkForAdminChange(form.nuevaPassword)) {
        throw new Error('La nueva contraseña debe tener máximo 6 caracteres')
      }
      if (form.nuevaPassword !== form.confirmarPassword) {
        throw new Error('La confirmación de contraseña no coincide')
      }

      const payload = { password: form.nuevaPassword }
      await axios.post(`${API_BASE}/admin/users/${editing.id}/change-password`, payload, {
        headers: user?.token
  ? { Authorization: `Bearer ${user.token}` }
  : {}
      })

      setSuccess('Contraseña actualizada correctamente.')
      // Limpiamos para evitar reuso/mostrar valores
      setForm((f) => ({ ...f, nuevaPassword: '', confirmarPassword: '' }))
      await fetchUsers()
    } catch (e) {
      setError(String(e?.response?.data?.message || e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  async function generateTemporaryPassword() {
    if (!editing) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      if (!canEdit) throw new Error('ADMIN no autenticado o sin id_empresa')

      const res = await axios.post(
        `${API_BASE}/admin/users/${editing.id}/reset-password`,
        {},
        { headers: user?.token ? { Authorization: `Bearer ${user.token}` } : {} }
      )
      const temp = res.data?.passwordTemporal

      if (!temp) throw new Error('No se recibió password temporal desde el servidor')

      setSuccess('Contraseña temporal generada. Copia el valor mostrado en el modal.')
      // Mostramos temporal en el campo “nuevaPassword” para que el ADMIN la copie.
      // No se obtiene desde BD como texto plano (solo se genera y retorna).
      setForm((f) => ({ ...f, nuevaPassword: temp, confirmarPassword: '' }))
    } catch (e) {
      setError(String(e?.response?.data?.message || e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  async function toggleStatus(row, nextEstado) {
    setLoading(true)
    setError(null)
    try {
      await axios.patch(`${API_BASE}/admin/users/${row.id}/status`, { estado: nextEstado }, {
        headers: user?.token
  ? { Authorization: `Bearer ${user.token}` }
  : {}
      })
      await fetchUsers()
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
                <div className="sa-panelTitle">Gestión de usuarios</div>
                <div className="sa-panelSub">Usuarios pertenecen a la misma empresa del ADMIN (id_empresa filtrado por backend).</div>
              </div>

              <button className="sa-btn sa-btnPrimary" onClick={openCreate} disabled={loading}>
                + Crear usuario
              </button>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <input
                  className="sa-select"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o correo..."
                />
              </div>

              <div style={{ width: 240 }}>
                <select
                  className="sa-select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="">Todos los roles</option>
                  <option value="LOGISTICA">LOGISTICA</option>
                  <option value="GESTOR">GESTOR</option>
                </select>
              </div>
            </div>

            {error ? (
              <div style={{ marginTop: 12, color: 'var(--danger)', fontWeight: 950 }}>{error}</div>
            ) : null}

            {success ? (
              <div style={{ marginTop: 12, color: 'var(--success)', fontWeight: 950 }}>{success}</div>
            ) : null}

            <div className="sa-tableWrap" style={{ marginTop: 14 }}>
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Fecha creación</th>
                    <th style={{ width: 320 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="sa-tdMuted">Cargando...</td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="sa-tdMuted">No hay usuarios para mostrar.</td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id}>
                        <td className="sa-tdStrong">{r.nombre}</td>
                        <td>{r.correo}</td>
                        <td>
                          <Badge variant="info">{normalizeRoleLabel(r.rol)}</Badge>
                        </td>
                        <td>
                          {r.estado ? <Badge variant="positive">ACTIVO</Badge> : <Badge variant="critical">INACTIVO</Badge>}
                        </td>
                        <td className="sa-tdMuted">{r.createdAt ? String(r.createdAt).slice(0, 10) : '-'}</td>
                        <td>
                          <div className="sa-rowBtns">
                            <button className="sa-btn sa-btnGhost" onClick={() => openEdit(r)} disabled={loading}>
                              Editar
                            </button>
                            <button
                              className="sa-btn sa-btnGhost"
                              onClick={() => toggleStatus(r, !r.estado)}
                              disabled={loading}
                            >
                              {r.estado ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title={editing ? 'Editar usuario' : 'Crear usuario'}
            subtitle={editing ? `id: ${editing?.id}` : 'Crea un usuario en tu empresa (LOGISTICA / GESTOR)'}
            footer={
              <>
                <button className="sa-btn sa-btnGhost" onClick={() => setModalOpen(false)} disabled={loading}>
                  Cancelar
                </button>
                <button className="sa-btn sa-btnPrimary" onClick={saveUser} disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </>
            }
          >
            <div className="sa-grid2">
              <div>
                <div style={{ fontWeight: 950, fontSize: 12, color: 'var(--muted)' }}>Nombre completo</div>
                <input
                  className="sa-select"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  disabled={loading}
                />
              </div>
              <div>
                <div style={{ fontWeight: 950, fontSize: 12, color: 'var(--muted)' }}>Correo</div>
                <input
                  className="sa-select"
                  value={form.correo}
                  onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
                  disabled={loading}
                />
              </div>

              <div>
                <div style={{ fontWeight: 950, fontSize: 12, color: 'var(--muted)' }}>Rol</div>
                <select
                  className="sa-select"
                  value={form.rol}
                  onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
                  disabled={loading}
                >
                  <option value="LOGISTICA">LOGISTICA</option>
                  <option value="GESTOR">GESTOR</option>
                </select>
              </div>

              <div>
                <div style={{ fontWeight: 950, fontSize: 12, color: 'var(--muted)' }}>Estado</div>
                <select
                  className="sa-select"
                  value={form.estado ? '1' : '0'}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value === '1' }))}
                  disabled={loading}
                >
                  <option value="1">ACTIVO</option>
                  <option value="0">INACTIVO</option>
                </select>
              </div>

              {!editing ? (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontWeight: 950, fontSize: 12, color: 'var(--muted)' }}>
                    Contraseña (obligatoria al crear)
                  </div>
                  <input
                    className="sa-select"
                    value={form.passwordTemporal}
                    onChange={(e) => setForm((f) => ({ ...f, passwordTemporal: e.target.value }))}
                    placeholder="Ej: Temp@123"
                    disabled={loading}
                    type="password"
                  />
                </div>
              ) : (
                <div style={{ gridColumn: '1 / -1' }} className="sa-mutedBox">
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 950, fontSize: 12, color: 'var(--muted)' }}>Contraseña</div>
                      <input
                        className="sa-select"
                        value={form.nuevaPassword}
                        onChange={(e) => setForm((f) => ({ ...f, nuevaPassword: e.target.value }))}
                        placeholder="Nueva contraseña (máx. 6 caracteres)"
                        disabled={loading}
                        type="password"
                      />
                    </div>

                    <div>
                      <div style={{ fontWeight: 950, fontSize: 12, color: 'var(--muted)' }}>
                        Confirmar contraseña
                      </div>
                      <input
                        className="sa-select"
                        value={form.confirmarPassword}
                        onChange={(e) => setForm((f) => ({ ...f, confirmarPassword: e.target.value }))}
                        placeholder="Repite la contraseña"
                        disabled={loading}
                        type="password"
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        className="sa-btn sa-btnPrimary"
                        onClick={changePassword}
                        disabled={loading}
                        type="button"
                      >
                        {loading ? 'Actualizando...' : 'Cambiar contraseña'}
                      </button>

                  
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.35 }}>
                       La contraseña actual no se muestra por seguridad. Desde aquí puedes asignar una nueva contraseña al usuario.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Modal>
        </div>
      </div>
    </div>
  )
}

