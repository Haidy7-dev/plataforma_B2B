import React, { useMemo, useState } from 'react'
import axios from 'axios'
import jsPDF from 'jspdf'

const API_BASE = 'http://localhost:4000'

export default function ReservationsFlow() {
  const [step, setStep] = useState(1)
  const [client, setClient] = useState({ nombre: 'Cliente Demo', email: 'cliente@demo.com' })
  const [space, setSpace] = useState({ espacioId: 'A-01', fecha: '2026-07-01', horas: 5 })

  const quotePayload = useMemo(() => ({
    client,
    space,
    lines: [
      { tipo: 'servicio', nombre: 'Catering', cantidad: 1, precio: 1200 },
      { tipo: 'inventario', nombre: 'Sillas', cantidad: 50, precio: 2.5 }
    ]
  }), [client, space])

  async function createQuote() {
    const res = await axios.post(`${API_BASE}/admin/quotations`, quotePayload)
    return res.data
  }

  function downloadPdf(doc) {
    const blob = new Blob([doc], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cotizacion.pdf'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function generarCotizacionYPDF() {
    const data = await createQuote()
    // jsPDF en front con datos mock: creamos un PDF simple.
    const pdf = new jsPDF()
    pdf.setFontSize(16)
    pdf.setTextColor(0, 71, 159)
    pdf.text('Cotización', 14, 18)

    pdf.setFontSize(11)
    pdf.setTextColor(0, 0, 0)
    pdf.text(`Cliente: ${data.client.nombre}`, 14, 30)
    pdf.text(`Espacio: ${data.space.espacioId}`, 14, 38)
    pdf.text(`Fecha: ${data.space.fecha}`, 14, 46)

    let y = 62
    pdf.setTextColor(129, 93, 174)
    pdf.text('Detalle:', 14, y)
    y += 6
    pdf.setTextColor(0, 0, 0)
    data.lines.forEach((l) => {
      pdf.text(`${l.nombre} x${l.cantidad} - $${l.precio}`, 14, y)
      y += 7
    })

    pdf.setTextColor(0, 71, 159)
    pdf.setFontSize(13)
    pdf.text(`Total: $${data.total}`, 14, y + 6)

    const pdfArrayBuffer = pdf.output('arraybuffer')
    downloadPdf(pdfArrayBuffer)
    return data
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Motor de Reservas (Admin)</h2>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: 10,
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: s === step ? 'rgba(0,71,159,0.08)' : 'white',
              color: s === step ? 'var(--primary)' : '#0f172a',
              fontWeight: 900
            }}
          >
            Paso {s}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>1) Cliente</h3>
          <label style={{ display: 'block', fontWeight: 800 }}>Nombre</label>
          <input
            value={client.nombre}
            onChange={(e) => setClient((c) => ({ ...c, nombre: e.target.value }))}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', marginTop: 6 }}
          />
          <label style={{ display: 'block', fontWeight: 800, marginTop: 10 }}>Email</label>
          <input
            value={client.email}
            onChange={(e) => setClient((c) => ({ ...c, email: e.target.value }))}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', marginTop: 6 }}
          />
          <button
            onClick={() => setStep(2)}
            style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 900 }}
          >
            Continuar
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>2) Espacio y recursos</h3>
          <label style={{ display: 'block', fontWeight: 800 }}>Espacio ID</label>
          <input
            value={space.espacioId}
            onChange={(e) => setSpace((s) => ({ ...s, espacioId: e.target.value }))}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', marginTop: 6 }}
          />
          <label style={{ display: 'block', fontWeight: 800, marginTop: 10 }}>Fecha</label>
          <input
            type="date"
            value={space.fecha}
            onChange={(e) => setSpace((s) => ({ ...s, fecha: e.target.value }))}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', marginTop: 6 }}
          />
          <label style={{ display: 'block', fontWeight: 800, marginTop: 10 }}>Horas</label>
          <input
            type="number"
            value={space.horas}
            onChange={(e) => setSpace((s) => ({ ...s, horas: Number(e.target.value) }))}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', marginTop: 6 }}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              onClick={() => setStep(1)}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', fontWeight: 900 }}
            >
              Atrás
            </button>
            <button
              onClick={() => setStep(3)}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 900 }}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>3) Cotización / Factura</h3>
          <p style={{ marginTop: 0 }}>Generación automática de PDF (mock) usando jsPDF.</p>

          <button
            onClick={generarCotizacionYPDF}
            style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: 'var(--secondary)', color: 'white', fontWeight: 900 }}
          >
            Generar Cotización PDF
          </button>

          <div style={{ marginTop: 12, color: '#334155', fontWeight: 700 }}>
            Siguiente (mock): facturas, validaciones y confirmación de disponibilidad.
          </div>

          <button
            onClick={() => setStep(1)}
            style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', fontWeight: 900 }}
          >
            Nueva reserva
          </button>
        </div>
      )}
    </div>
  )
}

