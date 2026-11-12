package com.soultrack.app.ui

import android.app.Application
import androidx.compose.runtime.Immutable
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.soultrack.app.SoultrackApp
import com.soultrack.app.data.AppVersionDto
import com.soultrack.app.data.PlaylistDto
import com.soultrack.app.data.ServerPreferences
import com.soultrack.app.data.SongDto
import com.soultrack.app.ui.theme.AppThemeMode
import com.soultrack.app.update.AppUpdater
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.random.Random

enum class LibraryCollection { LIKED, HISTORY }

internal suspend fun fetchCatalogPair(
    fetchSongs: suspend () -> List<SongDto>,
    fetchPlaylists: suspend () -> List<PlaylistDto>
): Pair<List<SongDto>, List<PlaylistDto>> = coroutineScope {
    val songsJob = async { fetchSongs() }
    val playlistsJob = async { fetchPlaylists() }
    songsJob.await() to playlistsJob.await()
}

internal data class ComputedLibraryProjection(
    val likedSongIds: Set<String> = emptySet(),
    val likedSongs: List<SongDto> = emptyList(),
    val historySongs: List<SongDto> = emptyList(),
    val homeRecentSongs: List<SongDto> = emptyList(),
    val mostPlayedPages: List<List<SongDto>> = emptyList(),
    val filterTags: List<String> = listOf("All"),
    val homeFilteredSongs: List<SongDto> = emptyList(),
    val quickPickPages: List<List<SongDto>> = emptyList(),
    val homeTotalMatchingCount: Int = 0,
    val searchResults: List<SongDto> = emptyList(),
    val searchTotalMatchingCount: Int = 0
)

internal object CatalogProjection {
    const val MAX_DISPLAY_SONGS = 10
    private const val MAX_SPEED_DIAL_SONGS = 27
    private const val SPEED_DIAL_PAGE_SIZE = 9
    private const val QUICK_PICK_PAGE_SIZE = 3

    fun compute(
        songs: List<SongDto>,
        likedIds: List<String>,
        historyIds: List<String>,
        selectedHomeFilter: String,
        searchQuery: String,
        selectedSearchTag: String,
        quickPickSeed: Long = 0L
    ): ComputedLibraryProjection {
        val byId = songs.associateBy { it.id }
        val likedSet = likedIds.toSet()
        val likedList = likedIds.mapNotNull { byId[it] }
        val historyList = historyIds.mapNotNull { byId[it] }

        val mostPlayed = songs
            .sortedWith(compareByDescending<SongDto> { it.playCount }.thenByDescending { it.createdAt })
            .take(MAX_SPEED_DIAL_SONGS)
        val pages = mostPlayed.chunked(SPEED_DIAL_PAGE_SIZE)

        val tagCounts = linkedMapOf<String, Int>()
        songs.forEach { song ->
            listOf(song.genre, song.mood, song.language)
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .distinct()
                .forEach { tag ->
                    tagCounts[tag] = (tagCounts[tag] ?: 0) + 1
                }
        }
        val dynamicTags = tagCounts.entries
            .sortedByDescending { it.value }
            .map { it.key }
            .take(8)
        val filterTags = buildList {
            add("All")
            if (likedList.isNotEmpty()) add("Liked")
            addAll(dynamicTags)
        }

        val homeMatches = filterByTag(songs, likedSet, selectedHomeFilter)
        val orderedHomeMatches = if (quickPickSeed != 0L && homeMatches.size > 1) {
            homeMatches.shuffled(Random(quickPickSeed))
        } else {
            homeMatches
        }
        val homeCapped = orderedHomeMatches.take(MAX_DISPLAY_SONGS)
        val quickPickPages = homeCapped.chunked(QUICK_PICK_PAGE_SIZE)

        val q = searchQuery.trim().lowercase()
        val tagFiltered = filterByTag(songs, likedSet, selectedSearchTag)
        val searchMatches = if (q.isEmpty()) {
            tagFiltered
        } else {
            tagFiltered.filter { s ->
                s.title.lowercase().contains(q) ||
                    s.artist.lowercase().contains(q) ||
                    s.genre.lowercase().contains(q) ||
                    s.mood.lowercase().contains(q) ||
                    s.language.lowercase().contains(q) ||
                    s.album.lowercase().contains(q) ||
                    s.tags.any { it.lowercase().contains(q) }
            }
        }

        return ComputedLibraryProjection(
            likedSongIds = likedSet,
            likedSongs = likedList,
            historySongs = historyList,
            homeRecentSongs = historyList.take(12),
            mostPlayedPages = pages,
            filterTags = filterTags,
            homeFilteredSongs = homeCapped,
            quickPickPages = quickPickPages,
            homeTotalMatchingCount = homeMatches.size,
            searchResults = searchMatches.take(MAX_DISPLAY_SONGS),
            searchTotalMatchingCount = searchMatches.size
        )
    }

