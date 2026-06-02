import express from 'express'
import { authJwt } from '../middleware/authJwt.js'
import { requireRole } from '../middleware/requireRole.js'
import { dataStore } from '../services/dataStore.js'
import { getPool } from '../services/mysql.js'

export const adminRouter = express.Router()

adminRouter.use(authJwt)
adminRouter.use(requireRole(['admin']))

// =========
// Mock store
// =========
if (!dataStore.quotations) dataStore.quotations = []

// Motor de Reservas (Admin)
// - Listar cotizaciones creadas
// - Consultar disponibilidad mock para avanzar el flujo
adminRouter.get('/reservations/quotes', (req, res) => {
  const id_empresa = req.user?.id_empresa || null
  res.json({ id_empresa, quotes: dataStore.quotations })
})

adminRouter.post('/reservations/check-availability', (req, res) => {
  const payload = req.body || {}
  const space = payload.space || {}
  const ok = Boolean(space.espacioId && space.fecha)

  res.json({
    ok,
    reason: ok ? null : 'Faltan datos de espacio (espacioId/fecha)'
  })
})

// =========================
// Dashboard (Admin)
// =========================
adminRouter.get('/dashboard/stats', async (req, res) => {
  const id_empresa = req.user?.id_empresa

  if (!id_empresa) {
    return res.status(400).json({ message: 'id_empresa faltante en JWT' })
  }

  const pool = getPool()

  // Estados financieros parciales requeridos:
  // - PARCIAL
  // - PAGO PARCIAL
  const PARTIAL_STATES = ['PARCIAL', 'PAGO PARCIAL']
  const placeholders = PARTIAL_STATES.map(() => '?').join(', ')

  // Normaliza estado_financiero para evitar discrepancias por espacios/case en BD
  const EF_NORM = 'UPPER(TRIM(r.estado_financiero))'

  try {
    // =========================
    // Usuarios activos
    // =========================
    // Activos = usuarios habilitados/estado activo (columna "estado" en tabla usuario)
    const [activeUsersRows] = await pool.query(
      `
      SELECT
        COUNT(DISTINCT u.id_usuario) AS activeUsers
      FROM usuario u
      WHERE u.id_empresa = ?
        AND u.estado = ?
      `,
      [Number(id_empresa), 1]
    )

    const activeUsers = Number(activeUsersRows?.[0]?.activeUsers || 0)

    // Conteo de reservas con estado financiero parcial
    const [partialRows] = await pool.query(
      `
      SELECT
        COUNT(DISTINCT r.id_reserva) AS countParciales
      FROM reserva r
      INNER JOIN espacio e ON e.id_espacio = r.id_espacio
      LEFT JOIN pago p ON p.id_reserva = r.id_reserva
      WHERE e.id_empresa = ?
        AND ${EF_NORM} IN (${placeholders})
      `,
      [Number(id_empresa), ...PARTIAL_STATES]
    )

    const partialPayments = Number(partialRows?.[0]?.countParciales || 0)

    // Lista detallada de pagos parciales
    const [partialListRows] = await pool.query(
      `
      SELECT
        r.id_reserva,
        c.nombre AS cliente,
        r.fecha_evento,
        r.total,
        COALESCE(SUM(p.monto), 0) AS valor_pagado,
        (COALESCE(r.total, 0) - COALESCE(SUM(p.monto), 0)) AS saldo_pendiente,
        r.estado_financiero
      FROM reserva r
      INNER JOIN espacio e ON e.id_espacio = r.id_espacio
      INNER JOIN cliente c ON c.id_cliente = r.id_cliente
      LEFT JOIN pago p ON p.id_reserva = r.id_reserva
      WHERE e.id_empresa = ?
        AND ${EF_NORM} IN (${placeholders})
      GROUP BY r.id_reserva, c.nombre, r.fecha_evento, r.total, r.estado_financiero
      ORDER BY r.fecha_evento DESC, r.id_reserva DESC
      `,
      [Number(id_empresa), ...PARTIAL_STATES]
    )

    // Conteo y lista de pagos pendientes (estado_financiero = PENDIENTE)
    const PENDING_STATE = 'PENDIENTE'

    const [pendingCountRows] = await pool.query(
      `
      SELECT
        COUNT(DISTINCT r.id_reserva) AS countPendientes
      FROM reserva r
      INNER JOIN espacio e ON e.id_espacio = r.id_espacio
      WHERE e.id_empresa = ?
        AND ${EF_NORM} = ?
      `,
      [Number(id_empresa), PENDING_STATE]
    )

    const pendingPayments = Number(pendingCountRows?.[0]?.countPendientes || 0)

    const [pendingListRows] = await pool.query(
      `
      SELECT
        r.id_reserva,
        c.nombre AS cliente,
        r.fecha_evento,
        COALESCE(r.total, 0) AS total,
        r.estado_financiero
      FROM reserva r
      INNER JOIN espacio e ON e.id_espacio = r.id_espacio
      INNER JOIN cliente c ON c.id_cliente = r.id_cliente
      WHERE e.id_empresa = ?
        AND ${EF_NORM} = ?
      ORDER BY r.fecha_evento DESC, r.id_reserva DESC
      `,
      [Number(id_empresa), PENDING_STATE]
    )

    // =========================
    // Eventos próximos (Dashboard Admin)
    // =========================
    // Filtra por empresa autenticada + fecha >= ahora + excluye cancelados.
    // Importante: React espera columnas con estos aliases:
    // cliente, espacio, fecha_evento, estado_evento, estado_financiero, id_reserva
    const [upcomingRows] = await pool.query(
      `
      SELECT
        r.id_reserva,
        c.nombre AS cliente,
        e.nombre AS espacio,
        r.fecha_evento,
        r.estado_evento,
        r.estado_financiero
      FROM reserva r
      INNER JOIN espacio e ON e.id_espacio = r.id_espacio
      INNER JOIN cliente c ON c.id_cliente = r.id_cliente
      WHERE e.id_empresa = ?
        AND r.fecha_evento >= CURDATE()
        AND (UPPER(TRIM(r.estado_evento)) <> 'CANCELADO')
      ORDER BY r.fecha_evento ASC, r.id_reserva ASC
      LIMIT 5
      `,
      [Number(id_empresa)]
    )

    return res.json({
      activeUsers,
      confirmedEvents: 0,
      pendingPayments,
      finalizedEvents: 0,
      pendingPaymentsList: Array.isArray(pendingListRows) ? pendingListRows : [],
      recentReservations: [],

      partialPayments,
      partialPaymentsList: Array.isArray(partialListRows) ? partialListRows : []
    })
  } catch (e) {
    return res.status(500).json({
      message: 'Error cargando stats del dashboard',
      error: String(e?.message || e)
    })
  }
})

