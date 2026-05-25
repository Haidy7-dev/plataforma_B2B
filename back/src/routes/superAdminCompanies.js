import express from 'express'
import bcrypt from 'bcrypt'
import { getPool } from '../services/mysql.js'

function normalizeNit(value) {
  const nit = String(value || '').trim()
  return nit || null
}

function normalizePhone(value) {
  return String(value || '').trim()
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function isValidPhone(value) {
  const phone = normalizePhone(value)
  return /^\d{7,}$/.test(phone)
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

superAdminCompaniesRouter.get('/users/check-email', async (req, res) => {
  const pool = getPool()
  const correo = String(req.query?.correo || '').trim()
  const excludeUserId = req.query?.excludeUserId ? Number(req.query.excludeUserId) : null

  if (!correo) return res.status(400).json({ message: 'correo es requerido' })
  if (!isValidEmail(correo)) return res.status(400).json({ message: 'Email inválido' })

  try {
    let query = 'SELECT id_usuario FROM usuario WHERE correo = ? LIMIT 1'
    const params = [correo]

    if (excludeUserId) {
      query = 'SELECT id_usuario FROM usuario WHERE correo = ? AND id_usuario <> ? LIMIT 1'
      params.push(excludeUserId)
    }

    const [rows] = await pool.query(query, params)
    return res.json({ exists: Boolean(rows?.length), message: rows?.length ? 'correo ya existente' : 'ok' })
  } catch (e) {
    console.error('superAdminCompaniesRouter/checkEmail', e)
    return res.status(500).json({ message: 'Error validando correo', error: String(e?.message || e) })
  }
})

superAdminCompaniesRouter.post('/companies/:companyId/users', async (req, res) => {
  const pool = getPool()
  const payload = req.body || {}
  const { companyId } = req.params
  const { nombre, correo, telefono, password, estado } = payload

  if (!companyId) return res.status(400).json({ message: 'companyId es requerido' })
  if (!nombre || !correo || !password) return res.status(400).json({ message: 'nombre, correo y password son requeridos' })
  if (!isValidEmail(correo)) return res.status(400).json({ message: 'Email inválido' })
  if (!isValidPhone(telefono)) return res.status(400).json({ message: 'Teléfono inválido: solo números y mínimo 7 dígitos' })

  try {
    const [existingEmail] = await pool.query('SELECT id_usuario FROM usuario WHERE correo = ? LIMIT 1', [correo])
    if (existingEmail?.length) return res.status(409).json({ message: 'correo ya existente' })

    const hashed = await bcrypt.hash(String(password), 10)

    const [result] = await pool.query(
      'INSERT INTO usuario (nombre, correo, password, rol, estado, id_empresa) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, correo, hashed, 'ADMIN', estado ?? 1, Number(companyId)]
    )

    const [rows] = await pool.query(
      'SELECT id_usuario AS id, nombre, correo, rol, estado, id_empresa FROM usuario WHERE id_usuario = ? LIMIT 1',
      [result.insertId]
    )

    return res.status(201).json({ message: 'creado', user: rows?.[0] })
  } catch (e) {
    console.error('superAdminCompaniesRouter/companyUsers[POST]', e)
    if (isDuplicateEntryError(e)) return res.status(409).json({ message: 'correo ya existente' })
    return res.status(500).json({ message: 'Error creando usuario admin', error: String(e?.message || e) })
  }
})

superAdminCompaniesRouter.put('/companies/:companyId/users/:userId', async (req, res) => {
  const pool = getPool()
  const { companyId, userId } = req.params
  const payload = req.body || {}
  const { nombre, correo, estado } = payload

  if (!companyId || !userId) return res.status(400).json({ message: 'companyId y userId son requeridos' })
  if (!nombre || !correo) return res.status(400).json({ message: 'nombre y correo son requeridos' })
  if (!isValidEmail(correo)) return res.status(400).json({ message: 'Email inválido' })

  try {
    const [existingUser] = await pool.query(
      'SELECT id_usuario FROM usuario WHERE id_usuario = ? AND id_empresa = ? AND rol = ? LIMIT 1',
      [Number(userId), Number(companyId), 'ADMIN']
    )
    if (!existingUser?.length) return res.status(404).json({ message: 'Administrador no encontrado' })

    const [existingEmail] = await pool.query(
      'SELECT id_usuario FROM usuario WHERE correo = ? AND id_usuario <> ? LIMIT 1',
      [correo, Number(userId)]
    )
    if (existingEmail?.length) return res.status(409).json({ message: 'correo ya existente' })

    await pool.query(
      'UPDATE usuario SET nombre = ?, correo = ?, estado = ? WHERE id_usuario = ? AND id_empresa = ? AND rol = ?',
      [nombre, correo, estado ?? 1, Number(userId), Number(companyId), 'ADMIN']
    )

    const [rows] = await pool.query(
      'SELECT id_usuario AS id, nombre, correo, rol, estado, id_empresa FROM usuario WHERE id_usuario = ? LIMIT 1',
      [Number(userId)]
    )

    return res.json({ message: 'actualizado', user: rows?.[0] })
  } catch (e) {
    console.error('superAdminCompaniesRouter/companyUsers[PUT]', e)
    if (isDuplicateEntryError(e)) return res.status(409).json({ message: 'correo ya existente' })
    return res.status(500).json({ message: 'Error actualizando admin', error: String(e?.message || e) })
  }
})

superAdminCompaniesRouter.patch('/companies/:companyId/users/:userId/status', async (req, res) => {
  const pool = getPool()
  const { companyId, userId } = req.params
  const { estado } = req.body || {}

  if (!companyId || !userId) return res.status(400).json({ message: 'companyId y userId son requeridos' })

  try {
    const [existingUser] = await pool.query(
      'SELECT id_usuario FROM usuario WHERE id_usuario = ? AND id_empresa = ? AND rol = ? LIMIT 1',
      [Number(userId), Number(companyId), 'ADMIN']
    )
    if (!existingUser?.length) return res.status(404).json({ message: 'Administrador no encontrado' })

    await pool.query(
      'UPDATE usuario SET estado = ? WHERE id_usuario = ? AND id_empresa = ? AND rol = ?',
      [Number(estado) === 1 ? 1 : 0, Number(userId), Number(companyId), 'ADMIN']
    )

    return res.json({ message: 'actualizado' })
  } catch (e) {
    console.error('superAdminCompaniesRouter/companyUsers[PATCH status]', e)
    return res.status(500).json({ message: 'Error actualizando estado', error: String(e?.message || e) })
  }
})

superAdminCompaniesRouter.delete('/companies/:companyId/users/:userId', async (req, res) => {
  const pool = getPool()
  const { companyId, userId } = req.params

  if (!companyId || !userId) return res.status(400).json({ message: 'companyId y userId son requeridos' })

  try {
    const [existingUser] = await pool.query(
      'SELECT id_usuario FROM usuario WHERE id_usuario = ? AND id_empresa = ? AND rol = ? LIMIT 1',
      [Number(userId), Number(companyId), 'ADMIN']
    )
    if (!existingUser?.length) return res.status(404).json({ message: 'Administrador no encontrado' })

    await pool.query(
      'DELETE FROM usuario WHERE id_usuario = ? AND id_empresa = ? AND rol = ?',
      [Number(userId), Number(companyId), 'ADMIN']
    )

    return res.json({ message: 'eliminado' })
  } catch (e) {
    console.error('superAdminCompaniesRouter/companyUsers[DELETE]', e)
    return res.status(500).json({ message: 'Error eliminando admin', error: String(e?.message || e) })
  }
})

