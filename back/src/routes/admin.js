import express from 'express'
import { requireRole } from '../middleware/requireRole.js'
import { authJwt } from '../middleware/authJwt.js'
import { dataStore } from '../services/dataStore.js'
import { computeTotals } from '../services/pricing.js'
import { adminUsersRouter } from './adminUsers.js'
import {
  ensureInventoryTables,
  exportInventoryCSVRows,
  listInventory
} from '../services/inventoryService.js'
import {
  validateRecursoRows,
  insertRecursos
} from '../services/recursoImportService.js'
import { getPool } from '../services/mysql.js'

const ESTADOS_EVENTO_VALIDOS = new Set(['COTIZACION', 'CONFIRMADO', 'FINALIZADO', 'CANCELADO'])
const ESTADOS_FINANCIEROS_VALIDOS = new Set(['PENDIENTE', 'PARCIAL', 'PAGADO', 'DEUDA'])

function toBool(v, fallback = null) {
  if (v === undefined || v === null || v === '') return fallback
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v === 1
  const s = String(v).trim().toLowerCase()
  if (['1', 'true', 'activo', 'activa', 'si', 'sí'].includes(s)) return true
  if (['0', 'false', 'inactivo', 'inactiva', 'no'].includes(s)) return false
  return fallback
}

function parseHorarioRange(horario) {
  if (!horario || typeof horario !== 'string') return { hora_inicio: null, hora_fin: null }
  const parts = horario.split('-').map((s) => s.trim())
  if (parts.length !== 2) return { hora_inicio: null, hora_fin: null }
  return { hora_inicio: parts[0], hora_fin: parts[1] }
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

function isValidDateYYYYMMDD(value) {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return false
  return d.toISOString().slice(0, 10) === value
}

async function recalculateFinancialStatus(conn, id_reserva) {
  const [rRows] = await conn.query('SELECT total FROM reserva WHERE id_reserva = ? LIMIT 1', [Number(id_reserva)])
  const total = Number(rRows?.[0]?.total || 0)

  const [pRows] = await conn.query('SELECT COALESCE(SUM(monto),0) AS pagado FROM pago WHERE id_reserva = ?', [Number(id_reserva)])
  const pagado = Number(pRows?.[0]?.pagado || 0)

  let estado = 'PENDIENTE'
  if (total <= 0 && pagado > 0) estado = 'PAGADO'
  else if (pagado <= 0) estado = total > 0 ? 'PENDIENTE' : 'PENDIENTE'
  else if (pagado < total) estado = 'PARCIAL'
  else if (pagado === total) estado = 'PAGADO'
  else if (pagado > total) estado = 'DEUDA'

  await conn.query('UPDATE reserva SET estado_financiero = ? WHERE id_reserva = ?', [estado, Number(id_reserva)])
  return { total, pagado, estado_financiero: estado }
}

export const adminRouter = express.Router()

adminRouter.use(authJwt)
adminRouter.use(requireRole(['admin']))

// Gestión de usuarios (multiempresa por id_empresa)
adminRouter.use(adminUsersRouter)

// ==========================
// INVENTARIO CSV (ADMIN)
// ==========================
adminRouter.get('/inventory/template', async (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="inventory_template.csv"')

  const header = 'nombre,tipo,stock,precio,estado'
  res.send(`${header}\n`)
})

adminRouter.post('/inventory/validate', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const rows = req.body?.rows || []
  if (!Array.isArray(rows)) return res.status(400).json({ message: 'rows debe ser array' })

  try {
    const rowsWithEmpresa = rows.map((r) => ({ ...r, id_empresa }))
    const { validRows, errors } = await validateRecursoRows(rowsWithEmpresa)

    res.json({
      ok: errors.length === 0,
      total: rows.length,
      validCount: validRows.length,
      errorCount: errors.length,
      errors: (errors || []).map((e) => ({
        row_number: Number(e.fila) - 1,
        error_message: e.mensaje
      }))
    })
  } catch (e) {
    return res.status(500).json({ message: 'Error validando CSV', error: String(e?.message || e) })
  }
})

