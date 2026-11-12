import { createApp } from './app.js'
import { loadConfig, validateProductionConfig } from './config.js'
import { createPool, runMigrations } from './db.js'
import { createMediaTools } from './media.js'
import { createPgRepository } from './repository.js'
import { createStorage } from './storage.js'
import { createIngestionWorker } from './worker.js'

const config = loadConfig()
validateProductionConfig(config)
const pool = createPool(config.databaseUrl)

const repo = createPgRepository(pool)

if (config.autoMigrate) {
  await runMigrations(pool)
  const backfilled = await repo.backfillMissingSongMetadata()
  if (backfilled > 0) {
    console.log(`Enriched metadata for ${backfilled} existing Soultrack song(s).`)
  }
}

const storage = createStorage(config)
const media = createMediaTools(config)
const worker = createIngestionWorker({ repo, storage, media })
const app = createApp({ repo, storage, worker, media, config })

const server = app.listen(config.port, () => {
  console.log(`Soultrack server listening on port ${config.port} (storage=${storage.mode})`)
})

function shutdown() {
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