    private fun filterByTag(songs: List<SongDto>, likedSet: Set<String>, tag: String): List<SongDto> {
        if (tag.isBlank() || tag.equals("All", ignoreCase = true)) return songs
        if (tag.equals("Liked", ignoreCase = true)) return songs.filter { it.id in likedSet }
        if (tag.equals("New Releases", ignoreCase = true)) {
            return songs.sortedByDescending { it.createdAt }
        }
        if (tag.equals("Charts", ignoreCase = true)) {
            return songs.sortedWith(compareByDescending<SongDto> { it.playCount }.thenByDescending { it.createdAt })
        }
        return songs.filter { s ->
            s.genre.equals(tag, ignoreCase = true) ||
                s.mood.equals(tag, ignoreCase = true) ||
                s.language.equals(tag, ignoreCase = true) ||
                s.tags.any { it.equals(tag, ignoreCase = true) }
        }
    }
}

@Immutable
data class LibraryUiState(
    val serverUrl: String = "",
    val themeMode: AppThemeMode = AppThemeMode.SYSTEM,
    val songs: List<SongDto> = emptyList(),
    val playlists: List<PlaylistDto> = emptyList(),
    val likedSongIds: Set<String> = emptySet(),
    val likedSongs: List<SongDto> = emptyList(),
    val historySongs: List<SongDto> = emptyList(),
    val recentSearches: List<String> = emptyList(),
    val homeRecentSongs: List<SongDto> = emptyList(),
    val mostPlayedPages: List<List<SongDto>> = emptyList(),
    val filterTags: List<String> = listOf("All"),
    val selectedHomeFilter: String = "All",
    val homeFilteredSongs: List<SongDto> = emptyList(),
    val quickPickPages: List<List<SongDto>> = emptyList(),
    val homeTotalMatchingCount: Int = 0,
    val searchQuery: String = "",
    val selectedSearchTag: String = "All",
    val searchResults: List<SongDto> = emptyList(),
    val searchTotalMatchingCount: Int = 0,
    val selectedPlaylist: PlaylistDto? = null,
    val selectedPlaylistSongs: List<SongDto> = emptyList(),
    val isPlaylistLoading: Boolean = false,
    val activeCollection: LibraryCollection? = null,
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val errorMessage: String? = null,
    val playlistErrorMessage: String? = null,
    val availableUpdate: AppVersionDto? = null,
    val isDownloadingUpdate: Boolean = false,
    val updateProgress: Float = 0f,
    val updateMessage: String? = null
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as SoultrackApp
    private val api = app.api
    private val prefs = app.prefs
    private val catalogCache = app.catalogCache
    private val userLibraryStore = app.userLibraryStore
    private val updater = app.appUpdater
    val playerController = app.playerController

    private val rawSongs = MutableStateFlow<List<SongDto>>(emptyList())
    private val homeFilterFlow = MutableStateFlow("All")
    private val searchQueryFlow = MutableStateFlow("")
    private val searchTagFlow = MutableStateFlow("All")
    private val quickPickSeedFlow = MutableStateFlow(System.currentTimeMillis())

    private val _uiState = MutableStateFlow(
        LibraryUiState(
            serverUrl = prefs.getServerUrl(),
            themeMode = prefs.getThemeMode()
        )
    )
    val uiState: StateFlow<LibraryUiState> = _uiState.asStateFlow()

    private var refreshJob: Job? = null
    private var playlistJob: Job? = null
    private var updateJob: Job? = null
    @Volatile
    private var lastSyncAtMs: Long = 0L

    init {
        observeCatalogProjections()
        viewModelScope.launch {
            val cached = catalogCache.read()
            if (cached != null && (cached.songs.isNotEmpty() || cached.playlists.isNotEmpty())) {
                rawSongs.value = cached.songs
                _uiState.update {
                    it.copy(
                        songs = cached.songs,
                        playlists = cached.playlists,
                        isLoading = false
                    )
                }
                prewarmArtwork(cached.songs, cached.playlists)
            }
            refreshLibrary()
            checkForUpdates(silent = true)
        }
    }

    private fun observeCatalogProjections() {
        viewModelScope.launch {
            userLibraryStore.recentSearches.collect { recent ->
                _uiState.update { it.copy(recentSearches = recent) }
            }
        }
        viewModelScope.launch {
            combine(
                rawSongs,
                userLibraryStore.likedIds,
                userLibraryStore.historyIds,
                homeFilterFlow,
                searchQueryFlow,
                searchTagFlow,
                quickPickSeedFlow
            ) { values ->
                @Suppress("UNCHECKED_CAST")
                val songs = values[0] as List<SongDto>
                @Suppress("UNCHECKED_CAST")
                val liked = values[1] as List<String>
                @Suppress("UNCHECKED_CAST")
                val history = values[2] as List<String>
                val homeFilter = values[3] as String
                val query = values[4] as String
                val searchTag = values[5] as String
                val pickSeed = values[6] as Long
                ProjectionInputs(songs, liked, history, homeFilter, query, searchTag, pickSeed)
            }.collect { inputs ->
                val computed = withContext(Dispatchers.Default) {
                    CatalogProjection.compute(
                        songs = inputs.songs,
                        likedIds = inputs.liked,
                        historyIds = inputs.history,
                        selectedHomeFilter = inputs.homeFilter,
                        searchQuery = inputs.query,
                        selectedSearchTag = inputs.searchTag,
                        quickPickSeed = inputs.quickPickSeed
                    )
                }
                val validHomeFilter = if (inputs.homeFilter in computed.filterTags) inputs.homeFilter else "All"
                if (validHomeFilter != homeFilterFlow.value) {
                    homeFilterFlow.value = validHomeFilter
                }
                _uiState.update {
                    it.copy(
                        likedSongIds = computed.likedSongIds,
                        likedSongs = computed.likedSongs,
                        historySongs = computed.historySongs,
                        homeRecentSongs = computed.homeRecentSongs,
                        mostPlayedPages = computed.mostPlayedPages,
                        filterTags = computed.filterTags,
                        selectedHomeFilter = validHomeFilter,
                        homeFilteredSongs = computed.homeFilteredSongs,
                        quickPickPages = computed.quickPickPages,
                        homeTotalMatchingCount = computed.homeTotalMatchingCount,
                        searchResults = computed.searchResults,
                        searchTotalMatchingCount = computed.searchTotalMatchingCount
                    )
                }
            }
        }
    }

    private data class ProjectionInputs(
        val songs: List<SongDto>,
        val liked: List<String>,
        val history: List<String>,
        val homeFilter: String,
        val query: String,
        val searchTag: String,
        val quickPickSeed: Long
    )

    private fun prewarmArtwork(songs: List<SongDto>, playlists: List<PlaylistDto>) {
        app.prefetchThumbnails(
            songs.mapNotNull { it.thumbnailUrl } +
                playlists.mapNotNull { it.coverImage } +
                playlists.flatMap { it.coverThumbnails }
        )
    }

    fun selectHomeFilter(tag: String) {
        homeFilterFlow.value = tag
    }

    fun updateSearchQuery(query: String) {
        searchQueryFlow.value = query
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun selectSearchTag(tag: String) {
        searchTagFlow.value = tag
        _uiState.update { it.copy(selectedSearchTag = tag) }
    }

    fun submitSearchQuery(query: String = searchQueryFlow.value) {
        val cleaned = query.trim()
        if (cleaned.isNotEmpty()) {
            userLibraryStore.recordSearch(cleaned)
        }
    }

    fun removeSearchQuery(query: String) {
        userLibraryStore.removeSearch(query)
    }

    fun clearSearchQueries() {
        userLibraryStore.clearSearches()
    }

    fun toggleLikeSong(songId: String): Boolean {
        return userLibraryStore.toggleLike(songId)
    }

    fun clearHistory() {
        userLibraryStore.clearHistory()
    }

    fun openCollection(collection: LibraryCollection) {
        playlistJob?.cancel()
        _uiState.update {
            it.copy(
                selectedPlaylist = null,
                selectedPlaylistSongs = emptyList(),
                isPlaylistLoading = false,
                playlistErrorMessage = null,
                activeCollection = collection
            )
        }
    }

    fun closeLibraryDetail() {
        playlistJob?.cancel()
        _uiState.update {
            it.copy(
                selectedPlaylist = null,
                selectedPlaylistSongs = emptyList(),
                isPlaylistLoading = false,
                playlistErrorMessage = null,
                activeCollection = null
            )
        }
    }

    fun refreshLibraryIfStale(minIntervalMs: Long = 5_000L) {
        if (refreshJob?.isActive == true) return
        val elapsed = System.currentTimeMillis() - lastSyncAtMs
        if (lastSyncAtMs == 0L || elapsed >= minIntervalMs) {
            refreshLibrary(userInitiated = false)
        }
    }

    fun refreshLibrary(userInitiated: Boolean = false) {
        if (userInitiated) {
            quickPickSeedFlow.value = System.currentTimeMillis()
        }
        val baseUrl = prefs.getServerUrl()
        refreshJob?.cancel()
        refreshJob = viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isLoading = !userInitiated && it.songs.isEmpty(),
                    isRefreshing = userInitiated,
                    errorMessage = null,
                    serverUrl = baseUrl
                )
            }
            try {
                val (songs, playlists) = fetchCatalogPair(
                    fetchSongs = { api.fetchSongs(baseUrl) },
                    fetchPlaylists = { api.fetchPlaylists(baseUrl) }
                )
                catalogCache.write(songs, playlists)
                lastSyncAtMs = System.currentTimeMillis()
                prewarmArtwork(songs, playlists)
                rawSongs.value = songs
                _uiState.update {
                    it.copy(
                        songs = songs,
                        playlists = playlists,
                        isLoading = false,
                        isRefreshing = false
                    )
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        errorMessage = e.message ?: "Could not reach Soultrack server"
                    )
                }
            }
        }
    }

    fun openPlaylist(playlist: PlaylistDto) {
        val baseUrl = prefs.getServerUrl()
        playlistJob?.cancel()
        playlistJob = viewModelScope.launch {
            _uiState.update {
                it.copy(
                    activeCollection = null,
                    selectedPlaylist = playlist,
                    selectedPlaylistSongs = emptyList(),
                    isPlaylistLoading = true,
                    playlistErrorMessage = null
                )
            }
            try {
                val detail = api.fetchPlaylistDetail(baseUrl, playlist.id)
                _uiState.update {
                    it.copy(
                        selectedPlaylist = detail.playlist,
                        selectedPlaylistSongs = detail.songs,
                        isPlaylistLoading = false,
                        playlistErrorMessage = null
                    )
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (e.message?.contains("404") == true) {
                    val remainingPlaylists = _uiState.value.playlists.filterNot { it.id == playlist.id }
                    catalogCache.write(_uiState.value.songs, remainingPlaylists)
                    _uiState.update {
                        it.copy(
                            playlists = remainingPlaylists,
                            selectedPlaylist = null,
                            selectedPlaylistSongs = emptyList(),
                            isPlaylistLoading = false,
                            playlistErrorMessage = null
                        )
                    }
                    refreshLibrary(userInitiated = false)
                } else {
                    _uiState.update {
                        it.copy(
                            isPlaylistLoading = false,
                            playlistErrorMessage = e.message ?: "Failed to load playlist"
                        )
                    }
                }
            }
        }
    }

    fun closePlaylist() {
        closeLibraryDetail()
    }

    fun updateServerUrl(newUrl: String) {
        val normalized = ServerPreferences.normalizeServerUrl(newUrl)
        prefs.setServerUrl(normalized)
        _uiState.update { it.copy(serverUrl = normalized) }
        refreshLibrary()
        checkForUpdates(silent = true)
    }

    fun updateThemeMode(mode: AppThemeMode) {
        prefs.setThemeMode(mode)
        _uiState.update { it.copy(themeMode = mode) }
    }

    fun checkForUpdates(silent: Boolean = false) {
        val baseUrl = prefs.getServerUrl()
        updateJob?.cancel()
        updateJob = viewModelScope.launch {
            if (!silent) _uiState.update { it.copy(updateMessage = null) }
            try {
                val latest = api.fetchLatestVersion(baseUrl)
                if (AppUpdater.isUpdateAvailable(latest)) {
                    _uiState.update { it.copy(availableUpdate = latest, updateMessage = null) }
                } else if (!silent) {
                    _uiState.update { it.copy(updateMessage = "You are on the latest version.") }
                }
            } catch (e: CancellationException) {
                throw e
            } catch (err: Exception) {
                if (!silent) {
                    _uiState.update { it.copy(updateMessage = err.message ?: "Update check failed.") }
                }
            }
        }
    }

    fun dismissOptionalUpdate() {
        val current = _uiState.value.availableUpdate ?: return
        if (!current.forceUpdate) {
            _uiState.update { it.copy(availableUpdate = null, updateMessage = null) }
        }
    }

    fun downloadAndInstallUpdate() {
        val release = _uiState.value.availableUpdate ?: return
        if (_uiState.value.isDownloadingUpdate) return

        viewModelScope.launch {
            _uiState.update {
                it.copy(isDownloadingUpdate = true, updateProgress = 0f, updateMessage = null)
            }
            try {
                val apk = updater.downloadApk(release.downloadUrl) { progress ->
                    _uiState.update { it.copy(updateProgress = progress) }
                }
                val startedInstall = updater.installApk(apk)
                _uiState.update {
                    it.copy(
                        isDownloadingUpdate = false,
                        updateMessage = if (startedInstall) null else "Allow 'Install unknown apps' for Soultrack, then tap Update again."
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isDownloadingUpdate = false,
                        updateMessage = e.message ?: "Download failed."
                    )
                }
            }
        }
    }
}
