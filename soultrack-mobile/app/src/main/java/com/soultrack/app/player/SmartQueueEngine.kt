package com.soultrack.app.player

import com.soultrack.app.data.SongDto
import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

internal enum class MusicStyleGroup(val keywords: Set<String>) {
    CHILL_LOFI(setOf("lofi", "slowed", "reverb", "chill", "ambient", "study", "sleep", "rain", "night", "dreamy", "relax")),
    REMIX_CLUB(setOf("remix", "mashup", "mix", "dj", "club", "edm", "house", "techno", "trance", "dubstep", "bass", "boosted", "phonk")),
    ACOUSTIC_LIVE(setOf("acoustic", "unplugged", "live", "session", "concert", "cover", "piano", "guitar", "violin", "flute")),
    INSTRUMENTAL_BGM(setOf("instrumental", "bgm", "theme", "ost", "score", "soundtrack", "karaoke", "beat", "beats", "synth")),
    ROMANTIC_MELODY(setOf("love", "romantic", "melody", "heart", "kadhal", "ishq", "pyaar", "mohabbat", "soul", "valentine", "vellake")),
    SAD_EMOTIONAL(setOf("sad", "pain", "broken", "alone", "tears", "cry", "hurt", "lonely", "heartbreak")),
    MASS_ENERGETIC(setOf("mass", "kuthu", "party", "dance", "workout", "gym", "hype", "trap", "rap", "hiphop", "swag", "fire", "rage")),
    DEVOTIONAL_CLASSICAL(setOf("devotional", "bhakti", "mantra", "sloka", "classical", "carnatic", "sufi", "qawwali", "prayer")),
    RETRO_CLASSIC(setOf("retro", "classic", "90s", "80s", "evergreen", "golden", "vintage"))
}

internal data class SongProfile(
    val song: SongDto,
    val primaryArtist: String,
    val artists: Set<String>,
    val styles: Set<MusicStyleGroup>,
    val titleKeywords: Set<String>,
    val genre: String,
    val mood: String,
    val language: String,
    val album: String,
    val normalizedTags: Set<String>
)

internal data class ManagedQueueState(
    val songs: List<SongDto> = emptyList(),
    val currentIndex: Int = -1,
    val priorityEndIndex: Int = -1
) {
    val priorityCount: Int
        get() = if (currentIndex >= 0 && priorityEndIndex > currentIndex) {
            (priorityEndIndex - currentIndex).coerceAtMost(songs.lastIndex - currentIndex).coerceAtLeast(0)
        } else 0
}

/**
 * Builds YouTube Music / Spotify style related-song mixes and manages ordered user priority queues
 * (`Play Next` and `Add to Queue`) cleanly without hidden player shuffle desync.
 */
internal object SmartQueueEngine {
    private val artistSplitRegex = Regex("""(?i)\s*(?:,|&|/|;|\+|\||×|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bwith\b|\bx\b)\s*""")
    private val titleFeatRegex = Regex("""(?i)(?:\(|\[|\b)(?:ft\.?|feat\.?|featuring)\s+([^)\]|-]+)""")
    private val noiseArtistWords = Regex("""(?i)\b(topic|official|music|vevo|records|channel|audio)\b""")
    private val nonWordRegex = Regex("""[^\p{L}\p{N}]+""")
    private val unknownArtistLabels = setOf("", "unknown", "unknown artist", "various", "various artists")
    private val titleStopwords = setOf(
        "the", "and", "for", "with", "from", "this", "that", "your", "song", "songs",
        "full", "video", "audio", "official", "lyric", "lyrics", "lyrical", "music",
        "version", "edit", "track", "hd", "uhd", "4k", "hq", "feat", "ft", "featuring"
    )

    fun extractProfile(song: SongDto): SongProfile {
        val rawArtists = mutableListOf(song.artist)
        titleFeatRegex.findAll(song.title).forEach { match ->
            match.groupValues.getOrNull(1)?.let { rawArtists.add(it) }
        }

        val normalizedArtists = rawArtists
            .flatMap { segment -> segment.split(artistSplitRegex) }
            .map { cleanArtistToken(it) }
            .filter { it !in unknownArtistLabels && it.length >= 2 }
            .toCollection(LinkedHashSet())

        val primaryArtist = normalizedArtists.firstOrNull() ?: cleanArtistToken(song.artist)
        val combinedMetaText = "${song.title} ${song.artist} ${song.genre} ${song.mood} ${song.tags.joinToString(" ")}"
        val tokens = tokenizeTitleAndArtist(combinedMetaText)
        val styles = detectStyles(tokens)
        val titleTokens = tokenizeTitleAndArtist(song.title)
            .filterTo(LinkedHashSet()) { it.length >= 3 && it !in titleStopwords }

        return SongProfile(
            song = song,
            primaryArtist = primaryArtist,
            artists = normalizedArtists,
            styles = styles,
            titleKeywords = titleTokens,
            genre = song.genre.trim().lowercase(),
            mood = song.mood.trim().lowercase(),
            language = song.language.trim().lowercase(),
            album = song.album.trim().lowercase(),
            normalizedTags = song.tags.map { it.trim().lowercase() }.filter { it.length >= 2 }.toSet()
        )
    }

