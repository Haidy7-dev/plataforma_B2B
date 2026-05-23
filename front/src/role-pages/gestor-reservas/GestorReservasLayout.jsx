import React, { useState } from 'react'
import RoleLayout from '../../components/layout/RoleLayout.jsx'

const espacios = [
  {
    id: 1,
    nombre: 'Salón Cerrado',
    tipo: 'Cerrado',
    imagen:
      'https://images.unsplash.com/photo-1519167758481-83f550bb49b3'
  },
  {
    id: 2,
    nombre: 'Zona Campestre',
    tipo: 'Abierto',
    imagen:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb'
  }
]

const fechasDisponibles = [
  '2026-05-20',
  '2026-05-22',
  '2026-05-25',
  '2026-05-28'
]

export default function GestorReservasLayout() {

  const [mostrarFlujo, setMostrarFlujo] = useState(false)

  const [form, setForm] = useState({
    cliente: '',
    telefono: '',
    espacio: '',
    fecha: '',
    cotizacion: '',
    factura: ''
  })

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    })
  }

  function seleccionarEspacio(nombre) {
    setForm({
      ...form,
      espacio: nombre
    })
  }

  function handleSubmit(e) {
    e.preventDefault()

    console.log(form)

    alert('Reserva creada correctamente')
  }

  return (
    <RoleLayout
      title="Gestión de Eventos"
      roleLabel="Gestor"
      links={[
        {
          to: '#',
          label: 'Nuevo flujo'
        }
      ]}
    >

      {!mostrarFlujo && (

        <div className="inicio-gestor">

          <h2>Bienvenido Gestor</h2>

          <p>
            Inicia un nuevo proceso de reserva
            para eventos y cotizaciones.
          </p>

          <button
            className="btn-guardar"
            onClick={() => setMostrarFlujo(true)}
          >
            Nuevo flujo
          </button>

        </div>

      )}

      {mostrarFlujo && (

        <div className="gestor-dashboard">

          <h2>Nuevo Evento</h2>

          <form
            onSubmit={handleSubmit}
            className="card-section"
          >

            <h3>Datos del Cliente</h3>

            <input
              type="text"
              name="cliente"
              placeholder="Nombre del cliente"
              className="input-form"
              value={form.cliente}
              onChange={handleChange}
              required
            />

            <input
              type="text"
              name="telefono"
              placeholder="Teléfono"
              className="input-form"
              value={form.telefono}
              onChange={handleChange}
              required
            />

            <h3>Selecciona el Espacio</h3>

            <div className="carousel-container">

              {espacios.map((espacio) => (

                <div
                  key={espacio.id}
                  className={`card-espacio ${
                    form.espacio === espacio.nombre
                      ? 'seleccionado'
                      : ''
                  }`}
                  onClick={() =>
                    seleccionarEspacio(espacio.nombre)
                  }
                >

                  <img
                    src={espacio.imagen}
                    alt={espacio.nombre}
                  />

                  <h4>{espacio.nombre}</h4>

                  <p>{espacio.tipo}</p>

                </div>

              ))}

            </div>

            <h3>Fechas Disponibles</h3>

            <select
              name="fecha"
              className="input-form"
              value={form.fecha}
              onChange={handleChange}
              required
            >

              <option value="">
                Selecciona una fecha
              </option>

              {fechasDisponibles.map((fecha) => (
                <option key={fecha} value={fecha}>
                  {fecha}
                </option>
              ))}

            </select>

            <h3>Cotización</h3>

            <input
              type="number"
              name="cotizacion"
              placeholder="Valor cotización"
              className="input-form"
              value={form.cotizacion}
              onChange={handleChange}
            />

            <h3>Factura</h3>

            <input
              type="text"
              name="factura"
              placeholder="Número factura"
              className="input-form"
              value={form.factura}
              onChange={handleChange}
            />

            <button
              type="submit"
              className="btn-guardar"
            >
              Crear Reserva
            </button>

          </form>

        </div>

      )}

    </RoleLayout>
  )
}