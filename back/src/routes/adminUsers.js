import express from 'express'
import bcrypt from 'bcrypt'
import { getPool } from '../services/mysql.js'

export const adminUsersRouter = express.Router()

// GET /admin/users?role=&search=
adminUsersRouter.get('/users', async (req, res) => {
  const pool = getPool()
  const { role, search } = req.query || {}

  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const roleNormalized = role ? String(role).toUpperCase() : null
  const allowed = ['LOGISTICA', 'GESTOR']
  const effectiveRole = roleNormalized && allowed.includes(roleNormalized) ? roleNormalized : null

  try {
    const terms = []
    let where = 'WHERE id_empresa = ? AND rol IN (\'LOGISTICA\', \'GESTOR\')'
    terms.push(Number(id_empresa))

    if (effectiveRole) {
      where += ' AND rol = ?'
      terms.push(effectiveRole)
    }

    if (search) {
      where += ' AND (nombre LIKE ? OR correo LIKE ?)'
      const like = `%${String(search)}%`
      terms.push(like, like)
    }

    const sql = `SELECT id_usuario AS id,
                        nombre,
                        correo,
                        rol,
                        estado,
                        id_empresa,
                        createdAt AS createdAt
                 FROM usuario
                 ${where}
                 ORDER BY id_usuario DESC`

    // Si no existe createdAt real en BD, caemos a id ordenado.
    // mysql2 no fallará si createdAt no existe? sí fallará: por eso intentamos fallback.
    try {
      const [rows] = await pool.query(sql, terms)
      return res.json({ users: rows || [] })
    } catch (e) {
      const sql2 = `SELECT id_usuario AS id,
                           nombre,
                           correo,
                           rol,
                           estado,
                           id_empresa
                    FROM usuario
                    ${where}
                    ORDER BY id_usuario DESC`
      const [rows2] = await pool.query(sql2, terms)
      return res.json({ users: rows2 || [] })
    }
  } catch (e) {
    return res.status(500).json({ message: 'Error obteniendo usuarios', error: String(e?.message || e) })
  }
})

// POST /admin/users
adminUsersRouter.post('/users', async (req, res) => {
  const pool = getPool()
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const payload = req.body || {}
  const { nombre, correo, passwordTemporal, rol, estado } = payload

  if (!nombre) return res.status(400).json({ message: 'nombre es requerido' })
  if (!correo) return res.status(400).json({ message: 'correo es requerido' })
  if (!passwordTemporal) return res.status(400).json({ message: 'passwordTemporal es requerido' })

  const rolNormalized = String(rol || '').toUpperCase()
  const allowed = ['LOGISTICA', 'GESTOR']
  if (!allowed.includes(rolNormalized)) return res.status(400).json({ message: 'rol inválido. Solo LOGISTICA o GESTOR.' })

  const estadoBool = estado === undefined ? true : Boolean(estado)

  try {
    const hashed = await bcrypt.hash(String(passwordTemporal), 10)

    const [result] = await pool.query(
      'INSERT INTO usuario (nombre, correo, password, rol, estado, id_empresa) VALUES (?, ?, ?, ?, ?, ?)',
      [String(nombre), String(correo), hashed, rolNormalized, estadoBool ? 1 : 0, Number(id_empresa)]
    )

    const [rows] = await pool.query(
      'SELECT id_usuario AS id, nombre, correo, rol, estado, id_empresa FROM usuario WHERE id_usuario = ? LIMIT 1',
      [result.insertId]
    )

    return res.status(201).json({ user: rows?.[0] })
  } catch (e) {
    return res.status(500).json({ message: 'Error creando usuario', error: String(e?.message || e) })
  }
})

