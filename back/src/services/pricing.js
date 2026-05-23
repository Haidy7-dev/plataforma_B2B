export function computeTotals(lines) {
  const normalized = (lines || []).map((l) => ({
    tipo: l.tipo || 'servicio',
    nombre: l.nombre || '',
    cantidad: Number(l.cantidad || 0),
    precio: Number(l.precio || 0)
  }))

  const total = normalized.reduce((acc, l) => acc + l.cantidad * l.precio, 0)

  return {
    total: total.toFixed(2),
    lines: normalized
  }
}

