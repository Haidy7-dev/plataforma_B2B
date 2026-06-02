import { getPool } from './mysql.js'

export const RECURSO_COLUMNS = ['nombre', 'tipo', 'stock', 'precio', 'estado', 'id_empresa']

// Para CSV ADMIN (Inventario CSV) SOLO estos campos son obligatorios.
// El sistema completa el resto: estado e id_empresa.
export const RECURSO_IMPORT_REQUIRED_COLUMNS = ['nombre', 'tipo', 'stock', 'precio']

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

  const countDelim = (line, delim) => {
    // Contar delimitadores ignorando los que estén dentro de comillas
    let inQuotes = false
    let count = 0
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') inQuotes = !inQuotes
      if (!inQuotes && ch === delim) count++
    }
    return count
  }

  const detectDelimiter = (headerLine) => {
    const comma = countDelim(headerLine, ',')
    const semi = countDelim(headerLine, ';')
    // Si hay más ';' que ',' asumimos ';' (muy típico en CSV Excel ES)
    return semi > comma ? ';' : ','
  }

  const splitCsvLine = (line, delimiter) => {
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

      if (ch === delimiter && !inQuotes) {
        out.push(current)
        current = ''
        continue
      }

      current += ch
    }

    out.push(current)
    return out.map((v) => v.trim())
  }

  const delimiter = detectDelimiter(lines[0])
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader)

  const rows = lines.slice(1).map((line) => {
    const cols = splitCsvLine(line, delimiter)
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

  // Para permitir que estado/id_empresa vengan vacíos del CSV,
  // calculamos candidatos solo si existen.
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

    // Defaults del sistema (si el CSV no trae estos campos)
    const estadoParsed = parseBooleanEstado(r.estado)
    const estado = estadoParsed === null ? 1 : estadoParsed

    const idEmpresaParsed = parseInteger(r.id_empresa)
    const id_empresa = idEmpresaParsed === null ? null : idEmpresaParsed

    // Validar SOLO columnas requeridas por el objetivo
    if (!nombre) rowErrors.push('nombre es obligatorio')
    if (nombre && nombre.length > 100) rowErrors.push('nombre supera 100 caracteres')

    if (!tipo) rowErrors.push('tipo es obligatorio')
    if (tipo && tipo.length > 50) rowErrors.push('tipo supera 50 caracteres')

    if (stock === null) rowErrors.push('stock inválido')
    if (stock !== null && stock < 0) rowErrors.push('stock no puede ser negativo')

    if (precio === null) rowErrors.push('precio inválido')
    if (precio !== null && precio < 0) rowErrors.push('precio debe ser mayor o igual a 0')

    // Validación opcional de estado/id_empresa si vienen en el CSV o desde el caller
    if (parseBooleanEstado(r.estado) !== null && estadoParsed === null) {
      // caso improbable por parseBooleanEstado, pero dejamos claro el motivo
      rowErrors.push('estado inválido (use 1,0,true,false)')
    }

    if (id_empresa !== null && !existingEmpresaIds.has(id_empresa)) {
      rowErrors.push('id_empresa no existe')
    }

    if (rowErrors.length) {
      console.log('[recursoImportService][validateRecursoRows] filaRechazada', {
        fila,
        required: RECURSO_IMPORT_REQUIRED_COLUMNS,
        found: Object.keys(r || {}).slice(0, 20),
        motivo: rowErrors.join(' • ')
      })
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
      // id_empresa: si el caller ya lo inyectó desde JWT, irá aquí.
      // Si no viene, insertRecursos fallará en BD: pero en nuestro flujo el route lo inyecta.
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
