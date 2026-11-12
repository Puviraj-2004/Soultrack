import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { inferSongMetadata } from '../src/metadata.js'
import { createIngestionWorker } from '../src/worker.js'

function createInMemoryRepo() {
  const songs = new Map()
  const playlists = new Map()
  const playlistSongs = []
  let release = null

  return {
    async ping() {},
    async listReadySongs({ q = '' } = {}) {
      const needle = q.trim().toLowerCase()
      return [...songs.values()]
        .filter(s => s.status === 'READY')
        .filter(s => !needle || `${s.title} ${s.artist} ${s.genre} ${s.mood} ${s.language} ${s.album} ${(s.tags || []).join(' ')}`.toLowerCase().includes(needle))
    },
    async listAllSongs() {
      return [...songs.values()].map(s => ({
        ...s,
        playlist_ids: playlistSongs.filter(ps => ps.song_id === s.id).map(ps => ps.playlist_id),
      }))
    },
    async findSongById(id) {
      return songs.get(id) || null
    },
    async findSongByYoutubeId(youtubeId) {
      return [...songs.values()].find(s => s.youtube_id === youtubeId) || null
    },
    async findSongByTitle(title, excludeId = null) {
      const norm = String(title || '').replace(/\s+/g, ' ').trim().toLowerCase()
      if (!norm) return null
      return [...songs.values()].find(s =>
        s.status !== 'FAILED' &&
        (!excludeId || s.id !== excludeId) &&
        String(s.title || '').replace(/\s+/g, ' ').trim().toLowerCase() === norm
      ) || null
    },
    async createSong(data) {
      const id = crypto.randomUUID()
      const row = {
        id,
        source_type: data.source_type || 'upload',
        youtube_id: data.youtube_id || null,
        title: data.title,
        artist: data.artist || 'Unknown Artist',
        duration_seconds: data.duration_seconds || 0,
        genre: data.genre || '',
        mood: data.mood || '',
        language: data.language || '',
        album: data.album || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        audio_url: data.audio_url || '',
        audio_key: data.audio_key || null,
        thumbnail_url: data.thumbnail_url || null,
        thumbnail_key: data.thumbnail_key || null,
        status: data.status || 'READY',
        error_message: data.error_message || null,
        play_count: 0,
        last_played_at: null,
        created_at: new Date().toISOString(),
      }
      songs.set(id, row)
      return row
    },
    async updateSong(id, patch) {
      const existing = songs.get(id)
      if (!existing) return null
      const updated = { ...existing, ...patch }
      songs.set(id, updated)
      return updated
    },
    async deleteSong(id) {
      const existing = songs.get(id)
      if (!existing) return null
      songs.delete(id)
      return existing
    },
    async incrementPlayCount(id) {
      const existing = songs.get(id)
      if (!existing || existing.status !== 'READY') return null
      existing.play_count += 1
      existing.last_played_at = new Date().toISOString()
      return existing
    },
    async listPlaylists() {
      return [...playlists.values()].map(p => ({
        ...p,
        song_count: playlistSongs.filter(ps => ps.playlist_id === p.id).length,
        cover_thumbnails: [],
      }))
    },
    async getPlaylistDetail(id) {
      const playlist = playlists.get(id)
      if (!playlist) return null
      const linked = playlistSongs
        .filter(ps => ps.playlist_id === id)
        .sort((a, b) => a.position - b.position)
        .map(ps => songs.get(ps.song_id))
        .filter(s => s && s.status === 'READY')
      return { playlist, songs: linked }
    },
    async createPlaylist({ name, description = '', cover_color = '#0096FF', cover_image = null }) {
      const id = crypto.randomUUID()
      const row = { id, name, description, cover_color, cover_image, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      playlists.set(id, row)
      return row
    },
    async updatePlaylist(id, patch) {
      const existing = playlists.get(id)
      if (!existing) return null
      const updated = { ...existing, ...patch, updated_at: new Date().toISOString() }
      playlists.set(id, updated)
      return updated
    },
    async deletePlaylist(id) {
      const existing = playlists.get(id)
      if (!existing) return null
      playlists.delete(id)
      return existing
    },
    async addSongToPlaylist(playlistId, songId) {
      if (!playlistSongs.some(ps => ps.playlist_id === playlistId && ps.song_id === songId)) {
        playlistSongs.push({ playlist_id: playlistId, song_id: songId, position: playlistSongs.length })
      }
    },
    async removeSongFromPlaylist(playlistId, songId) {
      const idx = playlistSongs.findIndex(ps => ps.playlist_id === playlistId && ps.song_id === songId)
      if (idx >= 0) playlistSongs.splice(idx, 1)
    },
    async getLatestRelease() {
      return release
    },
    async upsertRelease(data) {
      release = { id: 1, ...data, updated_at: new Date().toISOString() }
      return release
    },
  }
}

test('Soultrack REST API, auth, ingestion worker, playlists, and version endpoints', async () => {
  const repo = createInMemoryRepo()
  const storedObjects = new Map()
  const storage = {
    mode: 'memory',
    async putFile({ key, filePath }) {
      const bytes = await fs.readFile(filePath)
      storedObjects.set(key, bytes)
      return `https://cdn.example.com/${key}`
    },
    async deleteKeys(keys) {
      keys.forEach(k => storedObjects.delete(k))
    },
  }
  const media = {
    async fetchYoutubeInfo() {
      return { title: 'Test Song', artist: 'Test Artist', durationSeconds: 215, thumbnailUrl: null }
    },
    async downloadYoutubeAudio(_url, outDir) {
      const p = path.join(outDir, 'source.webm')
      await fs.writeFile(p, 'fake-raw-audio')
      return p
    },
    async transcodeFaststartM4a(_inPath, outPath) {
      await fs.writeFile(outPath, 'fake-m4a-faststart')
    },
    async probeDurationSeconds() {
      return 216
    },
    async downloadImageFile() {
      return null
    },
    async lookupItunesMetadata() {
      return null
    },
  }

  const config = loadConfig({
    ADMIN_SECRET: 'super-secret-pass',
    TOKEN_SECRET: 'signing-secret',
    STORAGE_MODE: 'local',
    LOCAL_MEDIA_DIR: path.join(os.tmpdir(), 'soultrack-test-media'),
  })

  const worker = createIngestionWorker({ repo, storage, media, concurrency: 1 })
  const app = createApp({ repo, storage, worker, media, config })

  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`)
    assert.equal(healthRes.status, 200)

    // 2. Unauthenticated admin route blocked
    const unauthRes = await fetch(`${baseUrl}/api/admin/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    })
    assert.equal(unauthRes.status, 401)

    // 3. Login fails with wrong secret, succeeds with right secret
    const badLogin = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'wrong' }),
    })
    assert.equal(badLogin.status, 401)

    const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'super-secret-pass' }),
    })
    assert.equal(loginRes.status, 200)
    const { token } = await loginRes.json()
    assert.ok(token)

    // 4. Queue YouTube ingest
    const ingestRes = await fetch(`${baseUrl}/api/admin/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url: 'https://youtu.be/dQw4w9WgXcQ' }),
    })
    assert.equal(ingestRes.status, 202)
    const { song: queuedSong } = await ingestRes.json()

    // Wait briefly for in-process worker
    for (let i = 0; i < 20; i++) {
      const listRes = await fetch(`${baseUrl}/api/songs`)
      const { songs } = await listRes.json()
      if (songs.length === 1) break
      await new Promise(r => setTimeout(r, 20))
    }

    const songsRes = await fetch(`${baseUrl}/api/songs`)
    const { songs } = await songsRes.json()
    assert.equal(songs.length, 1)
    assert.equal(songs[0].title, 'Test Song')
    assert.equal(songs[0].durationSeconds, 216)
    assert.equal(songs[0].audioUrl, `https://cdn.example.com/songs/${queuedSong.id}.m4a`)

    // 5. Increment play count
    const playRes = await fetch(`${baseUrl}/api/songs/${queuedSong.id}/play`, { method: 'POST' })
    assert.equal(playRes.status, 200)
    const playJson = await playRes.json()
    assert.equal(playJson.playCount, 1)

    // 6. Multipart upload
    const form = new FormData()
    form.append('title', 'Uploaded Track')
    form.append('artist', 'Upload Artist')
    form.append('audio', new Blob(['mp3bytes'], { type: 'audio/mpeg' }), 'my_track.mp3')
    const uploadRes = await fetch(`${baseUrl}/api/admin/songs/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    assert.equal(uploadRes.status, 201)
    const { song: uploadedSong } = await uploadRes.json()
    assert.equal(uploadedSong.title, 'Uploaded Track')

    // 7. Create playlist and link song
    const plRes = await fetch(`${baseUrl}/api/admin/playlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Favorites', coverColor: '#0096FF' }),
    })
    assert.equal(plRes.status, 201)
    const { playlist } = await plRes.json()

    const linkRes = await fetch(`${baseUrl}/api/admin/playlists/${playlist.id}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ songId: uploadedSong.id }),
    })
    assert.equal(linkRes.status, 201)

    const detailRes = await fetch(`${baseUrl}/api/playlists/${playlist.id}`)
    assert.equal(detailRes.status, 200)
    const detail = await detailRes.json()
    assert.equal(detail.songs.length, 1)
    assert.equal(detail.songs[0].id, uploadedSong.id)

    // 8. Version endpoint
    const putVer = await fetch(`${baseUrl}/api/admin/version`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        versionCode: 2,
        versionName: '1.1.0',
        downloadUrl: 'https://github.com/Puviraj-2004/Soultrack/releases/download/v1.1.0/app.apk',
        releaseNotes: 'Fast background playback',
        forceUpdate: true,
      }),
    })
    assert.equal(putVer.status, 200)

    const getVer = await fetch(`${baseUrl}/api/version`)
    assert.equal(getVer.status, 200)
    const ver = await getVer.json()
    assert.equal(ver.versionCode, 2)
    assert.equal(ver.forceUpdate, true)

    const delRes = await fetch(`${baseUrl}/api/admin/songs/${queuedSong.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(delRes.status, 200)
    assert.equal(storedObjects.has(`songs/${queuedSong.id}.m4a`), false)

    // 10. Upload with explicit metadata & patch update
    const metaForm = new FormData()
    metaForm.append('title', 'Vaseegara (Lofi Mix)')
    metaForm.append('artist', 'Anirudh')
    metaForm.append('genre', 'Lofi')
    metaForm.append('mood', 'Chill')
    metaForm.append('audio', new Blob(['mp3bytes'], { type: 'audio/mpeg' }), 'vaseegara.mp3')
    const metaUpload = await fetch(`${baseUrl}/api/admin/songs/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: metaForm,
    })
    assert.equal(metaUpload.status, 201)
    const { song: metaSong } = await metaUpload.json()
    assert.equal(metaSong.genre, 'Lofi')
    assert.equal(metaSong.mood, 'Chill')
    assert.equal(metaSong.language, 'Tamil')
    assert.ok(metaSong.tags.includes('lofi'))

    const searchByMood = await fetch(`${baseUrl}/api/songs?q=Chill`)
    assert.equal(searchByMood.status, 200)
    const searched = await searchByMood.json()
    assert.ok(searched.songs.some(s => s.id === metaSong.id))

    // 11. Admin enrich cleans record label artist & populates missing metadata
    const labelForm = new FormData()
    labelForm.append('title', 'Meesakaara nanba – Lyrical Video | Natpukkaga | Sarathkumar')
    labelForm.append('artist', 'Universal Music South')
    labelForm.append('audio', new Blob(['mp3bytes'], { type: 'audio/mpeg' }), 'meesakaara.mp3')
    const labelUpload = await fetch(`${baseUrl}/api/admin/songs/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: labelForm,
    })
    assert.equal(labelUpload.status, 201)
    const { song: labelSong } = await labelUpload.json()
    assert.equal(labelSong.album, 'Natpukkaga')
    assert.equal(labelSong.language, 'Tamil')
    assert.ok(labelSong.genre.length > 0)
    assert.ok(labelSong.mood.length > 0)

    const enrichRes = await fetch(`${baseUrl}/api/admin/songs/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ songId: labelSong.id }),
    })
    assert.equal(enrichRes.status, 200)
    const enrichedBody = await enrichRes.json()
    assert.equal(enrichedBody.updatedCount, 1)
    assert.equal(enrichedBody.song.album, 'Natpukkaga')
    assert.equal(enrichedBody.song.language, 'Tamil')

    // 12. YouTube ingest preview + user-reviewed override ingest
    media.fetchYoutubeInfo = async () => ({
      title: 'Pathikichu – Lyrical Video | Vidaamuyarchi | Ajith Kumar',
      artist: 'Sony Music South',
      durationSeconds: 205,
      thumbnailUrl: 'https://img.youtube.com/vi/abc123def45/hqdefault.jpg',
      album: '',
      genre: 'Music',
      description: 'Song: Pathikichu\nMusic: Anirudh Ravichander\nSingers: Anirudh, Yogi B\nMovie: Vidaamuyarchi\nYear: 2025',
      rawTags: ['Tamil Mass'],
    })

    const previewRes = await fetch(`${baseUrl}/api/admin/ingest/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=abc123def45' }),
    })
    assert.equal(previewRes.status, 200)
    const previewJson = await previewRes.json()
    assert.equal(previewJson.youtubeId, 'abc123def45')
    assert.equal(previewJson.metadata.title, 'Pathikichu')
    assert.equal(previewJson.metadata.artist, 'Anirudh Ravichander, Anirudh, Yogi B')
    assert.equal(previewJson.metadata.album, 'Vidaamuyarchi')
    assert.equal(previewJson.metadata.language, 'Tamil')
    assert.ok(previewJson.metadata.tags.includes('2020s'))

    const customIngestRes = await fetch(`${baseUrl}/api/admin/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=abc123def45',
        title: 'Pathikichu',
        artist: 'Anirudh Ravichander, Yogi B',
        genre: 'Mass',
        mood: 'Energetic',
        language: 'Tamil',
        album: 'Vidaamuyarchi',
        tags: '2020s, ajith, workout',
      }),
    })
    assert.equal(customIngestRes.status, 202)
    const { song: customQueued } = await customIngestRes.json()

    let readyCustom = null
    for (let i = 0; i < 25; i++) {
      const listRes = await fetch(`${baseUrl}/api/songs`)
      const body = await listRes.json()
      readyCustom = body.songs.find(s => s.id === customQueued.id)
      if (readyCustom) break
      await new Promise(r => setTimeout(r, 20))
    }
    assert.ok(readyCustom)
    assert.equal(readyCustom.title, 'Pathikichu')
    assert.equal(readyCustom.artist, 'Anirudh Ravichander, Yogi B')
    assert.equal(readyCustom.mood, 'Energetic')
    assert.ok(readyCustom.tags.includes('workout'))

    // 13. Same song title blocked across preview, upload, ingest, and rename
    const dupPreview = await fetch(`${baseUrl}/api/admin/ingest/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=zz998877665' }),
    })
    assert.equal(dupPreview.status, 200)
    const dupPreviewJson = await dupPreview.json()
    assert.equal(dupPreviewJson.duplicate, true)
    assert.equal(dupPreviewJson.duplicateReason, 'title')

    const dupUploadForm = new FormData()
    dupUploadForm.append('title', '  pathikichu  ')
    dupUploadForm.append('audio', new Blob(['mp3bytes'], { type: 'audio/mpeg' }), 'dup.mp3')
    const dupUploadRes = await fetch(`${baseUrl}/api/admin/songs/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: dupUploadForm,
    })
    assert.equal(dupUploadRes.status, 409)

    const dupIngestRes = await fetch(`${baseUrl}/api/admin/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=zz998877665',
        title: 'Pathikichu',
      }),
    })
    assert.equal(dupIngestRes.status, 409)

    const dupRenameRes = await fetch(`${baseUrl}/api/admin/songs/${metaSong.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: 'Pathikichu' }),
    })
    assert.equal(dupRenameRes.status, 409)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

test('inferSongMetadata derives genre, mood, language, and normalized tags', () => {
  const inferred = inferSongMetadata({
    title: 'Munbe Vaa (Slowed + Reverb)',
    artist: 'A.R. Rahman',
    rawTags: ['Tamil Melody', 'Late Night'],
  })
  assert.equal(inferred.genre, 'Lofi')
  assert.equal(inferred.mood, 'Chill')
  assert.equal(inferred.language, 'Tamil')
  assert.ok(inferred.tags.includes('lofi'))
  assert.ok(inferred.tags.includes('chill'))

  const youtubeLabelCase = inferSongMetadata({
    title: 'Meesakaara nanba – Lyrical Video | Natpukkaga | Sarathkumar | Deva',
    artist: 'Universal Music South',
    description: 'Music by S.A. Rajkumar\nMovie: Natpukkaga\nYear: 1998',
  })
  assert.equal(youtubeLabelCase.title, 'Meesakaara nanba')
  assert.equal(youtubeLabelCase.album, 'Natpukkaga')
  assert.equal(youtubeLabelCase.artist, 'S.A. Rajkumar')
  assert.equal(youtubeLabelCase.language, 'Tamil')
  assert.ok(youtubeLabelCase.tags.includes('90s'))
  assert.ok(youtubeLabelCase.genre)
  assert.ok(youtubeLabelCase.mood)
})
