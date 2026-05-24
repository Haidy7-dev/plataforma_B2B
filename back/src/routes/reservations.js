import express from 'express'
import { requireRole } from '../middleware/requireRole.js'
import { authJwt } from '../middleware/authJwt.js'
import { dataStore } from '../services/dataStore.js'
import { getPool } from '../services/mysql.js'

export const reservationsRouter = express.Router()

reservationsRouter.use(authJwt)
reservationsRouter.use(requireRole(['gestor']))

const ESTADOS_EVENTO_VALIDOS = new Set(['COTIZACION', 'CONFIRMADO', 'FINALIZADO', 'CANCELADO'])
const ESTADOS_FINANCIEROS_VALIDOS = new Set(['PENDIENTE', 'PARCIAL', 'PAGADO', 'DEUDA'])

function parseHorarioRange(horario) {
  if (!horario || typeof horario !== 'string') return { hora_inicio: null, hora_fin: null }
  const parts = horario.split('-').map((s) => s.trim())
  if (parts.length !== 2) return { hora_inicio: null, hora_fin: null }
  return { hora_inicio: parts[0], hora_fin: parts[1] }
}

function isValidDateYYYYMMDD(value) {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return false
  return d.toISOString().slice(0, 10) === value
}

function normalizeTimeHHMMSS(value) {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(v)) return null
  const [hh, mm, ss = '00'] = v.split(':')
  const h = Number(hh)
  const m = Number(mm)
  const s = Number(ss)
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function toSeconds(timeHHMMSS) {
  const [hh, mm, ss] = timeHHMMSS.split(':').map(Number)
  return hh * 3600 + mm * 60 + ss
}

async function normalizeResources(conn, recursos = []) {
  if (!Array.isArray(recursos) || recursos.length === 0) return []

  const names = []
  const ids = []

  for (const item of recursos) {
    if (typeof item === 'string') {
      names.push(item.trim())
      continue
    }
    if (item && typeof item === 'object') {
      if (item.nombre) names.push(String(item.nombre).trim())
      else if (item.id_recurso || item.id) ids.push(Number(item.id_recurso || item.id))
    }
  }

  let rowsByName = []
  if (names.length) {
    const [rows] = await conn.query(
      'SELECT id_recurso, nombre, COALESCE(precio_unitario, precio, costo, 0) AS precio_ref FROM recurso WHERE nombre IN (?)',
      [names]
    )
    rowsByName = rows || []
  }

  let rowsById = []
  if (ids.length) {
    const [rows] = await conn.query(
      'SELECT id_recurso, nombre, COALESCE(precio_unitario, precio, costo, 0) AS precio_ref FROM recurso WHERE id_recurso IN (?)',
      [ids]
    )
    rowsById = rows || []
  }

  const byName = new Map(rowsByName.map((r) => [String(r.nombre).trim().toLowerCase(), r]))
  const byId = new Map(rowsById.map((r) => [Number(r.id_recurso), r]))

  const normalized = []
  for (const item of recursos) {
    let qty = 1
    let dbResource = null

    if (typeof item === 'string') {
      dbResource = byName.get(String(item).trim().toLowerCase())
    } else if (item && typeof item === 'object') {
      qty = Math.max(1, Number(item.cantidad || 1))
      if (item.id_recurso || item.id) dbResource = byId.get(Number(item.id_recurso || item.id))
      if (!dbResource && item.nombre) dbResource = byName.get(String(item.nombre).trim().toLowerCase())
    }

    if (!dbResource) continue

    const precioUnitario = Number(dbResource.precio_ref || 0)
    const subtotal = Number((qty * precioUnitario).toFixed(2))

    normalized.push({
      id_recurso: Number(dbResource.id_recurso),
      cantidad: qty,
      precio_unitario: precioUnitario,
      subtotal
    })
  }

  return normalized
}

reservationsRouter.get('/upcoming', (req, res) => {
  res.json({ events: dataStore.upcomingEvents })
})

