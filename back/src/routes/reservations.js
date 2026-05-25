import express from 'express'
import { requireRole } from '../middleware/requireRole.js'
import { authJwt } from '../middleware/authJwt.js'
import { getPool } from '../services/mysql.js'

export const reservationsRouter = express.Router()

reservationsRouter.use(authJwt)
reservationsRouter.use(requireRole(['gestor']))

const ESTADOS_EVENTO_VALIDOS = new Set(['COTIZACION', 'CONFIRMADO', 'FINALIZADO', 'CANCELADO'])
const ESTADOS_FINANCIEROS_VALIDOS = new Set(['PENDIENTE', 'PARCIAL', 'PAGADO', 'DEUDA'])
const ESTADOS_PAGO_VALIDOS = new Set(['PENDIENTE', 'PARCIAL', 'PAGADO'])

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

function resolveEstadoPago(estadoFinanciero) {
  const ef = String(estadoFinanciero || 'PENDIENTE').toUpperCase()
  if (ef === 'PAGADO') return 'PAGADO'
  if (ef === 'PARCIAL') return 'PARCIAL'
  return 'PENDIENTE'
}

function isValidEmail(value) {
  if (value === null || value === undefined || String(value).trim() === '') return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())
}

function isValidPhone(value) {
  if (value === null || value === undefined || String(value).trim() === '') return false
  const digits = String(value).replace(/\D/g, '')
  return /^\d{7,}$/.test(digits)
}

async function hasCedulaColumn(conn) {
  const [rows] = await conn.query("SHOW COLUMNS FROM cliente LIKE 'cedula'")
  return Array.isArray(rows) && rows.length > 0
}

async function normalizeResources(conn, recursos = [], id_empresa) {
  if (!Array.isArray(recursos) || recursos.length === 0) return []

  const ids = []
  const names = []

  for (const item of recursos) {
    if (!item) continue
    if (typeof item === 'number' || typeof item === 'string') {
      const n = Number(item)
      if (Number.isFinite(n) && n > 0) ids.push(n)
      else names.push(String(item).trim())
      continue
    }
    if (typeof item === 'object') {
      if (item.id_recurso || item.id) ids.push(Number(item.id_recurso || item.id))
      else if (item.nombre) names.push(String(item.nombre).trim())
    }
  }

  const found = new Map()

  if (ids.length) {
    const [rows] = await conn.query(
      `SELECT id_recurso, nombre, stock, COALESCE(precio, 0) AS precio
       FROM recurso
       WHERE id_empresa = ? AND estado = 1 AND id_recurso IN (?)`,
      [Number(id_empresa), ids]
    )
    for (const r of rows || []) found.set(Number(r.id_recurso), r)
  }

  if (names.length) {
    const [rows] = await conn.query(
      `SELECT id_recurso, nombre, stock, COALESCE(precio, 0) AS precio
       FROM recurso
       WHERE id_empresa = ? AND estado = 1 AND nombre IN (?)`,
      [Number(id_empresa), names]
    )
    for (const r of rows || []) found.set(Number(r.id_recurso), r)
  }

  const normalized = []
  for (const item of recursos) {
    let qty = 1
    let row = null

    if (typeof item === 'object' && item) {
      qty = Math.max(1, Number(item.cantidad || 1))
      if (item.id_recurso || item.id) row = found.get(Number(item.id_recurso || item.id))
      if (!row && item.nombre) {
        row = Array.from(found.values()).find((x) => String(x.nombre).toLowerCase() === String(item.nombre).toLowerCase())
      }
    } else {
      const id = Number(item)
      if (Number.isFinite(id) && id > 0) row = found.get(id)
      if (!row) row = Array.from(found.values()).find((x) => String(x.nombre).toLowerCase() === String(item).toLowerCase())
    }

    if (!row) continue
    if (qty > Number(row.stock || 0)) throw new Error(`Stock insuficiente para recurso: ${row.nombre}`)

    const precioUnitario = Number(row.precio || 0)
    const subtotal = Number((precioUnitario * qty).toFixed(2))
    normalized.push({
      id_recurso: Number(row.id_recurso),
      nombre: row.nombre,
      cantidad: qty,
      precio_unitario: precioUnitario,
      subtotal
    })
  }

  return normalized
}

