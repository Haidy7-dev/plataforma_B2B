import express from 'express'
import bcrypt from 'bcrypt'
import { getPool } from '../services/mysql.js'
import { signJwt } from '../middleware/authJwt.js'

export const authRouter = express.Router()


authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ message: 'email y password son requeridos' })

  try {
    const pool = getPool()

    // sanity: si no hay conexión a MySQL, esto termina en ETIMEDOUT en catch
    if (!process.env.MYSQL_HOST) {
      console.error('LOGIN_CONFIG_ERROR', {
        MYSQL_HOST: process.env.MYSQL_HOST
      })
    }

    const t0 = Date.now()

    const [rows] = await pool.query(
      'SELECT id_usuario AS id, correo AS email, rol AS role, password, id_empresa FROM usuario WHERE correo = ? AND estado = 1 LIMIT 1',
      [email]
    )


    if (!rows || rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' })
    }

    const user = rows[0]

    // Logging temporal para depurar login (NO imprime la contraseña)
    console.log('LOGIN_LOOKUP', {
      email: String(email),
      found: !!user,
      userId: user?.id,
      dbRole: user?.role
    })

    const ok = await bcrypt.compare(password, user.password)
    console.log('LOGIN_PASSWORD_OK', { ok })

    if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' })

    // Normalizamos roles desde BD para evitar mismatch (ej: SUPER_ADMIN -> super-admin)
    const normalizeRole = (r) => {
      if (r == null) return r
      return String(r)
        .trim()
        .toLowerCase()
        .replace(/_/g, '-')
    }

    const normalizedRole = normalizeRole(user.role)
    console.log('LOGIN_NORMALIZED_ROLE', { normalizedRole })

    const token = signJwt({ id: user.id, email: user.email, role: normalizedRole, id_empresa: user.id_empresa })
    res.json({
      token,
      user: { id: user.id, email: user.email, role: normalizedRole, id_empresa: user.id_empresa },
      ms: Date.now() - t0
    })

  } catch (err) {
    console.error('LOGIN_ERROR', err)

    const code = err?.code
    if (code === 'MYSQL_CONFIG_ERROR') {
      return res.status(500).json({
        message: 'Error de configuración de base de datos (MySQL)',
        error: err?.message || String(err)
      })
    }

    // Evita exponer info sensible; muestra el mensaje raíz para depurar.
    return res.status(500).json({
      message: 'Error de login',
      error: String(err?.message || err)
    })
  }
})





