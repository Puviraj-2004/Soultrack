const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
])

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/

/**
 * Validates a YouTube URL and extracts its 11-character video ID.
 * Returns null if the input is not a valid YouTube video URL.
 */
export function extractYoutubeId(rawUrl) {
  if (typeof rawUrl !== 'string') return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  let url
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase()
  if (!ALLOWED_HOSTS.has(host)) return null

  let candidate = null
  if (host === 'youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] || null
  } else {
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments[0] === 'watch' || segments.length === 0) {
      candidate = url.searchParams.get('v')
    } else if (segments[0] === 'shorts' || segments[0] === 'embed' || segments[0] === 'live') {
      candidate = segments[1] || null
    }
  }

  return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null
}

export function canonicalYoutubeUrl(youtubeId) {
  if (!VIDEO_ID_PATTERN.test(youtubeId || '')) {
    throw new Error('Invalid YouTube video ID')
  }
  return `https://www.youtube.com/watch?v=${youtubeId}`
}