async function ensureAvailability(conn, { id_espacio, fecha_evento, hora_inicio, hora_fin, id_reserva_excluir = null }) {
  const params = [Number(id_espacio), fecha_evento, hora_fin, hora_inicio]
  let sql = `
    SELECT COUNT(*) AS total
    FROM reserva
    WHERE id_espacio = ?
      AND fecha_evento = ?
      AND NOT (hora_fin <= ? OR hora_inicio >= ?)
      AND estado_evento <> 'CANCELADO'
  `
  if (id_reserva_excluir) {
    sql += ' AND id_reserva <> ?'
    params.push(Number(id_reserva_excluir))
  }

  const [rows] = await conn.query(sql, params)
  return Number(rows?.[0]?.total || 0) === 0
}

async function calculateAndPersistDetails(conn, { id_reserva, recursos, id_empresa }) {
  await conn.query('DELETE FROM detalle_reserva WHERE id_reserva = ?', [Number(id_reserva)])

  const normalized = await normalizeResources(conn, recursos, id_empresa)
  let total = 0

  for (const r of normalized) {
    await conn.query(
      'INSERT INTO detalle_reserva (cantidad, subtotal, id_reserva, id_recurso) VALUES (?, ?, ?, ?)',
      [Number(r.cantidad), Number(r.subtotal), Number(id_reserva), Number(r.id_recurso)]
    )
    total += Number(r.subtotal)
  }

  total = Number(total.toFixed(2))
  await conn.query('UPDATE reserva SET total = ? WHERE id_reserva = ?', [total, Number(id_reserva)])

  return { total, recursos: normalized }
}

// ====================
// CLIENTES
// ====================
reservationsRouter.get('/clients', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const q = String(req.query?.query || '').trim()
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 50)))

    const terms = [Number(id_empresa)]
    let where = `
      WHERE EXISTS (
        SELECT 1
        FROM reserva r
        INNER JOIN espacio e ON e.id_espacio = r.id_espacio
        WHERE r.id_cliente = c.id_cliente
          AND e.id_empresa = ?
      )
    `

    if (q) {
      where += ' AND (c.nombre LIKE ? OR c.telefono LIKE ? OR c.correo LIKE ?)'
      const like = `%${q}%`
      terms.push(like, like, like)
    }

    terms.push(limit)

    const [rows] = await conn.query(
      `SELECT
          c.id_cliente,
          c.nombre,
          c.telefono,
          c.correo,
          COUNT(DISTINCT r.id_reserva) AS reservasCount,
          COALESCE(SUM(CASE WHEN UPPER(r.estado_financiero) IN ('PENDIENTE','PARCIAL','DEUDA') THEN COALESCE(r.total,0) ELSE 0 END), 0) AS faltante,
          SUM(CASE WHEN UPPER(r.estado_financiero) = 'DEUDA' THEN 1 ELSE 0 END) AS deudaCount,
          SUM(CASE WHEN UPPER(r.estado_financiero) = 'PAGADO' THEN 1 ELSE 0 END) AS pagadoCount
       FROM cliente c
       LEFT JOIN reserva r ON r.id_cliente = c.id_cliente
       LEFT JOIN espacio e ON e.id_espacio = r.id_espacio
       ${where}
       GROUP BY c.id_cliente, c.nombre, c.telefono, c.correo
       ORDER BY c.id_cliente DESC
       LIMIT ?`,
      terms
    )

    const clients = (rows || []).map((r) => {
      const reservasCount = Number(r.reservasCount || 0)
      const deudaCount = Number(r.deudaCount || 0)
      const pagadoCount = Number(r.pagadoCount || 0)
      const faltante = Number(r.faltante || 0)

      let estadoFinancieroResumen = 'SIN RESERVAS'
      if (reservasCount === 0) estadoFinancieroResumen = 'SIN RESERVAS'
      else if (deudaCount > 0) estadoFinancieroResumen = 'DEUDA'
      else if (faltante > 0) estadoFinancieroResumen = 'PENDIENTE'
      else if (pagadoCount > 0 && faltante === 0) estadoFinancieroResumen = 'PAGADO'

      return {
        id_cliente: Number(r.id_cliente),
        nombre: r.nombre,
        telefono: r.telefono,
        correo: r.correo,
        reservasCount,
        faltante,
        estadoFinancieroResumen
      }
    })

    return res.json({ clients })
  } catch (e) {
    return res.status(500).json({ message: 'Error consultando clientes', error: String(e?.message || e) })
  } finally {
    conn.release()
  }
})

