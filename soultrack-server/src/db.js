import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { SERVER_ROOT } from './config.js'

const { Pool } = pg

function shouldUseSsl(databaseUrl) {
  if (process.env.PGSSL === 'false') return false
  if (process.env.PGSSL === 'true') return true
  return /neon\.tech|supabase\.co|sslmode=require/i.test(databaseUrl)
}

export function createPool(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required (Neon DB connection string).')
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl)
      ? { rejectUnauthorized: process.env.PGSSL_NO_VERIFY !== 'true' }
      : false,
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 20_000,
  })

  // Neon scales idle compute to zero and drops idle sockets; log rather than crashing the process.
  pool.on('error', err => {
    console.error('Postgres pool idle client error:', err.message)
  })

  return pool
}

export async function runMigrations(pool) {
  const sqlPath = path.join(SERVER_ROOT, 'sql', '001_init.sql')
  const sql = await fs.readFile(sqlPath, 'utf8')
  await pool.query(sql)
}
