import jwt from 'jsonwebtoken'

export function authJwt(req, res, next) {
  const header = String(req.headers.authorization || '').trim()
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null

  if (!token) return res.status(401).json({ message: 'Falta token JWT (Authorization Bearer)' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload
    next()
  } catch (e) {
    return res.status(401).json({ message: 'Token JWT inválido' })
  }
}

export function signJwt(user) {
  const payload = {
    id_usuario: Number(user.id_usuario),
    id_empresa: user.id_empresa != null ? Number(user.id_empresa) : null,
    rol: user.rol,
    nombre: user.nombre
  }

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' })
}