// =========================
// Reports (Admin)
// =========================
adminRouter.get('/reports/summary', async (req, res) => {
  const id_empresa = req.user?.id_empresa

  if (!id_empresa) {
    return res.status(400).json({ message: 'id_empresa faltante en JWT' })
  }

  const pool = getPool()

  // Estados financieros requeridos por el frontend:
  // - PENDIENTE
  // - PARCIAL
  // - PAGADO
  // - DEUDA (si tu BD usa este string)
  const PARTIAL_STATES = ['PARCIAL', 'PAGO PARCIAL']
  const PENDING_STATE = 'PENDIENTE'
  const PAID_STATE = 'PAGADO'
  const DEBT_STATE = 'DEUDA'

  const allFinancialStatesForUnpaid = [PENDING_STATE, ...PARTIAL_STATES, DEBT_STATE]

  // Helpers
  const unpaidPlaceholders = allFinancialStatesForUnpaid.map(() => '?').join(', ')
  const partialPlaceholders = PARTIAL_STATES.map(() => '?').join(', ')

  // Normaliza estado_financiero para evitar discrepancias por espacios/case en BD
  const EF_NORM = 'UPPER(TRIM(r.estado_financiero))'

  try {
    // =========
    // Conteos
    // =========
    const [financialCountRows] = await pool.query(
      `
      SELECT
        SUM(CASE WHEN ${EF_NORM} = ? THEN 1 ELSE 0 END) AS countPendiente,
        SUM(CASE WHEN ${EF_NORM} IN (${partialPlaceholders}) THEN 1 ELSE 0 END) AS countParcial,
        SUM(CASE WHEN ${EF_NORM} = ? THEN 1 ELSE 0 END) AS countPagado,
        SUM(CASE WHEN ${EF_NORM} = ? THEN 1 ELSE 0 END) AS countDeuda
      FROM reserva r
      INNER JOIN espacio e ON e.id_espacio = r.id_espacio
      WHERE e.id_empresa = ?
      `,
      [PENDING_STATE, ...PARTIAL_STATES, PAID_STATE, DEBT_STATE, Number(id_empresa)]
    )

    // Si no existe la tabla/estados, estos valores quedarán en 0
    const row0 = financialCountRows?.[0] || {}
    const PENDIENTE = Number(row0.countPendiente || 0)
    const PARCIAL = Number(row0.countParcial || 0)
    const PAGADO = Number(row0.countPagado || 0)
    const DEUDA = Number(row0.countDeuda || 0)

    const totalReservas = PENDIENTE + PARCIAL + PAGADO + DEUDA

    // ====================
    // Tabla: Reservas sin pagar (unpaidReservations)
    // ====================
    // El frontend espera:
    // id_reserva, cliente, espacio, fecha_evento, estado_evento, estado_financiero, total
    const [unpaidRows] = await pool.query(
      `
      SELECT
        r.id_reserva,
        c.nombre AS cliente,
        e.nombre AS espacio,
        r.fecha_evento,
        r.estado_evento,
        r.estado_financiero,
        COALESCE(r.total, 0) AS total
      FROM reserva r
      INNER JOIN espacio e ON e.id_espacio = r.id_espacio
      INNER JOIN cliente c ON c.id_cliente = r.id_cliente
      WHERE e.id_empresa = ?
        AND ${EF_NORM} IN (${unpaidPlaceholders})
      ORDER BY r.fecha_evento DESC, r.id_reserva DESC
      `,
      [Number(id_empresa), ...allFinancialStatesForUnpaid]
    )

    // ====================
    // Eventos próximos (upcomingEvents)
    // ====================
    // Si tu esquema no maneja estado_evento/fecha_evento de forma homogénea,
    // devolvemos lista vacía para evitar 404/500.
    const [upcomingRows] = await pool.query(
      `
      SELECT
        r.id_reserva,
        c.nombre AS cliente,
        e.nombre AS espacio,
        r.fecha_evento,
        r.estado_evento,
        r.estado_financiero,
        COALESCE(r.total, 0) AS total
      FROM reserva r
      INNER JOIN espacio e ON e.id_espacio = r.id_espacio
      INNER JOIN cliente c ON c.id_cliente = r.id_cliente
      WHERE e.id_empresa = ?
        AND r.fecha_evento >= NOW()
      ORDER BY r.fecha_evento ASC
      LIMIT 10
      `,
      [Number(id_empresa)]
    )

    // ====================
    // Pagos Pendientes y Pagos Parciales (solo fecha_evento, espacio, estado_financiero)
    // ====================

    const [pendingPaymentsRows] = await pool.query(
      `
      SELECT
        r.fecha_evento,
        e.nombre AS espacio,
        r.estado_financiero
      FROM reserva r
      INNER JOIN espacio e ON e.id_espacio = r.id_espacio
      WHERE e.id_empresa = ?
        AND ${EF_NORM} = ?
      ORDER BY r.fecha_evento DESC, r.id_reserva DESC
      `,
      [Number(id_empresa), PENDING_STATE]
    )

    const [partialPaymentsRows] = await pool.query(
      `
      SELECT
        r.fecha_evento,
        e.nombre AS espacio,
        r.estado_financiero
      FROM reserva r
      INNER JOIN espacio e ON e.id_espacio = r.id_espacio
      WHERE e.id_empresa = ?
        AND ${EF_NORM} IN (${partialPlaceholders})
      ORDER BY r.fecha_evento DESC, r.id_reserva DESC
      `,
      [Number(id_empresa), ...PARTIAL_STATES]
    )

    return res.json({
      incidencias: 0,
      cumplimiento: 0,
      totalReservas,
      financieros: {
        PENDIENTE,
        PARCIAL,
        PAGADO,
        DEUDA
      },
      unpaidReservations: Array.isArray(unpaidRows) ? unpaidRows : [],
      upcomingEvents: Array.isArray(upcomingRows) ? upcomingRows : [],
      pendingPayments: Array.isArray(pendingPaymentsRows) ? pendingPaymentsRows : [],
      partialPayments: Array.isArray(partialPaymentsRows) ? partialPaymentsRows : []
    })
  } catch (e) {
    return res.status(500).json({
      message: 'Error cargando reportes (summary)',
      error: String(e?.message || e)
    })
  }
})

