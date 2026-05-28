import { getPool } from './mysql.js'

let auditoriaSchemaReady = false
let auditoriaHasIdEmpresa = null

export async function ensureAuditoriaTable() {
  if (auditoriaSchemaReady) return
  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
      accion VARCHAR(120) NOT NULL,
      descripcion TEXT,
      tabla_afectada VARCHAR(120) NOT NULL,
      id_registro BIGINT NULL,
      fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      id_usuario INT NULL,
      id_empresa INT NULL,
      INDEX idx_auditoria_empresa_fecha (id_empresa, fecha),
      INDEX idx_auditoria_tabla_registro (tabla_afectada, id_registro)
    )
  `)
  auditoriaSchemaReady = true
}

async function checkAuditoriaHasIdEmpresa(executor) {
  if (auditoriaHasIdEmpresa !== null) return auditoriaHasIdEmpresa
  const [rows] = await executor.query(
    `
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'auditoria'
      AND COLUMN_NAME = 'id_empresa'
    `
  )
  auditoriaHasIdEmpresa = Number(rows?.[0]?.total || 0) > 0
  return auditoriaHasIdEmpresa
}

export async function registrarAuditoria(connOrPool, payload = {}) {
  const {
    accion,
    descripcion,
    tabla_afectada,
    id_registro = null,
    id_usuario = null,
    id_empresa = null
  } = payload

  if (!accion || !tabla_afectada) return

  await ensureAuditoriaTable()

  const executor = connOrPool && typeof connOrPool.query === 'function'
    ? connOrPool
    : getPool()

  const includeIdEmpresa = await checkAuditoriaHasIdEmpresa(executor)

  if (includeIdEmpresa) {
    await executor.query(
      `INSERT INTO auditoria
        (accion, descripcion, tabla_afectada, id_registro, id_usuario, id_empresa)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(accion),
        descripcion == null ? null : String(descripcion),
        String(tabla_afectada),
        id_registro == null ? null : Number(id_registro),
        id_usuario == null ? null : Number(id_usuario),
        id_empresa == null ? null : Number(id_empresa)
      ]
    )
    return
  }

  await executor.query(
    `INSERT INTO auditoria
      (accion, descripcion, tabla_afectada, id_registro, id_usuario)
     VALUES (?, ?, ?, ?, ?)`,
    [
      String(accion),
      descripcion == null ? null : String(descripcion),
      String(tabla_afectada),
      id_registro == null ? null : Number(id_registro),
      id_usuario == null ? null : Number(id_usuario)
    ]
  )
}
