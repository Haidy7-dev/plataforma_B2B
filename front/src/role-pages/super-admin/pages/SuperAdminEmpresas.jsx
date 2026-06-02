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

export default function SuperAdminEmpresas() {
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
  const [companies, setCompanies] = useState([])
  const [loadingList, setLoadingList] = useState(false)

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

  React.useEffect(() => {
    async function load() {
      setLoadingList(true)
      try {
        const list = await fetchCompanies()
        setCompanies(list)
      } catch (err) {
        const text = err?.response?.data?.message || err?.message || 'Error cargando empresas'
        showMessage('err', text)
      } finally {
        setLoadingList(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function nitAlreadyExists(nitValue) {
    const n = normalizeNit(nitValue)
    if (!n) return false
    return companies.some((c) => normalizeNit(c?.nit) === n)
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

      // Validación UI (frontend) - backend también valida
      const correoStr = String(companyForm.correo || '').trim()
      const isValidCompanyEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoStr)
      if (!isValidCompanyEmail) {
        showMessage('err', 'Ingrese un correo electrónico válido para la empresa.')
        return
      }

      // Validación UI extra (backend también valida)
      const telefonoStr = String(companyForm.telefono || '')
      if (!/^3\d{9}$/.test(telefonoStr)) {
        showMessage('err', 'Ingrese un número de teléfono válido de 10 dígitos.')
        return
      }

      const token = localStorage.getItem('token')
      if (!token) throw new Error('No hay token. Vuelve a iniciar sesión.')

      const res = await client.post(
        `${API_BASE}/super-admin/companies`,
        {
          ...companyForm,
          telefono: telefonoStr,
          nit: normalizeNit(companyForm.nit) || null,
          estado: companyForm.estado ? 1 : 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const createdCompanyId = String(res?.data?.company?.id_empresa || '')
      showMessage('ok', 'Empresa creada correctamente.')
      setCompanyForm({ nombre: '', nit: '', correo: '', telefono: '', estado: true })

      const list = await fetchCompanies()
      setCompanies(list)

      if (createdCompanyId) {
        setAdminForm((v) => ({ ...v, companyId: createdCompanyId }))
      }
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error creando empresa'
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
      const passStr = String(adminForm.password || '')
      if (!/^\d{6}$/.test(passStr)) {
        showMessage('err', 'Password inválida: debe tener exactamente 6 dígitos numéricos.')
        return
      }

      const token = localStorage.getItem('token')
      if (!token) throw new Error('No hay token. Vuelve a iniciar sesión.')

      const res = await client.post(
        `${API_BASE}/super-admin/companies/${adminForm.companyId}/users`,
        {
          nombre: adminForm.nombre,
          correo: adminForm.correo,
          password: passStr,
          estado: adminForm.estado ? 1 : 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      showMessage('ok', `Administrador creado: ${res.data?.user?.correo}`)
      setAdminForm((v) => ({ ...v, nombre: '', correo: '', password: '', estado: true }))
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error creando admin'
      showMessage('err', text)
    } finally {
      setLoading(false)
    }
  }

  async function deleteCompany(companyId) {
    const token = localStorage.getItem('token')
    if (!token) {
      showMessage('err', 'No hay token. Vuelve a iniciar sesión.')
      return
    }

    if (!companyId) return

    const ok = window.confirm('¿Seguro que deseas eliminar esta empresa? Esta acción no se puede deshacer.')
    if (!ok) return

    setLoading(true)
    setMessage(null)
    try {
      await client.delete(`${API_BASE}/super-admin/companies/${companyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      showMessage('ok', 'Empresa eliminada correctamente.')

      const list = await fetchCompanies()
      setCompanies(list)

      // Si eliminaste la empresa seleccionada para crear admin, limpiar selección
      setAdminForm((v) => {
        const nextCompanyId = String(v.companyId || '') === String(companyId) ? '' : v.companyId
        return { ...v, companyId: nextCompanyId }
      })

      // También limpia el formulario de admin
      setAdminForm((v) => ({ ...v, nombre: '', correo: '', password: '', estado: true }))
    } catch (err) {
      const text = err?.response?.data?.message || err?.message || 'Error eliminando empresa'
      showMessage('err', text)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr', alignItems: 'start' }}>
      <Section title="Crear empresa" subtitle="Aquí se registra la empresa y luego su administrador.">
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
                required
                inputMode="numeric"
                pattern="^3\d{9}$"
                minLength={10}
                maxLength={10}
                value={companyForm.telefono}
                onChange={(e) => {
                  const next = e.target.value
                  // permitir solo dígitos mientras se escribe
                  const onlyDigits = next.replace(/\D/g, '')
                  setCompanyForm((v) => ({ ...v, telefono: onlyDigits.slice(0, 10) }))
                }}
                placeholder="10 dígitos"
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

      <Section title="Crear administrador de empresa" subtitle="Selecciona empresa y registra su administrador.">
        <form onSubmit={createCompanyAdmin}>
          <Field label="Empresa">
            <select
              required
              value={adminForm.companyId}
              onChange={(e) => setAdminForm((v) => ({ ...v, companyId: String(e.target.value || '') }))}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            >
              <option value="">{loadingList ? 'Cargando empresas...' : 'Selecciona una empresa'}</option>
              {companies.map((company) => (
                <option key={company.id_empresa} value={String(company.id_empresa)}>
                  {company.nombre}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nombre">
            <input
              value={adminForm.nombre}
              onChange={(e) => setAdminForm((v) => ({ ...v, nombre: e.target.value }))}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </Field>

          <Field label="Correo del admin">
            <input
              required
              type="email"
              value={adminForm.correo}
              onChange={(e) => setAdminForm((v) => ({ ...v, correo: e.target.value }))}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </Field>

          <Field label="Password del admin">
            <input
              required
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              value={adminForm.password}
              onChange={(e) => {
                const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 6)
                setAdminForm((v) => ({ ...v, password: onlyDigits }))
              }}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
              placeholder="6 dígitos"
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
            style={{ padding: '10px 16px', borderRadius: 10, border: 0, fontWeight: 900, background: '#2563eb', color: 'white' }}
          >
            {loading ? 'Procesando...' : 'Crear admin'}
          </button>
        </form>
      </Section>

     

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
