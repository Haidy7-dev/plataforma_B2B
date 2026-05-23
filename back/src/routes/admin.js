import express from 'express'
import { requireRole } from '../middleware/requireRole.js'
import { authJwt } from '../middleware/authJwt.js'
import { dataStore } from '../services/dataStore.js'
import { computeTotals } from '../services/pricing.js'
import { adminUsersRouter } from './adminUsers.js'
import {
  ensureInventoryTables,
  exportInventoryCSVRows,
  listInventory,
  validateRows,
  upsertInventoryByRows
} from '../services/inventoryService.js'
import { getPool } from '../services/mysql.js'

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

  const header = 'tipo,nombre,cantidad,espacio,estado,descripcion'
  res.send(`${header}\n`)
})

adminRouter.post('/inventory/validate', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const rows = req.body?.rows || []
  if (!Array.isArray(rows)) return res.status(400).json({ message: 'rows debe ser array' })

  try {
    await ensureInventoryTables()
    const { validRows, errors } = validateRows({ id_empresa, rows })
    res.json({
      ok: errors.length === 0,
      total: rows.length,
      validCount: validRows.length,
      errorCount: errors.length,
      errors
    })
  } catch (e) {
    return res.status(500).json({ message: 'Error validando CSV', error: String(e?.message || e) })
  }
})

adminRouter.post('/inventory/import', async (req, res) => {
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const originalFilename = req.body?.originalFilename || null
  const rows = req.body?.rows || []
  if (!Array.isArray(rows)) return res.status(400).json({ message: 'rows debe ser array' })

  try {
    await ensureInventoryTables()

    // Validación server-side (seguridad)
    const { validRows, errors } = validateRows({ id_empresa, rows })

    const pool = getPool()

    const status = errors.length ? (validRows.length ? 'PARTIAL' : 'ERROR') : 'SUCCESS'

    const [insImport] = await pool.query(
      'INSERT INTO inventory_imports (id_empresa, original_filename, total_rows, valid_rows, error_rows, status) VALUES (?, ?, ?, ?, ?, ?)',
      [Number(id_empresa), originalFilename, rows.length, validRows.length, errors.length, status]
    )

    const id_import = insImport?.insertId

    // Guardar filas con error (sin upsert de inventario)
    for (const er of errors) {
      await pool.query(
        `INSERT INTO inventory_import_rows (id_import, row_number, raw_json, error_message, created_item_id, updated_item_id)
         VALUES (?, ?, ?, ?, NULL, NULL)`,
        [id_import, er.row_number, JSON.stringify(rows[er.row_number - 1] || {}), er.error_message]
      )
    }

    // Upsert inventario con transacción dentro del service
    let upsertSummary = { createdCount: 0, updatedCount: 0 }
    if (validRows.length) {
      upsertSummary = await upsertInventoryByRows({
        id_empresa: Number(id_empresa),
        validRows,
        id_import,
        rawRows: rows
      })
    }

    return res.json({
      ok: errors.length === 0,
      importId: id_import,
      total: rows.length,
      validCount: validRows.length,
      errorCount: errors.length,
      createdCount: upsertSummary.createdCount,
      updatedCount: upsertSummary.updatedCount,
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

