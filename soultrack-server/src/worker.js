import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { cleanYoutubeDisplayTitle, enrichSongWithMetadata } from './metadata.js'
import { canonicalYoutubeUrl } from './youtube.js'

export function createIngestionWorker({ repo, storage, media, concurrency = 2 }) {
  const queue = []
  let activeCount = 0

  async function processJob({ songId, youtubeId, playlistId, overrides = null }) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'soultrack-ingest-'))
    try {
      const url = canonicalYoutubeUrl(youtubeId)
      const info = await media.fetchYoutubeInfo(url)

      const overrideTitle = String(overrides?.title || '').trim().slice(0, 200)
      const overrideArtist = String(overrides?.artist || '').trim().slice(0, 200)
      const initialCleanTitle = overrideTitle || cleanYoutubeDisplayTitle(info.title) || info.title

      if (typeof repo.findSongByTitle === 'function') {
        const dup = await repo.findSongByTitle(initialCleanTitle, songId)
        if (dup) {
          throw new Error(`Song with title "${dup.title}" already exists in catalog.`)
        }
      }

      await repo.updateSong(songId, {
        title: initialCleanTitle,
        artist: overrideArtist || info.artist,
        duration_seconds: info.durationSeconds,
      })

      const rawAudioPath = await media.downloadYoutubeAudio(url, tmpDir)
      const faststartPath = path.join(tmpDir, `${songId}.m4a`)
      await media.transcodeFaststartM4a(rawAudioPath, faststartPath)

      const probedDuration = await media.probeDurationSeconds(faststartPath)
      const durationSeconds = probedDuration || info.durationSeconds

      const audioKey = `songs/${songId}.m4a`
      const audioUrl = await storage.putFile({
        key: audioKey,
        filePath: faststartPath,
        contentType: 'audio/mp4',
      })

      let thumbnailUrl = info.thumbnailUrl
      let thumbnailKey = null
      const cover = await media.downloadImageFile(info.thumbnailUrl, tmpDir)
      if (cover) {
        thumbnailKey = `covers/${songId}.${cover.ext}`
        thumbnailUrl = await storage.putFile({
          key: thumbnailKey,
          filePath: cover.filePath,
          contentType: cover.contentType,
        })
      }

      const meta = await enrichSongWithMetadata({
        title: overrideTitle || info.title,
        artist: overrideArtist || info.artist,
        album: String(overrides?.album || '').trim() || info.album || '',
        genre: String(overrides?.genre || '').trim() || info.genre || '',
        mood: String(overrides?.mood || '').trim(),
        language: String(overrides?.language || '').trim(),
        description: info.description || '',
        releaseYear: info.releaseYear || '',
        rawTags: Array.isArray(overrides?.tags) && overrides.tags.length
          ? overrides.tags
          : (info.rawTags || []),
        lookupItunes: media.lookupItunesMetadata?.bind(media),
        extractWithAi: media.extractAiMetadata?.bind(media),
      })

      await repo.updateSong(songId, {
        title: overrideTitle || meta.title || info.title,
        artist: overrideArtist || meta.artist || info.artist,
        duration_seconds: durationSeconds,
        genre: meta.genre,
        mood: meta.mood,
        language: meta.language,
        album: meta.album,
        tags: meta.tags,
        audio_url: audioUrl,
        audio_key: audioKey,
        thumbnail_url: thumbnailUrl,
        thumbnail_key: thumbnailKey,
        status: 'READY',
        error_message: null,
      })

      if (playlistId) {
        await repo.addSongToPlaylist(playlistId, songId)
      }
    } catch (err) {
      console.error(`Ingestion failed for song ${songId}:`, err)
      await repo.updateSong(songId, {
        status: 'FAILED',
        error_message: (err?.message || 'Ingestion failed').slice(0, 500),
      }).catch(console.error)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  function pump() {
    while (activeCount < concurrency && queue.length > 0) {
      const job = queue.shift()
      activeCount += 1
      processJob(job).finally(() => {
        activeCount -= 1
        pump()
      })
    }
  }

  return {
    enqueue(job) {
      queue.push(job)
      pump()
    },
    stats() {
      return { active: activeCount, queued: queue.length }
    },
  }
}
