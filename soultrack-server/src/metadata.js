const GENRE_RULES = [
  { label: 'Lofi', patterns: ['lofi', 'lo-fi', 'slowed', 'reverb', 'chillhop'] },
  { label: 'Remix', patterns: ['remix', 'mashup', 'dj mix', 'dj', 'bass boosted', 'phonk', 'club mix'] },
  { label: 'Instrumental', patterns: ['instrumental', 'bgm', 'ost', 'soundtrack', 'theme music', 'karaoke', 'score'] },
  { label: 'Acoustic', patterns: ['acoustic', 'unplugged', 'live session', 'piano cover', 'guitar cover'] },
  { label: 'Hip-Hop', patterns: ['hip hop', 'hip-hop', 'rap', 'trap', 'freestyle', 'cypher'] },
  { label: 'Mass', patterns: ['mass', 'kuthu', 'item song', 'folk beat', 'dappankuthu'] },
  { label: 'Devotional', patterns: ['devotional', 'bhakti', 'mantra', 'sloka', 'kirtan', 'qawwali', 'sufi'] },
  { label: 'Classical', patterns: ['classical', 'carnatic', 'hindustani', 'raga', 'symphony'] },
  { label: 'Melody', patterns: ['melody', 'romantic', 'love song', 'kadhal', 'ishq', 'pyaar', 'duet'] },
  { label: 'Pop', patterns: ['pop', 'synthpop', 'indie', 'dance pop', 'edm'] },
]

const MOOD_RULES = [
  { label: 'Chill', patterns: ['lofi', 'lo-fi', 'slowed', 'reverb', 'chill', 'ambient', 'rain', 'sleep', 'night', 'study', 'relax', 'calm'] },
  { label: 'Romantic', patterns: ['love', 'romantic', 'melody', 'heart', 'kadhal', 'ishq', 'pyaar', 'mohabbat', 'valentine', 'soulful'] },
  { label: 'Emotional', patterns: ['sad', 'pain', 'broken', 'alone', 'tears', 'cry', 'miss you', 'heartbreak', 'emotional', 'lonely'] },
  { label: 'Energetic', patterns: ['mass', 'kuthu', 'workout', 'gym', 'hype', 'trap', 'rap', 'phonk', 'fire', 'rage', 'energetic', 'beast'] },
  { label: 'Party', patterns: ['party', 'dance', 'club', 'dj', 'remix', 'mashup', 'edm', 'festival'] },
  { label: 'Focus', patterns: ['instrumental', 'bgm', 'theme', 'score', 'piano', 'focus', 'coding', 'lofi'] },
  { label: 'Devotional', patterns: ['devotional', 'bhakti', 'mantra', 'sloka', 'prayer', 'god', 'sufi'] },
]

const LANGUAGE_PATTERNS = [
  {
    label: 'Tamil',
    regex: /[\u0B80-\u0BFF]|\b(tamil|kollywood|kuthu|kadhal|uyire|mazhai|nanba|thala|thalapathy|vijay|ajith|suriya|rajini|rajinikanth|kamal haasan|sarathkumar|dhanush|sivakarthikeyan|karthi|vikram|simbu|natpukkaga|vidaamuyarchi|jailer|anirudh|yuvan|ilaiyaraaja|a\.?r\.?\s*rahman|harris jayaraj|gv prakash|g\.?\s*v\.?\s*prakash|santhosh narayanan|hiphop tamizha|vidyasagar|deva|sirpy|sa rajkumar|s\.?\s*a\.?\s*rajkumar|imman|spb|s\.?\s*p\.?\s*balasubrahmanyam|janaki|chitra|swarnalatha|harish raghavendra|yesudas)\b/i,
  },
  {
    label: 'Hindi',
    regex: /[\u0900-\u097F]|\b(hindi|bollywood|ishq|pyaar|mohabbat|arijit|pritam|shreya ghoshal|atif aslam|jubin|vishal dadlani|shankar ehsaan loy|sonu nigam|udit narayan|alka yagnik|kumar sanu|t-series|yrf|zee music)\b/i,
  },
  {
    label: 'Telugu',
    regex: /[\u0C00-\u0C7F]|\b(telugu|tollywood|devi sri prasad|dsp|thaman|mm keeravani|aditya music)\b/i,
  },
  {
    label: 'Malayalam',
    regex: /[\u0D00-\u0D7F]|\b(malayalam|mollywood|muzik247|sushin shyam|vineeth sreenivasan)\b/i,
  },
  {
    label: 'English',
    regex: /\b(english|vevo|billboard)\b/i,
  },
]