adminRouter.post('/inventory/import', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const rows = req.body?.rows || []
  if (!Array.isArray(rows)) return res.status(400).json({ message: 'rows debe ser array' })

  try {
    const rowsWithEmpresa = rows.map((r) => ({ ...r, id_empresa }))
    const { validRows, errors } = await validateRecursoRows(rowsWithEmpresa)

    const status = errors.length ? (validRows.length ? 'PARTIAL' : 'ERROR') : 'SUCCESS'

    let createdCount = 0
    if (validRows.length) {
      const ins = await insertRecursos(validRows)
      createdCount = Number(ins?.insertados || 0)
    }

    return res.json({
      ok: errors.length === 0,
      total: rows.length,
      validCount: validRows.length,
      errorCount: errors.length,
      errors: (errors || []).map((e) => ({
        row_number: Number(e.fila) - 1,
        error_message: e.mensaje
      })),
      createdCount,
      updatedCount: 0,
      status
    })
  } catch (e) {
    return res.status(500).json({ message: 'Error importando CSV', error: String(e?.message || e) })
  }
})

adminRouter.get('/inventory', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const { tipo, search } = req.query || {}

  try {
    await ensureInventoryTables()
    const items = await listInventory({
      id_empresa,
      tipo: tipo ? String(tipo).toLowerCase() : null,
      search
    })
    res.json({ items })
  } catch (e) {
    return res.status(500).json({ message: 'Error listando inventario', error: String(e?.message || e) })
  }
})

adminRouter.get('/inventory/export', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  try {
    await ensureInventoryTables()

    const rows = await exportInventoryCSVRows({ id_empresa })

    const escape = (v) => {
      const s = v == null ? '' : String(v)
      if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
      return s
    }

    const header = 'tipo,nombre,cantidad,espacio,estado,descripcion'
    const body = rows
      .map((r) => [r.tipo, r.nombre, r.cantidad, r.espacio, r.estado, r.descripcion].map(escape).join(','))
      .join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_export.csv"')
    res.send(`${header}\n${body}`)
  } catch (e) {
    return res.status(500).json({ message: 'Error exportando CSV', error: String(e?.message || e) })
  }
})

adminRouter.get('/inventory/imports', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  try {
    await ensureInventoryTables()

    const pool = getPool()
    const [rows] = await pool.query(
      'SELECT id_import AS id, original_filename, total_rows, valid_rows, error_rows, status, created_at FROM inventory_imports WHERE id_empresa=? ORDER BY created_at DESC LIMIT 50',
      [Number(id_empresa)]
    )

    res.json({ imports: rows || [] })
  } catch (e) {
    return res.status(500).json({ message: 'Error obteniendo historial', error: String(e?.message || e) })
  }
})

adminRouter.get('/inventory/imports/:id/errors', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const id_import = Number(req.params.id)
  if (!id_import) return res.status(400).json({ message: 'id_import inválido' })

  try {
    await ensureInventoryTables()

    const pool = getPool()

    const [imports] = await pool.query(
      'SELECT id_import FROM inventory_imports WHERE id_import=? AND id_empresa=? LIMIT 1',
      [id_import, Number(id_empresa)]
    )

    if (!imports?.length) return res.status(404).json({ message: 'Import no encontrada para tu empresa' })

    const [rows] = await pool.query(
      'SELECT row_number, error_message, raw_json FROM inventory_import_rows WHERE id_import=? AND error_message IS NOT NULL ORDER BY row_number ASC',
      [id_import]
    )

    res.json({ errors: rows || [] })
  } catch (e) {
    return res.status(500).json({ message: 'Error obteniendo errores', error: String(e?.message || e) })
  }
})

