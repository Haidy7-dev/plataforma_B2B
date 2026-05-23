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

    // Falla más rápido si el host no responde (evita ETIMEDOUT poco claro)
    connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT_MS || 5000),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  })

  return pool
}