const RECORD_LABEL_PATTERNS = [
  /\buniversal music/i,
  /\bsony music/i,
  /\bthink music/i,
  /\baditya music/i,
  /\blahari music/i,
  /\bt-?series\b/i,
  /\bsaregama\b/i,
  /\bsun tv\b/i,
  /\bzee music/i,
  /\btips official\b/i,
  /\byrf\b/i,
  /\bmuzik\s?247\b/i,
  /\bstar music\b/i,
  /\bjunglee music\b/i,
  /\btimes music\b/i,
  /\beros now\b/i,
  /\bmusic south\b/i,
  /\bmusic india\b/i,
  /\bvevo\b/i,
  /\b-\s*topic\b/i,
  /\bofficial channel\b/i,
  /\bunknown artist\b/i,
]

const KNOWN_ARTIST_REGEX = /\b(a\.?\s*r\.?\s*rahman|anirudh(?:\s+ravichander)?|yuvan(?:\s+shankar\s+raja)?|ilaiyaraaja|harris jayaraj|g\.?\s*v\.?\s*prakash(?:\s+kumar)?|santhosh narayanan|vidyasagar|deva|d\.?\s*imman|hiphop tamizha|s\.?\s*a\.?\s*rajkumar|sa rajkumar|s\.?\s*p\.?\s*balasubrahmanyam|spb|shreya ghoshal|arijit singh|pritam|devi sri prasad|s\.?\s*thaman|sid sriram|pradeep kumar|shakthisree gopalan|chinmayi|s\.?\s*janaki|k\.?\s*s\.?\s*chithra|chitra|swarnalatha|harish raghavendra|karthik|unnikrishnan|sonu nigam|udit narayan|alka yagnik|kumar sanu|vishal mishra|atif aslam|k\.?\s*j\.?\s*yesudas|yesudas|sujatha)\b/i

const VIDEO_NOISE_REGEX = /\b(official\s+(?:music\s+|lyric(?:al)?\s+|video\s+|audio\s+)?(?:video|audio|song|track|teaser|trailer)|lyric(?:al)?\s*(?:video|song)?|full\s+(?:video|audio)\s*(?:song)?|video\s+song|audio\s+song|jukebox|4k|8k|hd|1080p|uhd|hq|with lyrics|lyrics|whatsapp status|status)\b/gi

const GENERIC_ALBUM_REGEX = /^(lyrical|lyric|video|audio|song|songs|official|4k|8k|hd|uhd|full|tamil|hindi|telugu|malayalam|music|soundtrack|theme)$/i

const KEEP_STYLE_PAREN_REGEX = /\b(lofi|lo-fi|slowed|reverb|acoustic|unplugged|remix|mashup|bgm|instrumental|live|cover|version|mix)\b/i

export const STANDARD_GENRES = [
  'Melody',
  'Mass',
  'Lofi',
  'Remix',
  'Instrumental',
  'Acoustic',
  'Hip-Hop',
  'Devotional',
  'Classical',
  'Pop',
]

export const STANDARD_MOODS = [
  'Romantic',
  'Chill',
  'Emotional',
  'Energetic',
  'Party',
  'Focus',
  'Feel Good',
  'Devotional',
]

export const STANDARD_LANGUAGES = [
  'Tamil',
  'Hindi',
  'Telugu',
  'Malayalam',
  'English',
  'Instrumental',
]

function cleanText(value, maxLen = 120) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

export function isRecordLabelChannel(artist) {
  const cleaned = cleanText(artist, 200)
  if (!cleaned) return true
  return RECORD_LABEL_PATTERNS.some(rx => rx.test(cleaned))
}

