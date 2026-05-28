﻿import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PremiumRoleLayout from '../../components/layout/PremiumRoleLayout.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'

const API_BASE = 'http://localhost:4000'
const PLACEHOLDER_IMG =
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=1200&auto=format&fit=crop'

const stepLabels = ['Cliente', 'Espacio', 'Fecha', 'Horario', 'Recursos', 'Confirmar']

function toYmdLocal(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function splitScheduleRange(horario) {
  const [rawStart, rawEnd] = String(horario || '').split('-').map((x) => x.trim())
  const normalize = (v) => (/^\d{2}:\d{2}$/.test(v || '') ? `${v}:00` : v)
  return { hora_inicio: normalize(rawStart), hora_fin: normalize(rawEnd) }
}

function normalizeResourceFromApi(item) {
  return {
    id_recurso: Number(item?.id_recurso),
    nombre: String(item?.nombre || ''),
    tipo: String(item?.tipo || 'General'),
    stock: Number(item?.stock || 0),
    precio: Number(item?.precio || 0)
  }
}

function buildDefaultRanges() {
  return ['08:00 - 12:00', '13:00 - 17:00', '18:00 - 22:00']
}

export default function GestorReservasLayout() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const authToken = token || localStorage.getItem('token') || ''

  const [currentStep, setCurrentStep] = useState(1)
  const [spaces, setSpaces] = useState([])
  const [resources, setResources] = useState([])
  const [selectedResources, setSelectedResources] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingSpaces, setLoadingSpaces] = useState(false)
  const [loadingResources, setLoadingResources] = useState(false)
  const [uiMessage, setUiMessage] = useState({ type: '', text: '' })
  const [spaceSearch, setSpaceSearch] = useState('')

  const [form, setForm] = useState({
    idCliente: '',
    nombre: '',
    telefono: '',
    correo: '',
    espacio: '',
    idEspacio: '',
    fecha: toYmdLocal(),
    horario: '',
    horariosDisponibles: buildDefaultRanges(),
    clientSaved: false
  })

  function normalizeDigits(value) {
    return String(value || '').replace(/\D/g, '')
  }

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const filteredSpaces = useMemo(() => {
    const q = String(spaceSearch || '').trim().toLowerCase()
    if (!q) return spaces
    return spaces.filter((s) => {
      const text = `${s.nombre || ''} ${s.capacidad || ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [spaces, spaceSearch])

  const selectedResourcesList = useMemo(() => {
    return resources
      .map((r) => {
        const selected = selectedResources[r.id_recurso]
        if (!selected || !selected.selected) return null
        return {
          id_recurso: Number(r.id_recurso),
          nombre: r.nombre,
          cantidad: Number(selected.cantidad || 0),
          stock: Number(r.stock || 0),
          precio: Number(r.precio || 0)
        }
      })
      .filter(Boolean)
  }, [resources, selectedResources])

  const totalRecursos = useMemo(() => {
    return selectedResourcesList.reduce((acc, r) => acc + Number(r.precio || 0) * Number(r.cantidad || 0), 0)
  }, [selectedResourcesList])

  const resourcesValidation = useMemo(() => {
    const errors = []
    for (const item of selectedResourcesList) {
      if (!Number.isFinite(item.cantidad) || item.cantidad <= 0) {
        errors.push(`El recurso "${item.nombre}" debe tener cantidad mayor a cero.`)
      }
      if (item.cantidad > item.stock) {
        errors.push(`La cantidad de "${item.nombre}" no puede superar el stock (${item.stock}).`)
      }
    }
    return { valid: errors.length === 0, errors }
  }, [selectedResourcesList])

  function canContinue(step) {
    if (step === 1) {
      return Number(form.idCliente) > 0 && form.nombre.trim().length >= 2 && normalizeDigits(form.telefono).length === 10 && /\S+@\S+\.\S+/.test(form.correo)
    }
    if (step === 2) return Boolean(form.idEspacio)
    if (step === 3) return Boolean(form.fecha)
    if (step === 4) return Boolean(form.horario)
    if (step === 5) return resourcesValidation.valid
    return true
  }

  function nextStep() {
    if (!canContinue(currentStep)) return
    setUiMessage({ type: '', text: '' })
    if (currentStep < 6) setCurrentStep((s) => s + 1)
  }

  function prevStep() {
    setUiMessage({ type: '', text: '' })
    if (currentStep > 1) setCurrentStep((s) => s - 1)
  }

  function resetFlow() {
    setCurrentStep(1)
    setUiMessage({ type: '', text: '' })
    setSelectedResources({})
    setForm({
      idCliente: '',
      nombre: '',
      telefono: '',
      correo: '',
      espacio: '',
      idEspacio: '',
      fecha: toYmdLocal(),
      horario: '',
      horariosDisponibles: buildDefaultRanges(),
      clientSaved: false
    })
  }

  async function request(path, options = {}) {
    const normalizedPath = String(path || '').startsWith('/api/')
      ? String(path || '')
      : `/api${String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`}`

    let response
    try {
      response = await fetch(normalizedPath, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      })
    } catch {
      throw new Error('No se pudo conectar con el servidor. Verifica que el backend esté activo en puerto 4000.')
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const backendMessage = String(data?.message || data?.error || '').trim()
      const statusInfo = response?.status ? ` (HTTP ${response.status})` : ''
      throw new Error(backendMessage || `Error en la solicitud${statusInfo}`)
    }

    return data
  }

  useEffect(() => {
    async function loadSpaces() {
      if (!authToken) return
      setLoadingSpaces(true)
      try {
        const data = await request('/gestor/spaces')
        const normalized = (data?.spaces || []).map((s) => ({
          id: Number(s?.id ?? s?.id_espacio),
          nombre: s?.nombre || '',
          capacidad: Number(s?.capacidad || 0),
          precio: Number(s?.precio || 0),
          estado: Number(s?.estado || 0),
          imagen: s?.imagen || ''
        }))
        setSpaces(normalized)
      } catch {
        setSpaces([])
      } finally {
        setLoadingSpaces(false)
      }
    }
    loadSpaces().catch(() => {})
  }, [authToken])

  useEffect(() => {
    async function loadResources() {
      if (!authToken) return
      setLoadingResources(true)
      try {
        const data = await request('/gestor/resources')
        const normalized = (data?.resources || []).map(normalizeResourceFromApi)
        setResources(normalized)
      } catch {
        setResources([])
      } finally {
        setLoadingResources(false)
      }
    }
    loadResources().catch(() => {})
  }, [authToken])

  function toggleResource(resource) {
    setSelectedResources((prev) => {
      const current = prev[resource.id_recurso]
      if (current?.selected) {
        return {
          ...prev,
          [resource.id_recurso]: {
            ...current,
            selected: false
          }
        }
      }
      return {
        ...prev,
        [resource.id_recurso]: {
          selected: true,
          cantidad: current?.cantidad && current.cantidad > 0 ? current.cantidad : 1
        }
      }
    })
  }

  function updateResourceQuantity(idRecurso, value) {
    const base = resources.find((r) => Number(r.id_recurso) === Number(idRecurso))
    const stock = Number(base?.stock || 0)
    const raw = Number(value)
    const nextQty = Number.isFinite(raw) ? Math.max(0, raw) : 0

    setSelectedResources((prev) => ({
      ...prev,
      [idRecurso]: {
        ...(prev[idRecurso] || { selected: true }),
        selected: true,
        cantidad: Math.min(nextQty, stock)
      }
    }))
  }

  async function handleSaveOrUpdateClient() {
    const idCliente = Number(form.idCliente)
    if (!idCliente) {
      setUiMessage({ type: 'error', text: 'Debes ingresar una cédula válida.' })
      return
    }

    if (!canContinue(1)) {
      setUiMessage({ type: 'error', text: 'Completa correctamente los datos del cliente.' })
      return
    }

    setLoading(true)
    setUiMessage({ type: '', text: '' })

    try {
      const payload = {
        id_cliente: idCliente,
        nombre: form.nombre.trim(),
        telefono: normalizeDigits(form.telefono),
        correo: form.correo.trim()
      }

      try {
        await request('/gestor/clients', { method: 'POST', body: payload })
      } catch (postErr) {
        if (String(postErr?.message || '').toLowerCase().includes('ya existe')) {
          await request(`/gestor/clients/${idCliente}`, {
            method: 'PUT',
            body: {
              nombre: payload.nombre,
              telefono: payload.telefono,
              correo: payload.correo
            }
          })
        } else {
          throw postErr
        }
      }

      setForm((prev) => ({ ...prev, clientSaved: true }))
      setUiMessage({ type: 'success', text: 'Cliente validado/actualizado correctamente.' })
      setCurrentStep(2)
    } catch (e) {
      setUiMessage({ type: 'error', text: String(e?.message || 'No se pudo guardar el cliente.') })
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmReservation() {
    setUiMessage({ type: '', text: '' })

    if (!canContinue(5)) {
      setUiMessage({ type: 'error', text: resourcesValidation.errors[0] || 'Revisa los recursos seleccionados.' })
      return
    }

    if (!canContinue(4) || !canContinue(3) || !canContinue(2) || !canContinue(1)) {
      setUiMessage({ type: 'error', text: 'Faltan datos obligatorios del flujo de reserva.' })
      return
    }

    const { hora_inicio, hora_fin } = splitScheduleRange(form.horario)
    if (!hora_inicio || !hora_fin) {
      setUiMessage({ type: 'error', text: 'Horario inválido. Usa un rango válido.' })
      return
    }

    const recursosPayload = selectedResourcesList.map((r) => ({
      id_recurso: Number(r.id_recurso),
      cantidad: Number(r.cantidad)
    }))

    setLoading(true)
    try {
      const payload = {
        id_cliente: Number(form.idCliente),
        id_espacio: Number(form.idEspacio),
        fecha_evento: form.fecha,
        hora_inicio,
        hora_fin,
        recursos: recursosPayload
      }

      await request('/gestor/reservations', {
        method: 'POST',
        body: payload
      })

      setUiMessage({
        type: 'success',
        text: 'Reserva creada correctamente'
      })
      setTimeout(() => {
        navigate('/gestor')
      }, 900)
    } catch (e) {
      setUiMessage({ type: 'error', text: String(e?.message || 'No se pudo crear la reserva.') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PremiumRoleLayout
      title="GESTOR DE RESERVAS"
      roleLabel="Flujo operativo"
      links={[{ to: '/gestor', label: 'Inicio' }]}
    >
      <section className="sa-panel">
        <div className="sa-panelHeader">
          <div>
            <div className="sa-panelTitle">Crear reserva</div>
            <div className="sa-panelSub">Flujo guiado en 6 pasos</div>
          </div>
        </div>

        <div className="gestor-stepper">
          {stepLabels.map((label, index) => {
            const step = index + 1
            const state = step < currentStep ? 'done' : step === currentStep ? 'current' : 'next'
            return (
              <div key={label} className={`gestor-step gestor-step-${state}`}>
                <div className="gestor-stepCircle">{step}</div>
                <div className="gestor-stepLabel">{label}</div>
              </div>
            )
          })}
        </div>

        {uiMessage.text && (
          <div
            className={`sa-alert ${uiMessage.type === 'error' ? 'sa-alert-danger' : 'sa-alert-success'}`}
            style={{ marginTop: 12 }}
          >
            {uiMessage.text}
          </div>
        )}

        <div className="gestor-flowForm">
          {currentStep === 1 && (
            <div className="gestor-flowCard">
              <h3>Cliente</h3>
              <input
                className="input-form"
                placeholder="Cédula (ID cliente)"
                value={form.idCliente}
                onChange={(e) => setField('idCliente', normalizeDigits(e.target.value))}
              />
              <input
                className="input-form"
                placeholder="Nombre del cliente"
                value={form.nombre}
                onChange={(e) => setField('nombre', e.target.value)}
              />
              <input
                className="input-form"
                placeholder="Teléfono (10 dígitos)"
                value={form.telefono}
                onChange={(e) => setField('telefono', normalizeDigits(e.target.value))}
              />
              <input
                className="input-form"
                placeholder="Correo"
                value={form.correo}
                onChange={(e) => setField('correo', e.target.value)}
              />
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="sa-btn sa-btnPrimary"
                  onClick={handleSaveOrUpdateClient}
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Validar cliente y continuar'}
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="gestor-flowCard">
              <h3>Espacio</h3>
              <input
                className="input-form"
                placeholder="Buscar espacio por nombre o capacidad"
                value={spaceSearch}
                onChange={(e) => setSpaceSearch(e.target.value)}
              />
              {loadingSpaces ? (
                <div className="sa-alert sa-alert-info" style={{ marginTop: 8 }}>Cargando espacios...</div>
              ) : (
                <div className="carousel-container">
                  {filteredSpaces.map((espacio) => {
                    const activo = Number(form.idEspacio) === Number(espacio.id)
                    const disponible = Number(espacio.estado) === 1
                    const imageSrc = espacio.imagen
                      ? (String(espacio.imagen).startsWith('/uploads/') ? `${API_BASE}${espacio.imagen}` : espacio.imagen)
                      : PLACEHOLDER_IMG

                    return (
                      <div
                        key={espacio.id}
                        className={`card-espacio ${activo ? 'seleccionado' : ''}`}
                        onClick={() => {
                          setField('espacio', espacio.nombre || '')
                          setField('idEspacio', String(espacio.id))
                        }}
                      >
                        <img src={imageSrc} alt={espacio.nombre || 'Espacio'} />
                        <h4>{espacio.nombre}</h4>
                        <p>Capacidad {Number(espacio.capacidad || 0)}</p>
                        <p>Precio ${Number(espacio.precio || 0)}</p>
                        <p style={{ color: disponible ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                          {disponible ? 'Disponible' : 'No disponible'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="gestor-flowCard">
              <h3>Fecha</h3>
              <input
                className="input-form"
                type="date"
                value={form.fecha}
                onChange={(e) => setField('fecha', e.target.value)}
              />
            </div>
          )}

          {currentStep === 4 && (
            <div className="gestor-flowCard">
              <h3>Horario</h3>
              <select
                className="input-form"
                value={form.horario}
                onChange={(e) => setField('horario', e.target.value)}
              >
                <option value="">Selecciona un horario</option>
                {(form.horariosDisponibles || []).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          )}

          {currentStep === 5 && (
            <div className="gestor-flowCard">
              <h3>Recursos</h3>
              <div className="sa-alert sa-alert-info" style={{ marginTop: 8 }}>
                Puedes continuar sin seleccionar recursos.
              </div>

              {loadingResources ? (
                <div className="sa-alert sa-alert-info" style={{ marginTop: 8 }}>Cargando recursos...</div>
              ) : resources.length === 0 ? (
                <div className="sa-alert sa-alert-warning" style={{ marginTop: 8 }}>
                  No hay recursos activos con stock para esta empresa.
                </div>
              ) : (
                <div className="gestor-resourceGrid">
                  {resources.map((resource) => {
                    const state = selectedResources[resource.id_recurso] || { selected: false, cantidad: 1 }
                    const active = Boolean(state.selected)

                    return (
                      <div key={resource.id_recurso} className={`gestor-resourceBtn ${active ? 'active' : ''}`}>
                        <button
                          type="button"
                          style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                          onClick={() => toggleResource(resource)}
                        >
                          <span>{resource.nombre}</span>
                          <small>
                            Tipo: {resource.tipo} · Stock: {resource.stock} · ${resource.precio}
                          </small>
                        </button>

                        {active && (
                          <input
                            type="number"
                            min="0"
                            max={resource.stock}
                            className="input-form"
                            style={{ marginTop: 8 }}
                            value={state.cantidad}
                            onChange={(e) => updateResourceQuantity(resource.id_recurso, e.target.value)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {!!selectedResourcesList.length && (
                <div className="sa-alert sa-alert-info" style={{ marginTop: 12 }}>
                  Total recursos: <strong>${totalRecursos}</strong>
                </div>
              )}

              {!resourcesValidation.valid && (
                <div className="sa-alert sa-alert-danger" style={{ marginTop: 12 }}>
                  {resourcesValidation.errors.join(' ')}
                </div>
              )}
            </div>
          )}

          {currentStep === 6 && (
            <div className="gestor-flowCard">
              <h3>Confirmar reserva</h3>
              <div className="gestor-confirmGrid">
                <div><strong>ID cliente:</strong> {form.idCliente}</div>
                <div><strong>Cliente:</strong> {form.nombre}</div>
                <div><strong>Teléfono:</strong> {form.telefono}</div>
                <div><strong>Correo:</strong> {form.correo}</div>
                <div><strong>Espacio:</strong> {form.espacio}</div>
                <div><strong>ID espacio:</strong> {form.idEspacio}</div>
                <div><strong>Fecha:</strong> {form.fecha}</div>
                <div><strong>Horario:</strong> {form.horario}</div>
                <div>
                  <strong>Recursos:</strong>{' '}
                  {selectedResourcesList.length
                    ? selectedResourcesList.map((r) => `${r.nombre} x${r.cantidad}`).join(', ')
                    : 'Sin recursos'}
                </div>
              </div>
            </div>
          )}

          <div className="gestor-flowActions">
            <button
              type="button"
              className="sa-btn sa-btnGhost"
              onClick={prevStep}
              disabled={currentStep === 1 || loading}
            >
              Anterior
            </button>

            {currentStep > 1 && currentStep < 6 && (
              <button
                type="button"
                className="sa-btn sa-btnPrimary"
                onClick={nextStep}
                disabled={!canContinue(currentStep) || loading}
              >
                Siguiente
              </button>
            )}

            {currentStep === 6 && (
              <>
                <button
                  type="button"
                  className="sa-btn sa-btnPrimary"
                  onClick={handleConfirmReservation}
                  disabled={loading}
                >
                  {loading ? 'Creando reserva...' : 'Crear reserva'}
                </button>
                <button
                  type="button"
                  className="sa-btn sa-btnGhost"
                  onClick={resetFlow}
                  disabled={loading}
                >
                  Nueva reserva
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </PremiumRoleLayout>
  )
}
