import { loadConfig } from './config.js'
import { createPool, runMigrations } from './db.js'

const config = loadConfig()
const pool = createPool(config.databaseUrl)

try {
  await runMigrations(pool)
  console.log('Soultrack database schema migrated successfully.')
} finally {
  await pool.end()
}
