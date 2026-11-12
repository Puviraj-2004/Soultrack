import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import multer from 'multer'
import { createFixedWindowRateLimiter, createLoginRateLimiter, requireAdmin, safeEqual, signAdminToken } from './auth.js'
import { SERVER_ROOT } from './config.js'
import { enrichSongWithMetadata, inferSongMetadata, normalizeTagsInput } from './metadata.js'
import { canonicalYoutubeUrl, extractYoutubeId } from './youtube.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i
const ALLOWED_AUDIO_EXTS = new Set(['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'webm'])
const ALLOWED_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp'])

function isValidUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

function isHttpUrl(value) {
  if (typeof value !== 'string') return false
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function cleanTitleFromFilename(filename) {
  const withoutExt = (filename || '').replace(/\.[^/.]+$/, '')
  const cleaned = withoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\b(mp3|m4a|wav|flac|official|audio|video|lyrics)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'Untitled Track'
}

function extFromMimeOrName(mime, originalName, fallback) {
  const ext = path.extname(originalName || '').replace('.', '').toLowerCase()
  if (/^[a-z0-9]{2,5}$/.test(ext)) return ext
  if (mime?.includes('mp4') || mime?.includes('m4a') || mime?.includes('aac')) return 'm4a'
  if (mime?.includes('mpeg') || mime?.includes('mp3')) return 'mp3'
  if (mime?.includes('ogg')) return 'ogg'
  if (mime?.includes('flac')) return 'flac'
  if (mime?.includes('wav')) return 'wav'
  if (mime?.includes('png')) return 'png'
  if (mime?.includes('webp')) return 'webp'
  return fallback
}

function formatSongForClient(row) {
  return {
    id: row.id,
    sourceType: row.source_type,
    youtubeId: row.youtube_id,
    title: row.title,
    artist: row.artist,
    durationSeconds: row.duration_seconds,
    genre: row.genre || '',
    mood: row.mood || '',
    language: row.language || '',
    album: row.album || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    audioUrl: row.audio_url,
    thumbnailUrl: row.thumbnail_url,
    status: row.status,
    errorMessage: row.error_message || null,
    playCount: row.play_count,
    lastPlayedAt: row.last_played_at,
    createdAt: row.created_at,
    playlistIds: row.playlist_ids || undefined,
    playlistPosition: row.playlist_position,
  }
}

function formatPlaylistForClient(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    coverColor: row.cover_color,
    coverImage: row.cover_image,
    songCount: row.song_count ?? undefined,
    coverThumbnails: row.cover_thumbnails || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createApp({ repo, storage, worker, media, config }) {
  const app = express()
  app.set('trust proxy', 1)

  const adminGuard = requireAdmin(config)
  const loginLimiter = createLoginRateLimiter()
  const playLimiter = createFixedWindowRateLimiter({ windowMs: 60 * 1000, maxRequests: 60 })

  const upload = multer({
    dest: path.join(os.tmpdir(), 'soultrack-uploads'),
    limits: { fileSize: config.maxUploadBytes },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').replace('.', '').toLowerCase()
      if (file.fieldname === 'audio') {
        const ok = file.mimetype?.startsWith('audio/') || ALLOWED_AUDIO_EXTS.has(ext)
        return cb(ok ? null : Object.assign(new Error('Unsupported audio file type.'), { status: 400 }), ok)
      }
      if (file.fieldname === 'thumbnail') {
        const ok = file.mimetype?.startsWith('image/') || ALLOWED_IMAGE_EXTS.has(ext)
        return cb(ok ? null : Object.assign(new Error('Unsupported cover image type.'), { status: 400 }), ok)
      }
      cb(Object.assign(new Error('Unexpected upload field.'), { status: 400 }), false)
    },
  })

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }))
  app.use(cors())
  app.use(express.json({ limit: '1mb' }))

  if (config.storageMode === 'local') {
    app.use('/media', express.static(config.localMediaDir, {
      acceptRanges: true,
      maxAge: '1d',
    }))
  }

  app.get('/health', async (_req, res) => {
    try {
      await repo.ping()
      res.json({ ok: true, storage: storage.mode, worker: worker.stats() })
    } catch (err) {
      res.status(503).json({ ok: false, error: err.message })
    }
  })

  // ------------------------------------------------------------------ Public Music API
  app.get('/api/songs', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      const rows = await repo.listReadySongs({
        q: String(req.query.q || ''),
        limit: req.query.limit,
        offset: req.query.offset,
      })
      res.json({ songs: rows.map(formatSongForClient) })
    } catch (err) {
      next(err)
    }
  })

  app.post('/api/songs/:id/play', async (req, res, next) => {
    try {
      if (!isValidUuid(req.params.id)) return res.status(400).json({ error: 'Invalid song id.' })
      const limit = playLimiter.consume(`${req.ip}:${req.params.id}`)
      if (!limit.allowed) {
        return res.status(429).json({ error: 'Play count rate limit reached. Try again shortly.' })
      }
      const updated = await repo.incrementPlayCount(req.params.id)
      if (!updated) return res.status(404).json({ error: 'Song not found.' })
      res.json({ id: updated.id, playCount: updated.play_count })
    } catch (err) {
      next(err)
    }
  })

  app.get('/api/playlists', async (_req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      const rows = await repo.listPlaylists()
      res.json({ playlists: rows.map(formatPlaylistForClient) })
    } catch (err) {
      next(err)
    }
  })

  app.get('/api/playlists/:id', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      if (!isValidUuid(req.params.id)) return res.status(400).json({ error: 'Invalid playlist id.' })
      const detail = await repo.getPlaylistDetail(req.params.id)
      if (!detail) return res.status(404).json({ error: 'Playlist not found.' })
      res.json({
        playlist: formatPlaylistForClient(detail.playlist),
        songs: detail.songs.map(formatSongForClient),
      })
    } catch (err) {
      next(err)
    }
  })

  app.get('/api/version', async (_req, res, next) => {
    try {
      const release = await repo.getLatestRelease()
      if (!release) {
        return res.json(config.defaultAppRelease)
      }
      res.json({
        versionCode: release.version_code,
        versionName: release.version_name,
        downloadUrl: release.download_url,
        releaseNotes: release.release_notes || '',
        forceUpdate: Boolean(release.force_update),
        updatedAt: release.updated_at,
      })
    } catch (err) {
      next(err)
    }
  })

  // ------------------------------------------------------------------ Admin Auth
  app.post('/api/admin/login', (req, res) => {
    if (!config.adminSecret) {
      return res.status(503).json({ error: 'ADMIN_SECRET is not configured on the server.' })
    }

    const ip = req.ip || 'unknown'
    const limitStatus = loginLimiter.check(ip)
    if (!limitStatus.allowed) {
      return res.status(429).json({
        error: `Too many login attempts. Retry in ${limitStatus.retryAfterSec}s.`,
      })
    }

    const secret = String(req.body?.secret || '')
    if (!safeEqual(secret, config.adminSecret)) {
      loginLimiter.recordFailure(ip)
      return res.status(401).json({ error: 'Invalid admin password.' })
    }

    loginLimiter.reset(ip)
    const token = signAdminToken(config.tokenSecret)
    res.json({ token, expiresInSeconds: 24 * 60 * 60 })
  })

  // ------------------------------------------------------------------ Admin Songs & Ingestion
  app.get('/api/admin/songs', adminGuard, async (_req, res, next) => {
    try {
      const rows = await repo.listAllSongs()
      res.json({ songs: rows.map(formatSongForClient), worker: worker.stats() })
    } catch (err) {
      next(err)
    }
  })

  app.post('/api/admin/ingest/preview', adminGuard, async (req, res, next) => {
    try {
      const url = String(req.body?.url || '')
      const youtubeId = extractYoutubeId(url)
      if (!youtubeId) {
        return res.status(400).json({ error: 'Please provide a valid YouTube video URL.' })
      }

      const existing = await repo.findSongByYoutubeId(youtubeId)
      if (existing && existing.status !== 'FAILED') {
        return res.status(200).json({ duplicate: true, song: formatSongForClient(existing) })
      }

      const info = await media.fetchYoutubeInfo(canonicalYoutubeUrl(youtubeId))
      const enriched = await enrichSongWithMetadata({
        title: info.title,
        artist: info.artist,
        album: info.album || '',
        genre: info.genre || '',
        description: info.description || '',
        releaseYear: info.releaseYear || '',
        rawTags: info.rawTags || [],
        lookupItunes: media.lookupItunesMetadata?.bind(media),
        extractWithAi: media.extractAiMetadata?.bind(media),
      })

      if (typeof repo.findSongByTitle === 'function' && enriched.title) {
        const existingTitle = await repo.findSongByTitle(enriched.title)
        if (existingTitle) {
          return res.status(200).json({
            duplicate: true,
            duplicateReason: 'title',
            song: formatSongForClient(existingTitle),
          })
        }
      }

      res.json({
        youtubeId,
        thumbnailUrl: info.thumbnailUrl || null,
        durationSeconds: info.durationSeconds || 0,
        metadata: enriched,
      })
    } catch (err) {
      next(err)
    }
  })

  app.post('/api/admin/ingest', adminGuard, async (req, res, next) => {
    try {
      const url = String(req.body?.url || '')
      const playlistId = req.body?.playlistId ? String(req.body.playlistId) : null
      if (playlistId && !isValidUuid(playlistId)) {
        return res.status(400).json({ error: 'Invalid playlistId.' })
      }

      const youtubeId = extractYoutubeId(url)
      if (!youtubeId) {
        return res.status(400).json({ error: 'Please provide a valid YouTube video URL.' })
      }

      const overrides = {
        title: req.body?.title ? String(req.body.title).trim().slice(0, 200) : '',
        artist: req.body?.artist ? String(req.body.artist).trim().slice(0, 200) : '',
        genre: req.body?.genre ? String(req.body.genre).trim().slice(0, 80) : '',
        mood: req.body?.mood ? String(req.body.mood).trim().slice(0, 80) : '',
        language: req.body?.language ? String(req.body.language).trim().slice(0, 60) : '',
        album: req.body?.album ? String(req.body.album).trim().slice(0, 140) : '',
        tags: req.body?.tags ? normalizeTagsInput(req.body.tags) : [],
      }

      const existing = await repo.findSongByYoutubeId(youtubeId)
      if (existing) {
        if (existing.status === 'FAILED') {
          if (overrides.title && typeof repo.findSongByTitle === 'function') {
            const dupTitle = await repo.findSongByTitle(overrides.title, existing.id)
            if (dupTitle) {
              return res.status(409).json({
                error: `A song named "${dupTitle.title}" already exists in the catalog.`,
                duplicate: true,
                song: formatSongForClient(dupTitle),
              })
            }
          }
          const retried = await repo.updateSong(existing.id, {
            status: 'PROCESSING',
            error_message: null,
          })
          worker.enqueue({ songId: existing.id, youtubeId, playlistId, overrides })
          return res.status(202).json({ song: formatSongForClient(retried), retried: true })
        }
        if (playlistId && existing.status === 'READY') {
          await repo.addSongToPlaylist(playlistId, existing.id)
        }
        return res.status(200).json({ song: formatSongForClient(existing), duplicate: true })
      }

      if (overrides.title && typeof repo.findSongByTitle === 'function') {
        const dupTitle = await repo.findSongByTitle(overrides.title)
        if (dupTitle) {
          return res.status(409).json({
            error: `A song named "${dupTitle.title}" already exists in the catalog.`,
            duplicate: true,
            song: formatSongForClient(dupTitle),
          })
        }
      }

      const created = await repo.createSong({
        source_type: 'youtube',
        youtube_id: youtubeId,
        title: overrides.title || `Importing ${youtubeId}...`,
        artist: overrides.artist || 'Processing...',
        genre: overrides.genre,
        mood: overrides.mood,
        language: overrides.language,
        album: overrides.album,
        tags: overrides.tags,
        duration_seconds: 0,
        audio_url: '',
        status: 'PROCESSING',
      })

      worker.enqueue({ songId: created.id, youtubeId, playlistId, overrides })
      res.status(202).json({ song: formatSongForClient(created) })
    } catch (err) {
      next(err)
    }
  })

  app.post(
    '/api/admin/songs/upload',
    adminGuard,
    upload.fields([
      { name: 'audio', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ]),
    async (req, res, next) => {
      const audioFile = req.files?.audio?.[0]
      const thumbFile = req.files?.thumbnail?.[0]
      const tempFiles = [audioFile?.path, thumbFile?.path].filter(Boolean)

      try {
        const directUrl = String(req.body?.audioUrl || '').trim()
        const playlistId = req.body?.playlistId ? String(req.body.playlistId) : null
        if (playlistId && !isValidUuid(playlistId)) {
          return res.status(400).json({ error: 'Invalid playlistId.' })
        }

        if (!audioFile && !directUrl) {
          return res.status(400).json({ error: 'Provide either an audio file or an audioUrl.' })
        }

        if (directUrl && !/^https?:\/\//i.test(directUrl)) {
          return res.status(400).json({ error: 'audioUrl must start with http:// or https://.' })
        }

        const songId = crypto.randomUUID()
        const embeddedMeta = audioFile && typeof media.probeAudioMetadata === 'function'
          ? await media.probeAudioMetadata(audioFile.path)
          : { durationSeconds: 0, title: '', artist: '', album: '', genre: '', language: '' }

        const fallbackTitle = embeddedMeta.title || (audioFile
          ? cleanTitleFromFilename(audioFile.originalname)
          : 'Untitled Track')
        let title = String(req.body?.title || '').trim() || fallbackTitle
        if (typeof repo.findSongByTitle === 'function') {
          const dupTitle = await repo.findSongByTitle(title)
          if (dupTitle) {
            return res.status(409).json({
              error: `A song named "${dupTitle.title}" already exists in the catalog.`,
              duplicate: true,
              song: formatSongForClient(dupTitle),
            })
          }
        }
        let artist = String(req.body?.artist || '').trim() || embeddedMeta.artist || ''
        let album = String(req.body?.album || '').trim() || embeddedMeta.album || ''
        let genre = String(req.body?.genre || '').trim() || embeddedMeta.genre || ''
        let mood = String(req.body?.mood || '').trim()
        let language = String(req.body?.language || '').trim() || embeddedMeta.language || ''
        let thumbnailUrl = String(req.body?.thumbnailUrl || '').trim() || null
        let durationSeconds = Math.max(0, Math.round(Number(req.body?.durationSeconds) || embeddedMeta.durationSeconds || 0))

        if (!artist || !thumbnailUrl || !genre || !album) {
          const meta = await media.lookupItunesMetadata(title)
          if (meta) {
            if (!artist && meta.artist) artist = meta.artist
            if (!thumbnailUrl && meta.artworkUrl) thumbnailUrl = meta.artworkUrl
            if (!album && meta.album) album = meta.album
            if (!genre && meta.genre) genre = meta.genre
          }
        }
        if (!artist) artist = 'Unknown Artist'

        const inferred = inferSongMetadata({
          title,
          artist,
          album,
          genre,
          mood,
          language,
          rawTags: req.body?.tags,
        })

        let audioUrl = directUrl
        let audioKey = null
        let sourceType = 'url'

        if (audioFile) {
          sourceType = 'upload'
          if (!durationSeconds) {
            durationSeconds = await media.probeDurationSeconds(audioFile.path)
          }
          const audioExt = extFromMimeOrName(audioFile.mimetype, audioFile.originalname, 'mp3')
          audioKey = `songs/${songId}.${audioExt}`
          audioUrl = await storage.putFile({
            key: audioKey,
            filePath: audioFile.path,
            contentType: audioFile.mimetype || 'audio/mpeg',
          })
        }

        let thumbnailKey = null
        if (thumbFile) {
          const imgExt = extFromMimeOrName(thumbFile.mimetype, thumbFile.originalname, 'jpg')
          thumbnailKey = `covers/${songId}.${imgExt}`
          thumbnailUrl = await storage.putFile({
            key: thumbnailKey,
            filePath: thumbFile.path,
            contentType: thumbFile.mimetype || 'image/jpeg',
          })
        }

        const created = await repo.createSong({
          source_type: sourceType,
          title: title.slice(0, 200),
          artist: (inferred.artist || artist).slice(0, 200),
          duration_seconds: durationSeconds,
          genre: inferred.genre,
          mood: inferred.mood,
          language: inferred.language,
          album: inferred.album,
          tags: inferred.tags,
          audio_url: audioUrl,
          audio_key: audioKey,
          thumbnail_url: thumbnailUrl,
          thumbnail_key: thumbnailKey,
          status: 'READY',
        })

        if (playlistId) {
          await repo.addSongToPlaylist(playlistId, created.id)
        }

        res.status(201).json({ song: formatSongForClient(created) })
      } catch (err) {
        next(err)
      } finally {
        await Promise.allSettled(tempFiles.map(p => fs.rm(p, { force: true })))
      }
    }
  )

  app.patch('/api/admin/songs/:id', adminGuard, async (req, res, next) => {
    try {
      if (!isValidUuid(req.params.id)) return res.status(400).json({ error: 'Invalid song id.' })
      const patch = {}
      if (req.body?.title !== undefined) patch.title = String(req.body.title).trim().slice(0, 200)
      if (req.body?.artist !== undefined) patch.artist = String(req.body.artist).trim().slice(0, 200)
      if (req.body?.genre !== undefined) patch.genre = String(req.body.genre).trim().slice(0, 80)
      if (req.body?.mood !== undefined) patch.mood = String(req.body.mood).trim().slice(0, 80)
      if (req.body?.language !== undefined) patch.language = String(req.body.language).trim().slice(0, 60)
      if (req.body?.album !== undefined) patch.album = String(req.body.album).trim().slice(0, 140)
      if (req.body?.tags !== undefined) patch.tags = normalizeTagsInput(req.body.tags)
      if (req.body?.thumbnailUrl !== undefined) {
        const thumb = req.body.thumbnailUrl ? String(req.body.thumbnailUrl).trim() : null
        if (thumb && !isHttpUrl(thumb)) {
          return res.status(400).json({ error: 'thumbnailUrl must be a valid http(s) URL.' })
        }
        patch.thumbnail_url = thumb
      }
      if (patch.title === '') return res.status(400).json({ error: 'Title cannot be empty.' })
      if (patch.title && typeof repo.findSongByTitle === 'function') {
        const dupTitle = await repo.findSongByTitle(patch.title, req.params.id)
        if (dupTitle) {
          return res.status(409).json({ error: `Another song named "${dupTitle.title}" already exists.` })
        }
      }

      const updated = await repo.updateSong(req.params.id, patch)
      if (!updated) return res.status(404).json({ error: 'Song not found.' })
      res.json({ song: formatSongForClient(updated) })
    } catch (err) {
      next(err)
    }
  })

  app.post('/api/admin/songs/enrich', adminGuard, async (req, res, next) => {
    try {
      const songId = req.body?.songId ? String(req.body.songId) : null
      const lookupItunes = media.lookupItunesMetadata?.bind(media)
      const extractWithAi = media.extractAiMetadata?.bind(media)

      if (songId) {
        if (!isValidUuid(songId)) return res.status(400).json({ error: 'Invalid songId.' })
        const existing = await repo.findSongById(songId)
        if (!existing) return res.status(404).json({ error: 'Song not found.' })

        const enriched = await enrichSongWithMetadata({
          title: req.body?.title ?? existing.title,
          artist: req.body?.artist ?? existing.artist,
          album: req.body?.album ?? existing.album ?? '',
          genre: req.body?.genre ?? existing.genre ?? '',
          mood: req.body?.mood ?? existing.mood ?? '',
          language: req.body?.language ?? existing.language ?? '',
          rawTags: req.body?.tags ?? existing.tags ?? [],
          lookupItunes,
          extractWithAi,
        })

        if (req.body?.previewOnly) {
          return res.json({ updatedCount: 0, metadata: enriched })
        }

        const canRename = enriched.title && (
          typeof repo.findSongByTitle !== 'function' ||
          !(await repo.findSongByTitle(enriched.title, songId))
        )
        const updated = await repo.updateSong(songId, {
          title: canRename ? enriched.title : existing.title,
          artist: enriched.artist || existing.artist,
          genre: enriched.genre,
          mood: enriched.mood,
          language: enriched.language,
          album: enriched.album,
          tags: enriched.tags,
        })
        return res.json({ updatedCount: 1, song: formatSongForClient(updated), metadata: enriched })
      }

      const allSongs = await repo.listAllSongs()
      let updatedCount = 0
      for (const row of allSongs) {
        if (row.status !== 'READY') continue
        const enriched = await enrichSongWithMetadata({
          title: row.title,
          artist: row.artist,
          album: row.album || '',
          genre: row.genre || '',
          mood: row.mood || '',
          language: row.language || '',
          rawTags: row.tags || [],
          lookupItunes,
          extractWithAi,
        })
        const canRename = enriched.title && (
          typeof repo.findSongByTitle !== 'function' ||
          !(await repo.findSongByTitle(enriched.title, row.id))
        )
        await repo.updateSong(row.id, {
          title: canRename ? enriched.title : row.title,
          artist: enriched.artist || row.artist,
          genre: enriched.genre,
          mood: enriched.mood,
          language: enriched.language,
          album: enriched.album,
          tags: enriched.tags,
        })
        updatedCount += 1
      }
      res.json({ updatedCount })
    } catch (err) {
      next(err)
    }
  })

  app.delete('/api/admin/songs/:id', adminGuard, async (req, res, next) => {
    try {
      if (!isValidUuid(req.params.id)) return res.status(400).json({ error: 'Invalid song id.' })
      const deleted = await repo.deleteSong(req.params.id)
      if (!deleted) return res.status(404).json({ error: 'Song not found.' })
      await storage.deleteKeys([deleted.audio_key, deleted.thumbnail_key])
      res.json({ deleted: true, id: deleted.id })
    } catch (err) {
      next(err)
    }
  })

  // ------------------------------------------------------------------ Admin Playlists & App Version
  app.post('/api/admin/playlists', adminGuard, async (req, res, next) => {
    try {
      const name = String(req.body?.name || '').trim()
      if (!name || name.length > 120) {
        return res.status(400).json({ error: 'Playlist name must be 1 to 120 characters.' })
      }
      const coverColor = String(req.body?.coverColor || '#0096FF').trim()
      if (!HEX_COLOR_REGEX.test(coverColor)) {
        return res.status(400).json({ error: 'coverColor must be a 6-digit hex color like #0096FF.' })
      }
      const coverImage = req.body?.coverImage ? String(req.body.coverImage).trim() : null
      if (coverImage && !isHttpUrl(coverImage)) {
        return res.status(400).json({ error: 'coverImage must be a valid http(s) URL.' })
      }
      const created = await repo.createPlaylist({
        name,
        description: String(req.body?.description || '').trim(),
        cover_color: coverColor,
        cover_image: coverImage,
      })
      res.status(201).json({ playlist: formatPlaylistForClient(created) })
    } catch (err) {
      next(err)
    }
  })

  app.patch('/api/admin/playlists/:id', adminGuard, async (req, res, next) => {
    try {
      if (!isValidUuid(req.params.id)) return res.status(400).json({ error: 'Invalid playlist id.' })
      const patch = {}
      if (req.body?.name !== undefined) {
        const name = String(req.body.name).trim()
        if (!name || name.length > 120) {
          return res.status(400).json({ error: 'Playlist name must be 1 to 120 characters.' })
        }
        patch.name = name
      }
      if (req.body?.description !== undefined) patch.description = String(req.body.description).trim()
      if (req.body?.coverColor !== undefined) {
        const coverColor = String(req.body.coverColor).trim()
        if (!HEX_COLOR_REGEX.test(coverColor)) {
          return res.status(400).json({ error: 'coverColor must be a 6-digit hex color like #0096FF.' })
        }
        patch.cover_color = coverColor
      }

      const updated = await repo.updatePlaylist(req.params.id, patch)
      if (!updated) return res.status(404).json({ error: 'Playlist not found.' })
      res.json({ playlist: formatPlaylistForClient(updated) })
    } catch (err) {
      next(err)
    }
  })

  app.delete('/api/admin/playlists/:id', adminGuard, async (req, res, next) => {
    try {
      if (!isValidUuid(req.params.id)) return res.status(400).json({ error: 'Invalid playlist id.' })
      const deleted = await repo.deletePlaylist(req.params.id)
      if (!deleted) return res.status(404).json({ error: 'Playlist not found.' })
      res.json({ deleted: true, id: deleted.id })
    } catch (err) {
      next(err)
    }
  })

  app.post('/api/admin/playlists/:id/songs', adminGuard, async (req, res, next) => {
    try {
      const playlistId = req.params.id
      const songId = String(req.body?.songId || '')
      if (!isValidUuid(playlistId) || !isValidUuid(songId)) {
        return res.status(400).json({ error: 'Invalid playlist or song id.' })
      }
      await repo.addSongToPlaylist(playlistId, songId)
      res.status(201).json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  app.delete('/api/admin/playlists/:id/songs/:songId', adminGuard, async (req, res, next) => {
    try {
      const { id: playlistId, songId } = req.params
      if (!isValidUuid(playlistId) || !isValidUuid(songId)) {
        return res.status(400).json({ error: 'Invalid playlist or song id.' })
      }
      await repo.removeSongFromPlaylist(playlistId, songId)
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  app.put('/api/admin/version', adminGuard, async (req, res, next) => {
    try {
      const versionCode = Number(req.body?.versionCode)
      const versionName = String(req.body?.versionName || '').trim()
      const downloadUrl = String(req.body?.downloadUrl || '').trim()
      const releaseNotes = String(req.body?.releaseNotes || '').trim()
      const forceUpdate = Boolean(req.body?.forceUpdate)

      if (!Number.isInteger(versionCode) || versionCode < 1 || !versionName || !/^https?:\/\//i.test(downloadUrl)) {
        return res.status(400).json({
          error: 'Valid integer versionCode, versionName, and http(s) downloadUrl are required.',
        })
      }

      const saved = await repo.upsertRelease({
        version_code: versionCode,
        version_name: versionName,
        download_url: downloadUrl,
        release_notes: releaseNotes,
        force_update: forceUpdate,
      })

      res.json({
        versionCode: saved.version_code,
        versionName: saved.version_name,
        downloadUrl: saved.download_url,
        releaseNotes: saved.release_notes,
        forceUpdate: saved.force_update,
        updatedAt: saved.updated_at,
      })
    } catch (err) {
      next(err)
    }
  })

  // ------------------------------------------------------------------ Admin Web Panel (Static SPA)
  const publicDir = path.join(SERVER_ROOT, 'public')
  app.use(express.static(publicDir))
  app.get(/^\/(?!api\/|media\/|health$).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'))
  })

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err)
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Uploaded file exceeds the size limit.' })
    }
    res.status(err?.status || 500).json({ error: err?.message || 'Internal server error.' })
  })

  return app
}