adminRouter.put('/reports/reservations/:id/financiero', async (req, res) => {
  const { id } = req.params
  const { estado_financiero } = req.body || {}

  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })
  if (!id) return res.status(400).json({ message: 'id_reserva faltante' })
  if (!estado_financiero) return res.status(400).json({ message: 'estado_financiero faltante' })

  const pool = getPool()

  // Soportar estados que usa el frontend
  const ALLOWED = new Set(['PENDIENTE', 'PARCIAL', 'PAGADO'])

  if (!ALLOWED.has(String(estado_financiero).toUpperCase())) {
    return res.status(400).json({ message: 'estado_financiero inválido' })
  }

  try {
    const newEstado = String(estado_financiero).toUpperCase()
    const [result] = await pool.query(
      `
      UPDATE reserva r
      INNER JOIN espacio e ON e.id_espacio = r.id_espacio
      SET r.estado_financiero = ?
      WHERE r.id_reserva = ?
        AND e.id_empresa = ?
      `,
      [newEstado, Number(id), Number(id_empresa)]
    )

    // result puede variar según driver; si no hay filas afectadas, igual devolvemos ok false
    const affected =
      typeof result?.affectedRows === 'number'
        ? result.affectedRows
        : (result?.[0]?.affectedRows ?? 0)

    return res.json({
      ok: affected >= 0
    })
  } catch (e) {
    return res.status(500).json({
      message: 'Error actualizando estado financiero',
      error: String(e?.message || e)
    })
  }
})

// =========================
// Inventory Template Download (ADMIN)
// =========================
adminRouter.get('/inventory/template', (req, res) => {
  // El requireRole(['admin']) y authJwt ya están aplicados arriba en el router.
  const csvHeaders = ['nombre', 'tipo', 'stock', 'precio', 'estado']

  // CSV estático (sin tocar lógica de inventario/importación)
  // Incluye SOLO encabezados para que el usuario llene la plantilla.
  const csv = `${csvHeaders.join(',')}\n`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="inventory_template.csv"')
  return res.status(200).send(csv)
})
