import { getPool } from './mysql.js'

export const RECURSO_COLUMNS = ['nombre', 'tipo', 'stock', 'precio', 'estado', 'id_empresa']

export function normalizeHeader(h = '') {
  return String(h).trim().toLowerCase()
}

export function parseBooleanEstado(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (['1', 'true'].includes(raw)) return 1
  if (['0', 'false'].includes(raw)) return 0
  return null
}

export function parseInteger(value) {
  const s = String(value ?? '').trim()
  if (!s) return null
  if (!/^-?\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isInteger(n) ? n : null
}

export function parseDecimal(value) {
  const s = String(value ?? '').trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return n
}

export function parseCsvText(csvText = '') {
  const lines = String(csvText)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')

  if (!lines.length) return { headers: [], rows: [] }

  const splitCsvLine = (line) => {
    const out = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      const next = line[i + 1]

      if (ch === '"' && inQuotes && next === '"') {
        current += '"'
        i++
        continue
      }

      if (ch === '"') {
        inQuotes = !inQuotes
        continue
      }

      if (ch === ',' && !inQuotes) {
        out.push(current)
        current = ''
        continue
      }

      current += ch
    }

    out.push(current)
    return out.map((v) => v.trim())
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader)
  const rows = lines.slice(1).map((line) => {
    const cols = splitCsvLine(line)
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? ''
    })
    return row
  })

  return { headers, rows }
}

export async function findExistingEmpresaIds(ids = []) {
  if (!ids.length) return new Set()
  const pool = getPool()
  const uniqueIds = [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))]
  if (!uniqueIds.length) return new Set()

  const placeholders = uniqueIds.map(() => '?').join(',')
  const [rows] = await pool.query(
    `SELECT id_empresa FROM empresa WHERE id_empresa IN (${placeholders})`,
    uniqueIds
  )

  return new Set((rows || []).map((r) => Number(r.id_empresa)))
}

export async function validateRecursoRows(rows = []) {
  const errors = []
  const validRows = []

  const empresaCandidates = rows
    .map((r) => parseInteger(r.id_empresa))
    .filter((n) => Number.isInteger(n) && n > 0)

  const existingEmpresaIds = await findExistingEmpresaIds(empresaCandidates)

  rows.forEach((r, index) => {
    const fila = index + 2
    const rowErrors = []

    const nombre = String(r.nombre ?? '').trim()
    const tipo = String(r.tipo ?? '').trim()
    const stock = parseInteger(r.stock)
    const precio = parseDecimal(r.precio)
    const estado = parseBooleanEstado(r.estado)
    const id_empresa = parseInteger(r.id_empresa)

    if (!nombre) rowErrors.push('nombre es obligatorio')
    if (nombre && nombre.length > 100) rowErrors.push('nombre supera 100 caracteres')

    if (!tipo) rowErrors.push('tipo es obligatorio')
    if (tipo && tipo.length > 50) rowErrors.push('tipo supera 50 caracteres')

    if (stock === null) rowErrors.push('stock inválido')
    if (stock !== null && stock < 0) rowErrors.push('stock no puede ser negativo')

    if (precio === null) rowErrors.push('precio inválido')
    if (precio !== null && precio < 0) rowErrors.push('precio debe ser mayor o igual a 0')

    if (estado === null) rowErrors.push('estado inválido (use 1,0,true,false)')

    if (id_empresa === null) rowErrors.push('id_empresa es obligatorio')
    if (id_empresa !== null && !existingEmpresaIds.has(id_empresa)) rowErrors.push('id_empresa no existe')

    if (rowErrors.length) {
      errors.push({
        fila,
        mensaje: rowErrors.join(' • ')
      })
      return
    }

    validRows.push({
      nombre,
      tipo,
      stock,
      precio,
      estado,
      id_empresa
    })
  })

  return { validRows, errors }
}

export async function insertRecursos(validRows = []) {
  if (!validRows.length) return { insertados: 0 }
  const pool = getPool()

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const sql = `
      INSERT INTO recurso (nombre, tipo, stock, precio, estado, id_empresa)
      VALUES (?, ?, ?, ?, ?, ?)
    `

    for (const row of validRows) {
      await conn.query(sql, [
        row.nombre,
        row.tipo,
        row.stock,
        row.precio,
        row.estado,
        row.id_empresa
      ])
    }

    await conn.commit()
    return { insertados: validRows.length }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}