// PUT /admin/users/:id
adminUsersRouter.put('/users/:id', async (req, res) => {
  const pool = getPool()
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const payload = req.body || {}
  const { nombre, correo, rol, estado } = payload

  const userId = Number(req.params.id)
  if (!userId) return res.status(400).json({ message: 'id inválido' })

  const rolNormalized = rol ? String(rol).toUpperCase() : null
  const allowed = ['LOGISTICA', 'GESTOR']
  if (rolNormalized && !allowed.includes(rolNormalized)) return res.status(400).json({ message: 'rol inválido. Solo LOGISTICA o GESTOR.' })

  try {
    const [existing] = await pool.query(
      'SELECT id_usuario AS id FROM usuario WHERE id_usuario = ? AND id_empresa = ?',
      [userId, Number(id_empresa)]
    )
    if (!existing?.length) return res.status(404).json({ message: 'Usuario no encontrado en tu empresa' })

    const newNombre = nombre !== undefined ? String(nombre) : null
    const newCorreo = correo !== undefined ? String(correo) : null
    const newRol = rolNormalized !== null ? rolNormalized : null
    const newEstado = estado === undefined ? null : (estado ? 1 : 0)

    // Actualización flexible: usamos COALESCE
    const sql = `UPDATE usuario
                 SET nombre = COALESCE(?, nombre),
                     correo = COALESCE(?, correo),
                     rol = COALESCE(?, rol),
                     estado = COALESCE(?, estado)
                 WHERE id_usuario = ? AND id_empresa = ?`

    await pool.query(sql, [newNombre, newCorreo, newRol, newEstado, userId, Number(id_empresa)])

    const [rows] = await pool.query(
      'SELECT id_usuario AS id, nombre, correo, rol, estado, id_empresa FROM usuario WHERE id_usuario = ? AND id_empresa = ? LIMIT 1',
      [userId, Number(id_empresa)]
    )

    return res.json({ user: rows?.[0] })
  } catch (e) {
    return res.status(500).json({ message: 'Error editando usuario', error: String(e?.message || e) })
  }
})

// PATCH /admin/users/:id/status
adminUsersRouter.patch('/users/:id/status', async (req, res) => {
  const pool = getPool()
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const userId = Number(req.params.id)
  const payload = req.body || {}
  const { estado } = payload

  if (estado === undefined) return res.status(400).json({ message: 'estado es requerido' })

  try {
    const estadoBool = Boolean(estado)

    const [existing] = await pool.query(
      'SELECT id_usuario AS id FROM usuario WHERE id_usuario = ? AND id_empresa = ?',
      [userId, Number(id_empresa)]
    )
    if (!existing?.length) return res.status(404).json({ message: 'Usuario no encontrado en tu empresa' })

    await pool.query(
      'UPDATE usuario SET estado = ? WHERE id_usuario = ? AND id_empresa = ?',
      [estadoBool ? 1 : 0, userId, Number(id_empresa)]
    )

    const [rows] = await pool.query(
      'SELECT id_usuario AS id, nombre, correo, rol, estado, id_empresa FROM usuario WHERE id_usuario = ? AND id_empresa = ? LIMIT 1',
      [userId, Number(id_empresa)]
    )

    return res.json({ user: rows?.[0] })
  } catch (e) {
    return res.status(500).json({ message: 'Error cambiando estado', error: String(e?.message || e) })
  }
})

// POST /admin/users/:id/reset-password
adminUsersRouter.post('/users/:id/reset-password', async (req, res) => {
  const pool = getPool()
  const id_empresa = req.user?.id_empresa
  if (!id_empresa) return res.status(400).json({ message: 'id_empresa faltante en JWT' })

  const userId = Number(req.params.id)
  if (!userId) return res.status(400).json({ message: 'id inválido' })

  const temp = `Temp@${Math.floor(100000 + Math.random() * 900000)}`

  try {
    const [existing] = await pool.query(
      'SELECT id_usuario AS id FROM usuario WHERE id_usuario = ? AND id_empresa = ?',
      [userId, Number(id_empresa)]
    )
    if (!existing?.length) return res.status(404).json({ message: 'Usuario no encontrado en tu empresa' })

    const hashed = await bcrypt.hash(String(temp), 10)
    await pool.query(
      'UPDATE usuario SET password = ? WHERE id_usuario = ? AND id_empresa = ?',
      [hashed, userId, Number(id_empresa)]
    )

    return res.json({ passwordTemporal: temp })
  } catch (e) {
    return res.status(500).json({ message: 'Error reseteando contraseña', error: String(e?.message || e) })
  }
})

