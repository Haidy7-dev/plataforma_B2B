import React, { useMemo, useState } from 'react'
import { useAuth } from '../../../auth/AuthContext.jsx'

const recursosDisponibles = [
  { id: 'r1', nombre: 'Sonido profesional', stock: 4, precio: 250000 },
  { id: 'r2', nombre: 'Iluminación LED', stock: 6, precio: 180000 },
  { id: 'r3', nombre: 'Pantalla gigante', stock: 2, precio: 320000 },
  { id: 'r4', nombre: 'Sillas premium', stock: 200, precio: 15000 }
]

const espacios = [
  {
    id: 1,
    nombre: 'Salón Cerrado',
    tipo: 'Cerrado',
    capacidad: 160,
    imagen: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3'
  },
  {
    id: 2,
    nombre: 'Zona Campestre',
    tipo: 'Abierto',
    capacidad: 280,
    imagen: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb'
  },
  {
    id: 3,
    nombre: 'Terraza Premium',
    tipo: 'Mixto',
    capacidad: 120,
    imagen: 'https://images.unsplash.com/photo-1511578314322-379afb476865'
  }
]

const fechasDisponibles = ['2026-05-20', '2026-05-22', '2026-05-25', '2026-05-28']
const horariosDisponibles = ['08:00 - 12:00', '13:00 - 17:00', '18:00 - 22:00']

const stepLabels = ['Cliente', 'Espacio', 'Fecha', 'Horario', 'Recursos', 'Cotización', 'Confirmación']