reservationsRouter.post('/clients', async (req, res) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const { nombre, telefono, correo, cedula } = req.body || {}
    if (!nombre || !String(nombre).trim()) return res.status(400).json({ message: 'nombre es requerido' })

    const hasCedula = await hasCedulaColumn(conn)
    let ins
    if (hasCedula) {
      ;[ins] = await conn.query(
        'INSERT INTO cliente (nombre, telefono, correo, cedula) VALUES (?, ?, ?, ?)',
        [String(nombre).trim(), telefono ? String(telefono).trim() : null, correo ? String(correo).trim() : null, cedula ? String(cedula).trim() : null]
      )
    } else {
      ;[ins] = await conn.query(
        'INSERT INTO cliente (nombre, telefono, correo) VALUES (?, ?, ?)',
        [String(nombre).trim(), telefono ? String(telefono).trim() : null, correo ? String(correo).trim() : null]
      )
    }

    const [rows] = await conn.query('SELECT id_cliente, nombre, telefono, correo FROM cliente WHERE id_cliente = ? LIMIT 1', [ins.insertId])
    return res.status(201).json({ client: rows?.[0] || null })
  } catch (e) {
    return res.status(500).json({ message: 'Error creando cliente', error: String(e?.message || e) })
  } finally {
    conn.release()
  }
})

reservationsRouter.put('/clients/:id', async (req, res) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ message: 'id inválido' })

    const { nombre, telefono, correo, cedula } = req.body || {}
    const hasCedula = await hasCedulaColumn(conn)

    const [exists] = await conn.query('SELECT id_cliente FROM cliente WHERE id_cliente = ? LIMIT 1', [id])
    if (!exists?.length) return res.status(404).json({ message: 'Cliente no encontrado' })

    if (hasCedula) {
      await conn.query(
        `UPDATE cliente
         SET nombre = COALESCE(?, nombre),
             telefono = COALESCE(?, telefono),
             correo = COALESCE(?, correo),
             cedula = COALESCE(?, cedula)
         WHERE id_cliente = ?`,
        [
          nombre !== undefined ? String(nombre).trim() : null,
          telefono !== undefined ? String(telefono).trim() : null,
          correo !== undefined ? String(correo).trim() : null,
          cedula !== undefined ? String(cedula).trim() : null,
          id
        ]
      )
    } else {
      await conn.query(
        `UPDATE cliente
         SET nombre = COALESCE(?, nombre),
             telefono = COALESCE(?, telefono),
             correo = COALESCE(?, correo)
         WHERE id_cliente = ?`,
        [
          nombre !== undefined ? String(nombre).trim() : null,
          telefono !== undefined ? String(telefono).trim() : null,
          correo !== undefined ? String(correo).trim() : null,
          id
        ]
      )
    }

    const [rows] = await conn.query('SELECT id_cliente, nombre, telefono, correo FROM cliente WHERE id_cliente = ? LIMIT 1', [id])
    return res.json({ client: rows?.[0] || null })
  } catch (e) {
    return res.status(500).json({ message: 'Error actualizando cliente', error: String(e?.message || e) })
  } finally {
    conn.release()
  }
})

