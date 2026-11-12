package com.soultrack.app.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
private data class PersistedUserLibrary(
    val likedIds: List<String> = emptyList(),
    val historyIds: List<String> = emptyList(),
    val recentSearches: List<String> = emptyList()
)

internal object UserLibraryOps {
    const val MAX_HISTORY_ITEMS = 50
    const val MAX_RECENT_SEARCHES = 10

    fun toggleLikedId(current: List<String>, songId: String): List<String> {
        if (songId.isBlank()) return current
        return if (songId in current) {
            current.filterNot { it == songId }
        } else {
            listOf(songId) + current
        }
    }

    fun recordHistoryId(
        current: List<String>,
        songId: String,
        maxItems: Int = MAX_HISTORY_ITEMS
    ): List<String> {
        if (songId.isBlank()) return current
        return (listOf(songId) + current.filterNot { it == songId }).take(maxItems.coerceAtLeast(1))
    }

    fun recordSearchQuery(
        current: List<String>,
        query: String,
        maxItems: Int = MAX_RECENT_SEARCHES
    ): List<String> {
        val cleaned = query.trim()
        if (cleaned.isEmpty()) return current
        return (listOf(cleaned) + current.filterNot { it.equals(cleaned, ignoreCase = true) })
            .take(maxItems.coerceAtLeast(1))
    }

    fun removeSearchQuery(current: List<String>, query: String): List<String> =
        current.filterNot { it.equals(query.trim(), ignoreCase = true) }
}

class UserLibraryStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val lock = Any()

    private val _likedIds = MutableStateFlow<List<String>>(emptyList())
    val likedIds: StateFlow<List<String>> = _likedIds.asStateFlow()

    private val _historyIds = MutableStateFlow<List<String>>(emptyList())
    val historyIds: StateFlow<List<String>> = _historyIds.asStateFlow()

    private val _recentSearches = MutableStateFlow<List<String>>(emptyList())
    val recentSearches: StateFlow<List<String>> = _recentSearches.asStateFlow()

    init {
        val loaded = readSnapshot()
        _likedIds.value = loaded.likedIds
        _historyIds.value = loaded.historyIds
        _recentSearches.value = loaded.recentSearches
    }

    fun toggleLike(songId: String): Boolean {
        synchronized(lock) {
            val next = UserLibraryOps.toggleLikedId(_likedIds.value, songId)
            _likedIds.value = next
            persist(likedIds = next, historyIds = _historyIds.value, recentSearches = _recentSearches.value)
            return songId in next
        }
    }

    fun recordPlayed(songId: String) {
        if (songId.isBlank()) return
        synchronized(lock) {
            if (_historyIds.value.firstOrNull() == songId) return
            val next = UserLibraryOps.recordHistoryId(_historyIds.value, songId)
            _historyIds.value = next
            persist(likedIds = _likedIds.value, historyIds = next, recentSearches = _recentSearches.value)
        }
    }

    fun clearHistory() {
        synchronized(lock) {
            _historyIds.value = emptyList()
            persist(likedIds = _likedIds.value, historyIds = emptyList(), recentSearches = _recentSearches.value)
        }
    }

    fun recordSearch(query: String) {
        synchronized(lock) {
            val next = UserLibraryOps.recordSearchQuery(_recentSearches.value, query)
            if (next == _recentSearches.value) return
            _recentSearches.value = next
            persist(likedIds = _likedIds.value, historyIds = _historyIds.value, recentSearches = next)
        }
    }

    fun removeSearch(query: String) {
        synchronized(lock) {
            val next = UserLibraryOps.removeSearchQuery(_recentSearches.value, query)
            _recentSearches.value = next
            persist(likedIds = _likedIds.value, historyIds = _historyIds.value, recentSearches = next)
        }
    }

    fun clearSearches() {
        synchronized(lock) {
            _recentSearches.value = emptyList()
            persist(likedIds = _likedIds.value, historyIds = _historyIds.value, recentSearches = emptyList())
        }
    }

    private fun readSnapshot(): PersistedUserLibrary {
        val raw = prefs.getString(KEY_LIBRARY_JSON, null) ?: return PersistedUserLibrary()
        return runCatching { json.decodeFromString<PersistedUserLibrary>(raw) }
            .getOrDefault(PersistedUserLibrary())
    }

    private fun persist(likedIds: List<String>, historyIds: List<String>, recentSearches: List<String>) {
        val payload = json.encodeToString(
            PersistedUserLibrary(likedIds = likedIds, historyIds = historyIds, recentSearches = recentSearches)
        )
        prefs.edit().putString(KEY_LIBRARY_JSON, payload).apply()
    }

    companion object {
        private const val PREFS_NAME = "soultrack_user_library"
        private const val KEY_LIBRARY_JSON = "library_json"
        private val json = Json { ignoreUnknownKeys = true }
    }
}