    private fun cleanArtistToken(raw: String): String {
        return raw.lowercase()
            .replace(noiseArtistWords, " ")
            .replace(nonWordRegex, " ")
            .trim()
            .replace(Regex("""\s+"""), " ")
    }

    private fun tokenizeTitleAndArtist(text: String): List<String> {
        val lowered = text.lowercase()
            .replace("lo-fi", "lofi")
            .replace("hip-hop", "hiphop")
        return lowered.split(nonWordRegex).filter { it.isNotBlank() }
    }

    private fun detectStyles(tokens: List<String>): Set<MusicStyleGroup> {
        if (tokens.isEmpty()) return emptySet()
        val tokenSet = tokens.toSet()
        return MusicStyleGroup.entries.filterTo(LinkedHashSet()) { group ->
            group.keywords.any { it in tokenSet }
        }
    }

    /**
     * Scores how closely [candidate] relates to [seed] across author/artist, structured real metadata
     * (`genre`, `mood`, `language`, `album`, `tags`), title style/keywords, duration, and popularity.
     * Deliberately ignores playlist membership so Home playback creates independent mixes.
     */
    fun scoreSimilarity(seed: SongProfile, candidate: SongProfile): Double {
        if (seed.song.id == candidate.song.id) return 0.0
        var score = 0.0

        // 1. Author / Artist affinity (strongest signal)
        if (seed.primaryArtist.isNotEmpty() &&
            seed.primaryArtist !in unknownArtistLabels &&
            seed.primaryArtist == candidate.primaryArtist
        ) {
            score += 80.0
        } else if (seed.artists.isNotEmpty() && seed.artists.any { it in candidate.artists }) {
            score += 58.0
        } else if (sharesArtistSurnameOrAlias(seed.artists, candidate.artists)) {
            score += 44.0
        }

        // 2. Real Music Metadata signals (genre, mood, language, album, tags)
        if (seed.genre.isNotEmpty() && seed.genre == candidate.genre) {
            score += 48.0
        }
        if (seed.mood.isNotEmpty() && seed.mood == candidate.mood) {
            score += 36.0
        }
        if (seed.language.isNotEmpty() && seed.language == candidate.language) {
            score += 24.0
        }
        if (seed.album.isNotEmpty() && seed.album == candidate.album) {
            score += 22.0
        }
        val sharedTags = seed.normalizedTags.intersect(candidate.normalizedTags).size
        if (sharedTags > 0) {
            score += (sharedTags * 12.0).coerceAtMost(30.0)
        }

        // 3. Fallback style group & title/movie keywords
        val sharedStyles = seed.styles.intersect(candidate.styles).size
        if (sharedStyles > 0) {
            score += 28.0 + ((sharedStyles - 1) * 12.0).coerceAtMost(24.0)
        }
        val sharedKeywords = seed.titleKeywords.intersect(candidate.titleKeywords).size
        if (sharedKeywords > 0) {
            score += (sharedKeywords * 14.0).coerceAtMost(28.0)
        }

        // 4. Track format & duration vibe similarity
        val d1 = seed.song.durationSeconds
        val d2 = candidate.song.durationSeconds
        if (d1 > 0 && d2 > 0) {
            val ratio = min(d1, d2).toDouble() / max(d1, d2).toDouble()
            if (ratio >= 0.68 || durationBucket(d1) == durationBucket(d2)) {
                score += 10.0
            }
        }
        if (seed.song.sourceType.equals(candidate.song.sourceType, ignoreCase = true)) {
            score += 4.0
        }

        // 5. Gentle popularity preference
        score += candidate.song.playCount.coerceIn(0, 6).toDouble()
        return score
    }

    private fun durationBucket(durationSec: Int): Int = when {
        durationSec < 150 -> 0 // Short / BGM / intro
        durationSec <= 330 -> 1 // Standard song
        else -> 2 // Extended / mashup / mix
    }

