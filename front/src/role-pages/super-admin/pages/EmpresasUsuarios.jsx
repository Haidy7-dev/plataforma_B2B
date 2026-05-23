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
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: 'white' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
        {subtitle ? <div style={{ opacity: 0.8, marginTop: 6, fontWeight: 700 }}>{subtitle}</div> : null}
      </div>
      {children}
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

  const client = useMemo(() => axios.create({}), [])

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
    setMessage(null)

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
      setMessage({ kind: 'err', text })
    } finally {
      setLoadingList(false)
    }
  }

  // load on mount
  React.useEffect(() => {
    refreshCompaniesAndMaybeUsers('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function createCompany(e) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No hay token. Vuelve a iniciar sesión.')

      const res = await client.post(
        `${API_BASE}/super-admin/companies`,
        {
          ...companyForm,
          estado: companyForm.estado ? 1 : 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const company = res.data?.company
      setLastCreatedCompany(company)
      setAdminForm((v) => ({ ...v, companyId: company?.id_empresa || '' }))
      setMessage({ kind: 'ok', text: `Empresa creada: ${company?.nombre} (id=${company?.id_empresa})` })
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error creando empresa'
      setMessage({ kind: 'err', text })
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

      setMessage({ kind: 'ok', text: `Admin creado: ${res.data?.user?.correo}` })
      setAdminForm((v) => ({ ...v, password: '' }))
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error creando admin'
      setMessage({ kind: 'err', text })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr', alignItems: 'start' }}>
      <Section
        title="Crear empresa"
        subtitle="Registra nombre, NIT, correo, teléfono y estado."
      >
        <form onSubmit={createCompany}>
          <Field label="Nombre">
            <input
              required
              value={companyForm.nombre}
              onChange={(e) => setCompanyForm((v) => ({ ...v, nombre: e.target.value }))}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
            {loading ? 'Creando...' : 'Crear empresa'}
          </button>
        </form>
      </Section>

      <Section
        title="Crear admin de empresa"
        subtitle="Se crea un usuario con rol ADMIN y id_empresa asociado."
      >
        <form onSubmit={createCompanyAdmin}>
          <Field label="ID de empresa">
            <input
              required
              value={adminForm.companyId}
              onChange={(e) => setAdminForm((v) => ({ ...v, companyId: e.target.value }))}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
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
            disabled={loading}
            type="submit"
            style={{ padding: '10px 16px', borderRadius: 10, border: 0, fontWeight: 900, background: '#16a34a', color: 'white' }}
          >
            {loading ? 'Creando...' : 'Crear admin'}
          </button>
        </form>
      </Section>

      {lastCreatedCompany ? (
        <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 14, padding: 16, fontWeight: 800 }}>
          Última empresa creada: {lastCreatedCompany.nombre} (id={lastCreatedCompany.id_empresa})
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            border: `1px solid ${message.kind === 'ok' ? '#bbf7d0' : '#fecaca'}`,
            background: message.kind === 'ok' ? '#f0fdf4' : '#fef2f2',
            borderRadius: 14,
            padding: 16,
            fontWeight: 900
          }}
        >
          {message.text}
        </div>
      ) : null}
    </div>
  )
}

