import express from 'express'
import multer from 'multer'
import { requireRole } from '../middleware/requireRole.js'
import { authJwt } from '../middleware/authJwt.js'
import { dataStore } from '../services/dataStore.js'
import {
  RECURSO_COLUMNS,
  parseCsvText,
  validateRecursoRows,
  insertRecursos
} from '../services/recursoImportService.js'

export const logisticsRouter = express.Router()

logisticsRouter.use(authJwt)
logisticsRouter.use(requireRole(['logistica', 'logist', 'admin', 'superadmin']))

const STATUSES_ROUTE = ['pendiente', 'en curso', 'finalizada', 'retrasada']
const STATUSES_ORDER = ['recibido', 'preparado', 'enviado', 'entregado']
const STATUSES_TICKET = ['abierta', 'en proceso', 'resuelta']
const PRIORITIES_TICKET = ['baja', 'media', 'alta', 'crítica']

const csvColumns = [
  'nombre',
  'tipo',
  'stock',
  'precio',
  'estado'
]

const recursoCsvColumns = [...RECURSO_COLUMNS]
const upload = multer({ storage: multer.memoryStorage() })

const nowIso = () => new Date().toISOString()
const rid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`

function asNum(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function addHistory(module, action, details, user = 'logistica_api') {
  dataStore.logistics.history.unshift({
    id: rid('h'),
    module,
    action,
    details,
    user,
    at: nowIso()
  })
}

function csvToRows(csvText = '') {
  const lines = String(csvText)
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)

  if (!lines.length) return []
  const headers = lines[0].split(',').map((s) => s.trim())
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(',').map((s) => s.trim())
    const row = {}
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? ''
    })
    return row
  })

  return { headers, rows }
}

const headerAliasMap = {
  nombre: 'nombre',
  nombre_recurso: 'nombre',
  producto: 'nombre',
  recurso: 'nombre',

  tipo: 'tipo',
  categoria: 'tipo',

  stock: 'stock',
  cantidad: 'stock',

  precio: 'precio',
  costo: 'precio',

  estado: 'estado',
  activo: 'estado'
}

function normalizeHeader(h = '') {
  return String(h).trim().toLowerCase().replace(/\s+/g, '_')
}

function normalizeCsvParsed(parsed) {
  const mappedHeaders = parsed.headers.map((h) => {
    const normalized = normalizeHeader(h)
    return headerAliasMap[normalized] || normalized
  })

  const normalizedRows = parsed.rows.map((row) => {
    const out = {}
    parsed.headers.forEach((originalHeader, i) => {
      const targetHeader = mappedHeaders[i]
      out[targetHeader] = row[originalHeader]
    })
    return out
  })

  return { headers: mappedHeaders, rows: normalizedRows }
}

function parseEstadoToBoolean(value) {
  const v = String(value ?? '').trim().toLowerCase()
  return ['true', '1', 'si', 'sí', 'activo', 'activa'].includes(v)
}

function validateInventoryRow(row, existingKeySet) {
  const errors = []

  for (const c of csvColumns) {
    if (row[c] == null || String(row[c]).trim() === '') {
      errors.push(`Columna obligatoria faltante: ${c}`)
    }
  }

  const stock = asNum(row.stock, NaN)
  const precio = asNum(row.precio, NaN)

  if (!Number.isFinite(stock)) errors.push('stock debe ser numérico')
  if (!Number.isFinite(precio)) errors.push('precio debe ser numérico')

  const key = `${String(row.nombre || '').trim().toLowerCase()}::${String(row.tipo || '').trim().toLowerCase()}`
  if (existingKeySet.has(key)) errors.push('Recurso duplicado (nombre + tipo)')

  return {
    valid: errors.length === 0,
    errors,
    key
  }
}

logisticsRouter.get('/preparation-list', (req, res) => {
  res.json({ list: dataStore.preparationList })
})

logisticsRouter.get('/dashboard', (req, res) => {
  const routes = dataStore.logistics.routes
  const orders = dataStore.logistics.orders
  const tickets = dataStore.logistics.tickets
  const inventory = dataStore.logistics.inventory

  const kpis = {
    rutas_activas: routes.filter((r) => r.status === 'en curso').length,
    rutas_retrasadas: routes.filter((r) => r.status === 'retrasada').length,
    pedidos_pendientes: orders.filter((o) => ['recibido', 'preparado'].includes(o.status)).length,
    pedidos_entregados: orders.filter((o) => o.status === 'entregado').length,
    incidencias_abiertas: tickets.filter((t) => t.status !== 'resuelta').length,
    inventario_bajo: inventory.filter((i) => asNum(i.stock) <= 5).length
  }

  const livePanel = routes.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    driver: r.driver,
    vehicle: r.vehicle,
    etaMinutes: r.etaMinutes
  }))

  const alerts = []
  if (kpis.rutas_retrasadas > 0) alerts.push({ level: 'warning', message: `${kpis.rutas_retrasadas} rutas retrasadas` })
  if (kpis.incidencias_abiertas > 0) alerts.push({ level: 'danger', message: `${kpis.incidencias_abiertas} incidencias activas` })
  if (kpis.inventario_bajo > 0) alerts.push({ level: 'warning', message: `${kpis.inventario_bajo} productos bajo stock` })

  res.json({
    kpis,
    livePanel,
    alerts,
    charts: {
      pedidos_por_estado: STATUSES_ORDER.map((s) => ({
        status: s,
        value: orders.filter((o) => o.status === s).length
      })),
      rutas_por_estado: STATUSES_ROUTE.map((s) => ({
        status: s,
        value: routes.filter((r) => r.status === s).length
      }))
    }
  })
})

logisticsRouter.get('/routes', (req, res) => {
  const q = String(req.query.q || '').toLowerCase()
  const status = String(req.query.status || '').toLowerCase()

  let rows = [...dataStore.logistics.routes]
  if (status && STATUSES_ROUTE.includes(status)) rows = rows.filter((r) => r.status === status)
  if (q) {
    rows = rows.filter((r) =>
      [r.code, r.origin, r.destination, r.driver, r.vehicle].join(' ').toLowerCase().includes(q)
    )
  }

  res.json({ items: rows })
})

logisticsRouter.post('/routes', (req, res) => {
  const { code, origin, destination, driver = '', vehicle = '', status = 'pendiente', etaMinutes = 0 } = req.body || {}
  if (!code || !origin || !destination) {
    return res.status(400).json({ message: 'code, origin y destination son obligatorios' })
  }
  if (!STATUSES_ROUTE.includes(status)) return res.status(400).json({ message: 'Estado de ruta inválido' })

  const row = {
    id: rid('r'),
    code: String(code),
    origin: String(origin),
    destination: String(destination),
    driver: String(driver),
    vehicle: String(vehicle),
    status,
    etaMinutes: asNum(etaMinutes, 0),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    timeline: [{ at: nowIso(), label: 'Ruta creada', status }]
  }

  dataStore.logistics.routes.unshift(row)
  addHistory('rutas', 'Ruta creada', row.code, req.user?.username || 'logistica_ui')
  res.status(201).json({ item: row })
})

logisticsRouter.put('/routes/:id', (req, res) => {
  const id = req.params.id
  const idx = dataStore.logistics.routes.findIndex((r) => r.id === id)
  if (idx < 0) return res.status(404).json({ message: 'Ruta no encontrada' })

  const current = dataStore.logistics.routes[idx]
  const next = { ...current, ...req.body, updatedAt: nowIso() }
  if (next.status && !STATUSES_ROUTE.includes(next.status)) {
    return res.status(400).json({ message: 'Estado de ruta inválido' })
  }

  if (next.status !== current.status) {
    next.timeline = [
      { at: nowIso(), label: `Cambio de estado a ${next.status}`, status: next.status },
      ...(current.timeline || [])
    ]
  }

  dataStore.logistics.routes[idx] = next
  addHistory('rutas', 'Ruta actualizada', next.code, req.user?.username || 'logistica_ui')
  res.json({ item: next })
})

logisticsRouter.delete('/routes/:id', (req, res) => {
  const id = req.params.id
  const idx = dataStore.logistics.routes.findIndex((r) => r.id === id)
  if (idx < 0) return res.status(404).json({ message: 'Ruta no encontrada' })
  const [deleted] = dataStore.logistics.routes.splice(idx, 1)
  addHistory('rutas', 'Ruta eliminada', deleted.code, req.user?.username || 'logistica_ui')
  res.json({ ok: true })
})

logisticsRouter.get('/routes/:id/timeline', (req, res) => {
  const item = dataStore.logistics.routes.find((r) => r.id === req.params.id)
  if (!item) return res.status(404).json({ message: 'Ruta no encontrada' })
  res.json({ items: item.timeline || [] })
})

logisticsRouter.get('/orders', (req, res) => {
  const q = String(req.query.q || '').toLowerCase()
  const status = String(req.query.status || '').toLowerCase()
  let rows = [...dataStore.logistics.orders]

  if (status && STATUSES_ORDER.includes(status)) rows = rows.filter((o) => o.status === status)
  if (q) {
    rows = rows.filter((o) =>
      [o.id, o.customerName, o.customerPhone, o.customerAddress].join(' ').toLowerCase().includes(q)
    )
  }

  res.json({ items: rows })
})

logisticsRouter.put('/orders/:id/status', (req, res) => {
  const { status } = req.body || {}
  if (!STATUSES_ORDER.includes(status)) return res.status(400).json({ message: 'Estado de pedido inválido' })

  const row = dataStore.logistics.orders.find((o) => o.id === req.params.id)
  if (!row) return res.status(404).json({ message: 'Pedido no encontrado' })

  row.status = status
  row.updatedAt = nowIso()
  row.history = [{ at: nowIso(), status, note: `Estado actualizado a ${status}` }, ...(row.history || [])]

  addHistory('pedidos', 'Estado de pedido actualizado', `${row.id} -> ${status}`, req.user?.username || 'logistica_ui')
  res.json({ item: row })
})

logisticsRouter.get('/inventory', (req, res) => {
  const q = String(req.query.q || '').toLowerCase()
  const category = String(req.query.category || '').toLowerCase()
  let rows = [...dataStore.logistics.inventory]

  if (category) rows = rows.filter((i) => String(i.tipo || '').toLowerCase() === category)
  if (q) {
    rows = rows.filter((i) =>
      [i.nombre, i.tipo, i.stock, i.precio, i.estado].join(' ').toLowerCase().includes(q)
    )
  }

  res.json({
    items: rows,
    lowStock: []
  })
})

logisticsRouter.post('/inventory', (req, res) => {
  const payload = req.body || {}
  for (const c of csvColumns) {
    if (payload[c] == null || String(payload[c]).trim() === '') {
      return res.status(400).json({ message: `Campo obligatorio: ${c}` })
    }
  }

  const duplicated = dataStore.logistics.inventory.some(
    (i) => String(i.nombre).trim().toLowerCase() === String(payload.nombre).trim().toLowerCase() &&
      String(i.tipo).trim().toLowerCase() === String(payload.tipo).trim().toLowerCase()
  )
  if (duplicated) return res.status(409).json({ message: 'Recurso duplicado (nombre + tipo)' })

  const row = {
    id: rid('inv'),
    ...payload,
    stock: asNum(payload.stock, 0),
    precio: asNum(payload.precio, 0),
    estado: String(payload.estado).toLowerCase() === 'true' || String(payload.estado).toLowerCase() === 'activo',
    createdAt: nowIso(),
    updatedAt: nowIso()
  }

  dataStore.logistics.inventory.unshift(row)
  dataStore.logistics.inventoryMovements.unshift({
    id: rid('mov'),
    sku: row.nombre,
    type: 'entrada',
    qty: row.stock,
    note: 'Alta de recurso',
    at: nowIso()
  })
  addHistory('inventario', 'Recurso creado', row.nombre, req.user?.username || 'logistica_ui')
  res.status(201).json({ item: row })
})

logisticsRouter.put('/inventory/:id', (req, res) => {
  const idx = dataStore.logistics.inventory.findIndex((i) => i.id === req.params.id)
  if (idx < 0) return res.status(404).json({ message: 'Producto no encontrado' })

  const current = dataStore.logistics.inventory[idx]
  const next = { ...current, ...req.body, updatedAt: nowIso() }
  next.stock = asNum(next.stock, current.stock)
  next.precio = asNum(next.precio, current.precio)
  next.estado = typeof next.estado === 'boolean'
    ? next.estado
    : String(next.estado).toLowerCase() === 'true' || String(next.estado).toLowerCase() === 'activo'

  dataStore.logistics.inventory[idx] = next
  addHistory('inventario', 'Recurso actualizado', next.nombre, req.user?.username || 'logistica_ui')
  res.json({ item: next })
})

logisticsRouter.delete('/inventory/:id', (req, res) => {
  const idx = dataStore.logistics.inventory.findIndex((i) => i.id === req.params.id)
  if (idx < 0) return res.status(404).json({ message: 'Producto no encontrado' })
  const [deleted] = dataStore.logistics.inventory.splice(idx, 1)
  addHistory('inventario', 'Recurso eliminado', deleted.nombre, req.user?.username || 'logistica_ui')
  res.json({ ok: true })
})

logisticsRouter.get('/inventory/movements', (req, res) => {
  res.json({ items: dataStore.logistics.inventoryMovements })
})

logisticsRouter.get('/inventory/template.csv', (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="inventario_plantilla.csv"')
  const exampleRow = [
    'Silla plegable',
    'mobiliario',
    '25',
    '180.50',
    'true'
  ].join(',')
  res.send(`${csvColumns.join(',')}\n${exampleRow}\n`)
})

// ==========================
// NUEVO: Importación masiva CSV -> tabla `recurso`
// ==========================
logisticsRouter.get('/inventario/plantilla', (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_recurso.csv"')

  const rows = [
    recursoCsvColumns.join(','),
    'Laptop,Tecnología,15,2500000,1,1',
    'Silla,Mobiliario,40,180000,1,1',
    'VideoBeam,Equipos,8,3200000,1,2'
  ]

  res.send(`${rows.join('\n')}\n`)
})

logisticsRouter.post('/inventario/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Archivo CSV requerido' })

    const csvText = req.file.buffer.toString('utf8')
    const { headers, rows } = parseCsvText(csvText)

    if (!headers.length) {
      return res.status(400).json({ success: false, message: 'CSV vacío o inválido' })
    }

    const missingHeaders = recursoCsvColumns.filter((h) => !headers.includes(h))
    if (missingHeaders.length) {
      return res.status(400).json({
        success: false,
        message: 'Faltan columnas obligatorias',
        missingHeaders
      })
    }

    const { validRows, errors } = await validateRecursoRows(rows)

    return res.json({
      success: true,
      total: rows.length,
      validos: validRows.length,
      invalidos: errors.length,
      errores: errors,
      preview: rows
    })
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: 'Error procesando preview CSV',
      error: String(e?.message || e)
    })
  }
})

logisticsRouter.post('/inventario/importar', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Archivo CSV requerido' })

    const csvText = req.file.buffer.toString('utf8')
    const { headers, rows } = parseCsvText(csvText)

    if (!headers.length) {
      return res.status(400).json({ success: false, message: 'CSV vacío o inválido' })
    }

    const missingHeaders = recursoCsvColumns.filter((h) => !headers.includes(h))
    if (missingHeaders.length) {
      return res.status(400).json({
        success: false,
        message: 'Faltan columnas obligatorias',
        missingHeaders
      })
    }

    const { validRows, errors } = await validateRecursoRows(rows)
    const { insertados } = await insertRecursos(validRows)

    return res.json({
      success: true,
      insertados,
      validos: validRows.length,
      invalidos: errors.length,
      errores: errors
    })
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: 'Error importando CSV',
      error: String(e?.message || e)
    })
  }
})

logisticsRouter.post('/inventory/import/preview', (req, res) => {
  const { csvText = '' } = req.body || {}
  const parsed = csvToRows(csvText)
  if (!parsed || !parsed.headers) return res.status(400).json({ message: 'CSV vacío o inválido' })

  const normalized = normalizeCsvParsed(parsed)
  const missingHeaders = csvColumns.filter((h) => !normalized.headers.includes(h))
  if (missingHeaders.length) {
    return res.status(400).json({ message: 'Faltan columnas obligatorias', missingHeaders })
  }

  const existingKeys = new Set(
    dataStore.logistics.inventory.map(
      (i) => `${String(i.nombre || '').trim().toLowerCase()}::${String(i.tipo || '').trim().toLowerCase()}`
    )
  )

  const rows = normalized.rows.map((row, index) => {
    const candidate = {
      nombre: String(row.nombre || '').trim(),
      tipo: String(row.tipo || '').trim(),
      stock: row.stock,
      precio: row.precio,
      estado: row.estado
    }
    const v = validateInventoryRow(candidate, existingKeys)
    if (v.valid) existingKeys.add(v.key)
    return {
      index: index + 2,
      row: {
        nombre: candidate.nombre,
        tipo: candidate.tipo,
        stock: asNum(candidate.stock, 0),
        precio: asNum(candidate.precio, 0),
        estado: parseEstadoToBoolean(candidate.estado)
      },
      valid: v.valid,
      errors: v.errors
    }
  })

  res.json({
    total: rows.length,
    valid: rows.filter((r) => r.valid).length,
    invalid: rows.filter((r) => !r.valid).length,
    rows
  })
})

logisticsRouter.post('/inventory/import/commit', (req, res) => {
  const { rows = [] } = req.body || {}
  if (!Array.isArray(rows)) return res.status(400).json({ message: 'rows debe ser un arreglo' })

  const existingKeys = new Set(
    dataStore.logistics.inventory.map(
      (i) => `${String(i.nombre || '').trim().toLowerCase()}::${String(i.tipo || '').trim().toLowerCase()}`
    )
  )
  const accepted = []
  const rejected = []

  rows.forEach((row, idx) => {
    const candidate = {
      nombre: String(row.nombre || '').trim(),
      tipo: String(row.tipo || '').trim(),
      stock: row.stock,
      precio: row.precio,
      estado: row.estado
    }

    const v = validateInventoryRow(candidate, existingKeys)
    if (!v.valid) {
      rejected.push({ index: idx + 1, row: candidate, errors: v.errors })
      return
    }

    existingKeys.add(v.key)
    const item = {
      id: rid('inv'),
      nombre: candidate.nombre,
      tipo: candidate.tipo,
      stock: asNum(candidate.stock, 0),
      precio: asNum(candidate.precio, 0),
      estado: parseEstadoToBoolean(candidate.estado),
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
    accepted.push(item)
  })

  dataStore.logistics.inventory = [...accepted, ...dataStore.logistics.inventory]
  accepted.forEach((row) => {
    dataStore.logistics.inventoryMovements.unshift({
      id: rid('mov'),
      sku: row.nombre,
      type: 'entrada',
      qty: row.stock,
      note: 'Importación CSV recurso',
      at: nowIso()
    })
  })

  if (accepted.length) {
    addHistory('inventario', 'Importación CSV recurso', `${accepted.length} registros`, req.user?.username || 'logistica_ui')
  }

  res.json({
    imported: accepted.length,
    rejected: rejected.length,
    rejectedRows: rejected
  })
})

logisticsRouter.get('/tickets', (req, res) => {
  const q = String(req.query.q || '').toLowerCase()
  const status = String(req.query.status || '').toLowerCase()
  const priority = String(req.query.priority || '').toLowerCase()

  let rows = [...dataStore.logistics.tickets]
  if (status && STATUSES_TICKET.includes(status)) rows = rows.filter((t) => t.status === status)
  if (priority && PRIORITIES_TICKET.includes(priority)) rows = rows.filter((t) => t.priority === priority)
  if (q) {
    rows = rows.filter((t) =>
      [t.id, t.title, t.description, t.assignedTo].join(' ').toLowerCase().includes(q)
    )
  }

  res.json({ items: rows })
})

logisticsRouter.post('/tickets', (req, res) => {
  const { title, description = '', priority = 'media', status = 'abierta', assignedTo = '' } = req.body || {}
  if (!title) return res.status(400).json({ message: 'title es obligatorio' })
  if (!PRIORITIES_TICKET.includes(priority)) return res.status(400).json({ message: 'Prioridad inválida' })
  if (!STATUSES_TICKET.includes(status)) return res.status(400).json({ message: 'Estado inválido' })

  const row = {
    id: rid('tic'),
    title: String(title),
    description: String(description),
    priority,
    status,
    assignedTo: String(assignedTo),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    comments: []
  }

  dataStore.logistics.tickets.unshift(row)
  addHistory('incidencias', 'Incidencia creada', row.title, req.user?.username || 'logistica_ui')
  res.status(201).json({ item: row })
})

logisticsRouter.put('/tickets/:id', (req, res) => {
  const idx = dataStore.logistics.tickets.findIndex((t) => t.id === req.params.id)
  if (idx < 0) return res.status(404).json({ message: 'Incidencia no encontrada' })

  const current = dataStore.logistics.tickets[idx]
  const next = { ...current, ...req.body, updatedAt: nowIso() }

  if (next.priority && !PRIORITIES_TICKET.includes(next.priority)) {
    return res.status(400).json({ message: 'Prioridad inválida' })
  }
  if (next.status && !STATUSES_TICKET.includes(next.status)) {
    return res.status(400).json({ message: 'Estado inválido' })
  }

  dataStore.logistics.tickets[idx] = next
  addHistory('incidencias', 'Incidencia actualizada', next.title, req.user?.username || 'logistica_ui')
  res.json({ item: next })
})

logisticsRouter.post('/tickets/:id/comments', (req, res) => {
  const { text = '' } = req.body || {}
  if (!text.trim()) return res.status(400).json({ message: 'Comentario vacío' })

  const row = dataStore.logistics.tickets.find((t) => t.id === req.params.id)
  if (!row) return res.status(404).json({ message: 'Incidencia no encontrada' })

  const comment = {
    id: rid('c'),
    author: req.user?.username || 'logistica_ui',
    text: String(text),
    at: nowIso()
  }

  row.comments = [comment, ...(row.comments || [])]
  row.updatedAt = nowIso()
  addHistory('incidencias', 'Comentario agregado', row.title, req.user?.username || 'logistica_ui')
  res.status(201).json({ item: comment })
})

logisticsRouter.get('/history', (req, res) => {
  const q = String(req.query.q || '').toLowerCase()
  const module = String(req.query.module || '').toLowerCase()
  const from = req.query.from ? new Date(String(req.query.from)).getTime() : null
  const to = req.query.to ? new Date(String(req.query.to)).getTime() : null
  const page = Math.max(1, asNum(req.query.page, 1))
  const pageSize = Math.max(1, Math.min(100, asNum(req.query.pageSize, 10)))

  let rows = [...dataStore.logistics.history]
  if (module) rows = rows.filter((h) => String(h.module).toLowerCase() === module)
  if (from) rows = rows.filter((h) => new Date(h.at).getTime() >= from)
  if (to) rows = rows.filter((h) => new Date(h.at).getTime() <= to)
  if (q) {
    rows = rows.filter((h) =>
      [h.module, h.action, h.user, h.details].join(' ').toLowerCase().includes(q)
    )
  }

  const total = rows.length
  const start = (page - 1) * pageSize
  const items = rows.slice(start, start + pageSize)

  res.json({
    items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
  })
})

logisticsRouter.get('/history/export/:type', (req, res) => {
  const type = String(req.params.type || '').toLowerCase()
  if (!['pdf', 'excel'].includes(type)) return res.status(400).json({ message: 'Tipo inválido' })

  res.json({
    ok: true,
    type,
    generatedAt: nowIso(),
    url: `/mock-exports/logistica-historial.${type === 'excel' ? 'xlsx' : 'pdf'}`
  })
})

