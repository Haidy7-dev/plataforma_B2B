import React, { useMemo, useState } from 'react'
import PremiumRoleLayout from '../../components/layout/PremiumRoleLayout.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'

const API_BASE = 'http://localhost:4000'
const PLACEHOLDER_IMG =
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=1200&auto=format&fit=crop'

export default function GestorReservasLayout() {
  const { user, token } = useAuth()
  const authToken = token || localStorage.getItem('token') || ''

  const [currentStep, setCurrentStep] = useState(1)

  const [spaces] = useState([
    {
      id: 1,
      nombre: 'Camping',
      capacidad: 10,
      precio: 100000,
      estado: 1,
      imagen:
        'http://localhost:4000/uploads/espacios/espacio-1779669920690-50331668.jpg'
    },
    {
      id: 2,
      nombre: 'Glamping',
      capacidad: 2,
      precio: 250000,
      estado: 1,
      imagen:
        'http://localhost:4000/uploads/espacios/espacio-1779669794862-229885146.jpg'
    },
    {
      id: 5,
      nombre: 'Jardin',
      capacidad: 35,
      precio: 570000,
      estado: 1,
      imagen:
        'http://localhost:4000/uploads/espacios/espacio-1779671448808-550127642.jpg'
    }
  ])

  // IMPORTANTE: datos de cliente se guardan temporalmente en state
  // y se persisten al backend en el PASO 1.
  const [form, setForm] = useState({
    idCliente: '',
    nombre: '',
    telefono: '',
    correo: '',
    espacio: '',
    idEspacio: '',
    fecha: '',
    horario: '',
    // marca interna para saber que paso 1 ya quedó persistido
    clientSaved: false
  })

  const [loading, setLoading] = useState(false)

  function normalizeDigits(value) {
    return String(value || '').replace(/\D/g, '')
  }

  function isValidNombre(value) {
    return String(value || '').trim().length >= 3
  }

  function isValidCedula(value) {
    return /^\d+$/.test(String(value || '').trim())
  }

  function isValidCorreo(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
  }

  function isValidTelefono(value) {
    return /^\d{10}$/.test(String(value || '').trim())
  }

  function changeField(name, value) {
    let nextValue = value
    if (name === 'telefono' || name === 'idCliente') {
      nextValue = normalizeDigits(value)
    }

    setForm((prev) => ({
      ...prev,
      [name]: nextValue
    }))
  }

  const filteredSpaces = useMemo(() => spaces, [spaces])

  const step1Validation = useMemo(() => {
    const idCliente = String(form.idCliente || '').trim()
    const nombre = String(form.nombre || '').trim()
    const telefono = String(form.telefono || '').trim()
    const correo = String(form.correo || '').trim()

    return {
      cedulaValid: isValidCedula(idCliente),
      nombreValid: isValidNombre(nombre),
      telefonoValid: isValidTelefono(telefono),
      correoValid: isValidCorreo(correo)
    }
  }, [form.idCliente, form.nombre, form.telefono, form.correo])

  function canContinue(step) {
    if (step === 1) {
      return (
        step1Validation.cedulaValid &&
        step1Validation.nombreValid &&
        step1Validation.telefonoValid &&
        step1Validation.correoValid
      )
    }
    if (step === 2) return Boolean(form.idEspacio)
    if (step === 3) return Boolean(form.fecha)
    if (step === 4) return Boolean(form.horario)
    return true
  }

  // Usa URL absoluta al backend para evitar 404 por base/proxy de Vite
  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, options)
    const raw = await res.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }
    return { res, data, raw }
  }

  async function persistClientStepOne() {
    const idCliente = Number(form.idCliente)
    if (!idCliente) {
      throw new Error('Debes ingresar una cédula (id_cliente) válida.')
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    }

    const payload = {
      nombre: String(form.nombre || '').trim(),
      telefono: String(form.telefono || '').trim(),
      correo: String(form.correo || '').trim()
    }

    // 1) Buscar si existe
    const getResult = await apiFetch(`/gestor/clients/${idCliente}`, {
      method: 'GET',
      headers
    })

    if (getResult.res.status === 404) {
      // 2a) No existe -> crear
      const createResult = await apiFetch('/gestor/clients', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id_cliente: idCliente,
          ...payload
        })
      })

      if (!createResult.res.ok) {
        throw new Error(
          createResult.data?.message ||
            `Error creando cliente (HTTP ${createResult.res.status})`
        )
      }

      const createdId = Number(createResult.data?.client?.id_cliente || 0)
      if (!createdId) {
        throw new Error('La API no devolvió id_cliente al crear cliente.')
      }

      setForm((prev) => ({
        ...prev,
        idCliente: String(createdId),
        clientSaved: true
      }))
      return createdId
    }

    if (!getResult.res.ok) {
      throw new Error(
        getResult.data?.message ||
          `Error consultando cliente (HTTP ${getResult.res.status})`
      )
    }

    // 2b) Existe -> actualizar
    const updateResult = await apiFetch(`/gestor/clients/${idCliente}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    })

    if (!updateResult.res.ok) {
      throw new Error(
        updateResult.data?.message ||
          `Error actualizando cliente (HTTP ${updateResult.res.status})`
      )
    }

    const updatedId = Number(updateResult.data?.client?.id_cliente || idCliente)
    setForm((prev) => ({
      ...prev,
      idCliente: String(updatedId),
      clientSaved: true
    }))
    return updatedId
  }

  async function nextStep() {
    if (!canContinue(currentStep)) return

    try {
      if (currentStep === 1) {
        setLoading(true)
        await persistClientStepOne()
      }
      setCurrentStep((prev) => prev + 1)
    } catch (err) {
      alert(err?.message || 'No se pudo guardar el cliente.')
    } finally {
      if (currentStep === 1) setLoading(false)
    }
  }

  function prevStep() {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1)
  }

  async function confirmarReserva() {
    try {
      setLoading(true)

      // Cliente debe haber quedado guardado temporalmente y persistido en paso 1
      const idCliente = Number(form.idCliente)
      if (!idCliente || !form.clientSaved) {
        throw new Error(
          'Primero debes completar y guardar el cliente en el paso 1.'
        )
      }

      const headers = {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      }

      const [horaInicioRaw, horaFinRaw] = String(form.horario || '')
        .split('-')
        .map((x) => x.trim())

      const reservaResult = await apiFetch('/gestor/reservations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id_cliente: idCliente,
          id_espacio: Number(form.idEspacio),
          fecha_evento: form.fecha,
          hora_inicio: horaInicioRaw,
          hora_fin: horaFinRaw
        })
      })

      if (!reservaResult.res.ok) {
        throw new Error(
          reservaResult.data?.message ||
            `Error creando reserva (HTTP ${reservaResult.res.status})`
        )
      }

      alert('Reserva creada correctamente')

      setCurrentStep(1)
      setForm({
        idCliente: '',
        nombre: '',
        telefono: '',
        correo: '',
        espacio: '',
        idEspacio: '',
        fecha: '',
        horario: '',
        clientSaved: false
      })
    } catch (err) {
      alert(err?.message || 'Error guardando reserva')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PremiumRoleLayout title="Gestión de Reservas" roleLabel="Gestor">
      <section className="sa-panel">
        <div className="sa-panelHeader">
          <div>
            <div className="sa-panelTitle">Bienvenido {user?.nombre || 'Gestor'}</div>
            <div className="sa-panelSub">Gestión completa de reservas</div>
          </div>
        </div>

        <div className="gestor-stepper">
          <div className={`gestor-step ${currentStep === 1 ? 'active' : ''}`}>Cliente</div>
          <div className={`gestor-step ${currentStep === 2 ? 'active' : ''}`}>Espacio</div>
          <div className={`gestor-step ${currentStep === 3 ? 'active' : ''}`}>Fecha</div>
          <div className={`gestor-step ${currentStep === 4 ? 'active' : ''}`}>Horario</div>
        </div>

        <form className="gestor-flowForm">
          {currentStep === 1 && (
            <div className="gestor-flowCard">
              <h3>Datos del cliente</h3>

              <input
                className="input-form"
                placeholder="Cédula (id_cliente)"
                inputMode="numeric"
                value={form.idCliente}
                onChange={(e) => changeField('idCliente', e.target.value)}
              />
              {!step1Validation.cedulaValid && form.idCliente.trim().length > 0 && (
                <small style={{ color: '#dc2626', fontWeight: 600 }}>
                  La cédula debe contener solo números.
                </small>
              )}

              <input
                className="input-form"
                placeholder="Nombre completo"
                value={form.nombre}
                onChange={(e) => changeField('nombre', e.target.value)}
              />
              {!step1Validation.nombreValid && form.nombre.trim().length > 0 && (
                <small style={{ color: '#dc2626', fontWeight: 600 }}>
                  El nombre debe tener al menos 3 caracteres.
                </small>
              )}

              <input
                className="input-form"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                pattern="\d{10}"
                placeholder="Teléfono (10 dígitos)"
                value={form.telefono}
                onChange={(e) => changeField('telefono', e.target.value)}
              />
              {!step1Validation.telefonoValid && form.telefono.trim().length > 0 && (
                <small style={{ color: '#dc2626', fontWeight: 600 }}>
                  El teléfono debe tener exactamente 10 dígitos numéricos.
                </small>
              )}

              <input
                className="input-form"
                placeholder="Correo electrónico"
                value={form.correo}
                onChange={(e) => changeField('correo', e.target.value)}
              />
              {!step1Validation.correoValid && form.correo.trim().length > 0 && (
                <small style={{ color: '#dc2626', fontWeight: 600 }}>
                  Ingresa un correo válido.
                </small>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="gestor-flowCard">
              <div className="carousel-container">
                {filteredSpaces.map((espacio) => {
                  const activo = form.idEspacio === String(espacio.id)
                  const disponible = Number(espacio.estado) === 1
                  const imageSrc = espacio.imagen || PLACEHOLDER_IMG

                  return (
                    <div
                      key={espacio.id}
                      className={`card-espacio ${activo ? 'seleccionado' : ''}`}
                      onClick={() => {
                        changeField('espacio', espacio.nombre)
                        changeField('idEspacio', String(espacio.id))
                      }}
                    >
                      <img src={imageSrc} alt={espacio.nombre} />
                      <h4>{espacio.nombre}</h4>
                      <p>Capacidad {espacio.capacidad}</p>
                      <p>Precio ${espacio.precio}</p>
                      <p style={{ color: disponible ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                        {disponible ? 'Disponible' : 'Ocupado'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="gestor-flowCard">
              <h3>Selecciona la fecha</h3>
              <input
                type="date"
                className="input-form"
                value={form.fecha}
                onChange={(e) => changeField('fecha', e.target.value)}
              />
            </div>
          )}

          {currentStep === 4 && (
            <div className="gestor-flowCard">
              <h3>Selecciona el horario</h3>
              <select
                className="input-form"
                value={form.horario}
                onChange={(e) => changeField('horario', e.target.value)}
              >
                <option value="">Selecciona horario</option>
                <option value="08:00 - 12:00">08:00 - 12:00</option>
                <option value="13:00 - 17:00">13:00 - 17:00</option>
                <option value="18:00 - 22:00">18:00 - 22:00</option>
              </select>
            </div>
          )}

          <div className="gestor-flowActions">
            <button
              type="button"
              className="sa-btn sa-btnGhost"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              Anterior
            </button>

            {currentStep < 4 && (
              <button
                type="button"
                className="sa-btn sa-btnPrimary"
                onClick={nextStep}
                disabled={loading || !canContinue(currentStep)}
              >
                {loading && currentStep === 1 ? 'Guardando cliente...' : 'Siguiente'}
              </button>
            )}

            {currentStep === 4 && (
              <button
                type="button"
                className="sa-btn sa-btnPrimary"
                onClick={confirmarReserva}
                disabled={loading || !canContinue(4)}
              >
                {loading ? 'Guardando...' : 'Confirmar reserva'}
              </button>
            )}
          </div>
        </form>
      </section>
    </PremiumRoleLayout>
  )
}
