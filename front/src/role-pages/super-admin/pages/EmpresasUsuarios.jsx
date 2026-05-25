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
    estado: true
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

    const res = await client.get(`${API_BASE}/super-admin/companies`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    return res.data?.companies || []
  }

  async function fetchUsers(companyId) {
    const token = localStorage.getItem('token')
    if (!token) throw new Error('No hay token. Vuelve a iniciar sesión.')

    const res = await client.get(`${API_BASE}/super-admin/companies/${companyId}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    return res.data?.users || []
  }

  async function refreshCompaniesAndMaybeUsers(nextSelectedId) {
    setLoadingList(true)

    try {
      const list = await fetchCompanies()
      setCompanies(list)

      const idToUse = nextSelectedId || selectedCompanyId || (list?.[0]?.id_empresa ? String(list[0].id_empresa) : '')
      if (idToUse) {
        setSelectedCompanyId(idToUse)
        const users = await fetchUsers(idToUse)
        setUsersByCompany((prev) => ({ ...prev, [idToUse]: users }))
      } else {
        setSelectedCompanyId('')
      }
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error cargando información'
      showMessage('err', text)
    } finally {
      setLoadingList(false)
    }
  }

  React.useEffect(() => {
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
      estado: Number(user?.estado) === 1
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
      await client.put(
        `${API_BASE}/super-admin/companies/${editForm.companyId}/users/${editForm.id}`,
        {
          nombre: editForm.nombre,
          correo: editForm.correo,
          estado: editForm.estado ? 1 : 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

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

  const selectedUsers = usersByCompany[selectedCompanyId] || []

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr', alignItems: 'start' }}>
      <Section title="Usuarios creados" subtitle="Solo visualización de empresas y sus administradores.">
        {loadingList ? (
          <div style={{ fontWeight: 700, opacity: 0.8 }}>Cargando información...</div>
        ) : companies.length === 0 ? (
          <div style={{ fontWeight: 700, opacity: 0.8 }}>No hay empresas disponibles.</div>
        ) : (
          <>
            <Field label="Empresa">
              <select
                value={selectedCompanyId}
                onChange={async (e) => {
                  const id = String(e.target.value || '')
                  setSelectedCompanyId(id)
                  if (!id) return
                  try {
                    const users = await fetchUsers(id)
                    setUsersByCompany((prev) => ({ ...prev, [id]: users }))
                  } catch (err) {
                    const text = err?.response?.data?.message || err?.message || 'Error cargando usuarios'
                    showMessage('err', text)
                  }
                }}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
              >
                <option value="">Selecciona una empresa</option>
                {companies.map((company) => (
                  <option key={company.id_empresa} value={String(company.id_empresa)}>
                    {company.nombre}
                  </option>
                ))}
              </select>
            </Field>

            <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Admins de la empresa seleccionada</div>
              {!selectedCompanyId ? (
                <div style={{ fontWeight: 700, opacity: 0.8 }}>Selecciona una empresa para ver usuarios.</div>
              ) : selectedUsers.length === 0 ? (
                <div style={{ fontWeight: 700, opacity: 0.8 }}>No hay usuarios registrados.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {selectedUsers.map((u) => (
                    <div key={u.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 800 }}>{u.nombre || 'Sin nombre'}</div>
                      <div style={{ opacity: 0.8 }}>{u.correo}</div>
                      <div style={{ opacity: 0.75, marginTop: 4, fontWeight: 700 }}>
                        Rol: {u.rol || 'ADMIN'} · Estado: {Number(u.estado) === 1 ? 'Activo' : 'Inactivo'}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          style={{
                            background: '#2563eb',
                            color: 'white',
                            border: '1px solid #2563eb',
                            borderRadius: 8,
                            padding: '8px 12px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          disabled={togglingUserId === String(u.id)}
                          onClick={() => toggleUserStatus(u)}
                          style={{
                            background: '#2563eb',
                            color: 'white',
                            border: '1px solid #2563eb',
                            borderRadius: 8,
                            padding: '8px 12px',
                            fontWeight: 800,
                            cursor: togglingUserId === String(u.id) ? 'not-allowed' : 'pointer',
                            opacity: togglingUserId === String(u.id) ? 0.7 : 1
                          }}
                        >
                          {togglingUserId === String(u.id)
                            ? 'Actualizando...'
                            : Number(u.estado) === 1
                            ? 'Desactivar'
                            : 'Activar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Section>

      {editModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 560,
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: 18,
              background: 'white',
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.04)'
            }}
          >
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Editar usuario</div>
              <div style={{ opacity: 0.8, marginTop: 6, fontWeight: 700 }}>Actualiza nombre, correo, rol y estado.</div>
            </div>

            <form onSubmit={submitEditUser}>
              <Field label="Nombre">
                <input
                  required
                  value={editForm.nombre}
                  onChange={(e) => setEditForm((v) => ({ ...v, nombre: e.target.value }))}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
                />
              </Field>

              <Field label="Correo">
                <input
                  required
                  type="email"
                  value={editForm.correo}
                  onChange={(e) => setEditForm((v) => ({ ...v, correo: e.target.value }))}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
                />
              </Field>

              <Field label="Rol">
                <select
                  value={editForm.rol}
                  onChange={(e) => setEditForm((v) => ({ ...v, rol: e.target.value }))}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
                >
                  <option value="ADMIN">ADMIN</option>
                </select>
              </Field>

              <Field label="Estado">
                <select
                  value={editForm.estado ? '1' : '0'}
                  onChange={(e) => setEditForm((v) => ({ ...v, estado: e.target.value === '1' }))}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
                >
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </Field>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeEditModal}
                  style={{
                    background: 'white',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  style={{
                    background: '#2563eb',
                    color: 'white',
                    border: '1px solid #2563eb',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontWeight: 800,
                    cursor: savingEdit ? 'not-allowed' : 'pointer',
                    opacity: savingEdit ? 0.7 : 1
                  }}
                >
                  {savingEdit ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            border: `1px solid ${message.kind === 'ok' ? '#86efac' : '#fca5a5'}`,
            background: message.kind === 'ok' ? 'linear-gradient(180deg,#f0fdf4,#dcfce7)' : 'linear-gradient(180deg,#fff1f2,#ffe4e6)',
            borderRadius: 14,
            padding: 16,
            fontWeight: 900,
            boxShadow: '0 10px 24px rgba(15,23,42,0.08)'
          }}
        >
          {message.text}
        </div>
      ) : null}
    </div>
  )
}
