import React, { useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:4000'

function normalizeNit(value) {
  return String(value || '').trim()
}

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

function Modal({ title, children, onClose, actions }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 45px rgba(15, 23, 42, 0.2)',
          padding: 20
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>{title}</div>
        <div style={{ marginBottom: 16 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>{actions}</div>
      </div>
    </div>
  )
}

export default function EmpresasUsuarios() {
  const [companyForm, setCompanyForm] = useState({
    nombre: '',
    nit: '',
    correo: '',
    telefono: '',
    estado: true
  })

  const [adminForm, setAdminForm] = useState({
    companyId: '',
    nombre: '',
    correo: '',
    password: '',
    estado: true
  })

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [lastCreatedCompany, setLastCreatedCompany] = useState(null)

  const [companies, setCompanies] = useState([])
  const [usersByCompany, setUsersByCompany] = useState({})
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [loadingList, setLoadingList] = useState(false)

  const [editModal, setEditModal] = useState({ open: false, company: null })
  const [editForm, setEditForm] = useState({ nombre: '', nit: '', correo: '', telefono: '', estado: true })
  const [deleteModal, setDeleteModal] = useState({ open: false, company: null })

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
        setAdminForm((v) => ({ ...v, companyId: idToUse }))
      } else {
        setSelectedCompanyId('')
        setAdminForm((v) => ({ ...v, companyId: '' }))
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

  function nitAlreadyExists(nitValue, ignoreCompanyId) {
    const n = normalizeNit(nitValue)
    if (!n) return false
    return companies.some((c) => normalizeNit(c?.nit) === n && String(c?.id_empresa) !== String(ignoreCompanyId || ''))
  }

  async function createCompany(e) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (nitAlreadyExists(companyForm.nit)) {
        showMessage('err', 'Ya existe una empresa con este NIT.')
        return
      }

      const token = localStorage.getItem('token')
      if (!token) throw new Error('No hay token. Vuelve a iniciar sesión.')

      const res = await client.post(
        `${API_BASE}/super-admin/companies`,
        {
          ...companyForm,
          nit: normalizeNit(companyForm.nit) || null,
          estado: companyForm.estado ? 1 : 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const company = res.data?.company
      setLastCreatedCompany(company)
      setAdminForm((v) => ({ ...v, companyId: company?.id_empresa ? String(company.id_empresa) : '' }))
      setCompanyForm({ nombre: '', nit: '', correo: '', telefono: '', estado: true })
      showMessage('ok', 'Empresa creada correctamente.')
      await refreshCompaniesAndMaybeUsers(company?.id_empresa ? String(company.id_empresa) : '')
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error creando empresa'
      showMessage('err', text)
    } finally {
      setLoading(false)
    }
  }

  function openEditCompany(company) {
    setEditForm({
      nombre: company?.nombre || '',
      nit: company?.nit || '',
      correo: company?.correo || '',
      telefono: company?.telefono || '',
      estado: Number(company?.estado) === 1
    })
    setEditModal({ open: true, company })
  }

  async function updateCompany(e) {
    e.preventDefault()
    if (!editModal.company) return
    setLoading(true)
    setMessage(null)

    try {
      if (nitAlreadyExists(editForm.nit, editModal.company.id_empresa)) {
        showMessage('err', 'Ya existe una empresa con este NIT.')
        return
      }

      const token = localStorage.getItem('token')
      if (!token) throw new Error('No hay token. Vuelve a iniciar sesión.')

      await client.put(
        `${API_BASE}/super-admin/companies/${editModal.company.id_empresa}`,
        {
          ...editForm,
          nit: normalizeNit(editForm.nit) || null,
          estado: editForm.estado ? 1 : 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setEditModal({ open: false, company: null })
      showMessage('ok', 'Empresa actualizada correctamente.')
      await refreshCompaniesAndMaybeUsers(String(editModal.company.id_empresa))
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error actualizando empresa'
      showMessage('err', text)
    } finally {
      setLoading(false)
    }
  }

  function askDeleteCompany(company) {
    setDeleteModal({ open: true, company })
  }

  async function deleteCompany() {
    if (!deleteModal.company) return
    setLoading(true)
    setMessage(null)

    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No hay token. Vuelve a iniciar sesión.')

      await client.delete(`${API_BASE}/super-admin/companies/${deleteModal.company.id_empresa}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const deletedId = String(deleteModal.company.id_empresa)
      setDeleteModal({ open: false, company: null })
      showMessage('ok', 'Empresa eliminada correctamente.')

      const nextList = companies.filter((c) => String(c.id_empresa) !== deletedId)
      const nextSelected = String(selectedCompanyId) === deletedId ? (nextList?.[0]?.id_empresa ? String(nextList[0].id_empresa) : '') : selectedCompanyId

      await refreshCompaniesAndMaybeUsers(nextSelected || '')
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error eliminando empresa'
      showMessage('err', text)
    } finally {
      setLoading(false)
    }
  }

  async function createCompanyAdmin(e) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No hay token. Vuelve a iniciar sesión.')

      const res = await client.post(
        `${API_BASE}/super-admin/companies/${adminForm.companyId}/users`,
        {
          nombre: adminForm.nombre,
          correo: adminForm.correo,
          password: adminForm.password,
          estado: adminForm.estado ? 1 : 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      showMessage('ok', `Admin creado: ${res.data?.user?.correo}`)
      setAdminForm((v) => ({ ...v, password: '' }))
      if (adminForm.companyId) {
        const users = await fetchUsers(adminForm.companyId)
        setUsersByCompany((prev) => ({ ...prev, [adminForm.companyId]: users }))
      }
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error creando admin'
      showMessage('err', text)
    } finally {
      setLoading(false)
    }
  }

  const selectedUsers = usersByCompany[selectedCompanyId] || []

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr', alignItems: 'start' }}>
      <Section title="Empresas" subtitle="Visualización limpia: nombre y NIT.">
        {loadingList ? (
          <div style={{ fontWeight: 700, opacity: 0.8 }}>Cargando empresas...</div>
        ) : companies.length === 0 ? (
          <div style={{ fontWeight: 700, opacity: 0.8 }}>No hay empresas registradas.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {companies.map((company) => {
              const isActive = String(selectedCompanyId) === String(company.id_empresa)
              return (
                <button
                  key={company.id_empresa}
                  type="button"
                  onClick={async () => {
                    const id = String(company.id_empresa)
                    setSelectedCompanyId(id)
                    setAdminForm((v) => ({ ...v, companyId: id }))
                    try {
                      const users = await fetchUsers(id)
                      setUsersByCompany((prev) => ({ ...prev, [id]: users }))
                    } catch (err) {
                      const text = err?.response?.data?.message || err?.message || 'Error cargando usuarios'
                      showMessage('err', text)
                    }
                  }}
                  style={{
                    textAlign: 'left',
                    border: isActive ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    borderRadius: 14,
                    padding: 14,
                    background: isActive ? '#eff6ff' : '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 900, color: '#0f172a' }}>{company.nombre}</div>
                  <div style={{ marginTop: 4, fontWeight: 700, color: '#334155' }}>NIT: {company.nit || '—'}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontWeight: 800,
                        fontSize: 12,
                        background: Number(company.estado) === 1 ? '#dcfce7' : '#fee2e2',
                        color: Number(company.estado) === 1 ? '#166534' : '#991b1b'
                      }}
                    >
                      {Number(company.estado) === 1 ? 'Activo' : 'Inactivo'}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditCompany(company)
                      }}
                      style={{ fontWeight: 800, color: '#1d4ed8' }}
                    >
                      Editar
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        askDeleteCompany(company)
                      }}
                      style={{ fontWeight: 800, color: '#b91c1c' }}
                    >
                      Eliminar
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="Crear empresa" subtitle="Registra nombre, NIT, correo, teléfono y estado.">
        <form onSubmit={createCompany}>
          <Field label="Nombre">
            <input
              required
              value={companyForm.nombre}
              onChange={(e) => setCompanyForm((v) => ({ ...v, nombre: e.target.value }))}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <Field label="NIT">
              <input
                value={companyForm.nit}
                onChange={(e) => setCompanyForm((v) => ({ ...v, nit: e.target.value }))}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
              />
            </Field>
            <Field label="Teléfono">
              <input
                value={companyForm.telefono}
                onChange={(e) => setCompanyForm((v) => ({ ...v, telefono: e.target.value }))}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
              />
            </Field>
          </div>

          <Field label="Correo">
            <input
              value={companyForm.correo}
              onChange={(e) => setCompanyForm((v) => ({ ...v, correo: e.target.value }))}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </Field>

          <Field label="Estado">
            <select
              value={companyForm.estado ? '1' : '0'}
              onChange={(e) => setCompanyForm((v) => ({ ...v, estado: e.target.value === '1' }))}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            >
              <option value="1">Activo</option>
              <option value="0">Inactivo</option>
            </select>
          </Field>

          <button
            disabled={loading}
            type="submit"
            style={{ padding: '10px 16px', borderRadius: 10, border: 0, fontWeight: 900, background: '#2563eb', color: 'white' }}
          >
            {loading ? 'Procesando...' : 'Crear empresa'}
          </button>
        </form>
      </Section>

      <Section title="Crear admin de empresa" subtitle="Se crea un usuario con rol ADMIN asociado a la empresa seleccionada.">
        <form onSubmit={createCompanyAdmin}>
          <Field label="Empresa seleccionada">
            <input
              required
              readOnly
              value={adminForm.companyId}
              placeholder="Selecciona una empresa en la lista superior"
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc' }}
            />
          </Field>

          <Field label="Nombre (opcional)">
            <input
              value={adminForm.nombre}
              onChange={(e) => setAdminForm((v) => ({ ...v, nombre: e.target.value }))}
              placeholder="Ej: Admin principal"
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </Field>

          <Field label="Correo del admin">
            <input
              required
              value={adminForm.correo}
              onChange={(e) => setAdminForm((v) => ({ ...v, correo: e.target.value }))}
              type="email"
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </Field>

          <Field label="Password del admin">
            <input
              required
              value={adminForm.password}
              onChange={(e) => setAdminForm((v) => ({ ...v, password: e.target.value }))}
              type="password"
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </Field>

          <Field label="Estado">
            <select
              value={adminForm.estado ? '1' : '0'}
              onChange={(e) => setAdminForm((v) => ({ ...v, estado: e.target.value === '1' }))}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            >
              <option value="1">Activo</option>
              <option value="0">Inactivo</option>
            </select>
          </Field>

          <button
            disabled={loading || !adminForm.companyId}
            type="submit"
            style={{ padding: '10px 16px', borderRadius: 10, border: 0, fontWeight: 900, background: '#16a34a', color: 'white' }}
          >
            {loading ? 'Procesando...' : 'Crear admin'}
          </button>
        </form>

        {adminForm.companyId ? (
          <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Admins de la empresa seleccionada</div>
            {selectedUsers.length === 0 ? (
              <div style={{ fontWeight: 700, opacity: 0.8 }}>No hay usuarios ADMIN registrados.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {selectedUsers.map((u) => (
                  <div key={u.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontWeight: 800 }}>{u.nombre || 'Sin nombre'}</div>
                    <div style={{ opacity: 0.8 }}>{u.correo}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Section>

      {lastCreatedCompany ? (
        <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 14, padding: 16, fontWeight: 800 }}>
          Última empresa creada: {lastCreatedCompany.nombre} | NIT: {lastCreatedCompany.nit || '—'}
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

      {editModal.open ? (
        <Modal
          title={`Editar empresa ${editModal?.company?.nombre ? `- ${editModal.company.nombre}` : ''}`}
          onClose={() => setEditModal({ open: false, company: null })}
          actions={
            <>
              <button
                type="button"
                onClick={() => setEditModal({ open: false, company: null })}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 800 }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="edit-company-form"
                disabled={loading}
                style={{ padding: '10px 14px', borderRadius: 10, border: 0, background: '#2563eb', color: '#fff', fontWeight: 900 }}
              >
                Guardar cambios
              </button>
            </>
          }
        >
          <form id="edit-company-form" onSubmit={updateCompany}>
            <Field label="Nombre">
              <input
                required
                value={editForm.nombre}
                onChange={(e) => setEditForm((v) => ({ ...v, nombre: e.target.value }))}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
              />
            </Field>
            <Field label="NIT">
              <input
                value={editForm.nit}
                onChange={(e) => setEditForm((v) => ({ ...v, nit: e.target.value }))}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
              />
            </Field>
            <Field label="Correo">
              <input
                value={editForm.correo}
                onChange={(e) => setEditForm((v) => ({ ...v, correo: e.target.value }))}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
              />
            </Field>
            <Field label="Teléfono">
              <input
                value={editForm.telefono}
                onChange={(e) => setEditForm((v) => ({ ...v, telefono: e.target.value }))}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
              />
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
          </form>
        </Modal>
      ) : null}

      {deleteModal.open ? (
        <Modal
          title="¿Está seguro de eliminar esta empresa?"
          onClose={() => setDeleteModal({ open: false, company: null })}
          actions={
            <>
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, company: null })}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 800 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={deleteCompany}
                disabled={loading}
                style={{ padding: '10px 14px', borderRadius: 10, border: 0, background: '#dc2626', color: '#fff', fontWeight: 900 }}
              >
                Eliminar empresa
              </button>
            </>
          }
        >
          <div style={{ fontWeight: 700, color: '#334155' }}>
            Esta acción eliminará <b>{deleteModal?.company?.nombre || 'la empresa seleccionada'}</b> de forma permanente.
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
