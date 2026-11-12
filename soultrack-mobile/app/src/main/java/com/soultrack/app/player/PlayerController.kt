package com.soultrack.app.player

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import androidx.compose.runtime.Immutable
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.soultrack.app.data.ServerPreferences
import com.soultrack.app.data.SongDto
import com.soultrack.app.data.SoultrackApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@Immutable
data class PlaybackProgress(
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val bufferedPositionMs: Long = 0L
)

@Immutable
data class PlayerUiState(
    val currentSong: SongDto? = null,
    val queue: List<SongDto> = emptyList(),
    val currentIndex: Int = -1,
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    val hasNext: Boolean = false,
    val hasPrevious: Boolean = false,
    val shuffleEnabled: Boolean = false,
    val isSmartMix: Boolean = false,
    val priorityQueueCount: Int = 0,
    val repeatMode: Int = Player.REPEAT_MODE_OFF,
    val errorMessage: String? = null
)

internal object QueueOps {
    fun insertPlayNext(queue: List<SongDto>, currentIndex: Int, song: SongDto): Pair<List<SongDto>, Int> {
        val (updated, insertIndex) = SmartQueueEngine.insertPlayNext(
            ManagedQueueState(songs = queue, currentIndex = currentIndex, priorityEndIndex = currentIndex),
            song
        )
        return updated.songs to insertIndex
    }

    fun appendToQueue(queue: List<SongDto>, song: SongDto): List<SongDto> = queue + song

    fun removeAt(queue: List<SongDto>, currentIndex: Int, removeIndex: Int): Pair<List<SongDto>, Int>? {
        val updated = SmartQueueEngine.removeAt(
            ManagedQueueState(songs = queue, currentIndex = currentIndex, priorityEndIndex = currentIndex),
            removeIndex
        ) ?: return null
        return updated.songs to updated.currentIndex
    }
}

private data class PendingPlaybackRequest(
    val songs: List<SongDto>,
    val startIndex: Int
)

