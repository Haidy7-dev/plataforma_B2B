import { getPool } from './mysql.js'

export const INVENTORY_TYPES = ['silla', 'mesa', 'espacio', 'salon', 'equipo', 'recurso']

export function normalizeTipo(tipo) {
  if (tipo == null) return ''
  const t = String(tipo).trim().toLowerCase()
  // Aceptar variantes comunes
  if (t === 'salones') return 'salon'
  if (t === 'recursos') return 'recurso'
  if (t === 'sillas') return 'silla'
  if (t === 'mesas') return 'mesa'
  if (t === 'espacios') return 'espacio'
  if (t === 'equipos') return 'equipo'
  return t
}

export function normalizeEstado(estado) {
  if (estado == null) return ''
  return String(estado).trim().toLowerCase()
}

export function toNullableString(v) {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

export function toNumber(v) {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  if (s === '') return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return n
}

export async function ensureInventoryTables() {
  const pool = getPool()
  // Ejecutar DDL idempotente
  // eslint-disable-next-line no-undef
  const { inventoryDDL } = await import('./inventoryDDL.js')
  await pool.query(inventoryDDL)
}

export async function listInventory({ id_empresa, tipo, search }) {
  const pool = getPool()

  const terms = []
  let where = 'WHERE id_empresa = ?'
  terms.push(Number(id_empresa))

  if (tipo) {
    where += ' AND tipo = ?'
    terms.push(String(tipo))
  }

  if (search) {
    where += ' AND (nombre LIKE ? OR espacio LIKE ? OR estado LIKE ?)' 
    const like = `%${String(search)}%`
    terms.push(like, like, like)
  }

  const sql = `SELECT id_item AS id,
                       tipo, nombre, cantidad, espacio, estado, descripcion,
                       created_at, updated_at
               FROM inventory_items
               ${where}
               ORDER BY created_at DESC`

  const [rows] = await pool.query(sql, terms)
  return rows || []
}

export async function exportInventoryCSVRows({ id_empresa }) {
  const items = await listInventory({ id_empresa })
  // Convertir a CSV plantilla
  return items.map((it) => ({
    tipo: it.tipo,
    nombre: it.nombre,
    cantidad: it.cantidad,
    espacio: it.espacio,
    estado: it.estado,
    descripcion: it.descripcion || ''
  }))
}

export function validateRows({ id_empresa, rows }) {
  const errorsByRow = []
  const normalizedValid = []

  const seenInFile = new Set()

  const getKey = (r) => {
    const tipoN = normalizeTipo(r.tipo)
    const nombreN = String(r.nombre || '').trim().toLowerCase()
    const espacioN = String(r.espacio || '').trim().toLowerCase()
    const estadoN = normalizeEstado(r.estado)
    return `${id_empresa}::${tipoN}::${nombreN}::${espacioN}::${estadoN}`
  }

  rows.forEach((r, idx) => {
    const rowNumber = idx + 1

    const tipoN = normalizeTipo(r.tipo)
    const nombre = String(r.nombre ?? '').trim()
    const cantidadN = toNumber(r.cantidad)
    const espacio = String(r.espacio ?? '').trim()
    const estadoN = normalizeEstado(r.estado)
    const descripcion = String(r.descripcion ?? '').trim()

    const rowErrors = []

    if (!tipoN) rowErrors.push('Tipo es requerido')
    if (tipoN && !INVENTORY_TYPES.includes(tipoN)) rowErrors.push('Tipo inválido')

    if (!nombre) rowErrors.push('Nombre es requerido')

    if (cantidadN === null) rowErrors.push('Cantidad es requerida y debe ser numérica')
    if (cantidadN !== null && cantidadN < 0) rowErrors.push('Cantidad no puede ser negativa')

    if (!espacio) rowErrors.push('Espacio es requerido')

    if (!estadoN) rowErrors.push('Estado es requerido')

    // Duplicado en archivo
    if (rowErrors.length === 0) {
      const key = getKey({ tipo: tipoN, nombre, cantidad: cantidadN, espacio, estado: estadoN })
      if (seenInFile.has(key)) rowErrors.push('Registro duplicado dentro del archivo')
      else seenInFile.add(key)
    }

    // Validar campos vacíos/incompletos (descripcion es opcional)

    if (rowErrors.length) {
      errorsByRow.push({ row_number: rowNumber, error_message: rowErrors.join(' • ') })
      return
    }

    normalizedValid.push({
      row_number: rowNumber,
      tipo: tipoN,
      nombre,
      cantidad: cantidadN,
      espacio,
      estado: estadoN,
      descripcion: descripcion || null
    })
  })

  return { validRows: normalizedValid, errors: errorsByRow }
}

export async function upsertInventoryByRows({ id_empresa, validRows, id_import, rawRows }) {
  const pool = getPool()

  let createdCount = 0
  let updatedCount = 0

  // Hacer todo transaccional
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    for (const vr of validRows) {
      const key = [
        id_empresa,
        vr.tipo,
        vr.nombre,
        vr.espacio,
        vr.estado
      ]

      // intentar encontrar existente
      const [existingRows] = await conn.query(
        `SELECT id_item FROM inventory_items
         WHERE id_empresa=? AND tipo=? AND nombre=? AND espacio=? AND estado=?
         LIMIT 1`,
        key
      )

      if (existingRows?.length) {
        const id_item = existingRows[0].id_item
        await conn.query(
          `UPDATE inventory_items
           SET cantidad=?, descripcion=?
           WHERE id_item=?`,
          [vr.cantidad, vr.descripcion, id_item]
        )
        updatedCount++

        await conn.query(
          `INSERT INTO inventory_import_rows (id_import, row_number, raw_json, error_message, created_item_id, updated_item_id)
           VALUES (?, ?, ?, NULL, NULL, ?)`,
          [id_import, vr.row_number, JSON.stringify(rawRows[vr.row_number - 1] || {}), id_item]
        )
      } else {
        const [ins] = await conn.query(
          `INSERT INTO inventory_items (id_empresa, tipo, nombre, cantidad, espacio, estado, descripcion)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id_empresa, vr.tipo, vr.nombre, vr.cantidad, vr.espacio, vr.estado, vr.descripcion]
        )
        createdCount++

        const createdId = ins?.insertId
        await conn.query(
          `INSERT INTO inventory_import_rows (id_import, row_number, raw_json, error_message, created_item_id, updated_item_id)
           VALUES (?, ?, ?, NULL, ?, NULL)`,
          [id_import, vr.row_number, JSON.stringify(rawRows[vr.row_number - 1] || {}), createdId]
        )
      }
    }

    await conn.commit()
    return { createdCount, updatedCount }
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

