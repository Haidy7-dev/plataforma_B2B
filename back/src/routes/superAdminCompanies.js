import express from 'express'
import bcrypt from 'bcrypt'
import { getPool } from '../services/mysql.js'

function normalizeNit(value) {
  const nit = String(value || '').trim()
  return nit || null
}

function isDuplicateEntryError(err) {
  return err?.code === 'ER_DUP_ENTRY'
}

export const superAdminCompaniesRouter = express.Router()

// Listado de empresas
superAdminCompaniesRouter.get('/companies', async (req, res) => {
  const pool = getPool()
  try {
    const [rows] = await pool.query(
      'SELECT id_empresa, nombre, nit, correo, telefono, estado FROM empresa ORDER BY id_empresa DESC'
    )
    return res.json({ companies: rows || [] })
  } catch (e) {
    console.error('superAdminCompaniesRouter/companies[GET]', e)
    return res.status(500).json({ message: 'Error obteniendo empresas', error: String(e?.message || e) })
  }
})

// Usuarios por empresa
superAdminCompaniesRouter.get('/companies/:companyId/users', async (req, res) => {
  const pool = getPool()
  const { companyId } = req.params

  if (!companyId) return res.status(400).json({ message: 'companyId es requerido' })

  try {
    const [rows] = await pool.query(
      'SELECT id_usuario AS id, nombre, correo, rol, estado, id_empresa FROM usuario WHERE id_empresa = ? AND rol = ? ORDER BY id_usuario DESC',
      [Number(companyId), 'ADMIN']
    )

    return res.json({ users: rows || [] })
  } catch (e) {
    console.error('superAdminCompaniesRouter/companyUsers[GET]', e)
    return res.status(500).json({ message: 'Error obteniendo usuarios de la empresa', error: String(e?.message || e) })
  }
})

superAdminCompaniesRouter.post('/companies', async (req, res) => {
  const pool = getPool()
  const payload = req.body || {}

  const { nombre, nit, correo, telefono, estado } = payload
  const normalizedNit = normalizeNit(nit)

  if (!nombre) return res.status(400).json({ message: 'nombre es requerido' })

  try {
    if (normalizedNit) {
      const [existingByNit] = await pool.query(
        'SELECT id_empresa FROM empresa WHERE nit = ? LIMIT 1',
        [normalizedNit]
      )
      if (existingByNit?.length) {
        return res.status(409).json({ message: 'Ya existe una empresa con este NIT.' })
      }
    }

    const [result] = await pool.query(
      'INSERT INTO empresa (nombre, nit, correo, telefono, estado) VALUES (?, ?, ?, ?, ?)',
      [nombre, normalizedNit, correo || null, telefono || null, estado ?? 1]
    )

    const [rows] = await pool.query('SELECT id_empresa, nombre, nit, correo, telefono, estado FROM empresa WHERE id_empresa = ? LIMIT 1', [result.insertId])
    return res.status(201).json({ message: 'Empresa creada correctamente.', company: rows?.[0] })
  } catch (e) {
    console.error('superAdminCompaniesRouter/companies', e)
    if (isDuplicateEntryError(e)) {
      return res.status(409).json({ message: 'Ya existe una empresa con este NIT.' })
    }
    return res.status(500).json({ message: 'Error creando empresa', error: String(e?.message || e) })
  }
})

superAdminCompaniesRouter.put('/companies/:companyId', async (req, res) => {
  const pool = getPool()
  const { companyId } = req.params
  const payload = req.body || {}

  const { nombre, nit, correo, telefono, estado } = payload
  const normalizedNit = normalizeNit(nit)

  if (!companyId) return res.status(400).json({ message: 'companyId es requerido' })
  if (!nombre) return res.status(400).json({ message: 'nombre es requerido' })

  try {
    const [existingCompany] = await pool.query(
      'SELECT id_empresa FROM empresa WHERE id_empresa = ? LIMIT 1',
      [Number(companyId)]
    )
    if (!existingCompany?.length) {
      return res.status(404).json({ message: 'Empresa no encontrada' })
    }

    if (normalizedNit) {
      const [existingByNit] = await pool.query(
        'SELECT id_empresa FROM empresa WHERE nit = ? AND id_empresa <> ? LIMIT 1',
        [normalizedNit, Number(companyId)]
      )
      if (existingByNit?.length) {
        return res.status(409).json({ message: 'Ya existe una empresa con este NIT.' })
      }
    }

    await pool.query(
      'UPDATE empresa SET nombre = ?, nit = ?, correo = ?, telefono = ?, estado = ? WHERE id_empresa = ?',
      [nombre, normalizedNit, correo || null, telefono || null, estado ?? 1, Number(companyId)]
    )

    const [rows] = await pool.query(
      'SELECT id_empresa, nombre, nit, correo, telefono, estado FROM empresa WHERE id_empresa = ? LIMIT 1',
      [Number(companyId)]
    )

    return res.json({ message: 'Empresa actualizada correctamente.', company: rows?.[0] })
  } catch (e) {
    console.error('superAdminCompaniesRouter/companies[PUT]', e)
    if (isDuplicateEntryError(e)) {
      return res.status(409).json({ message: 'Ya existe una empresa con este NIT.' })
    }
    return res.status(500).json({ message: 'Error actualizando empresa', error: String(e?.message || e) })
  }
})

superAdminCompaniesRouter.delete('/companies/:companyId', async (req, res) => {
  const pool = getPool()
  const { companyId } = req.params

  if (!companyId) return res.status(400).json({ message: 'companyId es requerido' })

  try {
    const [existingCompany] = await pool.query(
      'SELECT id_empresa FROM empresa WHERE id_empresa = ? LIMIT 1',
      [Number(companyId)]
    )
    if (!existingCompany?.length) {
      return res.status(404).json({ message: 'Empresa no encontrada' })
    }

    await pool.query('DELETE FROM empresa WHERE id_empresa = ?', [Number(companyId)])
    return res.json({ message: 'Empresa eliminada correctamente.' })
  } catch (e) {
    console.error('superAdminCompaniesRouter/companies[DELETE]', e)
    return res.status(500).json({ message: 'Error eliminando empresa', error: String(e?.message || e) })
  }
})

superAdminCompaniesRouter.post('/companies/:companyId/users', async (req, res) => {
  const pool = getPool()
  const payload = req.body || {}
  const { companyId } = req.params

  const { nombre, correo, telefono, password, estado } = payload

  if (!companyId) return res.status(400).json({ message: 'companyId es requerido' })
  if (!correo || !password) return res.status(400).json({ message: 'correo y password son requeridos' })

  try {
    // Nota: tu esquema de usuario no incluye telefono; se ignora si viene.
    const userNombre = nombre || 'Admin de empresa'

    const hashed = await bcrypt.hash(String(password), 10)

    const [result] = await pool.query(
      'INSERT INTO usuario (nombre, correo, password, rol, estado, id_empresa) VALUES (?, ?, ?, ?, ?, ?)',
      [userNombre, correo, hashed, 'ADMIN', estado ?? 1, Number(companyId)]
    )

    const [rows] = await pool.query('SELECT id_usuario AS id, nombre, correo, rol, estado, id_empresa FROM usuario WHERE id_usuario = ? LIMIT 1', [result.insertId])

    return res.status(201).json({ user: rows?.[0] })
  } catch (e) {
    console.error('superAdminCompaniesRouter/companyUsers', e)
    // Podría fallar por unique correo
    return res.status(500).json({ message: 'Error creando usuario admin', error: String(e?.message || e) })
  }
})