reservationsRouter.delete('/clients/:id', async (req, res) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ message: 'id inválido' })

    const [inUse] = await conn.query('SELECT COUNT(*) AS total FROM reserva WHERE id_cliente = ?', [id])
    if (Number(inUse?.[0]?.total || 0) > 0) {
      return res.status(409).json({ message: 'No se puede eliminar cliente con reservas asociadas' })
    }

    const [result] = await conn.query('DELETE FROM cliente WHERE id_cliente = ?', [id])
    if (!result?.affectedRows) return res.status(404).json({ message: 'Cliente no encontrado' })
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ message: 'Error eliminando cliente', error: String(e?.message || e) })
  } finally {
    conn.release()
  }
})

// ====================
// ESPACIOS (para flujo gestor)
// ====================
reservationsRouter.get('/spaces', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const pool = getPool()
  const search = String(req.query?.search || '').trim()

  try {
    const terms = [Number(id_empresa)]
    let where = `
      WHERE u.id_empresa = ?
        AND LOWER(u.rol) = 'admin'
    `
    if (search) {
      where += ' AND e.nombre LIKE ?'
      terms.push(`%${search}%`)
    }

    const [rows] = await pool.query(
      `SELECT
          e.id_espacio AS id,
          e.nombre,
          e.capacidad,
          e.precio,
          e.estado,
          e.id_empresa,
          e.imagen
       FROM espacio e
       INNER JOIN usuario u ON u.id_usuario = e.id_usuario
       ${where}
       ORDER BY e.id_espacio DESC`,
      terms
    )

    return res.json({ spaces: rows || [] })
  } catch (e) {
    try {
      const terms = [Number(id_empresa)]
      let where = 'WHERE id_empresa = ?'
      if (search) {
        where += ' AND nombre LIKE ?'
        terms.push(`%${search}%`)
      }

      const [rows] = await pool.query(
        `SELECT id_espacio AS id, nombre, capacidad, precio, estado, id_empresa, imagen
         FROM espacio
         ${where}
         ORDER BY id_espacio DESC`,
        terms
      )

      return res.json({ spaces: rows || [] })
    } catch (fallbackError) {
      return res.status(500).json({ message: 'Error listando espacios', error: String(fallbackError?.message || fallbackError) })
    }
  }
})

// ====================
// RESERVAS
// ====================
reservationsRouter.get('/reservations', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const pool = getPool()
  try {
    const [rows] = await pool.query(
      `SELECT
          r.id_reserva,
          r.fecha_reserva,
          r.fecha_evento,
          r.hora_inicio,
          r.hora_fin,
          r.estado_evento,
          r.estado_financiero,
          COALESCE(r.total, 0) AS total,
          r.id_cliente,
          c.nombre AS cliente,
          c.telefono,
          c.correo,
          r.id_espacio,
          e.nombre AS espacio
       FROM reserva r
       INNER JOIN espacio e ON e.id_espacio = r.id_espacio
       LEFT JOIN cliente c ON c.id_cliente = r.id_cliente
       WHERE e.id_empresa = ?
       ORDER BY r.id_reserva DESC`,
      [Number(id_empresa)]
    )
    return res.json({ reservations: rows || [] })
  } catch (e) {
    return res.status(500).json({ message: 'Error listando reservas', error: String(e?.message || e) })
  }
})