export default function ReservationsFlow() {
  const { token } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [saveState, setSaveState] = useState({ loading: false, error: '', success: '', reservaId: null })
  const [form, setForm] = useState({
    cliente: '',
    telefono: '',
    espacio: '',
    fecha: '',
    horario: '',
    recursos: [],
    factura: '',
    idCliente: '',
    idEspacio: ''
  })

  function changeField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function toggleRecurso(recurso) {
    const exists = form.recursos.some((r) => r.nombre === recurso.nombre)
    changeField(
      'recursos',
      exists
        ? form.recursos.filter((r) => r.nombre !== recurso.nombre)
        : [...form.recursos, { nombre: recurso.nombre, cantidad: 1, precio: recurso.precio }]
    )
  }

  function changeRecursoCantidad(nombre, cantidad) {
    const recursoBase = recursosDisponibles.find((r) => r.nombre === nombre)
    const maxStock = Number(recursoBase?.stock || 1)
    const qty = Math.min(maxStock, Math.max(1, Number(cantidad || 1)))
    changeField(
      'recursos',
      form.recursos.map((r) => (r.nombre === nombre ? { ...r, cantidad: qty } : r))
    )
  }

  const totalCotizacion = useMemo(
    () => form.recursos.reduce((acc, r) => acc + Number(r.precio || 0) * Number(r.cantidad || 0), 0),
    [form.recursos]
  )

  function canContinue(step) {
    if (step === 1) return form.cliente.trim().length > 2 && form.telefono.trim().length > 6
    if (step === 2) return Boolean(form.espacio)
    if (step === 3) return Boolean(form.fecha)
    if (step === 4) return Boolean(form.horario)
    if (step === 5) return form.recursos.length > 0
    if (step === 6) return form.recursos.length > 0
    return true
  }

  function nextStep() {
    if (currentStep < 7 && canContinue(currentStep)) setCurrentStep((s) => s + 1)
  }

  function prevStep() {
    if (currentStep > 1) setCurrentStep((s) => s - 1)
  }

  function resetFlow() {
    setCurrentStep(1)
    setSaveState({ loading: false, error: '', success: '', reservaId: null })
    setForm({
      cliente: '',
      telefono: '',
      espacio: '',
      fecha: '',
      horario: '',
      recursos: [],
      factura: '',
      idCliente: '',
      idEspacio: ''
    })
  }

  async function confirmReserva(e) {
    e.preventDefault()
    if (!canContinue(6)) return

    setSaveState({ loading: true, error: '', success: '', reservaId: null })

    try {
      const payload = {
        id_cliente: Number(form.idCliente || 0),
        id_espacio: Number(form.idEspacio || 0),
        fecha_evento: form.fecha,
        horario: form.horario,
        recursos: form.recursos.map((r) => ({ nombre: r.nombre, cantidad: Number(r.cantidad || 1) }))
      }

      const res = await fetch('/api/gestor/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || 'No se pudo guardar la reserva en la base de datos.')

      setSaveState({
        loading: false,
        error: '',
        success: `Reserva guardada correctamente. Total calculado: $${data?.total ?? totalCotizacion}${data?.factura?.numero_factura ? ` · Factura: ${data.factura.numero_factura}` : ''}`,
        reservaId: data?.id_reserva || null
      })
      setCurrentStep(7)
    } catch (err) {
      setSaveState({
        loading: false,
        error: err?.message || 'Error inesperado guardando la reserva.',
        success: '',
        reservaId: null
      })
    }
  }

  return (
    <section className="sa-panel">
      <div className="sa-panelHeader">
        <div>
          <div className="sa-panelTitle">Crear reserva</div>
          <div className="sa-panelSub">Flujo guiado en 7 pasos</div>
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

      <form className="gestor-flowForm" onSubmit={confirmReserva}>
        {currentStep === 1 && (
          <div className="gestor-flowCard">
            <h3>Seleccionar cliente</h3>
            <input className="input-form" placeholder="ID cliente (BD)" value={form.idCliente} onChange={(e) => changeField('idCliente', e.target.value)} />
            <input className="input-form" placeholder="Nombre del cliente" value={form.cliente} onChange={(e) => changeField('cliente', e.target.value)} />
            <input className="input-form" placeholder="Teléfono de contacto" value={form.telefono} onChange={(e) => changeField('telefono', e.target.value)} />
          </div>
        )}

        {currentStep === 2 && (
          <div className="gestor-flowCard">
            <h3>Seleccionar espacio</h3>
            <input className="input-form" placeholder="ID espacio (BD)" value={form.idEspacio} onChange={(e) => changeField('idEspacio', e.target.value)} />
            <div className="carousel-container">
              {espacios.map((espacio) => (
                <div key={espacio.id} className={`card-espacio ${form.espacio === espacio.nombre ? 'seleccionado' : ''}`} onClick={() => changeField('espacio', espacio.nombre)}>
                  <img src={espacio.imagen} alt={espacio.nombre} />
                  <h4>{espacio.nombre}</h4>
                  <p>{espacio.tipo} · Capacidad {espacio.capacidad}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="gestor-flowCard">
            <h3>Seleccionar fecha</h3>
            <select className="input-form" value={form.fecha} onChange={(e) => changeField('fecha', e.target.value)}>
              <option value="">Selecciona una fecha</option>
              {fechasDisponibles.map((fecha) => (
                <option key={fecha} value={fecha}>{fecha}</option>
              ))}
            </select>
          </div>
        )}

        {currentStep === 4 && (
          <div className="gestor-flowCard">
            <h3>Seleccionar horario</h3>
            <select className="input-form" value={form.horario} onChange={(e) => changeField('horario', e.target.value)}>
              <option value="">Selecciona un horario</option>
              {horariosDisponibles.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        )}

        {currentStep === 5 && (
          <div className="gestor-flowCard">
            <h3>Agregar recursos</h3>
            <div className="gestor-resourceGrid">
              {recursosDisponibles.map((recurso) => {
                const activeItem = form.recursos.find((r) => r.nombre === recurso.nombre)
                const active = Boolean(activeItem)
                return (
                  <div key={recurso.id} className={`gestor-resourceBtn ${active ? 'active' : ''}`}>
                    <button type="button" style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }} onClick={() => toggleRecurso(recurso)}>
                      <span>{recurso.nombre}</span>
                      <small>Stock: {recurso.stock} · $ {recurso.precio}</small>
                    </button>
                    {active && (
                      <input type="number" min="1" max={recurso.stock} className="input-form" style={{ marginTop: 8 }} value={activeItem.cantidad} onChange={(e) => changeRecursoCantidad(recurso.nombre, e.target.value)} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="gestor-flowCard">
            <h3>Generar cotización</h3>
            <div className="sa-alert sa-alert-info" style={{ marginTop: 8 }}>
              Total automático por inventario seleccionado: <strong>${totalCotizacion}</strong>
            </div>
            <input className="input-form" placeholder="Número factura (opcional)" value={form.factura} onChange={(e) => changeField('factura', e.target.value)} />
          </div>
        )}

        {currentStep === 7 && (
          <div className="gestor-flowCard">
            <h3>Confirmar reserva</h3>
            <div className="gestor-confirmGrid">
              <div><strong>Cliente:</strong> {form.cliente}</div>
              <div><strong>Teléfono:</strong> {form.telefono}</div>
              <div><strong>Espacio:</strong> {form.espacio}</div>
              <div><strong>Fecha:</strong> {form.fecha}</div>
              <div><strong>Horario:</strong> {form.horario}</div>
              <div><strong>Recursos:</strong> {form.recursos.map((r) => `${r.nombre} x${r.cantidad}`).join(', ')}</div>
              <div><strong>Cotización:</strong> ${totalCotizacion}</div>
              <div><strong>Factura:</strong> {form.factura || 'N/A'}</div>
              <div><strong>ID Cliente (BD):</strong> {form.idCliente}</div>
              <div><strong>ID Espacio (BD):</strong> {form.idEspacio}</div>
              {saveState.reservaId && <div><strong>ID Reserva (BD):</strong> {saveState.reservaId}</div>}
            </div>
            <div className="gestor-success">{saveState.success || 'Reserva confirmada correctamente.'}</div>
          </div>
        )}

        <div className="gestor-flowActions">
          <button type="button" className="sa-btn sa-btnGhost" onClick={prevStep} disabled={currentStep === 1}>Anterior</button>
          {currentStep < 6 && (
            <button type="button" className="sa-btn sa-btnPrimary" onClick={nextStep} disabled={!canContinue(currentStep)}>Siguiente</button>
          )}
          {currentStep === 6 && (
            <button type="submit" className="sa-btn sa-btnPrimary" disabled={!canContinue(6) || saveState.loading}>
              {saveState.loading ? 'Guardando...' : 'Confirmar reserva'}
            </button>
          )}
          {currentStep === 7 && (
            <button type="button" className="sa-btn sa-btnPrimary" onClick={resetFlow}>Nueva reserva</button>
          )}
        </div>

        {saveState.error && (
          <div className="sa-alert sa-alert-danger" style={{ marginTop: 12 }}>
            {saveState.error}
          </div>
        )}
      </form>
    </section>
  )
}
