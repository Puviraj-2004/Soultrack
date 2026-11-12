package com.soultrack.app.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

@Serializable
data class CatalogSnapshot(
    val songs: List<SongDto> = emptyList(),
    val playlists: List<PlaylistDto> = emptyList(),
    val savedAtEpochMs: Long = 0L
)

class CatalogCache(private val context: Context) {
    private val cacheFile: File
        get() = File(context.filesDir, CACHE_FILE_NAME)

    suspend fun read(): CatalogSnapshot? = withContext(Dispatchers.IO) {
        val file = cacheFile
        if (!file.exists()) return@withContext null
        runCatching { decodeSnapshot(file.readText()) }.getOrNull()
    }

    suspend fun write(songs: List<SongDto>, playlists: List<PlaylistDto>) = withContext(Dispatchers.IO) {
        val snapshot = CatalogSnapshot(
            songs = songs,
            playlists = playlists,
            savedAtEpochMs = System.currentTimeMillis()
        )
        val tmp = File(context.filesDir, "$CACHE_FILE_NAME.tmp")
        tmp.writeText(encodeSnapshot(snapshot))
        if (!tmp.renameTo(cacheFile)) {
            cacheFile.writeText(tmp.readText())
            tmp.delete()
        }
    }

    companion object {
        private const val CACHE_FILE_NAME = "catalog_cache.json"
        private val json = Json { ignoreUnknownKeys = true }

        fun encodeSnapshot(snapshot: CatalogSnapshot): String = json.encodeToString(snapshot)

        fun decodeSnapshot(raw: String): CatalogSnapshot = json.decodeFromString(raw)
    }
}