reservationsRouter.post('/reservations', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  const id_usuario = req.user?.id || req.user?.id_usuario
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })
  if (!id_usuario) return res.status(400).json({ message: 'id_usuario faltante en JWT' })

  const pool = getPool()
  const conn = await pool.getConnection()

  try {
    const payload = req.body || {}
    const {
      id_cliente,
      id_espacio,
      fecha_evento,
      hora_inicio,
      hora_fin,
      recursos = [],
      estado_evento = 'COTIZACION',
      estado_financiero = 'PENDIENTE',
      cotizacion = false,
      pago = null
    } = payload

    if (!id_cliente || !id_espacio || !fecha_evento || !hora_inicio || !hora_fin) {
      return res.status(400).json({
        message: 'Campos requeridos: id_cliente, id_espacio, fecha_evento, hora_inicio, hora_fin'
      })
    }

    if (!ESTADOS_EVENTO_VALIDOS.has(String(estado_evento).toUpperCase())) {
      return res.status(400).json({ message: 'estado_evento inválido' })
    }
    if (!ESTADOS_FINANCIEROS_VALIDOS.has(String(estado_financiero).toUpperCase())) {
      return res.status(400).json({ message: 'estado_financiero inválido' })
    }

    if (!isValidDateYYYYMMDD(String(fecha_evento))) {
      return res.status(400).json({ message: 'fecha_evento inválida. Usa YYYY-MM-DD' })
    }

    const hi = normalizeTimeHHMMSS(String(hora_inicio))
    const hf = normalizeTimeHHMMSS(String(hora_fin))
    if (!hi || !hf) return res.status(400).json({ message: 'hora_inicio/hora_fin inválidas' })
    if (toSeconds(hi) >= toSeconds(hf)) return res.status(400).json({ message: 'hora_inicio debe ser menor a hora_fin' })

    const [spaceRows] = await conn.query('SELECT id_espacio FROM espacio WHERE id_espacio = ? AND id_empresa = ? LIMIT 1', [Number(id_espacio), Number(id_empresa)])
    if (!spaceRows?.length) return res.status(404).json({ message: 'Espacio no encontrado para tu empresa' })

    const available = await ensureAvailability(conn, {
      id_espacio: Number(id_espacio),
      fecha_evento: String(fecha_evento),
      hora_inicio: hi,
      hora_fin: hf
    })
    if (!available) return res.status(409).json({ message: 'El espacio no está disponible en ese horario' })

    await conn.beginTransaction()

    const [insReserva] = await conn.query(
      `INSERT INTO reserva
      (fecha_evento, hora_inicio, hora_fin, estado_evento, estado_financiero, total, id_cliente, id_usuario, id_espacio)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [String(fecha_evento), hi, hf, String(estado_evento).toUpperCase(), String(estado_financiero).toUpperCase(), Number(id_cliente), Number(id_usuario), Number(id_espacio)]
    )

    const id_reserva = Number(insReserva.insertId)
    const { total, recursos: recursosPersistidos } = await calculateAndPersistDetails(conn, {
      id_reserva,
      recursos,
      id_empresa
    })

    let pagoInsertado = null
    if (pago && typeof pago === 'object') {
      const monto = Number(pago.monto || 0)
      if (monto > 0) {
        const metodo_pago = pago.metodo_pago ? String(pago.metodo_pago) : null
        const porcentaje = pago.porcentaje !== undefined ? Number(pago.porcentaje) : null
        const estado_pago = ESTADOS_PAGO_VALIDOS.has(String(pago.estado_pago || '').toUpperCase())
          ? String(pago.estado_pago).toUpperCase()
          : resolveEstadoPago(estado_financiero)

        const [insPago] = await conn.query(
          'INSERT INTO pago (monto, metodo_pago, porcentaje, estado_pago, id_reserva) VALUES (?, ?, ?, ?, ?)',
          [monto, metodo_pago, porcentaje, estado_pago, id_reserva]
        )
        pagoInsertado = { id_pago: insPago.insertId, monto, estado_pago }
      }
    }

    let documentoInsertado = null
    if (Boolean(cotizacion)) {
      const ruta_archivo = JSON.stringify({
        cliente: Number(id_cliente),
        espacio: Number(id_espacio),
        total
      })
      const [insDoc] = await conn.query(
        'INSERT INTO documento (tipo_documento, ruta_archivo, id_reserva) VALUES (?, ?, ?)',
        ['COTIZACION', ruta_archivo, id_reserva]
      )
      documentoInsertado = { id_documento: insDoc.insertId, tipo_documento: 'COTIZACION' }
    }

    await conn.commit()

    return res.status(201).json({
      ok: true,
      id_reserva,
      total,
      recursos: recursosPersistidos,
      pago: pagoInsertado,
      documento: documentoInsertado
    })
  } catch (e) {
    await conn.rollback()
    return res.status(500).json({ message: 'Error creando reserva', error: String(e?.message || e) })
  } finally {
    conn.release()
  }
})

reservationsRouter.put('/reservations/:id', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const id_reserva = Number(req.params.id)
  if (!id_reserva) return res.status(400).json({ message: 'id_reserva inválido' })

  const pool = getPool()
  const conn = await pool.getConnection()

  try {
    const payload = req.body || {}
    const {
      id_cliente,
      id_espacio,
      fecha_evento,
      hora_inicio,
      hora_fin,
      recursos,
      estado_evento,
      estado_financiero
    } = payload

    const [existsRows] = await conn.query(
      `SELECT r.id_reserva, r.id_espacio, r.fecha_evento, r.hora_inicio, r.hora_fin
       FROM reserva r
       INNER JOIN espacio e ON e.id_espacio = r.id_espacio
       WHERE r.id_reserva = ? AND e.id_empresa = ?
       LIMIT 1`,
      [id_reserva, Number(id_empresa)]
    )
    if (!existsRows?.length) return res.status(404).json({ message: 'Reserva no encontrada para tu empresa' })

    const current = existsRows[0]
    const newEspacio = id_espacio !== undefined ? Number(id_espacio) : Number(current.id_espacio)
    const newFecha = fecha_evento !== undefined ? String(fecha_evento) : String(current.fecha_evento).slice(0, 10)
    const newHi = hora_inicio !== undefined ? normalizeTimeHHMMSS(String(hora_inicio)) : normalizeTimeHHMMSS(String(current.hora_inicio))
    const newHf = hora_fin !== undefined ? normalizeTimeHHMMSS(String(hora_fin)) : normalizeTimeHHMMSS(String(current.hora_fin))

    if (!newHi || !newHf || toSeconds(newHi) >= toSeconds(newHf)) {
      return res.status(400).json({ message: 'Rango horario inválido' })
    }

    if (!isValidDateYYYYMMDD(newFecha)) return res.status(400).json({ message: 'fecha_evento inválida' })

    if (estado_evento !== undefined && !ESTADOS_EVENTO_VALIDOS.has(String(estado_evento).toUpperCase())) {
      return res.status(400).json({ message: 'estado_evento inválido' })
    }

    if (estado_financiero !== undefined && !ESTADOS_FINANCIEROS_VALIDOS.has(String(estado_financiero).toUpperCase())) {
      return res.status(400).json({ message: 'estado_financiero inválido' })
    }

    const available = await ensureAvailability(conn, {
      id_espacio: newEspacio,
      fecha_evento: newFecha,
      hora_inicio: newHi,
      hora_fin: newHf,
      id_reserva_excluir: id_reserva
    })
    if (!available) return res.status(409).json({ message: 'El espacio no está disponible en ese horario' })

    await conn.beginTransaction()

    await conn.query(
      `UPDATE reserva
       SET id_cliente = COALESCE(?, id_cliente),
           id_espacio = COALESCE(?, id_espacio),
           fecha_evento = COALESCE(?, fecha_evento),
           hora_inicio = COALESCE(?, hora_inicio),
           hora_fin = COALESCE(?, hora_fin),
           estado_evento = COALESCE(?, estado_evento),
           estado_financiero = COALESCE(?, estado_financiero)
       WHERE id_reserva = ?`,
      [
        id_cliente !== undefined ? Number(id_cliente) : null,
        id_espacio !== undefined ? Number(id_espacio) : null,
        fecha_evento !== undefined ? newFecha : null,
        hora_inicio !== undefined ? newHi : null,
        hora_fin !== undefined ? newHf : null,
        estado_evento !== undefined ? String(estado_evento).toUpperCase() : null,
        estado_financiero !== undefined ? String(estado_financiero).toUpperCase() : null,
        id_reserva
      ]
    )

    let total = null
    let recursosPersistidos = null
    if (Array.isArray(recursos)) {
      const calc = await calculateAndPersistDetails(conn, {
        id_reserva,
        recursos,
        id_empresa
      })
      total = calc.total
      recursosPersistidos = calc.recursos
    }

    await conn.commit()

    return res.json({ ok: true, id_reserva, total, recursos: recursosPersistidos })
  } catch (e) {
    await conn.rollback()
    return res.status(500).json({ message: 'Error actualizando reserva', error: String(e?.message || e) })
  } finally {
    conn.release()
  }
})

reservationsRouter.get('/dashboard', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const pool = getPool()
  try {
    const [activasRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reserva r
       INNER JOIN espacio e ON e.id_espacio = r.id_espacio
       WHERE e.id_empresa = ?
         AND r.estado_evento IN ('COTIZACION','CONFIRMADO')`,
      [Number(id_empresa)]
    )

    const [proximosRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reserva r
       INNER JOIN espacio e ON e.id_espacio = r.id_espacio
       WHERE e.id_empresa = ?
         AND r.fecha_evento >= CURDATE()`,
      [Number(id_empresa)]
    )

    const [cotizacionRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reserva r
       INNER JOIN espacio e ON e.id_espacio = r.id_espacio
       WHERE e.id_empresa = ?
         AND r.estado_evento = 'COTIZACION'`,
      [Number(id_empresa)]
    )

    const [confirmadosRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reserva r
       INNER JOIN espacio e ON e.id_espacio = r.id_espacio
       WHERE e.id_empresa = ?
         AND r.estado_evento = 'CONFIRMADO'`,
      [Number(id_empresa)]
    )

    const [pagosRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reserva r
       INNER JOIN espacio e ON e.id_espacio = r.id_espacio
       WHERE e.id_empresa = ?
         AND r.estado_financiero IN ('PENDIENTE','PARCIAL','DEUDA')`,
      [Number(id_empresa)]
    )

    const [recientesRows] = await pool.query(
      `SELECT
          r.id_reserva,
          r.fecha_evento,
          r.estado_evento,
          r.estado_financiero,
          COALESCE(c.nombre, 'Cliente') AS cliente,
          COALESCE(es.nombre, '-') AS espacio
       FROM reserva r
       INNER JOIN espacio es ON es.id_espacio = r.id_espacio
       LEFT JOIN cliente c ON c.id_cliente = r.id_cliente
       WHERE es.id_empresa = ?
       ORDER BY r.id_reserva DESC
       LIMIT 8`,
      [Number(id_empresa)]
    )

    return res.json({
      reservasActivas: Number(activasRows?.[0]?.total || 0),
      eventosProximos: Number(proximosRows?.[0]?.total || 0),
      cotizacionesPendientes: Number(cotizacionRows?.[0]?.total || 0),
      eventosConfirmados: Number(confirmadosRows?.[0]?.total || 0),
      pagosPendientes: Number(pagosRows?.[0]?.total || 0),
      recientes: recientesRows || []
    })
  } catch (e) {
    return res.status(500).json({ message: 'Error cargando dashboard gestor', error: String(e?.message || e) })
  }
})

