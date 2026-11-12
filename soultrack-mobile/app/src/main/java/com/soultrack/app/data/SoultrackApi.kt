package com.soultrack.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.CacheControl
import okhttp3.ConnectionPool
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class SoultrackApi(
    val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectionPool(ConnectionPool(8, 5, TimeUnit.MINUTES))
        .retryOnConnectionFailure(true)
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .build(),
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    suspend fun fetchSongs(baseUrl: String, query: String = ""): List<SongDto> {
        val cleanBase = ServerPreferences.normalizeServerUrl(baseUrl)
        val suffix = if (query.isBlank()) "" else "?q=${URLEncoder.encode(query.trim(), "UTF-8")}"
        val body = getString("$cleanBase/api/songs$suffix")
        return json.decodeFromString<SongsResponse>(body).songs.map { resolveSongMedia(cleanBase, it) }
    }

    suspend fun fetchPlaylists(baseUrl: String): List<PlaylistDto> {
        val cleanBase = ServerPreferences.normalizeServerUrl(baseUrl)
        val body = getString("$cleanBase/api/playlists")
        return json.decodeFromString<PlaylistsResponse>(body).playlists.map { pl ->
            pl.copy(
                coverImage = pl.coverImage?.let { resolveMediaUrl(cleanBase, it) },
                coverThumbnails = pl.coverThumbnails.map { resolveMediaUrl(cleanBase, it) }
            )
        }
    }

    suspend fun fetchPlaylistDetail(baseUrl: String, playlistId: String): PlaylistDetailResponse {
        val cleanBase = ServerPreferences.normalizeServerUrl(baseUrl)
        val body = getString("$cleanBase/api/playlists/$playlistId")
        val decoded = json.decodeFromString<PlaylistDetailResponse>(body)
        return decoded.copy(
            playlist = decoded.playlist.copy(
                coverImage = decoded.playlist.coverImage?.let { resolveMediaUrl(cleanBase, it) }
            ),
            songs = decoded.songs.map { resolveSongMedia(cleanBase, it) }
        )
    }

    suspend fun recordSongPlay(baseUrl: String, songId: String) {
        val cleanBase = ServerPreferences.normalizeServerUrl(baseUrl)
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url("$cleanBase/api/songs/$songId/play")
                .post("{}".toRequestBody("application/json".toMediaType()))
                .build()
            runCatching { httpClient.newCall(request).execute().close() }
        }
    }

    suspend fun fetchLatestVersion(baseUrl: String): AppVersionDto {
        val cleanBase = ServerPreferences.normalizeServerUrl(baseUrl)
        val body = getString("$cleanBase/api/version")
        return json.decodeFromString<AppVersionDto>(body)
    }

    private suspend fun getString(url: String): String = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url(url)
            .cacheControl(CacheControl.FORCE_NETWORK)
            .get()
            .build()
        httpClient.newCall(request).execute().use { response ->
            val payload = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IOException("Server returned ${response.code}")
            }
            payload
        }
    }

    companion object {
        fun resolveSongMedia(baseUrl: String, song: SongDto): SongDto = song.copy(
            audioUrl = resolveMediaUrl(baseUrl, song.audioUrl),
            thumbnailUrl = song.thumbnailUrl?.let { resolveMediaUrl(baseUrl, it) }
        )

        fun resolveMediaUrl(baseUrl: String, url: String): String {
            if (url.startsWith("http://") || url.startsWith("https://")) return url
            if (url.startsWith("/")) return "$baseUrl$url"
            return "$baseUrl/$url"
        }
    }
}
