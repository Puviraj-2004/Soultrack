import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from './config.js'
import { createPool } from './db.js'
import { createMediaTools } from './media.js'
import { createPgRepository } from './repository.js'
import { createStorage } from './storage.js'
import { canonicalYoutubeUrl } from './youtube.js'

const confirm = process.argv.includes('--confirm')
const config = loadConfig()
if (!config.databaseUrl) {
  console.error('DATABASE_URL is not configured in .env.')
  process.exit(1)
}

const pool = createPool(config.databaseUrl)
const repo = createPgRepository(pool)
const storage = createStorage(config)
const media = createMediaTools(config)

try {
  const allSongs = await repo.listAllSongs()
  const targets = allSongs.filter(s => s.status === 'READY' && s.source_type === 'youtube' && s.youtube_id)

  console.log(`Checking posters for ${targets.length} READY YouTube song(s)...\n`)

  let itunesFixed = 0
  let youtubeFallback = 0
  let skipped = 0

  for (const song of targets) {
    const query = [song.title, song.album || song.artist].filter(Boolean).join(' ')
    let itunes = await media.lookupItunesMetadata(query)
    if (!itunes && song.title) {
      itunes = await media.lookupItunesMetadata(song.title)
    }

    let chosenUrl = itunes?.artworkUrl || null
    let sourceLabel = itunes?.artworkUrl ? `iTunes (${itunes.title})` : null

    if (!chosenUrl) {
      try {
        const info = await media.fetchYoutubeInfo(canonicalYoutubeUrl(song.youtube_id))
        if (info?.thumbnailUrl) {
          chosenUrl = info.thumbnailUrl
          sourceLabel = 'YouTube Official Thumbnail'
        }
      } catch {
        // Ignore yt-dlp lookup failure for single track
      }
    }

    if (!chosenUrl) {
      skipped += 1
      console.log(`SKIP:    "${song.title}" — no verified artwork found`)
      continue
    }

    if (itunes?.artworkUrl) itunesFixed += 1
    else youtubeFallback += 1

    if (!confirm) {
      console.log(`PREVIEW: "${song.title}" -> ${sourceLabel}`)
      continue
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'soultrack-poster-'))
    try {
      const cover = await media.downloadImageFile(chosenUrl, tmpDir)
      if (!cover) {
        skipped += 1
        console.log(`SKIP:    "${song.title}" — image download failed`)
        continue
      }
      const key = `covers/${song.id}.${cover.ext}`
      const uploadedUrl = await storage.putFile({
        key,
        filePath: cover.filePath,
        contentType: cover.contentType,
      })
      await repo.updateSong(song.id, {
        thumbnail_url: uploadedUrl,
        thumbnail_key: key,
      })
      console.log(`UPDATED: "${song.title}" -> ${sourceLabel}`)
    } catch (err) {
      skipped += 1
      console.log(`SKIP:    "${song.title}" — ${err?.message || 'network error'}`)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  console.log('')
  if (confirm) {
    console.log(`Done! Updated ${itunesFixed + youtubeFallback} poster(s) (${itunesFixed} iTunes verified, ${youtubeFallback} YouTube fallback, ${skipped} skipped).`)
  } else {
    console.log(`Dry run complete: ${itunesFixed} iTunes verified, ${youtubeFallback} YouTube fallback, ${skipped} skipped.`)
    console.log('To apply these poster updates, run: npm run fix-posters -- --confirm')
  }
} finally {
  await pool.end()
}
