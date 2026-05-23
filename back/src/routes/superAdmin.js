import express from 'express'
import { requireRole } from '../middleware/requireRole.js'
import { authJwt } from '../middleware/authJwt.js'
import { dataStore } from '../services/dataStore.js'
import { superAdminCompaniesRouter } from './superAdminCompanies.js'

export const superAdminRouter = express.Router()

superAdminRouter.use(authJwt)
superAdminRouter.use(requireRole(['super-admin']))

// Rutas CRUD para empresas y admins por empresa
superAdminRouter.use(superAdminCompaniesRouter)

superAdminRouter.get('/reports/errors', async (req, res) => {


  // TODO: ajustar filtros (por rango fechas) cuando exista UI completa
  const pool = req.pool || null

  try {
    // preferir BD real si existe conexión
    if (pool) {
      const [rows] = await pool.query(
        'SELECT id_incidente, descripcion, modulo, severidad, fecha, id_usuario FROM incidente ORDER BY fecha DESC LIMIT 200'
      )
      return res.json({ incidents: rows })
    }

    // fallback a mock si aún no se inyecta pool
    return res.json({ incidents: dataStore.incidents })
  } catch (e) {
    console.error('superAdminRouter/errors', e)
    return res.status(500).json({ message: 'Error obteniendo incidentes', error: String(e?.message || e) })
  }
})


