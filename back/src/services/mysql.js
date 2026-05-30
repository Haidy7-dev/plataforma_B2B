import mysql from 'mysql2/promise'

let pool

function getRequiredEnv(name) {
  const v = process.env[name]
  if (v === undefined || v === '') return null
  return v
}

function assertMysqlEnv() {
  const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
  const missing = required.filter((k) => process.env[k] === undefined || process.env[k] === '')

  if (missing.length) {
    const printable = Object.fromEntries(
      missing.map((k) => [k, process.env[k]])
    )

    const err = new Error(
      `MYSQL_CONFIG_ERROR: faltan variables de entorno: ${missing.join(', ')}`
    )
    err.code = 'MYSQL_CONFIG_ERROR'
    err.details = { missing, printable }
    throw err
  }
}

export function getPool() {
  if (pool) return pool

  assertMysqlEnv()

  pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,

    // Evita problemas de codificación (ej: "Port�til") forzando UTF-8 real (utf8mb4)
    charset: 'utf8mb4',
    // Algunas collations/servidores requieren NAMES explícito; mysql2 lo respeta con charset,
    // pero si tu servidor está mal configurado, esto reduce el riesgo.
    // (Si necesitas aún más control, se puede agregar SET NAMES por conexión.)
    // supportBigNumbers: true,

    // Falla más rápido si el host no responde (evita ETIMEDOUT poco claro)
    connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT_MS || 5000),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  })

  return pool
}



