package com.soultrack.app

import com.soultrack.app.data.AppVersionDto
import com.soultrack.app.data.CatalogCache
import com.soultrack.app.data.CatalogSnapshot
import com.soultrack.app.data.PlaylistDto
import com.soultrack.app.data.ServerPreferences
import com.soultrack.app.data.SongDto
import com.soultrack.app.data.SongsResponse
import com.soultrack.app.data.SoultrackApi
import com.soultrack.app.data.UserLibraryOps
import com.soultrack.app.player.ManagedQueueState
import com.soultrack.app.player.QueueOps
import com.soultrack.app.player.SmartQueueEngine
import com.soultrack.app.ui.ArtworkRatioRegistry
import com.soultrack.app.ui.CatalogProjection
import com.soultrack.app.ui.clampArtworkAspectRatio
import com.soultrack.app.ui.fetchCatalogPair
import com.soultrack.app.ui.formatDurationSec
import com.soultrack.app.ui.formatTimeMs
import com.soultrack.app.ui.theme.AppThemeMode
import com.soultrack.app.update.AppUpdater
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import kotlin.random.Random

class SoultrackUnitTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun normalizeServerUrlHandlesSchemeAndTrailingSlash() {
        assertEquals("https://soultrack.onrender.com", ServerPreferences.normalizeServerUrl("soultrack.onrender.com/"))
        assertEquals("http://10.0.2.2:3000", ServerPreferences.normalizeServerUrl("http://10.0.2.2:3000/"))
    }

    @Test
    fun resolveMediaUrlBuildsAbsoluteUrl() {
        assertEquals(
            "http://10.0.2.2:3000/media/songs/1.m4a",
            SoultrackApi.resolveMediaUrl("http://10.0.2.2:3000", "/media/songs/1.m4a")
        )
        assertEquals(
            "https://cdn.example.com/1.m4a",
            SoultrackApi.resolveMediaUrl("http://10.0.2.2:3000", "https://cdn.example.com/1.m4a")
        )
    }

    @Test
    fun parsesSongsResponseSafely() {
        val payload = """
            {
              "songs": [
                {
                  "id": "abc",
                  "title": "Sample Track",
                  "artist": "Artist",
                  "durationSeconds": 185,
                  "audioUrl": "https://cdn.example.com/a.m4a",
                  "playCount": 3
                }
              ]
            }
        """.trimIndent()
        val parsed = json.decodeFromString<SongsResponse>(payload)
        assertEquals(1, parsed.songs.size)
        assertEquals("Sample Track", parsed.songs[0].title)
        assertEquals("3:05", formatDurationSec(parsed.songs[0].durationSeconds))
    }

    @Test
    fun updateAvailabilityChecksVersionCodeAndUrl() {
        assertTrue(
            AppUpdater.isUpdateAvailable(
                AppVersionDto(versionCode = 2, versionName = "1.0.1", downloadUrl = "https://example.com/app.apk"),
                currentVersionCode = 1,
                requireHttps = true
            )
        )
        assertFalse(
            AppUpdater.isUpdateAvailable(
                AppVersionDto(versionCode = 2, versionName = "1.0.1", downloadUrl = "http://example.com/app.apk"),
                currentVersionCode = 1,
                requireHttps = true
            )
        )
        assertTrue(
            AppUpdater.isUpdateAvailable(
                AppVersionDto(versionCode = 2, versionName = "1.0.1", downloadUrl = "http://10.0.2.2:3000/app.apk"),
                currentVersionCode = 1,
                requireHttps = false
            )
        )
        assertFalse(
            AppUpdater.isUpdateAvailable(
                AppVersionDto(versionCode = 1, versionName = "1.0.0", downloadUrl = "https://example.com/app.apk"),
                currentVersionCode = 1,
                requireHttps = true
            )
        )
        assertEquals("1:05", formatTimeMs(65_000L))
    }

    @Test
    fun catalogSnapshotRoundTripsJsonSafely() {
        val original = CatalogSnapshot(
            songs = listOf(
                SongDto(
                    id = "s-1",
                    title = "Ocean Breeze",
                    artist = "Soultrack",
                    durationSeconds = 210,
                    audioUrl = "https://cdn.example.com/ocean.m4a",
                    playCount = 12
                )
            ),
            playlists = listOf(
                PlaylistDto(
                    id = "p-1",
                    name = "Night Chill",
                    coverColor = "#0096FF",
                    songCount = 1
                )
            ),
            savedAtEpochMs = 1_700_000_000_000L
        )
        val encoded = CatalogCache.encodeSnapshot(original)
        val decoded = CatalogCache.decodeSnapshot(encoded)
        assertEquals(original, decoded)
    }

    @Test
    fun fetchCatalogPairRoutesFailuresToCallerWithoutCrashingScope() = runBlocking {
        var uncaught: Throwable? = null
        var caught: Throwable? = null
        val handler = CoroutineExceptionHandler { _, throwable -> uncaught = throwable }

        val job = CoroutineScope(Job() + handler).launch {
            try {
                fetchCatalogPair(
                    fetchSongs = {
                        delay(10)
                        emptyList()
                    },
                    fetchPlaylists = { throw IOException("timeout") }
                )
            } catch (e: IOException) {
                caught = e
            }
        }
        job.join()

        assertNull("CoroutineExceptionHandler must not fire when caller catches exception", uncaught)
        assertEquals("timeout", caught?.message)
    }

    @Test
    fun queueOperationsMaintainOrderAndCurrentIndex() {
        val s1 = SongDto(id = "1", title = "One", artist = "A", durationSeconds = 100, audioUrl = "https://cdn/1.m4a")
        val s2 = SongDto(id = "2", title = "Two", artist = "B", durationSeconds = 120, audioUrl = "https://cdn/2.m4a")
        val s3 = SongDto(id = "3", title = "Three", artist = "C", durationSeconds = 140, audioUrl = "https://cdn/3.m4a")
        val s4 = SongDto(id = "4", title = "Four", artist = "D", durationSeconds = 160, audioUrl = "https://cdn/4.m4a")

        val (afterInsert, insertIdx) = QueueOps.insertPlayNext(listOf(s1, s2), currentIndex = 0, song = s3)
        assertEquals(1, insertIdx)
        assertEquals(listOf(s1, s3, s2), afterInsert)

        val afterAppend = QueueOps.appendToQueue(afterInsert, s4)
        assertEquals(listOf(s1, s3, s2, s4), afterAppend)

        // Removing currently playing index is blocked
        assertNull(QueueOps.removeAt(afterAppend, currentIndex = 2, removeIndex = 2))

        // Removing item before currentIndex shifts currentIndex down cleanly
        val (afterRemove, newCurrent) = QueueOps.removeAt(afterAppend, currentIndex = 2, removeIndex = 0)!!
        assertEquals(listOf(s3, s2, s4), afterRemove)
        assertEquals(1, newCurrent)
    }

    @Test
    fun themeModeParsingAndArtworkAspectClamping() {
        assertEquals(AppThemeMode.SYSTEM, AppThemeMode.fromStorageKey(null))
        assertEquals(AppThemeMode.SYSTEM, AppThemeMode.fromStorageKey("unknown"))
        assertEquals(AppThemeMode.SYSTEM, AppThemeMode.fromStorageKey("system"))
        assertEquals(AppThemeMode.DARK, AppThemeMode.fromStorageKey("DARK"))
        assertEquals(AppThemeMode.LIGHT, AppThemeMode.fromStorageKey("light"))

        assertEquals(1f, clampArtworkAspectRatio(0, 500), 0.001f)
        assertEquals(1f, clampArtworkAspectRatio(500, -1), 0.001f)
        assertEquals(1f, clampArtworkAspectRatio(500, 500), 0.001f)
        assertEquals(16f / 9f, clampArtworkAspectRatio(1280, 720), 0.001f)
        assertEquals(4f / 3f, clampArtworkAspectRatio(480, 360), 0.001f)
        assertEquals(1f, clampArtworkAspectRatio(300, 600), 0.001f)
    }

    @Test
    fun smartQueueStartsSeedFirstAndPrioritizesRelatedArtistAndStyle() {
        val seed = SongDto(
            id = "oldest-10",
            sourceType = "youtube",
            title = "Vaseegara (Lofi Chill Mix)",
            artist = "Bombay Jayashri",
            durationSeconds = 210,
            audioUrl = "https://cdn/10.m4a"
        )
        val sameStyle1 = SongDto(
            id = "lofi-1",
            sourceType = "youtube",
            title = "Munbe Vaa (Slowed + Reverb)",
            artist = "Shreya Ghoshal",
            durationSeconds = 220,
            audioUrl = "https://cdn/lofi1.m4a"
        )
        val sameStyle2 = SongDto(
            id = "lofi-2",
            sourceType = "youtube",
            title = "Night Rain Lofi Beats",
            artist = "Chill Panda",
            durationSeconds = 205,
            audioUrl = "https://cdn/lofi2.m4a"
        )
        val sameArtist = SongDto(
            id = "artist-1",
            sourceType = "upload",
            title = "Zara Zara",
            artist = "Bombay Jayashri, Harris Jayaraj",
            durationSeconds = 230,
            audioUrl = "https://cdn/artist1.m4a"
        )
        val unrelated1 = SongDto(
            id = "mass-1",
            sourceType = "upload",
            title = "Hukum Party Kuthu",
            artist = "Anirudh Ravichander",
            durationSeconds = 190,
            audioUrl = "https://cdn/mass1.m4a"
        )
        val unrelated2 = SongDto(
            id = "edm-1",
            sourceType = "upload",
            title = "Neon Workout Trap",
            artist = "DJ Pulse",
            durationSeconds = 185,
            audioUrl = "https://cdn/edm1.m4a"
        )

        val catalog = listOf(unrelated1, unrelated2, sameStyle2, sameArtist, sameStyle1, seed)
        val built = SmartQueueEngine.buildRelatedQueue(seed, catalog, Random(42))

        // Tapping the oldest/last item always places it first at index 0, with all songs queued
        assertEquals("oldest-10", built.first().id)
        assertEquals(catalog.size, built.size)
        assertEquals(catalog.map { it.id }.toSet(), built.map { it.id }.toSet())

        // Immediate Up-Next positions favor same-artist and matching-style tracks ahead of unrelated songs
        val immediateNextIds = built.subList(1, 4).map { it.id }.toSet()
        assertTrue("artist-1 should rank in top Up-Next slots", "artist-1" in immediateNextIds)
        assertTrue(
            "At least one matching Lofi/Slowed track should rank in top Up-Next slots",
            "lofi-1" in immediateNextIds || "lofi-2" in immediateNextIds
        )
    }

    @Test
    fun managedPriorityQueueAndPlaylistRotationBehaveConsistently() {
        val s1 = SongDto(id = "1", title = "One", artist = "Anirudh", durationSeconds = 180, audioUrl = "https://cdn/1.m4a")
        val s2 = SongDto(id = "2", title = "Two", artist = "ARR", durationSeconds = 200, audioUrl = "https://cdn/2.m4a")
        val s3 = SongDto(id = "3", title = "Three", artist = "Yuvan", durationSeconds = 190, audioUrl = "https://cdn/3.m4a")
        val sNext = SongDto(id = "next", title = "PlayNext", artist = "GV", durationSeconds = 175, audioUrl = "https://cdn/next.m4a")
        val sQueued = SongDto(id = "queued", title = "Added", artist = "Sid", durationSeconds = 210, audioUrl = "https://cdn/queued.m4a")

        // Playlist rotation wraps tapped last song to index 0 so Up Next isn't empty
        val rotated = SmartQueueEngine.rotateFromSong(s3, listOf(s1, s2, s3))
        assertEquals(listOf("3", "1", "2"), rotated.map { it.id })

        var state = ManagedQueueState(songs = rotated, currentIndex = 0, priorityEndIndex = 0)
        // Add to Queue puts item right after current song (ahead of auto/playlist tail)
        val (afterQueue, queuedIdx) = SmartQueueEngine.enqueueToUserQueue(state, sQueued)
        state = afterQueue
        assertEquals(1, queuedIdx)
        assertEquals(listOf("3", "queued", "1", "2"), state.songs.map { it.id })
        assertEquals(1, state.priorityCount)

        // Play Next inserts directly at currentIndex + 1 and preserves earlier queued song right behind it
        val (afterNext, nextIdx) = SmartQueueEngine.insertPlayNext(state, sNext)
        state = afterNext
        assertEquals(1, nextIdx)
        assertEquals(listOf("3", "next", "queued", "1", "2"), state.songs.map { it.id })
        assertEquals(2, state.priorityCount)

        // Reshuffling preserves current song and both user priority items at indices 0..2
        val (reshuffled, newTail) = SmartQueueEngine.reshuffleTail(state, Random(7))!!
        assertEquals(listOf("3", "next", "queued"), reshuffled.songs.take(3).map { it.id })
        assertEquals(setOf("1", "2"), newTail.map { it.id }.toSet())
    }

    @Test
    fun artworkRatioRegistryPredictsYoutubeWideAndCachesMeasurements() {
        ArtworkRatioRegistry.clearForTests()

        // YouTube songs start widescreen immediately before network/decode completes
        val ytInitial = ArtworkRatioRegistry.resolveInitialAspectRatio(
            url = "https://example.com/covers/yt1.jpg",
            sourceType = "youtube",
            youtubeId = "abc123"
        )
        assertEquals(16f / 9f, ytInitial, 0.001f)

        // Local uploads default to 1:1 square
        val uploadInitial = ArtworkRatioRegistry.resolveInitialAspectRatio(
            url = "https://example.com/covers/up1.jpg",
            sourceType = "upload",
            youtubeId = null
        )
        assertEquals(1f, uploadInitial, 0.001f)

        // Measured ratios override predictions persistently in cache
        ArtworkRatioRegistry.put("https://example.com/covers/yt1.jpg", 1f)
        val overridden = ArtworkRatioRegistry.resolveInitialAspectRatio(
            url = "https://example.com/covers/yt1.jpg",
            sourceType = "youtube",
            youtubeId = "abc123"
        )
        assertEquals(1f, overridden, 0.001f)
        ArtworkRatioRegistry.clearForTests()
    }

    @Test
    fun userLibraryOpsTogglesLikesAndCapsHistoryToFifty() {
        var likes = emptyList<String>()
        likes = UserLibraryOps.toggleLikedId(likes, "song-a")
        likes = UserLibraryOps.toggleLikedId(likes, "song-b")
        assertEquals(listOf("song-b", "song-a"), likes)

        likes = UserLibraryOps.toggleLikedId(likes, "song-a")
        assertEquals(listOf("song-b"), likes)

        var history = emptyList<String>()
        for (i in 1..60) {
            history = UserLibraryOps.recordHistoryId(history, "song-$i")
        }
        assertEquals(UserLibraryOps.MAX_HISTORY_ITEMS, history.size)
        assertEquals("song-60", history.first())

        history = UserLibraryOps.recordHistoryId(history, "song-20")
        assertEquals("song-20", history.first())
        assertEquals(1, history.count { it == "song-20" })
        assertEquals(UserLibraryOps.MAX_HISTORY_ITEMS, history.size)

        var searches = emptyList<String>()
        for (i in 1..12) {
            searches = UserLibraryOps.recordSearchQuery(searches, "query $i")
        }
        assertEquals(UserLibraryOps.MAX_RECENT_SEARCHES, searches.size)
        assertEquals("query 12", searches.first())
        searches = UserLibraryOps.recordSearchQuery(searches, "QUERY 5")
        assertEquals("QUERY 5", searches.first())
        assertEquals(1, searches.count { it.equals("query 5", ignoreCase = true) })
        searches = UserLibraryOps.removeSearchQuery(searches, "query 5")
        assertFalse(searches.any { it.equals("query 5", ignoreCase = true) })
    }

    @Test
    fun catalogProjectionCapsTenSongsAndBuildsThreeByThreeMostPlayed() {
        val songs = (1..15).map { idx ->
            SongDto(
                id = "s$idx",
                title = "Track $idx",
                artist = if (idx <= 5) "Anirudh" else "Harris Jayaraj",
                durationSeconds = 180 + idx,
                audioUrl = "https://cdn/$idx.m4a",
                playCount = idx * 10,
                genre = if (idx % 2 == 0) "Melody" else "Lofi",
                mood = if (idx % 3 == 0) "Chill" else "Romantic",
                language = "Tamil",
                album = "Album $idx",
                tags = listOf("Acoustic", if (idx % 2 == 0) "Night" else "Rain")
            )
        }

        val allProjection = CatalogProjection.compute(
            songs = songs,
            likedIds = listOf("s15", "s2"),
            historyIds = listOf("s7", "s1"),
            selectedHomeFilter = "All",
            searchQuery = "",
            selectedSearchTag = "All"
        )

        // Speed dial pages hold up to 9 tiles per page (3x3 grid), sorted by playCount desc
        assertEquals(2, allProjection.mostPlayedPages.size)
        assertEquals(9, allProjection.mostPlayedPages[0].size)
        assertEquals(6, allProjection.mostPlayedPages[1].size)
        assertEquals("s15", allProjection.mostPlayedPages.first().first().id)

        // Quick picks group the capped 10 home songs into 3-row side-sliding columns
        assertEquals(listOf(3, 3, 3, 1), allProjection.quickPickPages.map { it.size })

        // Home & Search show at most 10 songs while preserving total count
        assertEquals(10, allProjection.homeFilteredSongs.size)
        assertEquals(15, allProjection.homeTotalMatchingCount)
        assertEquals(10, allProjection.searchResults.size)
        assertEquals(15, allProjection.searchTotalMatchingCount)

        // History & Liked preserve order
        assertEquals(listOf("s7", "s1"), allProjection.historySongs.map { it.id })
        assertEquals(listOf("s15", "s2"), allProjection.likedSongs.map { it.id })

        // Metadata search by mood + Search discovery Charts tag work cleanly
        val chillProjection = CatalogProjection.compute(
            songs = songs,
            likedIds = listOf("s15", "s2"),
            historyIds = listOf("s7"),
            selectedHomeFilter = "Liked",
            searchQuery = "Chill",
            selectedSearchTag = "All"
        )
        assertEquals(listOf("s2", "s15"), chillProjection.homeFilteredSongs.map { it.id })
        assertTrue(chillProjection.filterTags.containsAll(listOf("All", "Liked", "Tamil")))
        assertEquals(listOf("s3", "s6", "s9", "s12", "s15"), chillProjection.searchResults.map { it.id })

        val chartsProjection = CatalogProjection.compute(
            songs = songs,
            likedIds = emptyList(),
            historyIds = emptyList(),
            selectedHomeFilter = "All",
            searchQuery = "",
            selectedSearchTag = "Charts"
        )
        assertEquals("s15", chartsProjection.searchResults.first().id)
        assertEquals(10, chartsProjection.searchResults.size)
    }

    @Test
    fun smartQueuePrioritizesRealMetadataOverSharedPlaylistMembership() {
        val seed = SongDto(
            id = "seed",
            title = "Munbe Vaa",
            artist = "Shreya Ghoshal",
            durationSeconds = 220,
            audioUrl = "https://cdn/seed.m4a",
            genre = "Melody",
            mood = "Romantic",
            language = "Tamil",
            tags = listOf("Acoustic", "90s"),
            playlistIds = listOf("shared-pl")
        )
        val samePlaylistUnrelated = SongDto(
            id = "shared-pl-edm",
            title = "Laser Bass Drop",
            artist = "DJ Volt",
            durationSeconds = 190,
            audioUrl = "https://cdn/edm.m4a",
            genre = "EDM",
            mood = "Party",
            language = "English",
            tags = listOf("Club", "Workout"),
            playlistIds = listOf("shared-pl")
        )
        val metadataMatch = SongDto(
            id = "meta-match",
            title = "Vaseegara",
            artist = "Bombay Jayashri",
            durationSeconds = 215,
            audioUrl = "https://cdn/meta.m4a",
            genre = "Melody",
            mood = "Romantic",
            language = "Tamil",
            tags = listOf("Acoustic", "Classic"),
            playlistIds = emptyList()
        )

        val built = SmartQueueEngine.buildRelatedQueue(
            seed = seed,
            pool = listOf(samePlaylistUnrelated, seed, metadataMatch),
            random = Random(9)
        )
        assertEquals(listOf("seed", "meta-match", "shared-pl-edm"), built.map { it.id })
    }
}