    /**
     * Places [seed] at index 0 and orders all remaining playable songs from [pool] as a dynamic,
     * weighted-randomized mix favoring related artists, music styles, and smooth transitions while
     * breaking up repetitive back-to-back artist streaks.
     */
    fun buildRelatedQueue(
        seed: SongDto,
        pool: List<SongDto>,
        random: Random = Random.Default
    ): List<SongDto> {
        val validOthers = pool
            .asSequence()
            .filter { it.audioUrl.isNotBlank() && it.id != seed.id }
            .distinctBy { it.id }
            .toList()
        if (seed.audioUrl.isBlank() && validOthers.isEmpty()) return emptyList()
        if (seed.audioUrl.isBlank()) return validOthers
        if (validOthers.isEmpty()) return listOf(seed)

        return listOf(seed) + rankRelatedCandidates(seed, validOthers, random)
    }

    private fun sharesArtistSurnameOrAlias(a: Set<String>, b: Set<String>): Boolean {
        if (a.isEmpty() || b.isEmpty()) return false
        val wordsA = a.flatMap { it.split(' ') }.filter { it.length >= 4 }.toSet()
        val wordsB = b.flatMap { it.split(' ') }.filter { it.length >= 4 }.toSet()
        return wordsA.any { it in wordsB }
    }

    private fun rankRelatedCandidates(
        seed: SongDto,
        validCandidates: List<SongDto>,
        random: Random
    ): List<SongDto> {
        if (validCandidates.isEmpty()) return emptyList()
        val seedProfile = extractProfile(seed)
        val remaining = validCandidates.map(::extractProfile).toMutableList()
        val ordered = ArrayList<SongDto>(validCandidates.size)

        var prevProfile = seedProfile
        var prevPrevArtist: String? = null
        val total = remaining.size

        for (step in 0 until total) {
            val progress = step.toDouble() / max(total, 1).toDouble()
            val seedWeight = 1.0 - (0.35 * progress)

            var bestIdx = 0
            var bestScore = Double.NEGATIVE_INFINITY

            for (i in remaining.indices) {
                val cand = remaining[i]
                val seedAffinity = scoreSimilarity(seedProfile, cand)
                val transitionAffinity = scoreSimilarity(prevProfile, cand)
                val streakPenalty = artistStreakPenalty(
                    candidate = cand,
                    prev = prevProfile,
                    prevPrevArtist = prevPrevArtist
                )
                val jitter = random.nextDouble(0.0, 26.0)
                val totalScore = (seedWeight * seedAffinity) +
                    (0.30 * transitionAffinity) -
                    streakPenalty +
                    jitter

                if (totalScore > bestScore) {
                    bestScore = totalScore
                    bestIdx = i
                }
            }

            val chosen = remaining.removeAt(bestIdx)
            ordered.add(chosen.song)
            prevPrevArtist = prevProfile.primaryArtist.takeIf { it !in unknownArtistLabels }
            prevProfile = chosen
        }

        return ordered
    }

    private fun artistStreakPenalty(
        candidate: SongProfile,
        prev: SongProfile,
        prevPrevArtist: String?
    ): Double {
        val candArtist = candidate.primaryArtist
        if (candArtist in unknownArtistLabels) return 0.0
        val sameAsPrev = candArtist == prev.primaryArtist
        val sameAsPrevPrev = candArtist == prevPrevArtist
        return when {
            sameAsPrev && sameAsPrevPrev -> 48.0
            sameAsPrev -> 16.0
            else -> 0.0
        }
    }

    /**
     * Rotates [playlist] so [seed] starts at index 0 and all subsequent/earlier tracks remain playable
     * in playlist order (`hasNext` stays active even when tapping the last song in a playlist).
     */
    fun rotateFromSong(seed: SongDto, playlist: List<SongDto>): List<SongDto> {
        val valid = playlist.filter { it.audioUrl.isNotBlank() }.distinctBy { it.id }
        if (valid.isEmpty()) return if (seed.audioUrl.isNotBlank()) listOf(seed) else emptyList()
        val idx = valid.indexOfFirst { it.id == seed.id }
        if (idx < 0) return listOf(seed) + valid
        if (idx == 0) return valid
        return valid.subList(idx, valid.size) + valid.subList(0, idx)
    }

    /**
     * Builds a fresh shuffled queue starting from a randomly picked seed song in [pool].
     */
    fun buildShuffledQueue(pool: List<SongDto>, random: Random = Random.Default): List<SongDto> {
        val valid = pool.filter { it.audioUrl.isNotBlank() }.distinctBy { it.id }
        if (valid.isEmpty()) return emptyList()
        val seed = valid[random.nextInt(valid.size)]
        return buildRelatedQueue(seed, valid, random)
    }

