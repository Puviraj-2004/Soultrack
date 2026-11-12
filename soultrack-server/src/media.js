import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function cleanExecError(err, fallback) {
  const detail = (err?.stderr || err?.message || '').toString().trim()
  if (!detail) return fallback
  const lines = detail.split(/\r?\n/).filter(Boolean)
  return lines[lines.length - 1].slice(0, 300)
}

export function createMediaTools(config) {
  async function runBin(bin, args, timeoutMs = 120_000) {
    return execFileAsync(bin, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 })
  }

  return {
    async fetchYoutubeInfo(canonicalUrl) {
      try {
        const { stdout } = await runBin(config.ytDlpBin, [
          '--dump-single-json',
          '--no-playlist',
          '--no-warnings',
          canonicalUrl,
        ], 45_000)
        const info = JSON.parse(stdout)
        const ytmArtists = Array.isArray(info.artists) && info.artists.length
          ? info.artists.filter(Boolean).join(', ')
          : ''
        return {
          title: (info.track || info.title || 'Untitled Track').trim().slice(0, 200),
          artist: (ytmArtists || info.artist || info.creator || info.uploader || info.channel || 'Unknown Artist').trim().slice(0, 200),
          durationSeconds: Math.max(0, Math.round(Number(info.duration) || 0)),
          thumbnailUrl: info.thumbnail || null,
          album: (info.album || '').trim().slice(0, 140),
          genre: (Array.isArray(info.categories) ? info.categories[0] : info.genre || '').trim().slice(0, 80),
          releaseYear: String(info.release_year || '').trim().slice(0, 10),
          description: (info.description || '').trim().slice(0, 2500),
          rawTags: [
            ...(Array.isArray(info.tags) ? info.tags : []),
            ...(Array.isArray(info.categories) ? info.categories : []),
          ],
        }
      } catch (err) {
        throw new Error(`yt-dlp metadata failed: ${cleanExecError(err, 'Could not fetch video info')}`)
      }
    },

    async downloadYoutubeAudio(canonicalUrl, outDir) {
      const template = path.join(outDir, 'source.%(ext)s')
      try {
        await runBin(config.ytDlpBin, [
          '-f', 'bestaudio/best',
          '--no-playlist',
          '--no-warnings',
          '-o', template,
          canonicalUrl,
        ], 180_000)
      } catch (err) {
        throw new Error(`yt-dlp download failed: ${cleanExecError(err, 'Could not download audio stream')}`)
      }

      const entries = await fs.readdir(outDir)
      const audioName = entries.find(name => name.startsWith('source.') && !name.endsWith('.part'))
      if (!audioName) throw new Error('yt-dlp finished but produced no audio file.')
      return path.join(outDir, audioName)
    },

    async transcodeFaststartM4a(inputPath, outputPath) {
      try {
        await runBin(config.ffmpegBin, [
          '-y',
          '-i', inputPath,
          '-vn',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          outputPath,
        ], 180_000)
      } catch (err) {
        throw new Error(`ffmpeg transcode failed: ${cleanExecError(err, 'Audio conversion failed')}`)
      }
    },

    async probeDurationSeconds(filePath) {
      const meta = await this.probeAudioMetadata(filePath)
      return meta.durationSeconds
    },

    async probeAudioMetadata(filePath) {
      try {
        const { stdout } = await runBin(config.ffprobeBin, [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          filePath,
        ], 15_000)
        const parsed = JSON.parse(stdout || '{}')
        const fmt = parsed.format || {}
        const tags = fmt.tags || {}
        const pickTag = (...keys) => {
          for (const k of keys) {
            const match = tags[k] ?? tags[k.toUpperCase()] ?? tags[k.toLowerCase()]
            if (match && String(match).trim()) return String(match).trim()
          }
          return ''
        }
        return {
          durationSeconds: Math.max(0, Math.round(Number.parseFloat(fmt.duration) || 0)),
          title: pickTag('title', 'TITLE'),
          artist: pickTag('artist', 'album_artist', 'ARTIST', 'composer'),
          album: pickTag('album', 'ALBUM'),
          genre: pickTag('genre', 'GENRE'),
          language: pickTag('language', 'LANGUAGE'),
        }
      } catch {
        return { durationSeconds: 0, title: '', artist: '', album: '', genre: '', language: '' }
      }
    },

    async downloadImageFile(imageUrl, outDir) {
      if (!imageUrl) return null
      try {
        const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) })
        if (!res.ok) return null
        const contentType = res.headers.get('content-type') || 'image/jpeg'
        if (!contentType.startsWith('image/')) return null
        const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
        const filePath = path.join(outDir, `cover.${ext}`)
        const buf = Buffer.from(await res.arrayBuffer())
        if (!buf.length) return null
        await fs.writeFile(filePath, buf)
        return { filePath, contentType, ext }
      } catch {
        return null
      }
    },

    async lookupItunesMetadata(query) {
      if (!query?.trim()) return null
      try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query.trim())}&entity=song&limit=1`
        const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })
        if (!res.ok) return null
        const json = await res.json()
        const match = json?.results?.[0]
        if (!match) return null
        return {
          title: match.trackName || null,
          artist: match.artistName || null,
          album: match.collectionName || null,
          genre: match.primaryGenreName || null,
          releaseDate: match.releaseDate || null,
          artworkUrl: match.artworkUrl100 ? match.artworkUrl100.replace('100x100', '600x600') : null,
        }
      } catch {
        return null
      }
    },

    async extractAiMetadata({ title = '', artist = '', cleanQuery = '', description = '' } = {}) {
      if (!config.geminiApiKey) return null
      try {
        const prompt = [
          'Extract clean music metadata as JSON with keys: title, artist, album, genre, mood, language, tags.',
          'Rules:',
          '- title: clean song title only (remove video spam like Official Video, Lyrical Video, 4K, movie/actor names). Keep mix style like (Lofi) or (Remix) if applicable.',
          '- artist: comma-separated real composer and/or singers. NEVER use YouTube channel or record label names like Universal Music, Sony Music, Think Music, Sun TV.',
          '- album: movie or album name only, or empty string.',
          '- genre: pick ONE from [Melody, Mass, Lofi, Remix, Instrumental, Acoustic, Hip-Hop, Devotional, Classical, Pop].',
          '- mood: pick ONE from [Romantic, Chill, Emotional, Energetic, Party, Focus, Feel Good, Devotional].',
          '- language: pick ONE from [Tamil, Hindi, Telugu, Malayalam, English, Instrumental].',
          '- tags: array of 3-7 short lowercase search tags (era like 90s/2020s, vibe, theme).',
          `Raw title: ${title}`,
          `Clean query: ${cleanQuery}`,
          `Channel/uploader: ${artist}`,
          `Description excerpt: ${String(description || '').slice(0, 1200)}`,
        ].join('\n')

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
          signal: AbortSignal.timeout(7_000),
        })
        if (!res.ok) return null
        const json = await res.json()
        const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text
        if (!rawText) return null
        const parsed = JSON.parse(rawText)
        return parsed && typeof parsed === 'object' ? parsed : null
      } catch {
        return null
      }
    },
  }
}