reservationsRouter.delete('/reservations/:id', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const id_reserva = Number(req.params.id)
  if (!id_reserva) return res.status(400).json({ message: 'id_reserva inválido' })

  const pool = getPool()
  const conn = await pool.getConnection()

  try {
    const [existsRows] = await conn.query(
      `SELECT r.id_reserva
       FROM reserva r
       INNER JOIN espacio e ON e.id_espacio = r.id_espacio
       WHERE r.id_reserva = ? AND e.id_empresa = ?
       LIMIT 1`,
      [id_reserva, Number(id_empresa)]
    )
    if (!existsRows?.length) return res.status(404).json({ message: 'Reserva no encontrada para tu empresa' })

    await conn.beginTransaction()
    await conn.query('DELETE FROM documento WHERE id_reserva = ?', [id_reserva])
    await conn.query('DELETE FROM pago WHERE id_reserva = ?', [id_reserva])
    await conn.query('DELETE FROM detalle_reserva WHERE id_reserva = ?', [id_reserva])
    await conn.query('DELETE FROM reserva WHERE id_reserva = ?', [id_reserva])
    await conn.commit()

    return res.json({ ok: true })
  } catch (e) {
    await conn.rollback()
    return res.status(500).json({ message: 'Error eliminando reserva', error: String(e?.message || e) })
  } finally {
    conn.release()
  }
})
