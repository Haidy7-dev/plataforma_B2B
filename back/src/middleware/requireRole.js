function normalizeRoleValue(value) {
  if (value == null) return ''
  const base = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')

  const aliases = {
    administrador: 'admin',
    'super-admin': 'super-admin',
    superadmin: 'super-admin'
  }

  return aliases[base] || base
}

export function requireRole(allowedRoles) {
  const normalizedAllowed = (allowedRoles || []).map(normalizeRoleValue)

  return (req, res, next) => {
    const role = normalizeRoleValue(req.user?.rol || req.user?.role)

    if (!role) return res.status(401).json({ message: 'Rol no disponible' })
    if (!normalizedAllowed.includes(role)) {
      return res.status(403).json({ message: 'Rol no autorizado' })
    }

    req.user = {
      ...(req.user || {}),
      rol: role
    }

    next()
  }
}