class PlayerController(
    private val context: Context,
    private val api: SoultrackApi,
    private val prefs: ServerPreferences,
    private val onTrackPlayed: (String) -> Unit = {}
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val _state = MutableStateFlow(PlayerUiState())
    val state: StateFlow<PlayerUiState> = _state.asStateFlow()

    private val _progressState = MutableStateFlow(PlaybackProgress())
    val progressState: StateFlow<PlaybackProgress> = _progressState.asStateFlow()

    private var controller: MediaController? = null
    private var progressJob: Job? = null
    private var prefetchJob: Job? = null
    private var managedQueue = ManagedQueueState()
    private var shuffleActive: Boolean = false
    private var smartMixActive: Boolean = false
    private var lastReportedSongId: String? = null
    private var lastPrefetchedSongId: String? = null
    private var pendingPlayback: PendingPlaybackRequest? = null

    init {
        connectController()
    }

    private fun connectController() {
        val token = SessionToken(context, ComponentName(context, SoultrackPlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener({
            runCatching { future.get() }.onSuccess { mc ->
                controller = mc
                mc.addListener(playerListener)
                val pending = pendingPlayback
                pendingPlayback = null
                if (pending != null) {
                    startQueuePlayback(mc, pending.songs, pending.startIndex)
                } else {
                    syncFromController(mc)
                }
            }
        }, androidx.core.content.ContextCompat.getMainExecutor(context))
    }

    private val playerListener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) {
            syncFromController(player)
        }

        override fun onPlayerError(error: PlaybackException) {
            stopProgressLoop()
            val message = error.cause?.localizedMessage?.takeIf { it.isNotBlank() }
                ?: error.message?.takeIf { it.isNotBlank() }
                ?: "Unable to stream this track."
            _state.update {
                it.copy(
                    isPlaying = false,
                    isBuffering = false,
                    errorMessage = message
                )
            }
        }
    }

    private fun syncFromController(player: Player) {
        val mediaId = player.currentMediaItem?.mediaId
        if (player.mediaItemCount == 0 && pendingPlayback != null) {
            return
        }

        val currentIdx = player.currentMediaItemIndex.takeIf { it in managedQueue.songs.indices } ?: -1
        if (currentIdx >= 0) {
            managedQueue = SmartQueueEngine.syncCurrentIndex(managedQueue, currentIdx)
        }

        val queueSongs = managedQueue.songs
        val activeSong = (if (currentIdx >= 0) queueSongs[currentIdx] else null)
            ?.takeIf { mediaId == null || it.id == mediaId }
            ?: queueSongs.firstOrNull { it.id == mediaId }
            ?: if (mediaId != null) _state.value.currentSong?.takeIf { it.id == mediaId } else null

        if (activeSong != null && activeSong.id != lastReportedSongId && player.isPlaying) {
            lastReportedSongId = activeSong.id
            onTrackPlayed(activeSong.id)
            scope.launch {
                api.recordSongPlay(prefs.getServerUrl(), activeSong.id)
            }
        }

        val duration = player.duration.takeIf { it > 0 }
            ?: (activeSong?.durationSeconds?.toLong()?.times(1000L) ?: 0L)

        _progressState.value = PlaybackProgress(
            positionMs = player.currentPosition.coerceAtLeast(0L),
            durationMs = duration,
            bufferedPositionMs = player.bufferedPosition.coerceAtLeast(0L)
        )

        _state.update {
            it.copy(
                currentSong = activeSong,
                queue = queueSongs,
                currentIndex = currentIdx,
                isPlaying = player.isPlaying,
                isBuffering = player.playbackState == Player.STATE_BUFFERING,
                hasNext = player.hasNextMediaItem(),
                hasPrevious = player.hasPreviousMediaItem(),
                shuffleEnabled = shuffleActive,
                isSmartMix = smartMixActive,
                priorityQueueCount = managedQueue.priorityCount,
                repeatMode = player.repeatMode,
                errorMessage = if (player.isPlaying) null else it.errorMessage
            )
        }

        if (player.isPlaying) startProgressLoop() else stopProgressLoop()

        if (player.isPlaying || player.playbackState == Player.STATE_READY) {
            prefetchUpcomingTrack(player, activeSong)
        }
    }

    private fun prefetchUpcomingTrack(player: Player, activeSong: SongDto?) {
        val nextIdx = player.nextMediaItemIndex
        val queueSongs = managedQueue.songs
        if (nextIdx !in queueSongs.indices) return
        val nextSong = queueSongs[nextIdx]
        if (nextSong.id == activeSong?.id || nextSong.id == lastPrefetchedSongId) return
        lastPrefetchedSongId = nextSong.id
        prefetchJob?.cancel()
        prefetchJob = scope.launch {
            AudioCacheProvider.prefetchAudioHead(context, api.httpClient, nextSong.audioUrl)
        }
    }

    private fun startProgressLoop() {
        if (progressJob?.isActive == true) return
        progressJob = scope.launch {
            while (true) {
                val player = controller ?: break
                if (!player.isPlaying) break
                val duration = player.duration.takeIf { it > 0 }
                    ?: (_state.value.currentSong?.durationSeconds?.toLong()?.times(1000L) ?: 0L)
                _progressState.value = PlaybackProgress(
                    positionMs = player.currentPosition.coerceAtLeast(0L),
                    durationMs = duration,
                    bufferedPositionMs = player.bufferedPosition.coerceAtLeast(0L)
                )
                delay(200L)
            }
        }
    }

    private fun stopProgressLoop() {
        progressJob?.cancel()
        progressJob = null
    }

    private fun toMediaItem(song: SongDto): MediaItem {
        val metadata = MediaMetadata.Builder()
            .setTitle(song.title)
            .setArtist(song.artist)
            .apply {
                song.thumbnailUrl?.takeIf { it.isNotBlank() }?.let {
                    setArtworkUri(Uri.parse(it))
                }
            }
            .build()

        return MediaItem.Builder()
            .setMediaId(song.id)
            .setUri(song.audioUrl)
            .setMediaMetadata(metadata)
            .build()
    }

    /**
     * Handles tapping a song in a list cleanly:
     * - If [song] is already loaded, resumes playback if paused and returns true to open Full Player.
     * - When [smartMix] is true (Home / Search), puts [song] at index 0 followed by a dynamic
     *   artist/style-related queue via [SmartQueueEngine.buildRelatedQueue].
     * - When [smartMix] is false (Playlists), rotates the list so [song] begins at index 0 and
     *   remaining tracks play seamlessly without dead-ending on older tracks.
     */
    fun selectOrPlaySong(
        song: SongDto,
        pool: List<SongDto>,
        smartMix: Boolean = true
    ): Boolean {
        val current = _state.value.currentSong
        if (current?.id == song.id && controller != null) {
            if (!_state.value.isPlaying && !_state.value.isBuffering) {
                togglePlayPause()
            }
            return true
        }
        if (smartMix) {
            playSmartMix(song, pool)
        } else {
            val rotated = SmartQueueEngine.rotateFromSong(song, pool)
            if (rotated.isNotEmpty()) {
                dispatchQueuePlayback(
                    songs = rotated,
                    startIndex = 0,
                    shuffle = false,
                    smartMix = false
                )
            }
        }
        return false
    }

    /** Builds a Smart Related Mix starting at [seed] at index 0. */
    fun playSmartMix(seed: SongDto, pool: List<SongDto>) {
        if (seed.audioUrl.isBlank()) return
        val mixed = SmartQueueEngine.buildRelatedQueue(seed, pool)
        if (mixed.isEmpty()) return
        dispatchQueuePlayback(
            songs = mixed,
            startIndex = 0,
            shuffle = false,
            smartMix = true
        )
    }

    /** Plays [queue] strictly in list order starting from [song]. */
    fun playSong(song: SongDto, queue: List<SongDto>) {
        val validQueue = queue.ifEmpty { listOf(song) }.filter { it.audioUrl.isNotBlank() }.distinctBy { it.id }
        if (validQueue.isEmpty()) return
        val startIndex = validQueue.indexOfFirst { it.id == song.id }.coerceAtLeast(0)
        dispatchQueuePlayback(
            songs = validQueue,
            startIndex = startIndex,
            shuffle = false,
            smartMix = false
        )
    }

    /** Builds a fresh Smart Shuffled queue starting from a random song in [songs] at index 0. */
    fun shufflePlay(songs: List<SongDto>) {
        val mixed = SmartQueueEngine.buildShuffledQueue(songs)
        if (mixed.isEmpty()) return
        dispatchQueuePlayback(
            songs = mixed,
            startIndex = 0,
            shuffle = true,
            smartMix = true
        )
    }

    private fun dispatchQueuePlayback(
        songs: List<SongDto>,
        startIndex: Int,
        shuffle: Boolean,
        smartMix: Boolean
    ) {
        prefetchJob?.cancel()
        lastPrefetchedSongId = null
        shuffleActive = shuffle
        smartMixActive = smartMix
        managedQueue = ManagedQueueState(
            songs = songs,
            currentIndex = startIndex,
            priorityEndIndex = startIndex
        )
        val targetSong = songs[startIndex]

        // Update UI immediately on tap before binder/network preparation completes.
        _progressState.value = PlaybackProgress(
            positionMs = 0L,
            durationMs = targetSong.durationSeconds.toLong().coerceAtLeast(0L) * 1000L,
            bufferedPositionMs = 0L
        )
        _state.update {
            it.copy(
                currentSong = targetSong,
                queue = songs,
                currentIndex = startIndex,
                isPlaying = false,
                isBuffering = true,
                hasNext = startIndex < songs.lastIndex,
                hasPrevious = startIndex > 0,
                shuffleEnabled = shuffle,
                isSmartMix = smartMix,
                priorityQueueCount = 0,
                errorMessage = null
            )
        }

        val mc = controller
        if (mc == null) {
            pendingPlayback = PendingPlaybackRequest(songs, startIndex)
            return
        }
        startQueuePlayback(mc, songs, startIndex)
    }

    private fun startQueuePlayback(
        mc: MediaController,
        songs: List<SongDto>,
        startIndex: Int
    ) {
        // Explicit queue ordering in timeline guarantees UI queue, Play Next, and playback match 100%.
        mc.shuffleModeEnabled = false
        val items = songs.map(::toMediaItem)
        mc.setMediaItems(items, startIndex, 0L)
        mc.prepare()
        mc.play()
    }

    fun playNext(song: SongDto) {
        if (song.audioUrl.isBlank() || song.id == _state.value.currentSong?.id) return
        val mc = controller
        if (mc == null || _state.value.currentSong == null || managedQueue.songs.isEmpty()) {
            playSmartMix(song, listOf(song))
            return
        }
        val currentIdx = mc.currentMediaItemIndex.coerceIn(0, managedQueue.songs.lastIndex)
        val synced = SmartQueueEngine.syncCurrentIndex(managedQueue, currentIdx)
        val (updatedState, insertIdx) = SmartQueueEngine.insertPlayNext(synced, song)
        managedQueue = updatedState
        mc.addMediaItem(insertIdx, toMediaItem(song))
        if (insertIdx == mc.nextMediaItemIndex) {
            lastPrefetchedSongId = null
        }
        syncFromController(mc)
    }

    fun moveQueueItemToNext(index: Int) {
        val mc = controller ?: return
        val currentIdx = mc.currentMediaItemIndex
        val synced = if (currentIdx in managedQueue.songs.indices) {
            SmartQueueEngine.syncCurrentIndex(managedQueue, currentIdx)
        } else return
        if (index !in synced.songs.indices || index == synced.currentIndex) return

        val song = synced.songs[index]
        val withoutItem = SmartQueueEngine.removeAt(synced, index) ?: return
        mc.removeMediaItem(index)

        val (updatedState, insertIdx) = SmartQueueEngine.insertPlayNext(withoutItem, song)
        managedQueue = updatedState
        mc.addMediaItem(insertIdx, toMediaItem(song))
        lastPrefetchedSongId = null
        syncFromController(mc)
    }

    fun addToQueue(song: SongDto) {
        if (song.audioUrl.isBlank() || song.id == _state.value.currentSong?.id) return
        val mc = controller
        if (mc == null || _state.value.currentSong == null || managedQueue.songs.isEmpty()) {
            playSmartMix(song, listOf(song))
            return
        }
        val currentIdx = mc.currentMediaItemIndex.coerceIn(0, managedQueue.songs.lastIndex)
        val synced = SmartQueueEngine.syncCurrentIndex(managedQueue, currentIdx)
        val (updatedState, insertIdx) = SmartQueueEngine.enqueueToUserQueue(synced, song)
        managedQueue = updatedState
        mc.addMediaItem(insertIdx, toMediaItem(song))
        if (insertIdx == mc.nextMediaItemIndex) {
            lastPrefetchedSongId = null
        }
        syncFromController(mc)
    }

    fun playQueueIndex(index: Int) {
        val mc = controller ?: return
        if (index !in managedQueue.songs.indices) return
        prefetchJob?.cancel()
        lastPrefetchedSongId = null
        managedQueue = SmartQueueEngine.syncCurrentIndex(managedQueue, index)
        val target = managedQueue.songs[index]
        _progressState.value = PlaybackProgress(
            positionMs = 0L,
            durationMs = target.durationSeconds.toLong().coerceAtLeast(0L) * 1000L,
            bufferedPositionMs = 0L
        )
        _state.update {
            it.copy(
                currentSong = target,
                currentIndex = index,
                isBuffering = true,
                priorityQueueCount = managedQueue.priorityCount,
                errorMessage = null
            )
        }
        mc.seekToDefaultPosition(index)
        mc.prepare()
        mc.play()
    }

    fun removeFromQueue(index: Int) {
        val mc = controller ?: return
        val currentIdx = mc.currentMediaItemIndex
        val synced = if (currentIdx in managedQueue.songs.indices) {
            SmartQueueEngine.syncCurrentIndex(managedQueue, currentIdx)
        } else managedQueue
        val updatedState = SmartQueueEngine.removeAt(synced, index) ?: return
        managedQueue = updatedState
        mc.removeMediaItem(index)
        lastPrefetchedSongId = null
        syncFromController(mc)
    }

    fun dismissPlayer() {
        prefetchJob?.cancel()
        stopProgressLoop()
        pendingPlayback = null
        lastReportedSongId = null
        lastPrefetchedSongId = null
        shuffleActive = false
        smartMixActive = false
        managedQueue = ManagedQueueState()
        controller?.run {
            stop()
            clearMediaItems()
        }
        _progressState.value = PlaybackProgress()
        _state.update {
            PlayerUiState(repeatMode = it.repeatMode)
        }
    }

    fun clearError() {
        _state.update { it.copy(errorMessage = null) }
    }

    fun togglePlayPause() {
        val mc = controller ?: return
        if (mc.isPlaying) {
            mc.pause()
        } else {
            if (mc.playbackState == Player.STATE_ENDED) {
                mc.seekTo(mc.currentMediaItemIndex, 0L)
            }
            mc.play()
        }
    }

    fun next() {
        val mc = controller ?: return
        if (mc.hasNextMediaItem()) {
            mc.seekToNextMediaItem()
            if (!mc.isPlaying) mc.play()
        }
    }

    fun previous() {
        val mc = controller ?: return
        if (mc.currentPosition > 3000L || !mc.hasPreviousMediaItem()) {
            mc.seekTo(0L)
            if (!mc.isPlaying && mc.playbackState == Player.STATE_ENDED) {
                mc.play()
            }
        } else {
            mc.seekToPreviousMediaItem()
            if (!mc.isPlaying) mc.play()
        }
    }

    fun seekTo(positionMs: Long) {
        val clamped = positionMs.coerceAtLeast(0L)
        controller?.seekTo(clamped)
        _progressState.update { it.copy(positionMs = clamped) }
    }

    fun toggleShuffle() {
        val mc = controller ?: return
        mc.shuffleModeEnabled = false
        val currentIdx = mc.currentMediaItemIndex
        if (currentIdx !in managedQueue.songs.indices) {
            shuffleActive = !shuffleActive
            syncFromController(mc)
            return
        }

        val synced = SmartQueueEngine.syncCurrentIndex(managedQueue, currentIdx)
        val enableShuffle = !shuffleActive
        shuffleActive = enableShuffle

        if (enableShuffle) {
            smartMixActive = true
            val reshuffled = SmartQueueEngine.reshuffleTail(synced)
            if (reshuffled != null) {
                val (newState, newTail) = reshuffled
                managedQueue = newState
                val removeFrom = (maxOf(synced.priorityEndIndex, currentIdx) + 1)
                    .coerceAtMost(mc.mediaItemCount)
                if (removeFrom < mc.mediaItemCount) {
                    mc.removeMediaItems(removeFrom, mc.mediaItemCount)
                }
                if (newTail.isNotEmpty()) {
                    mc.addMediaItems(newTail.map(::toMediaItem))
                }
            }
        }
        lastPrefetchedSongId = null
        syncFromController(mc)
    }

    fun cycleRepeatMode() {
        val mc = controller ?: return
        mc.repeatMode = when (mc.repeatMode) {
            Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
            Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
            else -> Player.REPEAT_MODE_OFF
        }
        lastPrefetchedSongId = null
        syncFromController(mc)
    }
}
