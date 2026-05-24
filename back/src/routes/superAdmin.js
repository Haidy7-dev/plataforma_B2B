import express from 'express'
import { requireRole } from '../middleware/requireRole.js'
import { authJwt } from '../middleware/authJwt.js'
import { getPool } from '../services/mysql.js'
import { superAdminCompaniesRouter } from './superAdminCompanies.js'

export const superAdminRouter = express.Router()

superAdminRouter.use(authJwt)
superAdminRouter.use(requireRole(['super-admin']))

// Rutas CRUD para empresas y admins por empresa
superAdminRouter.use(superAdminCompaniesRouter)

superAdminRouter.get('/dashboard/stats', async (req, res) => {
  const pool = getPool()

  try {
    const [[usersActive]] = await pool.query(
      "SELECT COUNT(*) AS total FROM usuario WHERE estado = 1 AND rol = 'ADMIN'"
    )
    const [[companiesRegistered]] = await pool.query(
      'SELECT COUNT(*) AS total FROM empresa'
    )
    const [[alertsCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM incidente WHERE LOWER(COALESCE(severidad,'')) IN ('critico','crítico','alta','high')"
    )

    return res.json({
      usuariosActivos: Number(usersActive?.total || 0),
      empresasRegistradas: Number(companiesRegistered?.total || 0),
      alertasSistema: Number(alertsCount?.total || 0)
    })
  } catch (e) {
    console.error('superAdminRouter/dashboard/stats', e)
    return res.status(500).json({ message: 'Error obteniendo métricas del dashboard', error: String(e?.message || e) })
  }
})

superAdminRouter.get('/activity/recent', async (req, res) => {
  const pool = getPool()
  const q = String(req.query?.q || '').trim().toLowerCase()

  try {
    const [rows] = await pool.query(
      `SELECT
        i.id_incidente AS id,
        COALESCE(u.nombre, 'Sistema') AS actor,
        COALESCE(i.descripcion, 'Evento del sistema') AS action,
        COALESCE(e.nombre, 'Sin empresa') AS company,
        COALESCE(u.rol, 'SuperAdmin') AS role,
        COALESCE(i.severidad, 'OK') AS status,
        i.fecha AS time
      FROM incidente i
      LEFT JOIN usuario u ON u.id_usuario = i.id_usuario
      LEFT JOIN empresa e ON e.id_empresa = u.id_empresa
      ORDER BY i.fecha DESC
      LIMIT 250`
    )

    const filtered = (rows || []).filter((r) => {
      if (!q) return true
      const haystack = `${r.actor} ${r.action} ${r.company} ${r.role} ${r.status}`.toLowerCase()
      return haystack.includes(q)
    })

    return res.json({ rows: filtered })
  } catch (e) {
    console.error('superAdminRouter/activity/recent', e)
    return res.status(500).json({ message: 'Error obteniendo actividad reciente', error: String(e?.message || e) })
  }
})

superAdminRouter.get('/reports/errors', async (req, res) => {
  const pool = getPool()

  try {
    const [rows] = await pool.query(
      'SELECT id_incidente, descripcion, modulo, severidad, fecha, id_usuario FROM incidente ORDER BY fecha DESC LIMIT 200'
    )
    return res.json({ incidents: rows || [] })
  } catch (e) {
    console.error('superAdminRouter/reports/errors', e)
    return res.status(500).json({ message: 'Error obteniendo incidentes', error: String(e?.message || e) })
  }
})

superAdminRouter.get('/reports/incidents', async (req, res) => {
  const pool = getPool()

  try {
    const [rows] = await pool.query(
      'SELECT id_incidente, descripcion, modulo, severidad, fecha, id_usuario FROM incidente ORDER BY fecha DESC LIMIT 500'
    )
    return res.json({ incidents: rows || [] })
  } catch (e) {
    console.error('superAdminRouter/reports/incidents', e)
    return res.status(500).json({ message: 'Error obteniendo reporte de incidentes', error: String(e?.message || e) })
  }
})

superAdminRouter.get('/reports/logs', async (req, res) => {
  const pool = getPool()

  try {
    const [rows] = await pool.query(
      `SELECT
        i.id_incidente AS id,
        COALESCE(i.modulo, 'sistema') AS modulo,
        COALESCE(i.descripcion, 'evento') AS descripcion,
        COALESCE(i.severidad, 'info') AS severidad,
        i.fecha
      FROM incidente i
      ORDER BY i.fecha DESC
      LIMIT 500`
    )
    return res.json({ logs: rows || [] })
  } catch (e) {
    console.error('superAdminRouter/reports/logs', e)
    return res.status(500).json({ message: 'Error obteniendo logs', error: String(e?.message || e) })
  }
})


