import { inferSongMetadata, isRecordLabelChannel } from './metadata.js'

export function createPgRepository(pool) {
  return {
    async ping() {
      await pool.query('SELECT 1')
    },

    async listReadySongs({ q = '', limit = 100, offset = 0 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500)
      const safeOffset = Math.max(Number(offset) || 0, 0)
      const needle = q.trim()

      if (needle) {
        const { rows } = await pool.query(
          `SELECT id, source_type, youtube_id, title, artist, duration_seconds, audio_url, thumbnail_url, status,
                  genre, mood, language, album, tags, play_count, last_played_at, created_at
           FROM songs
           WHERE status = 'READY'
             AND (
               title ILIKE $1 OR artist ILIKE $1 OR genre ILIKE $1 OR mood ILIKE $1
               OR language ILIKE $1 OR album ILIKE $1 OR array_to_string(tags, ' ') ILIKE $1
             )
           ORDER BY created_at DESC, title ASC
           LIMIT $2 OFFSET $3`,
          [`%${needle}%`, safeLimit, safeOffset]
        )
        return rows
      }

      const { rows } = await pool.query(
        `SELECT id, source_type, youtube_id, title, artist, duration_seconds, audio_url, thumbnail_url, status,
                genre, mood, language, album, tags, play_count, last_played_at, created_at
         FROM songs
         WHERE status = 'READY'
         ORDER BY created_at DESC, title ASC
         LIMIT $1 OFFSET $2`,
        [safeLimit, safeOffset]
      )
      return rows
    },

    async listAllSongs() {
      const { rows } = await pool.query(
        `SELECT s.*, COALESCE(
           ARRAY_AGG(ps.playlist_id) FILTER (WHERE ps.playlist_id IS NOT NULL),
           '{}'
         ) AS playlist_ids
         FROM songs s
         LEFT JOIN playlist_songs ps ON ps.song_id = s.id
         GROUP BY s.id
         ORDER BY s.created_at DESC, s.title ASC`
      )
      return rows
    },

    async findSongById(id) {
      const { rows } = await pool.query('SELECT * FROM songs WHERE id = $1', [id])
      return rows[0] || null
    },

    async findSongByYoutubeId(youtubeId) {
      const { rows } = await pool.query('SELECT * FROM songs WHERE youtube_id = $1', [youtubeId])
      return rows[0] || null
    },

    async findSongByTitle(title, excludeId = null) {
      const normalized = String(title || '').replace(/\s+/g, ' ').trim().toLowerCase()
      if (!normalized) return null
      const params = [normalized]
      let excludeClause = ''
      if (excludeId) {
        params.push(excludeId)
        excludeClause = 'AND id <> $2'
      }
      const { rows } = await pool.query(
        `SELECT * FROM songs
         WHERE status <> 'FAILED'
           ${excludeClause}
           AND LOWER(REGEXP_REPLACE(TRIM(title), '\\s+', ' ', 'g')) = $1
         LIMIT 1`,
        params
      )
      return rows[0] || null
    },

    async createSong(data) {
      const { rows } = await pool.query(
        `INSERT INTO songs (
          source_type, youtube_id, title, artist, duration_seconds,
          genre, mood, language, album, tags,
          audio_url, audio_key, thumbnail_url, thumbnail_key, status, error_message
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *`,
        [
          data.source_type || 'upload',
          data.youtube_id || null,
          data.title,
          data.artist || 'Unknown Artist',
          Number(data.duration_seconds) || 0,
          data.genre || '',
          data.mood || '',
          data.language || '',
          data.album || '',
          Array.isArray(data.tags) ? data.tags : [],
          data.audio_url || '',
          data.audio_key || null,
          data.thumbnail_url || null,
          data.thumbnail_key || null,
          data.status || 'READY',
          data.error_message || null,
        ]
      )
      return rows[0]
    },

    async updateSong(id, patch) {
      const allowed = [
        'title', 'artist', 'duration_seconds', 'genre', 'mood', 'language', 'album', 'tags',
        'audio_url', 'audio_key', 'thumbnail_url', 'thumbnail_key', 'status', 'error_message',
      ]
      const entries = Object.entries(patch).filter(([k, v]) => allowed.includes(k) && v !== undefined)
      if (entries.length === 0) return this.findSongById(id)

      const sets = entries.map(([k], idx) => `${k} = $${idx + 2}`)
      const values = [id, ...entries.map(([, v]) => v)]
      const { rows } = await pool.query(
        `UPDATE songs SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
        values
      )
      return rows[0] || null
    },

    async backfillMissingSongMetadata() {
      const { rows } = await pool.query(
        `SELECT id, title, artist, album, genre, mood, language, tags
         FROM songs
         WHERE status = 'READY'`
      )
      let updatedCount = 0
      for (const row of rows) {
        const needsBackfill = !row.genre || !row.mood || !row.language || !row.album ||
          !Array.isArray(row.tags) || row.tags.length === 0 || isRecordLabelChannel(row.artist)
        if (!needsBackfill) continue

        const inferred = inferSongMetadata({
          title: row.title,
          artist: row.artist,
          album: row.album,
          genre: row.genre,
          mood: row.mood,
          language: row.language,
          rawTags: row.tags || [],
        })
        await pool.query(
          `UPDATE songs
           SET artist = $2, genre = $3, mood = $4, language = $5, album = $6, tags = $7
           WHERE id = $1`,
          [row.id, inferred.artist || row.artist, inferred.genre, inferred.mood, inferred.language, inferred.album, inferred.tags]
        )
        updatedCount += 1
      }
      return updatedCount
    },

    async deleteSong(id) {
      const { rows } = await pool.query('DELETE FROM songs WHERE id = $1 RETURNING *', [id])
      return rows[0] || null
    },

    async incrementPlayCount(id) {
      const { rows } = await pool.query(
        `UPDATE songs
         SET play_count = play_count + 1, last_played_at = NOW()
         WHERE id = $1 AND status = 'READY'
         RETURNING id, play_count, last_played_at`,
        [id]
      )
      return rows[0] || null
    },

    async listPlaylists() {
      const { rows } = await pool.query(
        `SELECT p.*,
                COUNT(s.id)::int AS song_count,
                COALESCE(
                  (SELECT ARRAY_AGG(sub.thumbnail_url)
                   FROM (
                     SELECT s2.thumbnail_url
                     FROM playlist_songs ps2
                     JOIN songs s2 ON s2.id = ps2.song_id
                     WHERE ps2.playlist_id = p.id
                       AND s2.status = 'READY'
                       AND s2.thumbnail_url IS NOT NULL
                     ORDER BY ps2.position ASC
                     LIMIT 4
                   ) sub),
                  '{}'
                ) AS cover_thumbnails
         FROM playlists p
         LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
         LEFT JOIN songs s ON s.id = ps.song_id AND s.status = 'READY'
         GROUP BY p.id
         ORDER BY p.created_at DESC`
      )
      return rows
    },

    async getPlaylistDetail(id) {
      const { rows: playlistRows } = await pool.query('SELECT * FROM playlists WHERE id = $1', [id])
      const playlist = playlistRows[0]
      if (!playlist) return null

      const { rows: songRows } = await pool.query(
        `SELECT s.id, s.source_type, s.youtube_id, s.title, s.artist, s.duration_seconds,
                s.genre, s.mood, s.language, s.album, s.tags,
                s.audio_url, s.thumbnail_url, s.status, s.play_count, s.last_played_at, s.created_at,
                ps.position AS playlist_position
         FROM playlist_songs ps
         JOIN songs s ON s.id = ps.song_id
         WHERE ps.playlist_id = $1 AND s.status = 'READY'
         ORDER BY ps.position ASC, s.created_at DESC`,
        [id]
      )
      return { playlist, songs: songRows }
    },

    async createPlaylist({ name, description = '', cover_color = '#0096FF', cover_image = null }) {
      const { rows } = await pool.query(
        `INSERT INTO playlists (name, description, cover_color, cover_image)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, description, cover_color, cover_image]
      )
      return rows[0]
    },

    async updatePlaylist(id, patch) {
      const allowed = ['name', 'description', 'cover_color', 'cover_image']
      const entries = Object.entries(patch).filter(([k, v]) => allowed.includes(k) && v !== undefined)
      if (entries.length === 0) {
        const { rows } = await pool.query('SELECT * FROM playlists WHERE id = $1', [id])
        return rows[0] || null
      }
      const sets = entries.map(([k], idx) => `${k} = $${idx + 2}`)
      const values = [id, ...entries.map(([, v]) => v)]
      const { rows } = await pool.query(
        `UPDATE playlists SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
        values
      )
      return rows[0] || null
    },

    async deletePlaylist(id) {
      const { rows } = await pool.query('DELETE FROM playlists WHERE id = $1 RETURNING *', [id])
      return rows[0] || null
    },

    async addSongToPlaylist(playlistId, songId) {
      const { rows: maxRows } = await pool.query(
        'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM playlist_songs WHERE playlist_id = $1',
        [playlistId]
      )
      const nextPos = maxRows[0]?.next_pos ?? 0
      await pool.query(
        `INSERT INTO playlist_songs (playlist_id, song_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (playlist_id, song_id) DO NOTHING`,
        [playlistId, songId, nextPos]
      )
    },

    async removeSongFromPlaylist(playlistId, songId) {
      await pool.query(
        'DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2',
        [playlistId, songId]
      )
    },

    async getLatestRelease() {
      const { rows } = await pool.query('SELECT * FROM app_releases WHERE id = 1')
      return rows[0] || null
    },

    async upsertRelease({ version_code, version_name, download_url, release_notes = '', force_update = false }) {
      const { rows } = await pool.query(
        `INSERT INTO app_releases (id, version_code, version_name, download_url, release_notes, force_update, updated_at)
         VALUES (1, $1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO UPDATE SET
           version_code = EXCLUDED.version_code,
           version_name = EXCLUDED.version_name,
           download_url = EXCLUDED.download_url,
           release_notes = EXCLUDED.release_notes,
           force_update = EXCLUDED.force_update,
           updated_at = NOW()
         RETURNING *`,
        [version_code, version_name, download_url, release_notes, Boolean(force_update)]
      )
      return rows[0]
    },
  }
}