    /**
     * Inserts [song] immediately after the currently playing song (`currentIndex + 1`) and expands
     * the priority queue boundary cleanly.
     */
    fun insertPlayNext(state: ManagedQueueState, song: SongDto): Pair<ManagedQueueState, Int> {
        if (state.songs.isEmpty()) {
            return ManagedQueueState(songs = listOf(song), currentIndex = 0, priorityEndIndex = 0) to 0
        }
        val safeCurrent = state.currentIndex.coerceIn(0, state.songs.lastIndex)
        val insertIndex = (safeCurrent + 1).coerceIn(0, state.songs.size)
        val updatedSongs = state.songs.toMutableList().apply { add(insertIndex, song) }
        val newPriorityEnd = (max(state.priorityEndIndex, safeCurrent) + 1).coerceAtMost(updatedSongs.lastIndex)
        return state.copy(
            songs = updatedSongs,
            currentIndex = safeCurrent,
            priorityEndIndex = newPriorityEnd
        ) to insertIndex
    }

    /**
     * Appends [song] to the end of the user's Up-Next priority window (ahead of auto-mix / playlist
     * tail tracks) so queued tracks play right after any earlier `Play Next` / `Add to Queue` picks.
     */
    fun enqueueToUserQueue(state: ManagedQueueState, song: SongDto): Pair<ManagedQueueState, Int> {
        if (state.songs.isEmpty()) {
            return ManagedQueueState(songs = listOf(song), currentIndex = 0, priorityEndIndex = 0) to 0
        }
        val safeCurrent = state.currentIndex.coerceIn(0, state.songs.lastIndex)
        val safeBaseEnd = max(state.priorityEndIndex, safeCurrent).coerceIn(safeCurrent, state.songs.lastIndex)
        val insertIndex = (safeBaseEnd + 1).coerceIn(0, state.songs.size)
        val updatedSongs = state.songs.toMutableList().apply { add(insertIndex, song) }
        return state.copy(
            songs = updatedSongs,
            currentIndex = safeCurrent,
            priorityEndIndex = insertIndex
        ) to insertIndex
    }

    fun syncCurrentIndex(state: ManagedQueueState, newCurrentIndex: Int): ManagedQueueState {
        if (state.songs.isEmpty()) return ManagedQueueState()
        val safeCurrent = newCurrentIndex.coerceIn(0, state.songs.lastIndex)
        val newPriorityEnd = max(state.priorityEndIndex, safeCurrent).coerceAtMost(state.songs.lastIndex)
        return state.copy(currentIndex = safeCurrent, priorityEndIndex = newPriorityEnd)
    }

    fun removeAt(state: ManagedQueueState, removeIndex: Int): ManagedQueueState? {
        if (removeIndex !in state.songs.indices || removeIndex == state.currentIndex) return null
        val updatedSongs = state.songs.toMutableList().apply { removeAt(removeIndex) }
        val adjustedCurrent = if (removeIndex < state.currentIndex) state.currentIndex - 1 else state.currentIndex
        val adjustedPriorityEnd = when {
            state.priorityEndIndex < 0 -> adjustedCurrent
            removeIndex <= state.priorityEndIndex -> (state.priorityEndIndex - 1).coerceAtLeast(adjustedCurrent)
            else -> state.priorityEndIndex
        }.coerceIn(adjustedCurrent, updatedSongs.lastIndex.coerceAtLeast(0))

        return ManagedQueueState(
            songs = updatedSongs,
            currentIndex = adjustedCurrent,
            priorityEndIndex = adjustedPriorityEnd
        )
    }

    /**
     * Returns only the newly mixed upcoming tracks after [lockedEnd] (`max(currentIndex, priorityEndIndex)`)
     * so callers can swap ExoPlayer's tail seamlessly without interrupting the active track or
     * erasing `Play Next` / `Add to Queue` selections.
     */
    fun reshuffleTail(
        state: ManagedQueueState,
        random: Random = Random.Default
    ): Pair<ManagedQueueState, List<SongDto>>? {
        if (state.songs.isEmpty() || state.currentIndex !in state.songs.indices) return null
        val lockedEnd = max(state.priorityEndIndex, state.currentIndex).coerceIn(0, state.songs.lastIndex)
        if (lockedEnd >= state.songs.lastIndex) return null

        val seed = state.songs[state.currentIndex]
        val tail = state.songs.subList(lockedEnd + 1, state.songs.size)
            .filter { it.audioUrl.isNotBlank() && it.id != seed.id }
            .distinctBy { it.id }
        val mixedTail = rankRelatedCandidates(seed, tail, random)
        val newSongs = state.songs.subList(0, lockedEnd + 1) + mixedTail
        return state.copy(songs = newSongs) to mixedTail
    }
}
