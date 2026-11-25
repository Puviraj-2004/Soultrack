import { loadConfig } from './config.js'
import { createPool } from './db.js'
import { cleanYoutubeDisplayTitle } from './metadata.js'
import { createPgRepository } from './repository.js'
import { createStorage } from './storage.js'

const confirm = process.argv.includes('--confirm')
const config = loadConfig()
if (!config.databaseUrl) {
  console.error('DATABASE_URL is not configured in .env.')
  process.exit(1)
}

const pool = createPool(config.databaseUrl)
const repo = createPgRepository(pool)
const storage = createStorage(config)

function normalizeKey(title) {
  return cleanYoutubeDisplayTitle(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0B80-\u0BFF]+/g, '')
}

try {
  const songs = await repo.listAllSongs()
  const groups = new Map()

  for (const song of songs) {
    const key = normalizeKey(song.title)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(song)
  }

  const duplicateGroups = [...groups.values()].filter(list => list.length > 1)
  if (!duplicateGroups.length) {
    console.log('No duplicate songs found in the catalog.')
    process.exit(0)
  }

  let totalToDelete = 0
  console.log(`Found ${duplicateGroups.length} duplicate song group(s):\n`)

  for (const group of duplicateGroups) {
    // Keep READY first, then highest play_count, then oldest created_at
    group.sort((a, b) => {
      if ((a.status === 'READY') !== (b.status === 'READY')) {
        return a.status === 'READY' ? -1 : 1
      }
      const playDiff = (b.play_count || 0) - (a.play_count || 0)
      if (playDiff !== 0) return playDiff
      return new Date(a.created_at) - new Date(b.created_at)
    })

    const [keep, ...removeList] = group
    console.log(`KEEP:   [${keep.status}] "${keep.title}" (${keep.artist}) — plays=${keep.play_count || 0}, id=${keep.id}`)
    for (const dup of removeList) {
      totalToDelete += 1
      console.log(`DELETE: [${dup.status}] "${dup.title}" (${dup.artist}) — plays=${dup.play_count || 0}, id=${dup.id}`)
      if (confirm) {
        const deleted = await repo.deleteSong(dup.id)
        if (deleted) {
          const keys = [deleted.audio_key, deleted.thumbnail_key].filter(Boolean)
          if (keys.length) {
            await storage.deleteKeys(keys).catch(err => console.warn(`Storage cleanup warning:`, err.message))
          }
        }
      }
    }
    console.log('')
  }

  if (confirm) {
    console.log(`Deleted ${totalToDelete} duplicate song(s) from database and storage.`)
  } else {
    console.log(`Dry run complete: ${totalToDelete} duplicate song(s) would be deleted.`)
    console.log('To actually delete them, run: npm run dedupe -- --confirm')
  }
} finally {
  await pool.end()
}