reservationsRouter.post('/reservations', async (req, res) => {
  const pool = getPool()
  const conn = await pool.getConnection()

  try {
    const payload = req.body || {}
    const {
      id_cliente,
      id_espacio,
      fecha_evento,
      horario,
      estado_evento = 'COTIZACION',
      estado_financiero = 'PENDIENTE',
      total,
      recursos = []
    } = payload

    const id_usuario = req.user?.id || req.user?.id_usuario

    if (!id_cliente || !id_espacio || !fecha_evento || !horario || !id_usuario) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: id_cliente, id_espacio, fecha_evento, horario e id_usuario (JWT).'
      })
    }

    if (!ESTADOS_EVENTO_VALIDOS.has(estado_evento)) {
      return res.status(400).json({
        message: 'estado_evento inválido. Valores permitidos: COTIZACION, CONFIRMADO, FINALIZADO, CANCELADO.'
      })
    }

    if (!ESTADOS_FINANCIEROS_VALIDOS.has(estado_financiero)) {
      return res.status(400).json({
        message: 'estado_financiero inválido. Valores permitidos: PENDIENTE, PARCIAL, PAGADO, DEUDA.'
      })
    }

    if (!isValidDateYYYYMMDD(fecha_evento)) {
      return res.status(400).json({ message: 'fecha_evento inválida. Usa formato YYYY-MM-DD.' })
    }

    const { hora_inicio, hora_fin } = parseHorarioRange(horario)
    const horaInicioNorm = normalizeTimeHHMMSS(hora_inicio)
    const horaFinNorm = normalizeTimeHHMMSS(hora_fin)
    if (!horaInicioNorm || !horaFinNorm) {
      return res.status(400).json({ message: 'Formato de horario inválido. Usa "HH:mm - HH:mm" o "HH:mm:ss - HH:mm:ss".' })
    }

    if (toSeconds(horaInicioNorm) >= toSeconds(horaFinNorm)) {
      return res.status(400).json({ message: 'Rango de horario inválido: hora_inicio debe ser menor que hora_fin.' })
    }

    await conn.beginTransaction()

    const [insReserva] = await conn.query(
      `INSERT INTO reserva (
        fecha_evento, hora_inicio, hora_fin, estado_evento, estado_financiero, total, id_cliente, id_usuario, id_espacio
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fecha_evento,
        horaInicioNorm,
        horaFinNorm,
        estado_evento,
        estado_financiero,
        Number(total || 0),
        Number(id_cliente),
        Number(id_usuario),
        Number(id_espacio)
      ]
    )

    const id_reserva = insReserva?.insertId
    const recursosNormalizados = await normalizeResources(conn, recursos)

    let totalCalculado = 0
    for (const r of recursosNormalizados) {
      await conn.query(
        `INSERT INTO detalle_reserva (cantidad, subtotal, id_reserva, id_recurso)
         VALUES (?, ?, ?, ?)`,
        [Number(r.cantidad), Number(r.subtotal), id_reserva, Number(r.id_recurso)]
      )
      totalCalculado += Number(r.subtotal)
    }

    totalCalculado = Number(totalCalculado.toFixed(2))

    await conn.query(
      'UPDATE reserva SET total = ? WHERE id_reserva = ?',
      [totalCalculado, id_reserva]
    )

    let facturaGenerada = null
    try {
      const numeroFactura = `FAC-${id_reserva}-${Date.now()}`
      const [insDoc] = await conn.query(
        `INSERT INTO documento (id_reserva, tipo_documento, numero_documento, fecha_emision, total)
         VALUES (?, 'FACTURA', ?, NOW(), ?)`,
        [id_reserva, numeroFactura, totalCalculado]
      )
      facturaGenerada = {
        id_documento: insDoc?.insertId || null,
        numero_factura: numeroFactura
      }
    } catch (docErr) {
      facturaGenerada = null
    }

    await conn.commit()

    return res.status(201).json({
      ok: true,
      id_reserva,
      total: totalCalculado,
      detalle_recursos_creados: recursosNormalizados.length,
      factura: facturaGenerada
    })
  } catch (e) {
    await conn.rollback()
    return res.status(500).json({
      message: 'Error guardando reserva en base de datos',
      error: String(e?.message || e)
    })
  } finally {
    conn.release()
  }
})

