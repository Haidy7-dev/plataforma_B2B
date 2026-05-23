export function requireRole(allowedRoles) {
  const normalizeRole = (r) => {
    if (r == null) return r
    return String(r)
      .trim()
      .toLowerCase()
      .replace(/_/g, '-')
  }

  const normalizedAllowed = allowedRoles.map(normalizeRole)

  return (req, res, next) => {
    const role = normalizeRole(req.user?.role)
    if (!role) return res.status(401).json({ message: 'Rol no disponible' })
    if (!normalizedAllowed.includes(role)) return res.status(403).json({ message: 'Rol no autorizado' })
    next()
  }
}


