import jwt from 'jsonwebtoken'

export function authJwt(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return res.status(401).json({ message: 'Falta token JWT' })

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
    sub: user.id,
    email: user.email,
    role: user.role,
    id_empresa: user.id_empresa || null
  }

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' })
}


