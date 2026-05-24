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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
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