adminRouter.get('/dashboard/stats', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const pool = getPool()
  try {
    const [activeRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM usuario WHERE id_empresa = ? AND estado = 1',
      [Number(id_empresa)]
    )

    const [confirmedRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reserva r
       INNER JOIN espacio e ON e.id_espacio = r.id_espacio
       WHERE e.id_empresa = ? AND r.estado_evento = 'CONFIRMADO'`,
      [Number(id_empresa)]
    )

    const [finalizedRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reserva r
       INNER JOIN espacio e ON e.id_espacio = r.id_espacio
       WHERE e.id_empresa = ? AND r.estado_evento = 'FINALIZADO'`,
      [Number(id_empresa)]
    )

    const [pendingPayRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reserva r
       INNER JOIN espacio e ON e.id_espacio = r.id_espacio
       WHERE e.id_empresa = ? AND r.estado_financiero IN ('PENDIENTE', 'PARCIAL', 'DEUDA')`,
      [Number(id_empresa)]
    )

    const [upcomingRows] = await pool.query(
      `SELECT
          r.id_reserva,
          COALESCE(c.nombre, 'Cliente') AS cliente,
          COALESCE(es.nombre, '-') AS espacio,
          r.fecha_evento,
          r.estado_evento,
          COALESCE(r.estado_financiero, 'PENDIENTE') AS estado_financiero
       FROM reserva r
       INNER JOIN espacio es ON es.id_espacio = r.id_espacio
       LEFT JOIN cliente c ON c.id_cliente = r.id_cliente
       WHERE es.id_empresa = ?
       ORDER BY r.fecha_evento ASC, r.id_reserva ASC
       LIMIT 5`,
      [Number(id_empresa)]
    )

    const [pendingPaymentsListRows] = await pool.query(
      `SELECT
          r.id_reserva,
          COALESCE(c.nombre, 'Cliente') AS cliente,
          COALESCE(es.nombre, '-') AS espacio,
          r.fecha_evento,
          COALESCE(r.total, 0) AS total,
          COALESCE(r.estado_financiero, 'PENDIENTE') AS estado_financiero
       FROM reserva r
       INNER JOIN espacio es ON es.id_espacio = r.id_espacio
       LEFT JOIN cliente c ON c.id_cliente = r.id_cliente
       WHERE es.id_empresa = ?
         AND r.estado_financiero IN ('PENDIENTE', 'PARCIAL', 'DEUDA')
       ORDER BY r.fecha_evento ASC, r.id_reserva ASC
       LIMIT 20`,
      [Number(id_empresa)]
    )

    const [recentReservationsRows] = await pool.query(
      `SELECT
          r.id_reserva,
          COALESCE(c.nombre, 'Cliente') AS cliente,
          r.fecha_evento AS fecha,
          COALESCE(r.total, 0) AS total,
          COALESCE(r.estado_financiero, 'PENDIENTE') AS estado
       FROM reserva r
       INNER JOIN espacio es ON es.id_espacio = r.id_espacio
       LEFT JOIN cliente c ON c.id_cliente = r.id_cliente
       WHERE es.id_empresa = ?
       ORDER BY r.id_reserva DESC
       LIMIT 8`,
      [Number(id_empresa)]
    )

    res.json({
      activeUsers: Number(activeRows?.[0]?.total || 0),
      confirmedEvents: Number(confirmedRows?.[0]?.total || 0),
      pendingPayments: Number(pendingPayRows?.[0]?.total || 0),
      finalizedEvents: Number(finalizedRows?.[0]?.total || 0),
      upcomingEvents: (upcomingRows || []).map((r) => ({
        id_reserva: r.id_reserva,
        cliente: r.cliente,
        espacio: r.espacio,
        fecha_evento: r.fecha_evento,
        estado_evento: r.estado_evento,
        estado_financiero: r.estado_financiero
      })),
      pendingPaymentsList: (pendingPaymentsListRows || []).map((r) => ({
        id_reserva: r.id_reserva,
        cliente: r.cliente,
        espacio: r.espacio,
        fecha_evento: r.fecha_evento,
        total: Number(r.total || 0),
        estado_financiero: r.estado_financiero
      })),
      recentReservations: (recentReservationsRows || []).map((r) => ({
        id_reserva: r.id_reserva,
        cliente: r.cliente,
        fecha: r.fecha,
        total: Number(r.total || 0),
        estado: r.estado
      }))
    })
  } catch (e) {
    return res.status(500).json({ message: 'Error cargando dashboard', error: String(e?.message || e) })
  }
})

adminRouter.get('/reports/summary', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const pool = getPool()
  try {
    const [incRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM incidente WHERE id_empresa = ?',
      [Number(id_empresa)]
    )

    const [finRows] = await pool.query(
      `SELECT
          COALESCE(r.estado_financiero, 'PENDIENTE') AS estado_financiero,
          COUNT(*) AS total
       FROM reserva r
       INNER JOIN espacio es ON es.id_espacio = r.id_espacio
       WHERE es.id_empresa = ?
       GROUP BY COALESCE(r.estado_financiero, 'PENDIENTE')`,
      [Number(id_empresa)]
    )

    const [totRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reserva r
       INNER JOIN espacio es ON es.id_espacio = r.id_espacio
       WHERE es.id_empresa = ?`,
      [Number(id_empresa)]
    )

    const [finEventsRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reserva r
       INNER JOIN espacio es ON es.id_espacio = r.id_espacio
       WHERE es.id_empresa = ? AND r.estado_evento = 'FINALIZADO'`,
      [Number(id_empresa)]
    )

    const [unpaidRows] = await pool.query(
      `SELECT
          r.id_reserva,
          COALESCE(c.nombre, 'Cliente') AS cliente,
          COALESCE(es.nombre, '-') AS espacio,
          r.fecha_evento,
          r.hora_inicio,
          r.hora_fin,
          COALESCE(r.estado_evento, 'COTIZACION') AS estado_evento,
          COALESCE(r.estado_financiero, 'PENDIENTE') AS estado_financiero,
          COALESCE(r.total, 0) AS total
       FROM reserva r
       INNER JOIN espacio es ON es.id_espacio = r.id_espacio
       LEFT JOIN cliente c ON c.id_cliente = r.id_cliente
       WHERE es.id_empresa = ?
         AND COALESCE(r.estado_financiero, 'PENDIENTE') IN ('PENDIENTE', 'DEUDA')
       ORDER BY r.fecha_evento ASC, r.id_reserva ASC
       LIMIT 20`,
      [Number(id_empresa)]
    )

    const [upcomingRows] = await pool.query(
      `SELECT
          r.id_reserva,
          COALESCE(c.nombre, 'Cliente') AS cliente,
          COALESCE(es.nombre, '-') AS espacio,
          r.fecha_evento,
          r.hora_inicio,
          r.hora_fin,
          COALESCE(r.estado_evento, 'COTIZACION') AS estado_evento,
          COALESCE(r.estado_financiero, 'PENDIENTE') AS estado_financiero,
          COALESCE(r.total, 0) AS total
       FROM reserva r
       INNER JOIN espacio es ON es.id_espacio = r.id_espacio
       LEFT JOIN cliente c ON c.id_cliente = r.id_cliente
       WHERE es.id_empresa = ?
       ORDER BY r.fecha_evento ASC, r.id_reserva ASC
       LIMIT 20`,
      [Number(id_empresa)]
    )

    const totalsByFinancial = {
      PENDIENTE: 0,
      PARCIAL: 0,
      PAGADO: 0,
      DEUDA: 0
    }

    ;(finRows || []).forEach((r) => {
      const key = String(r.estado_financiero || '').toUpperCase()
      if (totalsByFinancial[key] !== undefined) totalsByFinancial[key] = Number(r.total || 0)
    })

    const totalReservas = Number(totRows?.[0]?.total || 0)
    const totalFinalizadas = Number(finEventsRows?.[0]?.total || 0)
    const cumplimiento = totalReservas > 0 ? Math.round((totalFinalizadas / totalReservas) * 100) : 0

    return res.json({
      incidencias: Number(incRows?.[0]?.total || 0),
      cumplimiento,
      totalReservas,
      financieros: totalsByFinancial,
      unpaidReservations: (unpaidRows || []).map((r) => ({
        id_reserva: r.id_reserva,
        cliente: r.cliente,
        espacio: r.espacio,
        fecha_evento: r.fecha_evento,
        hora_inicio: r.hora_inicio,
        hora_fin: r.hora_fin,
        estado_evento: r.estado_evento,
        estado_financiero: r.estado_financiero,
        total: Number(r.total || 0)
      })),
      upcomingEvents: (upcomingRows || []).map((r) => ({
        id_reserva: r.id_reserva,
        cliente: r.cliente,
        espacio: r.espacio,
        fecha_evento: r.fecha_evento,
        hora_inicio: r.hora_inicio,
        hora_fin: r.hora_fin,
        estado_evento: r.estado_evento,
        estado_financiero: r.estado_financiero,
        total: Number(r.total || 0)
      }))
    })
  } catch (e) {
    return res.status(500).json({ message: 'Error cargando reportes', error: String(e?.message || e) })
  }
})

adminRouter.get('/spaces', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })
  const pool = getPool()
  const search = String(req.query?.search || '').trim()

  try {
    const terms = [Number(id_empresa)]
    let where = 'WHERE id_empresa = ?'
    if (search) {
      where += ' AND nombre LIKE ?'
      terms.push(`%${search}%`)
    }

    const [rows] = await pool.query(
      `SELECT id_espacio AS id, nombre, capacidad, precio, estado, id_empresa
       FROM espacio
       ${where}
       ORDER BY id_espacio DESC`,
      terms
    )
    res.json({ spaces: rows || [] })
  } catch (e) {
    return res.status(500).json({ message: 'Error listando espacios', error: String(e?.message || e) })
  }
})

adminRouter.post('/spaces', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })
  const pool = getPool()
  const { nombre, capacidad, precio, estado } = req.body || {}

  if (!nombre) return res.status(400).json({ message: 'nombre es requerido' })

  try {
    const [ins] = await pool.query(
      'INSERT INTO espacio (nombre, capacidad, precio, estado, id_empresa) VALUES (?, ?, ?, ?, ?)',
      [String(nombre), Number(capacidad || 0), Number(precio || 0), toBool(estado, true) ? 1 : 0, Number(id_empresa)]
    )

    const [rows] = await pool.query(
      'SELECT id_espacio AS id, nombre, capacidad, precio, estado, id_empresa FROM espacio WHERE id_espacio = ? LIMIT 1',
      [ins.insertId]
    )
    return res.status(201).json({ space: rows?.[0] || null })
  } catch (e) {
    return res.status(500).json({ message: 'Error creando espacio', error: String(e?.message || e) })
  }
})

adminRouter.put('/spaces/:id', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  const id = Number(req.params.id)
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })
  if (!id) return res.status(400).json({ message: 'id inválido' })

  const pool = getPool()
  const { nombre, capacidad, precio, estado } = req.body || {}

  try {
    const [exists] = await pool.query('SELECT id_espacio FROM espacio WHERE id_espacio = ? AND id_empresa = ? LIMIT 1', [id, Number(id_empresa)])
    if (!exists?.length) return res.status(404).json({ message: 'Espacio no encontrado en tu empresa' })

    await pool.query(
      `UPDATE espacio
       SET nombre = COALESCE(?, nombre),
           capacidad = COALESCE(?, capacidad),
           precio = COALESCE(?, precio),
           estado = COALESCE(?, estado)
       WHERE id_espacio = ? AND id_empresa = ?`,
      [
        nombre !== undefined ? String(nombre) : null,
        capacidad !== undefined ? Number(capacidad) : null,
        precio !== undefined ? Number(precio) : null,
        estado !== undefined ? (toBool(estado, true) ? 1 : 0) : null,
        id,
        Number(id_empresa)
      ]
    )

    const [rows] = await pool.query(
      'SELECT id_espacio AS id, nombre, capacidad, precio, estado, id_empresa FROM espacio WHERE id_espacio = ? AND id_empresa = ? LIMIT 1',
      [id, Number(id_empresa)]
    )
    res.json({ space: rows?.[0] || null })
  } catch (e) {
    return res.status(500).json({ message: 'Error actualizando espacio', error: String(e?.message || e) })
  }
})

adminRouter.delete('/spaces/:id', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  const id = Number(req.params.id)
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })
  if (!id) return res.status(400).json({ message: 'id inválido' })

  const pool = getPool()
  try {
    const [result] = await pool.query('DELETE FROM espacio WHERE id_espacio = ? AND id_empresa = ?', [id, Number(id_empresa)])
    if (!result?.affectedRows) return res.status(404).json({ message: 'Espacio no encontrado en tu empresa' })
    res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ message: 'Error eliminando espacio', error: String(e?.message || e) })
  }
})

adminRouter.get('/resources', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })
  const pool = getPool()
  const { search, tipo, estado } = req.query || {}

  try {
    const terms = [Number(id_empresa)]
    let where = 'WHERE id_empresa = ?'

    if (search) {
      where += ' AND nombre LIKE ?'
      terms.push(`%${String(search)}%`)
    }
    if (tipo) {
      where += ' AND tipo = ?'
      terms.push(String(tipo))
    }
    if (estado !== undefined && estado !== '') {
      where += ' AND estado = ?'
      terms.push(toBool(estado, true) ? 1 : 0)
    }

    const [rows] = await pool.query(
      `SELECT id_recurso AS id, nombre, tipo, stock, precio, estado, id_empresa
       FROM recurso
       ${where}
       ORDER BY id_recurso DESC`,
      terms
    )
    res.json({ resources: rows || [] })
  } catch (e) {
    return res.status(500).json({ message: 'Error listando recursos', error: String(e?.message || e) })
  }
})

adminRouter.post('/resources', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const { nombre, tipo, stock, precio, estado } = req.body || {}
  if (!nombre) return res.status(400).json({ message: 'nombre es requerido' })

  const pool = getPool()
  try {
    const [ins] = await pool.query(
      'INSERT INTO recurso (nombre, tipo, stock, precio, estado, id_empresa) VALUES (?, ?, ?, ?, ?, ?)',
      [String(nombre), String(tipo || ''), Number(stock || 0), Number(precio || 0), toBool(estado, true) ? 1 : 0, Number(id_empresa)]
    )

    const [rows] = await pool.query(
      'SELECT id_recurso AS id, nombre, tipo, stock, precio, estado, id_empresa FROM recurso WHERE id_recurso = ? LIMIT 1',
      [ins.insertId]
    )
    return res.status(201).json({ resource: rows?.[0] || null })
  } catch (e) {
    return res.status(500).json({ message: 'Error creando recurso', error: String(e?.message || e) })
  }
})

adminRouter.put('/resources/:id', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  const id = Number(req.params.id)
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })
  if (!id) return res.status(400).json({ message: 'id inválido' })

  const { nombre, tipo, stock, precio, estado } = req.body || {}
  const pool = getPool()

  try {
    const [exists] = await pool.query('SELECT id_recurso FROM recurso WHERE id_recurso = ? AND id_empresa = ? LIMIT 1', [id, Number(id_empresa)])
    if (!exists?.length) return res.status(404).json({ message: 'Recurso no encontrado en tu empresa' })

    await pool.query(
      `UPDATE recurso
       SET nombre = COALESCE(?, nombre),
           tipo = COALESCE(?, tipo),
           stock = COALESCE(?, stock),
           precio = COALESCE(?, precio),
           estado = COALESCE(?, estado)
       WHERE id_recurso = ? AND id_empresa = ?`,
      [
        nombre !== undefined ? String(nombre) : null,
        tipo !== undefined ? String(tipo) : null,
        stock !== undefined ? Number(stock) : null,
        precio !== undefined ? Number(precio) : null,
        estado !== undefined ? (toBool(estado, true) ? 1 : 0) : null,
        id,
        Number(id_empresa)
      ]
    )

    const [rows] = await pool.query(
      'SELECT id_recurso AS id, nombre, tipo, stock, precio, estado, id_empresa FROM recurso WHERE id_recurso = ? AND id_empresa = ? LIMIT 1',
      [id, Number(id_empresa)]
    )
    res.json({ resource: rows?.[0] || null })
  } catch (e) {
    return res.status(500).json({ message: 'Error actualizando recurso', error: String(e?.message || e) })
  }
})

adminRouter.delete('/resources/:id', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  const id = Number(req.params.id)
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })
  if (!id) return res.status(400).json({ message: 'id inválido' })

  const pool = getPool()
  try {
    const [result] = await pool.query('DELETE FROM recurso WHERE id_recurso = ? AND id_empresa = ?', [id, Number(id_empresa)])
    if (!result?.affectedRows) return res.status(404).json({ message: 'Recurso no encontrado en tu empresa' })
    res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ message: 'Error eliminando recurso', error: String(e?.message || e) })
  }
})

adminRouter.get('/resources/low-stock', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })
  const threshold = Number(req.query?.threshold || 5)
  const pool = getPool()

  try {
    const [rows] = await pool.query(
      `SELECT id_recurso AS id, nombre, tipo, stock, precio, estado
       FROM recurso
       WHERE id_empresa = ? AND stock <= ?
       ORDER BY stock ASC, id_recurso DESC`,
      [Number(id_empresa), threshold]
    )
    res.json({ threshold, items: rows || [] })
  } catch (e) {
    return res.status(500).json({ message: 'Error cargando alertas de stock', error: String(e?.message || e) })
  }
})

// ==========================
// LEGACY: mocks existentes
// ==========================
adminRouter.post('/import/inventory', (req, res) => {
  const items = req.body?.items || []
  dataStore.inventory.push(...items)
  res.json({ ok: true, imported: items.length })
})

adminRouter.post('/quotations', (req, res) => {
  const payload = req.body || {}
  const { total, lines } = computeTotals(payload.lines || [])

  const quote = {
    id: 'q-' + Date.now(),
    client: payload.client,
    space: payload.space,
    lines,
    total,
    createdAt: new Date().toISOString()
  }

  dataStore.quotations.push(quote)
  res.json({ ...quote })
})

// Motor de Reservas (Admin)
// - Listar cotizaciones creadas
// - Consultar disponibilidad mock para avanzar el flujo
adminRouter.get('/reservations/quotes', (req, res) => {
  const id_empresa = req.user?.id_empresa || null
  // Por ahora dataStore es mock; devolvemos igual.
  // Cuando exista BD real de cotizaciones, filtrar por id_empresa.
  res.json({ id_empresa, quotes: dataStore.quotations })
})

adminRouter.post('/reservations/check-availability', (req, res) => {
  const payload = req.body || {}

  // Mock: si hay space/fecha no vacíos => disponible
  const space = payload.space || {}
  const ok = Boolean(space.espacioId && space.fecha)

  res.json({
    ok,
    reason: ok ? null : 'Faltan datos de espacio (espacioId/fecha)'
  })
})