function stripVideoNoise(segment) {
  return String(segment || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(VIDEO_NOISE_REGEX, ' ')
    .replace(/[-–—:|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanYoutubeDisplayTitle(rawTitle = '') {
  const titleText = cleanText(rawTitle, 220)
  if (!titleText) return ''

  // Preserve meaningful mix/style parentheticals like (Lofi Mix), (Slowed + Reverb), etc.,
  // while stripping "(From ...)" or promo parens like "(Official Video)".
  const firstPipe = titleText.split(/\s*\|\s*/)[0] || titleText
  const cleanedParens = firstPipe
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\(([^)]*)\)/g, (full, inner) => (
      KEEP_STYLE_PAREN_REGEX.test(inner) ? ` (${cleanText(inner, 60)})` : ' '
    ))

  // Split trailing dash noise such as "Meesakaara nanba – Lyrical Video"
  const parts = cleanedParens.split(/\s+[–—-]\s+/)
  const keptParts = []
  for (let i = 0; i < parts.length; i += 1) {
    const part = cleanText(parts[i], 140)
    if (!part) continue
    if (i === 0) {
      keptParts.push(part)
      continue
    }
    const withoutNoise = cleanText(part.replace(VIDEO_NOISE_REGEX, ' '), 120)
    if (withoutNoise && !GENERIC_ALBUM_REGEX.test(withoutNoise) && i === 1 && keptParts[0].length < 40) {
      keptParts.push(withoutNoise)
    } else {
      break
    }
  }

  const candidate = cleanText(keptParts.join(' - ').replace(VIDEO_NOISE_REGEX, ' '), 200)
    .replace(/[-–—:|]+\s*$/, '')
    .trim()

  return candidate || cleanText(stripVideoNoise(firstPipe) || titleText, 200)
}

function extractDescriptionCredits(rawDescription = '') {
  const lines = String(rawDescription || '')
    .slice(0, 2600)
    .split(/[\r\n|]+/)
    .map(l => l.trim())
    .filter(Boolean)

  let composer = ''
  let singers = ''
  let album = ''
  let year = ''
  let fallbackArtist = ''

  for (const line of lines) {
    if (!composer) {
      const m = line.match(/^(?:music(?:\s+(?:by|director))?|composed\s+by|composer)(?:\s*[:\-–]\s*|\s+)(.+)$/i)
      if (m?.[1] && /^(?:music\s+by|composed\s+by|.*[:\-–])/.test(line.toLowerCase())) {
        composer = cleanText(m[1], 100)
      }
    }
    if (!singers) {
      const m = line.match(/^(?:singer(?:s)?|vocals?|sung\s+by)(?:\s*[:\-–]\s*|\s+)(.+)$/i)
      if (m?.[1] && /^(?:sung\s+by|.*[:\-–])/.test(line.toLowerCase())) {
        singers = cleanText(m[1], 120)
      }
    }
    if (!album) {
      const m = line.match(/^(?:movie|film|album)\s*[:\-–]\s*(.+)$/i)
      if (m?.[1]) album = cleanText(m[1], 120)
    }
    if (!fallbackArtist) {
      const m = line.match(/^(?:artist(?:s)?)\s*[:\-–]\s*(.+)$/i)
      if (m?.[1]) fallbackArtist = cleanText(m[1], 140)
    }
    if (!year) {
      const ym = line.match(/(?:year|released?)\s*[:\-–]?\s*((?:19|20)\d{2})\b/i)
      if (ym?.[1]) year = ym[1]
    }
  }

  const combinedArtists = []
  const seen = new Set()
  const addArtistTokens = raw => {
    for (const part of String(raw || '').split(/\s*(?:,|&|\/|;|\band\b)\s*/i)) {
      const token = cleanText(part, 80)
      const lower = token.toLowerCase()
      if (token.length >= 2 && !isRecordLabelChannel(token) && !seen.has(lower)) {
        seen.add(lower)
        combinedArtists.push(token)
      }
    }
  }
  addArtistTokens(composer)
  addArtistTokens(singers)
  if (!combinedArtists.length) addArtistTokens(fallbackArtist)

  return {
    artist: cleanText(combinedArtists.join(', '), 200),
    album: GENERIC_ALBUM_REGEX.test(album) ? '' : album,
    year,
  }
}

export function eraTagFromYear(rawYearOrDate) {
  const match = String(rawYearOrDate || '').match(/\b(19\d{2}|20\d{2})\b/)
  if (!match) return ''
  const year = Number(match[1])
  if (year >= 1980 && year < 1990) return '80s'
  if (year >= 1990 && year < 2000) return '90s'
  if (year >= 2000 && year < 2010) return '2000s'
  if (year >= 2010 && year < 2020) return '2010s'
  if (year >= 2020 && year < 2030) return '2020s'
  return ''
}

export function parseYoutubeTitleMetadata(rawTitle = '', rawArtist = '', description = '') {
  const titleText = cleanText(rawTitle, 220)
  const credits = extractDescriptionCredits(description)
  const descFlat = cleanText(description, 2600)

  let extractedAlbum = credits.album || ''
  const fromMatch = titleText.match(/\(\s*from\s+["'“”]?([^)"'“”]+)["'“”]?\s*\)/i)
  if (fromMatch?.[1]) {
    extractedAlbum = cleanText(fromMatch[1], 120)
  }

  const pipeSegments = titleText
    .split(/\s*\|\s*|\s+[–—-]\s+/)
    .map(stripVideoNoise)
    .filter(s => s.length >= 2)

  const cleanTitle = cleanYoutubeDisplayTitle(titleText)
  const cleanSongQuery = cleanText(
    pipeSegments[0] || cleanTitle || stripVideoNoise(titleText),
    120
  )

  if (!extractedAlbum && pipeSegments.length >= 2) {
    const candidate = pipeSegments.find((seg, idx) =>
      idx > 0 && !GENERIC_ALBUM_REGEX.test(seg) && !KNOWN_ARTIST_REGEX.test(seg)
    )
    if (candidate && candidate.toLowerCase() !== cleanSongQuery.toLowerCase()) {
      extractedAlbum = cleanText(candidate, 120)
    }
  }

  let extractedArtist = cleanText(rawArtist, 200)
  if (isRecordLabelChannel(extractedArtist)) {
    const knownInTitle = titleText.match(KNOWN_ARTIST_REGEX)?.[1]
    const knownInDesc = descFlat.match(KNOWN_ARTIST_REGEX)?.[1]
    if (credits.artist) {
      extractedArtist = credits.artist
    } else if (knownInTitle) {
      extractedArtist = cleanText(knownInTitle, 120)
    } else if (knownInDesc) {
      extractedArtist = cleanText(knownInDesc, 120)
    } else if (pipeSegments.length >= 3) {
      const fallbackCredit = pipeSegments.slice(2).find(seg => !GENERIC_ALBUM_REGEX.test(seg))
      if (fallbackCredit) extractedArtist = cleanText(fallbackCredit, 120)
    }
  }

  return {
    cleanTitle: cleanTitle || titleText,
    cleanSongQuery: cleanSongQuery || titleText,
    artist: extractedArtist,
    album: extractedAlbum,
    year: credits.year,
  }
}

export function normalizeTagsInput(raw) {
  const list = Array.isArray(raw)
    ? raw
    : String(raw || '')
        .split(',')
        .map(s => s.trim())
  const seen = new Set()
  const out = []
  for (const item of list) {
    const cleaned = String(item || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 32)
    if (cleaned.length >= 2 && !seen.has(cleaned)) {
      seen.add(cleaned)
      out.push(cleaned)
    }
    if (out.length >= 12) break
  }
  return out
}

function matchRule(rules, haystack) {
  for (const rule of rules) {
    if (rule.patterns.some(p => haystack.includes(p))) {
      return rule.label
    }
  }
  return ''
}

function detectLanguage(haystack, explicitLanguage) {
  const cleaned = cleanText(explicitLanguage, 60)
  if (cleaned) return cleaned
  for (const entry of LANGUAGE_PATTERNS) {
    if (entry.regex.test(haystack)) {
      return entry.label
    }
  }
  return ''
}

function normalizeKnownGenre(rawGenre, fallbackHaystack) {
  const cleaned = cleanText(rawGenre, 80)
  if (!cleaned) return matchRule(GENRE_RULES, fallbackHaystack)
  const lower = cleaned.toLowerCase()
  const mapped = matchRule(GENRE_RULES, `${lower} ${fallbackHaystack}`)
  if (lower === 'music' || lower === 'entertainment' || lower === 'people & blogs' || lower === 'film & animation' || lower === 'indian' || lower === 'tamil') {
    return mapped || 'Melody'
  }
  return cleaned
}

/**
 * Infers structured music metadata (clean title, artist, genre, mood, language, album, tags) from
 * explicit overrides, yt-dlp/ffprobe/iTunes metadata, and title/description/artist cues.
 */
export function inferSongMetadata({
  title = '',
  artist = '',
  album = '',
  genre = '',
  mood = '',
  language = '',
  description = '',
  releaseYear = '',
  rawTags = [],
} = {}) {
  const parsed = parseYoutubeTitleMetadata(title, artist, description)
  const cleanTitle = cleanText(title, 200)
  const cleanArtist = cleanText(parsed.artist || artist, 200)
  const cleanAlbum = cleanText(album || parsed.album, 140)
  const tagText = Array.isArray(rawTags) ? rawTags.join(' ') : String(rawTags || '')
  const haystack = `${cleanTitle} ${cleanArtist} ${artist} ${cleanAlbum} ${genre} ${mood} ${tagText} ${cleanText(description, 600)}`.toLowerCase()

  const resolvedGenre = cleanText(genre, 80)
    ? normalizeKnownGenre(genre, haystack)
    : (matchRule(GENRE_RULES, haystack) || (cleanAlbum ? 'Melody' : 'Pop'))

  let resolvedMood = cleanText(mood, 80) || matchRule(MOOD_RULES, haystack)
  if (!resolvedMood) {
    resolvedMood = resolvedGenre === 'Lofi' || resolvedGenre === 'Acoustic'
      ? 'Chill'
      : resolvedGenre === 'Mass' || resolvedGenre === 'Remix' || resolvedGenre === 'Hip-Hop'
        ? 'Energetic'
        : resolvedGenre === 'Melody'
          ? 'Romantic'
          : 'Feel Good'
  }

  let resolvedLanguage = detectLanguage(haystack, language)
  if (!resolvedLanguage) {
    if (resolvedGenre === 'Instrumental') {
      resolvedLanguage = 'Instrumental'
    } else if (/^[\x20-\x7E]+$/.test(`${cleanTitle} ${cleanArtist}`) && !/Unknown Artist/i.test(cleanArtist)) {
      resolvedLanguage = 'English'
    }
  }

  const era = eraTagFromYear(releaseYear || parsed.year || title)
  const combinedTags = normalizeTagsInput([
    ...(Array.isArray(rawTags) ? rawTags : normalizeTagsInput(rawTags)),
    resolvedGenre,
    resolvedMood,
    resolvedLanguage,
    cleanAlbum,
    era,
  ])

  return {
    title: parsed.cleanTitle || cleanTitle,
    artist: cleanArtist,
    genre: resolvedGenre,
    mood: resolvedMood,
    language: resolvedLanguage,
    album: cleanAlbum,
    tags: combinedTags,
  }
}

export async function enrichSongWithMetadata({
  title = '',
  artist = '',
  album = '',
  genre = '',
  mood = '',
  language = '',
  description = '',
  releaseYear = '',
  rawTags = [],
  lookupItunes = null,
  extractWithAi = null,
} = {}) {
  const parsed = parseYoutubeTitleMetadata(title, artist, description)
  let itunes = null
  const needsArtist = isRecordLabelChannel(parsed.artist || artist)
  const needsAlbumOrGenre = !album || !parsed.album || !genre

  if (typeof lookupItunes === 'function' && (needsArtist || needsAlbumOrGenre)) {
    const queryParts = [parsed.cleanSongQuery, parsed.album].filter(Boolean)
    try {
      itunes = await lookupItunes(queryParts.join(' '))
      if (!itunes && parsed.album && parsed.cleanSongQuery) {
        itunes = await lookupItunes(parsed.cleanSongQuery)
      }
    } catch {
      itunes = null
    }
  }

  let aiMeta = null
  const stillNeedsHelp = isRecordLabelChannel(itunes?.artist || parsed.artist || artist) ||
    (!album && !itunes?.album && !parsed.album) ||
    !genre ||
    !mood
  if (typeof extractWithAi === 'function' && stillNeedsHelp) {
    try {
      aiMeta = await extractWithAi({
        title,
        artist,
        cleanQuery: parsed.cleanSongQuery,
        description,
      })
    } catch {
      aiMeta = null
    }
  }

  const resolvedArtist = !isRecordLabelChannel(artist)
    ? cleanText(artist, 200)
    : (
        (!isRecordLabelChannel(aiMeta?.artist) && cleanText(aiMeta?.artist, 200)) ||
        (!isRecordLabelChannel(itunes?.artist) && cleanText(itunes?.artist, 200)) ||
        parsed.artist ||
        cleanText(artist, 200)
      )

  const inferred = inferSongMetadata({
    title: cleanText(aiMeta?.title, 200) || title,
    artist: resolvedArtist,
    album: album || cleanText(aiMeta?.album, 140) || itunes?.album || parsed.album || '',
    genre: genre || cleanText(aiMeta?.genre, 80) || itunes?.genre || '',
    mood: mood || cleanText(aiMeta?.mood, 80) || '',
    language: language || cleanText(aiMeta?.language, 60) || '',
    description,
    releaseYear: releaseYear || itunes?.releaseDate || parsed.year || '',
    rawTags: [
      ...(Array.isArray(rawTags) ? rawTags : normalizeTagsInput(rawTags)),
      ...(Array.isArray(aiMeta?.tags) ? aiMeta.tags : normalizeTagsInput(aiMeta?.tags)),
    ],
  })

  return {
    title: cleanText(aiMeta?.title, 200) || parsed.cleanTitle || cleanText(title, 200),
    artist: resolvedArtist || inferred.artist,
    genre: inferred.genre,
    mood: inferred.mood,
    language: inferred.language,
    album: inferred.album,
    tags: inferred.tags,
  }
}
