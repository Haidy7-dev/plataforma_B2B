import React, { useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:4000'

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, background: 'white', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.04)' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
        {subtitle ? <div style={{ opacity: 0.8, marginTop: 6, fontWeight: 700 }}>{subtitle}</div> : null}
      </div>
      {children}
    </div>
  )
}

export default function EmpresasUsuarios() {
  const [message, setMessage] = useState(null)
  const [companies, setCompanies] = useState([])
  const [usersByCompany, setUsersByCompany] = useState({})
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [togglingUserId, setTogglingUserId] = useState(null)
  const [editForm, setEditForm] = useState({
    id: '',
    companyId: '',
    nombre: '',
    correo: '',
    rol: 'ADMIN',
    estado: true,
    password: ''
  })

  const client = useMemo(() => axios.create({}), [])

  function showMessage(kind, text) {
    setMessage({ kind, text })
    window.setTimeout(() => {
      setMessage((prev) => (prev?.text === text ? null : prev))
    }, 3500)
  }

  async function fetchCompanies() {
    const token = localStorage.getItem('token')
    if (!token) throw new Error('No hay token. Vuelve a iniciar sesión.')

    try {
      const res = await client.get(`${API_BASE}/super-admin/companies`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data?.companies || []
    } catch (err) {
      console.error('[EmpresasUsuarios] fetchCompanies error', {
        status: err?.response?.status,
        url: `${API_BASE}/super-admin/companies`,
        data: err?.response?.data,
        message: err?.message
      })
      throw err
    }
  }

  async function fetchUsers(companyId) {
    const token = localStorage.getItem('token')
    if (!token) throw new Error('No hay token. Vuelve a iniciar sesión.')

    try {
      const res = await client.get(`${API_BASE}/super-admin/companies/${companyId}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data?.users || []
    } catch (err) {
      console.error('[EmpresasUsuarios] fetchUsers error', {
        status: err?.response?.status,
        url: `${API_BASE}/super-admin/companies/${companyId}/users`,
        data: err?.response?.data,
        message: err?.message
      })
      throw err
    }
  }

  async function refreshCompaniesAndMaybeUsers(nextSelectedId) {
    console.log('[EmpresasUsuarios] refreshCompaniesAndMaybeUsers start', { nextSelectedId })
    setLoadingList(true)

    try {
      const list = await fetchCompanies()
      setCompanies(list)

      const idToUse =
        nextSelectedId ||
        selectedCompanyId ||
        (list?.[0]?.id_empresa ? String(list[0].id_empresa) : '')

      if (idToUse) {
        setSelectedCompanyId(idToUse)
        const users = await fetchUsers(idToUse)
        setUsersByCompany((prev) => ({ ...prev, [idToUse]: users }))
      } else {
        setSelectedCompanyId('')
      }
    } catch (err) {
      console.error('[EmpresasUsuarios] refreshCompaniesAndMaybeUsers failed', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message
      })
      const text = err?.response?.data?.message || err?.message || 'Error cargando información'
      showMessage('err', text)
    } finally {
      setLoadingList(false)
    }
  }

  React.useEffect(() => {
    console.log('[EmpresasUsuarios] mounted', {
      tokenPresent: Boolean(localStorage.getItem('token'))
    })
    refreshCompaniesAndMaybeUsers('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refreshUsersForCompany(companyId) {
    if (!companyId) return
    const users = await fetchUsers(companyId)
    setUsersByCompany((prev) => ({ ...prev, [companyId]: users }))
  }

  function openEditModal(user) {
    setEditForm({
      id: String(user?.id || ''),
      companyId: String(selectedCompanyId || ''),
      nombre: String(user?.nombre || ''),
      correo: String(user?.correo || ''),
      rol: String(user?.rol || 'ADMIN'),
      estado: Number(user?.estado) === 1,
      password: ''
    })
    setEditModalOpen(true)
  }

  function closeEditModal() {
    setEditModalOpen(false)
    setSavingEdit(false)
  }

  async function submitEditUser(e) {
    e.preventDefault()
    const token = localStorage.getItem('token')
    if (!token) {
      showMessage('err', 'No hay token. Vuelve a iniciar sesión.')
      return
    }

    if (!editForm.companyId || !editForm.id) {
      showMessage('err', 'No se pudo identificar el usuario a editar.')
      return
    }

    setSavingEdit(true)
    try {
      // 1) Actualizar nombre/correo/estado (siempre)
      await client.put(
        `${API_BASE}/super-admin/companies/${editForm.companyId}/users/${editForm.id}`,
        {
          nombre: editForm.nombre,
          correo: editForm.correo,
          estado: editForm.estado ? 1 : 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // 2) Si se escribió nueva contraseña, actualizar password
      const hasNewPassword = String(editForm.password || '').trim().length > 0
      if (hasNewPassword) {
        const passStr = String(editForm.password).trim()
        await client.put(
          `${API_BASE}/super-admin/companies/${editForm.companyId}/users/${editForm.id}/password`,
          { password: passStr },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      }

      await refreshUsersForCompany(editForm.companyId)
      showMessage('ok', 'Usuario actualizado correctamente.')
      closeEditModal()
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error actualizando usuario'
      showMessage('err', text)
      setSavingEdit(false)
    }
  }

  async function toggleUserStatus(user) {
    const token = localStorage.getItem('token')
    if (!token) {
      showMessage('err', 'No hay token. Vuelve a iniciar sesión.')
      return
    }
    if (!selectedCompanyId || !user?.id) return

    setTogglingUserId(String(user.id))
    try {
      const nextEstado = Number(user.estado) === 1 ? 0 : 1
      await client.patch(
        `${API_BASE}/super-admin/companies/${selectedCompanyId}/users/${user.id}/status`,
        { estado: nextEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      await refreshUsersForCompany(String(selectedCompanyId))
      showMessage('ok', `Usuario ${nextEstado === 1 ? 'activado' : 'desactivado'} correctamente.`)
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error actualizando estado'
      showMessage('err', text)
    } finally {
      setTogglingUserId(null)
    }
  }

  async function deleteUser(user) {
    const token = localStorage.getItem('token')
    if (!token) {
      showMessage('err', 'No hay token. Vuelve a iniciar sesión.')
      return
    }
    if (!selectedCompanyId || !user?.id) return

    const ok = window.confirm(
      `¿Eliminar al usuario admin "${user?.nombre || ''}"? Esta acción no se puede deshacer.`
    )
    if (!ok) return

    try {
      await client.delete(
        `${API_BASE}/super-admin/companies/${selectedCompanyId}/users/${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      await refreshUsersForCompany(String(selectedCompanyId))
      showMessage('ok', 'Usuario eliminado correctamente.')
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error eliminando usuario'
      showMessage('err', text)
    }
  }

  const selectedUsers = usersByCompany[selectedCompanyId] || []

  async function deleteCompany(companyId) {
    const token = localStorage.getItem('token')
    if (!token) {
      showMessage('err', 'No hay token. Vuelve a iniciar sesión.')
      return
    }
    if (!companyId) return

    const company = companies?.find((c) => String(c?.id_empresa || c?.id) === String(companyId))
    const ok = window.confirm(
      `¿Eliminar la empresa "${company?.nombre || company?.razon_social || 'sin nombre'}"? Esta acción no se puede deshacer.`
    )
    if (!ok) return

    try {
      await client.delete(`${API_BASE}/super-admin/companies/${companyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      // refrescar lista
      await refreshCompaniesAndMaybeUsers(String(selectedCompanyId || ''))
      showMessage('ok', 'Empresa eliminada correctamente.')
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error eliminando empresa'
      showMessage('err', text)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: 0, marginBottom: 16 }}>Empresas & Usuarios</h2>

      {message ? (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            background: message.kind === 'ok' ? '#ECFDF5' : '#FEF2F2',
            color: message.kind === 'ok' ? '#065F46' : '#991B1B',
            border: `1px solid ${message.kind === 'ok' ? '#10B981' : '#EF4444'}`
          }}
        >
          {message.text}
        </div>
      ) : null}

      <Section title="Usuarios Admin" subtitle={selectedCompanyId ? 'Gestiona accesos y estado' : 'Selecciona una empresa'}>
        {loadingList ? (
          <div>Cargando usuarios...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #E2E8F0' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #E2E8F0' }}>Correo</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #E2E8F0' }}>Estado</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #E2E8F0' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {selectedUsers.length ? (
                  selectedUsers.map((u) => {
                    const estado = Number(u?.estado) === 1 ? 'Activo' : 'Inactivo'
                    const estadoColor = Number(u?.estado) === 1 ? '#059669' : '#DC2626'
                    return (
                      <tr key={u?.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: 10, fontWeight: 800 }}>{u?.nombre || '—'}</td>
                        <td style={{ padding: 10 }}>{u?.correo || '—'}</td>
                        <td style={{ padding: 10, fontWeight: 900, color: estadoColor }}>{estado}</td>
                        <td style={{ padding: 10 }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => toggleUserStatus(u)}
                              disabled={togglingUserId === String(u?.id)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 10,
                                border: '1px solid #CBD5E1',
                                background: 'white'
                              }}
                            >
                              {togglingUserId === String(u?.id) ? '...' : 'Activar/Desactivar'}
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 10,
                                border: '1px solid #CBD5E1',
                                background: 'white'
                              }}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteUser(u)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 10,
                                border: '1px solid #FCA5A5',
                                background: '#FEF2F2',
                                color: '#991B1B'
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: 14, opacity: 0.8 }}>
                      No hay usuarios para esta empresa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div style={{ height: 16 }} />

      <Section title="Empresas" subtitle="Puedes eliminar empresas desde aquí. También selecciona una empresa para ver sus usuarios">
        {loadingList ? (
          <div style={{ fontWeight: 800, opacity: 0.8 }}>Cargando empresas...</div>
        ) : companies.length === 0 ? (
          <div style={{ fontWeight: 800, opacity: 0.8 }}>No hay empresas disponibles.</div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {/* Selector + botón actualizar */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={selectedCompanyId}
                onChange={(e) => refreshCompaniesAndMaybeUsers(e.target.value)}
                style={{ flex: 1, minWidth: 260, padding: 10, borderRadius: 12, border: '1px solid #CBD5E1' }}
                disabled={loadingList}
              >
                {companies.map((c) => (
                  <option key={c?.id_empresa || c?.id} value={String(c?.id_empresa || c?.id)}>
                    {c?.nombre || c?.razon_social || 'Empresa'}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => refreshCompaniesAndMaybeUsers('')}
                disabled={loadingList}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #CBD5E1',
                  background: 'white',
                  fontWeight: 900
                }}
              >
                {loadingList ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>

            {/* Lista de empresas con botón Eliminar */}
            <div style={{ display: 'grid', gap: 10 }}>
              {companies.map((c) => {
                const id = String(c?.id_empresa || c?.id)
                const isSelected = String(selectedCompanyId || '') === id
                return (
                  <div
                    key={id}
                    style={{
                      border: `1px solid ${isSelected ? '#93C5FD' : '#E2E8F0'}`,
                      background: isSelected ? '#EFF6FF' : 'white',
                      borderRadius: 12,
                      padding: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12
                    }}
                  >
                    <div style={{ minWidth: 200 }}>
                      <div style={{ fontWeight: 1000 }}>{c?.nombre || c?.razon_social || 'Empresa'}</div>
                      <div style={{ opacity: 0.75, fontWeight: 800, marginTop: 4 }}>NIT: {c?.nit || '-'}</div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        disabled={loadingList}
                        onClick={() => refreshCompaniesAndMaybeUsers(id)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: `1px solid ${isSelected ? '#2563eb' : '#CBD5E1'}`,
                          background: isSelected ? '#2563eb' : 'white',
                          color: isSelected ? 'white' : 'black',
                          fontWeight: 900
                        }}
                      >
                        {isSelected ? 'Seleccionada' : 'Ver usuarios'}
                      </button>

                      <button
                        type="button"
                        disabled={loadingList}
                        onClick={() => deleteCompany(id)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 10,
                          background: '#dc2626',
                          color: 'white',
                          border: '1px solid #dc2626',
                          fontWeight: 900,
                          cursor: loadingList ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Section>

      {/* Modal de edición (simple) */}
      {editModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div style={{ width: 'min(720px, 100%)', background: 'white', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 1000, fontSize: 18 }}>Editar usuario</div>
              <button type="button" onClick={closeEditModal} style={{ border: 'none', background: 'transparent', fontSize: 18 }}>
                ✕
              </button>
            </div>

            <form onSubmit={submitEditUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Nombre">
                  <input
                    value={editForm.nombre}
                    onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))}
                    style={{ width: '100%', padding: 10, borderRadius: 12, border: '1px solid #CBD5E1' }}
                    required
                  />
                </Field>

                <Field label="Correo">
                  <input
                    value={editForm.correo}
                    onChange={(e) => setEditForm((p) => ({ ...p, correo: e.target.value }))}
                    style={{ width: '100%', padding: 10, borderRadius: 12, border: '1px solid #CBD5E1' }}
                    type="email"
                    required
                  />
                </Field>
              </div>

              <div style={{ marginTop: 12 }}>
                <Field label="Estado">
                  <select
                    value={editForm.estado ? 1 : 0}
                    onChange={(e) => setEditForm((p) => ({ ...p, estado: Number(e.target.value) === 1 }))}
                    style={{ width: '100%', padding: 10, borderRadius: 12, border: '1px solid #CBD5E1' }}
                  >
                    <option value={1}>Activo</option>
                    <option value={0}>Inactivo</option>
                  </select>
                </Field>
              </div>

              <div style={{ marginTop: 12 }}>
                <Field label="Nueva contraseña">
                  <input
                    value={editForm.password}
                    onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                    style={{ width: '100%', padding: 10, borderRadius: 12, border: '1px solid #CBD5E1' }}
                    inputMode="numeric"
                    autoComplete="new-password"
                    placeholder="Ej: 123456"
                  />
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, opacity: 0.75 }}>
                    Déjalo vacío para no cambiar la contraseña.
                  </div>
                </Field>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" onClick={closeEditModal} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #CBD5E1', background: 'white' }}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #10B981', background: '#10B981', color: 'white', fontWeight: 900 }}
                >
                  {savingEdit ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
