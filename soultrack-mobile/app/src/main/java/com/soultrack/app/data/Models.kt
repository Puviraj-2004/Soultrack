package com.soultrack.app.data

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable

@Immutable
@Serializable
data class SongDto(
    val id: String,
    val sourceType: String = "upload",
    val youtubeId: String? = null,
    val title: String,
    val artist: String = "Unknown Artist",
    val durationSeconds: Int = 0,
    val genre: String = "",
    val mood: String = "",
    val language: String = "",
    val album: String = "",
    val tags: List<String> = emptyList(),
    val audioUrl: String = "",
    val thumbnailUrl: String? = null,
    val status: String = "READY",
    val playCount: Int = 0,
    val createdAt: String = "",
    val playlistIds: List<String> = emptyList()
)

@Serializable
data class SongsResponse(
    val songs: List<SongDto> = emptyList()
)

@Immutable
@Serializable
data class PlaylistDto(
    val id: String,
    val name: String,
    val description: String = "",
    val coverColor: String = "#0096FF",
    val coverImage: String? = null,
    val songCount: Int = 0,
    val coverThumbnails: List<String> = emptyList()
)

@Serializable
data class PlaylistsResponse(
    val playlists: List<PlaylistDto> = emptyList()
)

@Serializable
data class PlaylistDetailResponse(
    val playlist: PlaylistDto,
    val songs: List<SongDto> = emptyList()
)

@Immutable
@Serializable
data class AppVersionDto(
    val versionCode: Int = 1,
    val versionName: String = "1.0.0",
    val downloadUrl: String = "",
    val releaseNotes: String = "",
    val forceUpdate: Boolean = false
)
