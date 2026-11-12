package com.soultrack.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.QueueMusic
import androidx.compose.material.icons.automirrored.rounded.TrendingUp
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.Mood
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.NewReleases
import androidx.compose.material.icons.rounded.NorthWest
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material.icons.rounded.RepeatOne
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.Player
import com.soultrack.app.BuildConfig
import com.soultrack.app.data.PlaylistDto
import com.soultrack.app.data.SongDto
import com.soultrack.app.player.PlaybackProgress
import com.soultrack.app.player.PlayerUiState
import com.soultrack.app.ui.theme.AppThemeMode
import com.soultrack.app.ui.theme.SoulBlue
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlin.math.absoluteValue
import kotlin.math.roundToInt

enum class MainTab { HOME, SEARCH, LIBRARY, SETTINGS }

internal fun clampArtworkAspectRatio(
    width: Int,
    height: Int,
    minRatio: Float = 1f,
    maxRatio: Float = 16f / 9f
): Float {
    if (width <= 0 || height <= 0) return 1f
    return (width.toFloat() / height.toFloat()).coerceIn(minRatio, maxRatio)
}

fun formatTimeMs(ms: Long): String {
    if (ms <= 0L) return "0:00"
    val totalSec = ms / 1000L
    val m = totalSec / 60L
    val s = totalSec % 60L
    return "$m:${s.toString().padStart(2, '0')}"
}

fun formatDurationSec(secs: Int): String {
    if (secs <= 0) return "--:--"
    return "${secs / 60}:${(secs % 60).toString().padStart(2, '0')}"
}

private fun lerpFloat(start: Float, stop: Float, fraction: Float): Float =
    start + (stop - start) * fraction

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SoultrackAppUi(viewModel: MainViewModel) {
    val libraryState by viewModel.uiState.collectAsStateWithLifecycle()
    val playerState by viewModel.playerController.state.collectAsStateWithLifecycle()
    var activeTab by rememberSaveable { mutableStateOf(MainTab.HOME) }
    var showFullPlayer by rememberSaveable { mutableStateOf(false) }
    var menuSong by remember { mutableStateOf<SongDto?>(null) }
    var queueMenuTarget by remember { mutableStateOf<Pair<Int, SongDto>?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    val showToast: (String) -> Unit = { msg ->
        scope.launch {
            snackbarHostState.currentSnackbarData?.dismiss()
            snackbarHostState.showSnackbar(msg)
        }
    }

    val handleSongTap: (SongDto, List<SongDto>, Boolean) -> Unit = { song, pool, smartMix ->
        val alreadyActive = viewModel.playerController.selectOrPlaySong(song, pool, smartMix = smartMix)
        if (alreadyActive) {
            showFullPlayer = true
        }
    }

    val handleToggleLike: (SongDto) -> Unit = { song ->
        val nowLiked = viewModel.toggleLikeSong(song.id)
        showToast(if (nowLiked) "Added to Liked Songs" else "Removed from Liked Songs")
    }

    BackHandler(enabled = activeTab == MainTab.HOME && libraryState.selectedPlaylist != null) {
        viewModel.closePlaylist()
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            Column {
                playerState.errorMessage?.let { err ->
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                            .border(
                                1.dp,
                                MaterialTheme.colorScheme.error.copy(alpha = 0.35f),
                                RoundedCornerShape(12.dp)
                            ),
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.errorContainer
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = err,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(
                                onClick = { viewModel.playerController.clearError() },
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(
                                    Icons.Rounded.Close,
                                    contentDescription = "Dismiss playback error",
                                    tint = MaterialTheme.colorScheme.onErrorContainer,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }
                playerState.currentSong?.let { song ->
                    MiniPlayerBar(
                        song = song,
                        playerState = playerState,
                        progressFlow = viewModel.playerController.progressState,
                        onOpen = { showFullPlayer = true },
                        onTogglePlay = { viewModel.playerController.togglePlayPause() },
                        onNext = { viewModel.playerController.next() },
                        onPrevious = { viewModel.playerController.previous() },
                        onDismiss = { viewModel.playerController.dismissPlayer() }
                    )
                }
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    NavigationBarItem(
                        selected = activeTab == MainTab.HOME,
                        onClick = {
                            if (activeTab == MainTab.HOME) {
                                viewModel.closePlaylist()
                            }
                            activeTab = MainTab.HOME
                        },
                        icon = { Icon(Icons.Rounded.Home, contentDescription = "Home") },
                        label = { Text("Home") }
                    )
                    NavigationBarItem(
                        selected = activeTab == MainTab.SEARCH,
                        onClick = { activeTab = MainTab.SEARCH },
                        icon = { Icon(Icons.Rounded.Search, contentDescription = "Search") },
                        label = { Text("Search") }
                    )
                    NavigationBarItem(
                        selected = activeTab == MainTab.LIBRARY,
                        onClick = { activeTab = MainTab.LIBRARY },
                        icon = { Icon(Icons.AutoMirrored.Rounded.QueueMusic, contentDescription = "Library") },
                        label = { Text("Library") }
                    )
                    NavigationBarItem(
                        selected = activeTab == MainTab.SETTINGS,
                        onClick = { activeTab = MainTab.SETTINGS },
                        icon = { Icon(Icons.Rounded.Settings, contentDescription = "Settings") },
                        label = { Text("Settings") }
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (activeTab) {
                MainTab.HOME -> {
                    val selectedPlaylist = libraryState.selectedPlaylist
                    if (selectedPlaylist != null) {
                        PlaylistDetailScreen(
                            playlist = selectedPlaylist,
                            songs = libraryState.selectedPlaylistSongs,
                            likedSongIds = libraryState.likedSongIds,
                            isLoading = libraryState.isPlaylistLoading,
                            errorMessage = libraryState.playlistErrorMessage,
                            currentSongId = playerState.currentSong?.id,
                            isPlaying = playerState.isPlaying,
                            onBack = viewModel::closePlaylist,
                            onRetry = { viewModel.openPlaylist(selectedPlaylist) },
                            onTapSong = { song, pool -> handleSongTap(song, pool, false) },
                            onOpenSongMenu = { menuSong = it }
                        )
                    } else {
                        HomeScreen(
                            state = libraryState,
                            currentSongId = playerState.currentSong?.id,
                            isPlaying = playerState.isPlaying,
                            onRefresh = { viewModel.refreshLibrary(userInitiated = true) },
                            onSelectFilter = viewModel::selectHomeFilter,
                            onTapSong = { song, pool -> handleSongTap(song, pool, true) },
                            onOpenSongMenu = { menuSong = it },
                            onOpenPlaylist = viewModel::openPlaylist,
                            onOpenHistory = {
                                viewModel.openCollection(LibraryCollection.HISTORY)
                                activeTab = MainTab.LIBRARY
                            }
                        )
                    }
                }

                MainTab.SEARCH -> SearchScreen(
                    state = libraryState,
                    currentSongId = playerState.currentSong?.id,
                    isPlaying = playerState.isPlaying,
                    onQueryChange = viewModel::updateSearchQuery,
                    onSubmitSearch = { viewModel.submitSearchQuery(it) },
                    onRemoveRecentSearch = viewModel::removeSearchQuery,
                    onClearRecentSearches = viewModel::clearSearchQueries,
                    onSelectTag = viewModel::selectSearchTag,
                    onTapSong = { song, pool ->
                        viewModel.submitSearchQuery(libraryState.searchQuery)
                        handleSongTap(song, pool, true)
                    },
                    onOpenSongMenu = { menuSong = it }
                )

                MainTab.LIBRARY -> LibraryScreen(
                    state = libraryState,
                    currentSongId = playerState.currentSong?.id,
                    isPlaying = playerState.isPlaying,
                    onRefresh = { viewModel.refreshLibrary(userInitiated = true) },
                    onSelectCollection = viewModel::openCollection,
                    onClearHistory = {
                        viewModel.clearHistory()
                        showToast("Listening history cleared")
                    },
                    onTapSong = { song, pool -> handleSongTap(song, pool, true) },
                    onOpenSongMenu = { menuSong = it }
                )

                MainTab.SETTINGS -> SettingsScreen(
                    serverUrl = libraryState.serverUrl,
                    themeMode = libraryState.themeMode,
                    updateMessage = libraryState.updateMessage,
                    onSelectThemeMode = viewModel::updateThemeMode,
                    onSaveServerUrl = { url ->
                        viewModel.updateServerUrl(url)
                        showToast("Server updated, reconnecting...")
                    },
                    onCheckUpdates = { viewModel.checkForUpdates(silent = false) }
                )
            }
        }
    }

    menuSong?.let { targetSong ->
        val isLiked = targetSong.id in libraryState.likedSongIds
        val isCurrentSong = targetSong.id == playerState.currentSong?.id
        val mixPool = (libraryState.songs + libraryState.selectedPlaylistSongs).distinctBy { it.id }
        SongOptionsSheet(
            song = targetSong,
            isLiked = isLiked,
            onDismiss = { menuSong = null },
            onToggleLike = {
                handleToggleLike(targetSong)
                menuSong = null
            },
            onPlayNow = if (!isCurrentSong) {
                {
                    handleSongTap(targetSong, mixPool.ifEmpty { listOf(targetSong) }, true)
                    menuSong = null
                }
            } else {
                null
            },
            onPlayNext = if (!isCurrentSong) {
                {
                    viewModel.playerController.playNext(targetSong)
                    showToast("Playing next: ${targetSong.title}")
                    menuSong = null
                }
            } else {
                null
            },
            onAddToQueue = if (!isCurrentSong) {
                {
                    viewModel.playerController.addToQueue(targetSong)
                    showToast("Added to queue: ${targetSong.title}")
                    menuSong = null
                }
            } else {
                null
            }
        )
    }

    queueMenuTarget?.let { (qIndex, qSong) ->
        val isLiked = qSong.id in libraryState.likedSongIds
        val isCurrentRow = if (playerState.currentIndex >= 0) {
            qIndex == playerState.currentIndex
        } else {
            qSong.id == playerState.currentSong?.id
        }
        SongOptionsSheet(
            song = qSong,
            isLiked = isLiked,
            onDismiss = { queueMenuTarget = null },
            onToggleLike = {
                handleToggleLike(qSong)
                queueMenuTarget = null
            },
            onPlayNow = if (!isCurrentRow) {
                {
                    viewModel.playerController.playQueueIndex(qIndex)
                    queueMenuTarget = null
                }
            } else {
                null
            },
            onPlayNext = if (!isCurrentRow) {
                {
                    viewModel.playerController.moveQueueItemToNext(qIndex)
                    showToast("Playing next: ${qSong.title}")
                    queueMenuTarget = null
                }
            } else {
                null
            },
            onRemoveFromQueue = if (!isCurrentRow) {
                {
                    viewModel.playerController.removeFromQueue(qIndex)
                    showToast("Removed from queue: ${qSong.title}")
                    queueMenuTarget = null
                }
            } else {
                null
            }
        )
    }

    if (showFullPlayer && playerState.currentSong != null) {
        val current = playerState.currentSong!!
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showFullPlayer = false },
            sheetState = sheetState,
            containerColor = MaterialTheme.colorScheme.surface,
            dragHandle = null
        ) {
            FullPlayerSheet(
                playerState = playerState,
                progressFlow = viewModel.playerController.progressState,
                likedSongIds = libraryState.likedSongIds,
                isLiked = current.id in libraryState.likedSongIds,
                onToggleLike = { handleToggleLike(current) },
                onOpenMenu = { menuSong = current },
                onClose = { showFullPlayer = false },
                onTogglePlay = { viewModel.playerController.togglePlayPause() },
                onNext = { viewModel.playerController.next() },
                onPrevious = { viewModel.playerController.previous() },
                onSeek = { viewModel.playerController.seekTo(it) },
                onToggleShuffle = { viewModel.playerController.toggleShuffle() },
                onCycleRepeat = { viewModel.playerController.cycleRepeatMode() },
                onSelectQueueIndex = { index -> viewModel.playerController.playQueueIndex(index) },
                onOpenQueueItemMenu = { index, item -> queueMenuTarget = index to item }
            )
        }
    }

    libraryState.availableUpdate?.let { update ->
        UpdateDialog(
            release = update,
            isDownloading = libraryState.isDownloadingUpdate,
            progress = libraryState.updateProgress,
            message = libraryState.updateMessage,
            onUpdateClick = viewModel::downloadAndInstallUpdate,
            onDismiss = viewModel::dismissOptionalUpdate
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HomeScreen(
    state: LibraryUiState,
    currentSongId: String?,
    isPlaying: Boolean,
    onRefresh: () -> Unit,
    onSelectFilter: (String) -> Unit,
    onTapSong: (SongDto, List<SongDto>) -> Unit,
    onOpenSongMenu: (SongDto) -> Unit,
    onOpenPlaylist: (PlaylistDto) -> Unit,
    onOpenHistory: () -> Unit
) {
    val shimmerBrush = rememberShimmerBrush()

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Soultrack",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.ExtraBold,
                color = MaterialTheme.colorScheme.primary
            )
        }

        PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = onRefresh,
            modifier = Modifier.fillMaxSize()
        ) {
            when {
                state.isLoading && state.songs.isEmpty() -> {
                    HomeSkeletonLoading(brush = shimmerBrush)
                }

                state.errorMessage != null && state.songs.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp)
                    ) {
                        EmptyOrErrorCard(
                            title = "Could not load Soultrack",
                            subtitle = "${state.errorMessage}\nServer: ${state.serverUrl}",
                            actionLabel = "Retry",
                            onAction = onRefresh
                        )
                    }
                }

                state.songs.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp)
                    ) {
                        EmptyOrErrorCard(
                            title = "Catalog is empty",
                            subtitle = "Add tracks in your Admin Studio or pull down to refresh.",
                            actionLabel = "Refresh",
                            onAction = onRefresh
                        )
                    }
                }

                else -> {
                    val speedDialPagerState = rememberPagerState(
                        pageCount = { state.mostPlayedPages.size.coerceAtLeast(1) }
                    )
                    val quickPicksPagerState = rememberPagerState(
                        pageCount = { state.quickPickPages.size.coerceAtLeast(1) }
                    )

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        if (state.filterTags.size > 1) {
                            item(key = "home_top_chips") {
                                FilterTagStrip(
                                    tags = state.filterTags,
                                    selectedTag = state.selectedHomeFilter,
                                    onSelectTag = onSelectFilter
                                )
                            }
                        }

                        if (state.mostPlayedPages.isNotEmpty()) {
                            item(key = "speed_dial_header") {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "Speed dial",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "Most played · 3×3",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }

                            item(key = "speed_dial_grid_pager") {
                                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    HorizontalPager(
                                        state = speedDialPagerState,
                                        contentPadding = PaddingValues(horizontal = 16.dp),
                                        pageSpacing = 12.dp,
                                        modifier = Modifier.fillMaxWidth()
                                    ) { pageIndex ->
                                        val pageSongs = state.mostPlayedPages[pageIndex]
                                        val pageOffset = (
                                            (speedDialPagerState.currentPage - pageIndex) +
                                                speedDialPagerState.currentPageOffsetFraction
                                            ).absoluteValue.coerceIn(0f, 1f)
                                        val rows = pageSongs.chunked(3)
                                        Column(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .graphicsLayer {
                                                    val s = lerpFloat(0.96f, 1f, 1f - pageOffset)
                                                    scaleX = s
                                                    scaleY = s
                                                    alpha = lerpFloat(0.74f, 1f, 1f - pageOffset)
                                                },
                                            verticalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            rows.forEach { rowSongs ->
                                                Row(
                                                    modifier = Modifier.fillMaxWidth(),
                                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                                ) {
                                                    rowSongs.forEach { song ->
                                                        SpeedDialSquareTile(
                                                            song = song,
                                                            isActive = song.id == currentSongId,
                                                            isPlaying = isPlaying && song.id == currentSongId,
                                                            onClick = { onTapSong(song, state.songs) },
                                                            onLongClick = { onOpenSongMenu(song) },
                                                            modifier = Modifier.weight(1f)
                                                        )
                                                    }
                                                    repeat(3 - rowSongs.size) {
                                                        Spacer(Modifier.weight(1f))
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    if (state.mostPlayedPages.size > 1) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.Center,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            repeat(state.mostPlayedPages.size) { pageIdx ->
                                                val selected = speedDialPagerState.currentPage == pageIdx
                                                Box(
                                                    modifier = Modifier
                                                        .padding(horizontal = 3.dp)
                                                        .height(6.dp)
                                                        .width(if (selected) 16.dp else 6.dp)
                                                        .clip(CircleShape)
                                                        .background(
                                                            if (selected) MaterialTheme.colorScheme.primary
                                                            else MaterialTheme.colorScheme.outline
                                                        )
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        item(key = "quick_picks_header") {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Quick picks",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Swipe · ${state.homeFilteredSongs.size} of ${state.homeTotalMatchingCount}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        if (state.quickPickPages.isEmpty()) {
                            item(key = "quick_picks_empty") {
                                Surface(
                                    shape = RoundedCornerShape(14.dp),
                                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(14.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "No songs in \"${state.selectedHomeFilter}\"",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.weight(1f)
                                        )
                                        TextButton(onClick = { onSelectFilter("All") }) {
                                            Text("Reset")
                                        }
                                    }
                                }
                            }
                        } else {
                            item(key = "quick_picks_side_slider") {
                                HorizontalPager(
                                    state = quickPicksPagerState,
                                    contentPadding = PaddingValues(start = 14.dp, end = 34.dp),
                                    pageSpacing = 10.dp,
                                    modifier = Modifier.fillMaxWidth()
                                ) { pageIndex ->
                                    val pageSongs = state.quickPickPages[pageIndex]
                                    Column(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalArrangement = Arrangement.spacedBy(2.dp)
                                    ) {
                                        pageSongs.forEach { song ->
                                            SongRow(
                                                song = song,
                                                isActive = song.id == currentSongId,
                                                isPlaying = isPlaying && song.id == currentSongId,
                                                isLiked = song.id in state.likedSongIds,
                                                onClick = { onTapSong(song, state.songs) },
                                                onOpenMenu = { onOpenSongMenu(song) }
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        if (state.homeRecentSongs.isNotEmpty()) {
                            item(key = "recent_header") {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "Recently played",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    TextButton(
                                        onClick = onOpenHistory,
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                                    ) {
                                        Text("History", style = MaterialTheme.typography.labelLarge)
                                    }
                                }
                            }
                            item(key = "recent_strip") {
                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    items(
                                        items = state.homeRecentSongs,
                                        key = { "recent_${it.id}" }
                                    ) { song ->
                                        SongTile(
                                            song = song,
                                            isActive = song.id == currentSongId,
                                            isPlaying = isPlaying && song.id == currentSongId,
                                            onClick = { onTapSong(song, state.songs) }
                                        )
                                    }
                                }
                            }
                        }

                        if (state.playlists.isNotEmpty()) {
                            item(key = "home_playlists_header") {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(start = 16.dp, end = 16.dp, top = 4.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "Playlists",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${state.playlists.size} curated",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            item(key = "home_playlists_row") {
                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    items(
                                        items = state.playlists,
                                        key = { "home_pl_${it.id}" }
                                    ) { playlist ->
                                        Box(modifier = Modifier.width(164.dp)) {
                                            PlaylistCard(
                                                playlist = playlist,
                                                onClick = { onOpenPlaylist(playlist) }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchScreen(
    state: LibraryUiState,
    currentSongId: String?,
    isPlaying: Boolean,
    onQueryChange: (String) -> Unit,
    onSubmitSearch: (String) -> Unit,
    onRemoveRecentSearch: (String) -> Unit,
    onClearRecentSearches: () -> Unit,
    onSelectTag: (String) -> Unit,
    onTapSong: (SongDto, List<SongDto>) -> Unit,
    onOpenSongMenu: (SongDto) -> Unit
) {
    val keyboardController = LocalSoftwareKeyboardController.current
    var showMoodTags by rememberSaveable { mutableStateOf(false) }
    val hasActiveFilter = state.searchQuery.isNotBlank() || state.selectedSearchTag != "All"

    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            OutlinedTextField(
                value = state.searchQuery,
                onValueChange = onQueryChange,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Type to search songs, moods, artists...") },
                leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                trailingIcon = {
                    if (state.searchQuery.isNotBlank()) {
                        IconButton(onClick = { onQueryChange("") }) {
                            Icon(Icons.Rounded.Close, contentDescription = "Clear search")
                        }
                    }
                },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(
                    onSearch = {
                        onSubmitSearch(state.searchQuery)
                        keyboardController?.hide()
                    }
                ),
                singleLine = true,
                shape = RoundedCornerShape(999.dp)
            )
        }

        if (showMoodTags || hasActiveFilter) {
            FilterTagStrip(
                tags = state.filterTags,
                selectedTag = state.selectedSearchTag,
                onSelectTag = onSelectTag
            )
            Spacer(Modifier.height(6.dp))
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (!hasActiveFilter) {
                if (state.homeRecentSongs.isNotEmpty()) {
                    item(key = "search_recent_title") {
                        Text(
                            text = "Recent searches",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp)
                        )
                    }
                    item(key = "search_recent_cards") {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(
                                items = state.homeRecentSongs.take(8),
                                key = { "sr_${it.id}" }
                            ) { song ->
                                SongTile(
                                    song = song,
                                    isActive = song.id == currentSongId,
                                    isPlaying = isPlaying && song.id == currentSongId,
                                    onClick = { onTapSong(song, state.songs) }
                                )
                            }
                        }
                    }
                }

                if (state.recentSearches.isNotEmpty()) {
                    items(
                        items = state.recentSearches,
                        key = { "sq_$it" }
                    ) { pastQuery ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onQueryChange(pastQuery)
                                    onSubmitSearch(pastQuery)
                                    keyboardController?.hide()
                                }
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Rounded.History,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(Modifier.width(14.dp))
                            Text(
                                text = pastQuery,
                                style = MaterialTheme.typography.bodyLarge,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(
                                onClick = { onQueryChange(pastQuery) },
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(
                                    Icons.Rounded.NorthWest,
                                    contentDescription = "Fill query",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            IconButton(
                                onClick = { onRemoveRecentSearch(pastQuery) },
                                modifier = Modifier.size(30.dp)
                            ) {
                                Icon(
                                    Icons.Rounded.Close,
                                    contentDescription = "Remove search",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                    item(key = "clear_recent_searches") {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.End
                        ) {
                            TextButton(onClick = onClearRecentSearches) {
                                Text("Clear search history", style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }
                }

                item(key = "search_discovery_cards") {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        SearchDiscoveryCard(
                            title = "New releases",
                            icon = Icons.Rounded.NewReleases,
                            modifier = Modifier.weight(1f),
                            onClick = { onSelectTag("New Releases") }
                        )
                        SearchDiscoveryCard(
                            title = "Charts",
                            icon = Icons.AutoMirrored.Rounded.TrendingUp,
                            modifier = Modifier.weight(1f),
                            onClick = { onSelectTag("Charts") }
                        )
                        SearchDiscoveryCard(
                            title = "Moods &\ngenres",
                            icon = Icons.Rounded.Mood,
                            modifier = Modifier.weight(1f),
                            onClick = { showMoodTags = !showMoodTags }
                        )
                    }
                }
            }

            item(key = "search_results_header") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val label = when {
                        state.selectedSearchTag != "All" -> state.selectedSearchTag
                        state.searchQuery.isNotBlank() -> "Search results"
                        else -> "Suggested tracks"
                    }
                    Text(
                        text = label,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Top ${state.searchResults.size} of ${state.searchTotalMatchingCount}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        if (hasActiveFilter) {
                            Spacer(Modifier.width(8.dp))
                            TextButton(
                                onClick = {
                                    onQueryChange("")
                                    onSelectTag("All")
                                },
                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp)
                            ) {
                                Text("Reset", style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }
                }
            }

            if (state.searchResults.isEmpty()) {
                item(key = "search_empty") {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (state.songs.isEmpty()) "No songs available yet" else "No matching tracks found",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                items(
                    items = state.searchResults,
                    key = { "search_${it.id}" },
                    contentType = { "song_row" }
                ) { song ->
                    Box(modifier = Modifier.padding(horizontal = 12.dp)) {
                        SongRow(
                            song = song,
                            isActive = song.id == currentSongId,
                            isPlaying = isPlaying && song.id == currentSongId,
                            isLiked = song.id in state.likedSongIds,
                            onClick = { onTapSong(song, state.songs) },
                            onOpenMenu = { onOpenSongMenu(song) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchDiscoveryCard(
    title: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier
            .height(92.dp)
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.size(22.dp)
            )
            Text(
                text = title,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun FilterTagStrip(
    tags: List<String>,
    selectedTag: String,
    onSelectTag: (String) -> Unit
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(items = tags, key = { "tag_$it" }) { tag ->
            val selected = tag == selectedTag
            FilterChip(
                selected = selected,
                onClick = { onSelectTag(tag) },
                label = {
                    Text(
                        text = if (tag == "Liked") "❤️ Liked" else tag,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                    )
                },
                shape = RoundedCornerShape(10.dp),
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    selectedLabelColor = MaterialTheme.colorScheme.primary
                )
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LibraryScreen(
    state: LibraryUiState,
    currentSongId: String?,
    isPlaying: Boolean,
    onRefresh: () -> Unit,
    onSelectCollection: (LibraryCollection) -> Unit,
    onClearHistory: () -> Unit,
    onTapSong: (SongDto, List<SongDto>) -> Unit,
    onOpenSongMenu: (SongDto) -> Unit
) {
    val active = state.activeCollection ?: LibraryCollection.LIKED
    val isLikedTab = active == LibraryCollection.LIKED
    val activeSongs = if (isLikedTab) state.likedSongs else state.historySongs
    val mixPool = (state.songs + activeSongs).distinctBy { it.id }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Library",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.ExtraBold,
                color = MaterialTheme.colorScheme.primary
            )
            if (!isLikedTab && activeSongs.isNotEmpty()) {
                TextButton(onClick = onClearHistory) {
                    Icon(
                        Icons.Rounded.DeleteOutline,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text("Clear history")
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            LibraryCollectionTile(
                title = "Liked Songs",
                subtitle = "${state.likedSongs.size} tracks",
                icon = Icons.Rounded.Favorite,
                accentColor = Color(0xFFE53935),
                selected = isLikedTab,
                modifier = Modifier.weight(1f),
                onClick = { onSelectCollection(LibraryCollection.LIKED) }
            )
            LibraryCollectionTile(
                title = "History",
                subtitle = "${state.historySongs.size} played",
                icon = Icons.Rounded.History,
                accentColor = MaterialTheme.colorScheme.primary,
                selected = !isLikedTab,
                modifier = Modifier.weight(1f),
                onClick = { onSelectCollection(LibraryCollection.HISTORY) }
            )
        }

        Spacer(Modifier.height(10.dp))

        PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = onRefresh,
            modifier = Modifier.fillMaxSize()
        ) {
            if (activeSongs.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = if (isLikedTab) Icons.Rounded.FavoriteBorder else Icons.Rounded.History,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(44.dp)
                        )
                        Text(
                            text = if (isLikedTab) "No liked songs yet" else "No listening history yet",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = if (isLikedTab) {
                                "Tap the heart button in the player or track menu to save songs here."
                            } else {
                                "Songs you play appear here in chronological order."
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 12.dp, end = 12.dp, bottom = 18.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    items(
                        items = activeSongs,
                        key = { "lib_${active.name}_${it.id}" },
                        contentType = { "song_row" }
                    ) { song ->
                        SongRow(
                            song = song,
                            isActive = song.id == currentSongId,
                            isPlaying = isPlaying && song.id == currentSongId,
                            isLiked = song.id in state.likedSongIds,
                            onClick = { onTapSong(song, mixPool) },
                            onOpenMenu = { onOpenSongMenu(song) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LibraryCollectionTile(
    title: String,
    subtitle: String,
    icon: ImageVector,
    accentColor: Color,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .border(
                width = if (selected) 1.5.dp else 1.dp,
                color = if (selected) accentColor else MaterialTheme.colorScheme.outline,
                shape = RoundedCornerShape(16.dp)
            )
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        color = if (selected) accentColor.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surface
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = accentColor.copy(alpha = 0.14f),
                modifier = Modifier.size(38.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = accentColor,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }
        }
    }
}

@Composable
private fun PlaylistDetailScreen(
    playlist: PlaylistDto,
    songs: List<SongDto>,
    likedSongIds: Set<String>,
    isLoading: Boolean,
    errorMessage: String?,
    currentSongId: String?,
    isPlaying: Boolean,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onTapSong: (SongDto, List<SongDto>) -> Unit,
    onOpenSongMenu: (SongDto) -> Unit
) {
    val shimmerBrush = rememberShimmerBrush()
    val coverColor = remember(playlist.coverColor) {
        runCatching { Color(android.graphics.Color.parseColor(playlist.coverColor)) }
            .getOrDefault(SoulBlue)
    }
    val coverThumb = remember(playlist.coverImage, playlist.coverThumbnails, songs) {
        playlist.coverImage?.takeIf { it.isNotBlank() }
            ?: playlist.coverThumbnails.firstOrNull { it.isNotBlank() }
            ?: songs.firstOrNull { !it.thumbnailUrl.isNullOrBlank() }?.thumbnailUrl
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back to home")
            }
            Text(
                text = playlist.name,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.ExtraBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
        }

        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp)),
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface
        ) {
            Row(
                modifier = Modifier.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                CoverImage(
                    url = coverThumb,
                    fallbackColor = coverColor,
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(14.dp)),
                    targetMaxPx = 256
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = playlist.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (playlist.description.isNotBlank()) {
                        Text(
                            text = playlist.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Text(
                        text = "${songs.size} tracks · Plays playlist only",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }

        Spacer(Modifier.height(10.dp))

        when {
            isLoading && songs.isEmpty() -> {
                CollectionSkeletonLoading(brush = shimmerBrush)
            }

            errorMessage != null && songs.isEmpty() -> {
                Box(modifier = Modifier.padding(16.dp)) {
                    EmptyOrErrorCard(
                        title = "Could not open playlist",
                        subtitle = errorMessage,
                        actionLabel = "Retry",
                        onAction = onRetry
                    )
                }
            }

            songs.isEmpty() -> {
                Box(modifier = Modifier.padding(16.dp)) {
                    EmptyOrErrorCard(
                        title = "Playlist has no tracks",
                        subtitle = "Assign tracks to this playlist from Admin Studio.",
                        actionLabel = "Refresh",
                        onAction = onRetry
                    )
                }
            }

            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 12.dp, end = 12.dp, bottom = 18.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    items(
                        items = songs,
                        key = { "pl_${playlist.id}_${it.id}" },
                        contentType = { "song_row" }
                    ) { song ->
                        SongRow(
                            song = song,
                            isActive = song.id == currentSongId,
                            isPlaying = isPlaying && song.id == currentSongId,
                            isLiked = song.id in likedSongIds,
                            onClick = { onTapSong(song, songs) },
                            onOpenMenu = { onOpenSongMenu(song) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsScreen(
    serverUrl: String,
    themeMode: AppThemeMode,
    updateMessage: String?,
    onSelectThemeMode: (AppThemeMode) -> Unit,
    onSaveServerUrl: (String) -> Unit,
    onCheckUpdates: () -> Unit
) {
    var draftUrl by remember(serverUrl) { mutableStateOf(serverUrl) }
    var showServerEditor by rememberSaveable { mutableStateOf(BuildConfig.DEBUG) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Settings",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.ExtraBold,
            color = MaterialTheme.colorScheme.primary
        )

        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Appearance", fontWeight = FontWeight.Bold)
                Text(
                    "Follows your device theme automatically in Auto mode, or lock Light / Dark.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AppThemeMode.entries.forEach { mode ->
                        val selected = themeMode == mode
                        if (selected) {
                            Button(
                                onClick = { onSelectThemeMode(mode) },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 10.dp)
                            ) {
                                Text(mode.label, maxLines = 1)
                            }
                        } else {
                            OutlinedButton(
                                onClick = { onSelectThemeMode(mode) },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 10.dp)
                            ) {
                                Text(mode.label, maxLines = 1)
                            }
                        }
                    }
                }
            }
        }

        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Soultrack Server", fontWeight = FontWeight.Bold)
                    if (!BuildConfig.DEBUG) {
                        TextButton(onClick = { showServerEditor = !showServerEditor }) {
                            Text(if (showServerEditor) "Hide" else "Advanced Server Settings")
                        }
                    }
                }
                if (showServerEditor) {
                    Text(
                        "Render (https://...), USB debug (http://127.0.0.1:3000), or emulator (http://10.0.2.2:3000).",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    OutlinedTextField(
                        value = draftUrl,
                        onValueChange = { draftUrl = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Button(
                        onClick = { onSaveServerUrl(draftUrl) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Save & Reconnect")
                    }
                } else {
                    Text(
                        text = "Connected: $serverUrl",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("App Version", fontWeight = FontWeight.Bold)
                Text(
                    "Installed: v${BuildConfig.VERSION_NAME} (code ${BuildConfig.VERSION_CODE})",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                OutlinedButton(onClick = onCheckUpdates, modifier = Modifier.fillMaxWidth()) {
                    Text("Check for Updates")
                }
                if (!updateMessage.isNullOrBlank()) {
                    Text(
                        updateMessage,
                        color = MaterialTheme.colorScheme.primary,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}

@Composable
private fun MiniPlayerProgressBar(progressFlow: StateFlow<PlaybackProgress>) {
    val progressState by progressFlow.collectAsStateWithLifecycle()
    val progress = if (progressState.durationMs > 0L) {
        (progressState.positionMs.toFloat() / progressState.durationMs.toFloat()).coerceIn(0f, 1f)
    } else 0f
    LinearProgressIndicator(
        progress = { progress },
        modifier = Modifier
            .fillMaxWidth()
            .height(2.5.dp),
        color = MaterialTheme.colorScheme.primary,
        trackColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.16f)
    )
}

@Composable
private fun MiniPlayerBar(
    song: SongDto,
    playerState: PlayerUiState,
    progressFlow: StateFlow<PlaybackProgress>,
    onOpen: () -> Unit,
    onTogglePlay: () -> Unit,
    onNext: () -> Unit,
    onPrevious: () -> Unit,
    onDismiss: () -> Unit
) {
    var dragOffsetX by remember { mutableFloatStateOf(0f) }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 10.dp, vertical = 4.dp)
            .offset { IntOffset((dragOffsetX * 0.25f).roundToInt(), 0) }
            .shadow(4.dp, RoundedCornerShape(16.dp), clip = false)
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
            .pointerInput(playerState.hasNext, playerState.hasPrevious) {
                detectHorizontalDragGestures(
                    onDragEnd = {
                        when {
                            dragOffsetX < -120f && playerState.hasNext -> onNext()
                            dragOffsetX > 120f -> onPrevious()
                        }
                        dragOffsetX = 0f
                    },
                    onDragCancel = { dragOffsetX = 0f },
                    onHorizontalDrag = { _, dragAmount ->
                        dragOffsetX = (dragOffsetX + dragAmount).coerceIn(-240f, 240f)
                    }
                )
            }
            .clickable(onClick = onOpen),
        color = MaterialTheme.colorScheme.primaryContainer
    ) {
        Column {
            Row(
                modifier = Modifier.padding(start = 10.dp, end = 4.dp, top = 8.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AutoSizedRowArtwork(song = song, height = 42.dp, corner = 10.dp)
                Spacer(Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        song.title,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = if (playerState.isBuffering) "Loading stream..." else song.artist,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (playerState.isBuffering) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                PlayPauseButtonWithBuffering(
                    isPlaying = playerState.isPlaying,
                    isBuffering = playerState.isBuffering,
                    onClick = onTogglePlay,
                    buttonSize = 42.dp,
                    iconSize = 26.dp,
                    filled = false
                )
                IconButton(
                    onClick = onNext,
                    enabled = playerState.hasNext,
                    modifier = Modifier
                        .size(40.dp)
                        .alpha(if (playerState.hasNext) 1f else 0.32f)
                ) {
                    Icon(Icons.Rounded.SkipNext, contentDescription = "Next", tint = MaterialTheme.colorScheme.onSurface)
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(34.dp)) {
                    Icon(
                        Icons.Rounded.Close,
                        contentDescription = "Dismiss mini player",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
            MiniPlayerProgressBar(progressFlow = progressFlow)
        }
    }
}

@Composable
private fun FullPlayerSeekSection(
    songId: String,
    progressFlow: StateFlow<PlaybackProgress>,
    onSeek: (Long) -> Unit
) {
    val progressState by progressFlow.collectAsStateWithLifecycle()
    val maxDuration = progressState.durationMs.coerceAtLeast(1L)
    var scrubbingPositionMs by remember(songId) { mutableStateOf<Long?>(null) }
    val displayPositionMs = (scrubbingPositionMs ?: progressState.positionMs).coerceIn(0L, maxDuration)

    Column(modifier = Modifier.fillMaxWidth()) {
        Slider(
            value = displayPositionMs.toFloat(),
            onValueChange = { scrubbingPositionMs = it.toLong() },
            onValueChangeFinished = {
                scrubbingPositionMs?.let(onSeek)
                scrubbingPositionMs = null
            },
            valueRange = 0f..maxDuration.toFloat()
        )
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                formatTimeMs(displayPositionMs),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                formatTimeMs(progressState.durationMs),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun PlayerActionPill(
    label: String,
    icon: ImageVector,
    active: Boolean = false,
    activeTint: Color = MaterialTheme.colorScheme.primary,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(999.dp),
        color = if (active) activeTint.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (active) activeTint else MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.size(16.dp)
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = if (active) activeTint else MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

@Composable
private fun FullPlayerSheet(
    playerState: PlayerUiState,
    progressFlow: StateFlow<PlaybackProgress>,
    likedSongIds: Set<String>,
    isLiked: Boolean,
    onToggleLike: () -> Unit,
    onOpenMenu: () -> Unit,
    onClose: () -> Unit,
    onTogglePlay: () -> Unit,
    onNext: () -> Unit,
    onPrevious: () -> Unit,
    onSeek: (Long) -> Unit,
    onToggleShuffle: () -> Unit,
    onCycleRepeat: () -> Unit,
    onSelectQueueIndex: (Int) -> Unit,
    onOpenQueueItemMenu: (Int, SongDto) -> Unit
) {
    val song = playerState.currentSong ?: return
    val metadataChips = listOf(song.genre, song.mood, song.language)
        .map { it.trim() }
        .filter { it.isNotEmpty() }
        .distinct()

    var selectedQueueTag by remember(song.id, playerState.queue.size) { mutableStateOf("All") }
    val queueTags = remember(playerState.queue) {
        val counts = linkedMapOf<String, Int>()
        playerState.queue.forEach { qSong ->
            listOf(qSong.genre, qSong.mood, qSong.language)
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .distinct()
                .forEach { t -> counts[t] = (counts[t] ?: 0) + 1 }
        }
        listOf("All") + counts.entries.sortedByDescending { it.value }.map { it.key }.take(7)
    }
    val indexedQueue = remember(playerState.queue, selectedQueueTag) {
        playerState.queue.mapIndexedNotNull { idx, item ->
            val matches = selectedQueueTag == "All" ||
                item.genre.equals(selectedQueueTag, ignoreCase = true) ||
                item.mood.equals(selectedQueueTag, ignoreCase = true) ||
                item.language.equals(selectedQueueTag, ignoreCase = true)
            if (matches) idx to item else null
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 22.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item(key = "player_header") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onClose) {
                    Icon(Icons.Rounded.KeyboardArrowDown, contentDescription = "Minimize player")
                }
                Text(
                    text = if (playerState.isBuffering) "Buffering stream..." else "Now Playing",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = if (playerState.isBuffering) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                )
                IconButton(onClick = onOpenMenu) {
                    Icon(Icons.Rounded.MoreVert, contentDescription = "More song options")
                }
            }
        }

        item(key = "player_controls") {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                FullPlayerArtwork(song = song)
                Spacer(Modifier.height(16.dp))
                Text(
                    song.title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.ExtraBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    song.artist,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center
                )
                if (metadataChips.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        metadataChips.take(3).forEach { label ->
                            Surface(
                                shape = RoundedCornerShape(999.dp),
                                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f)
                            ) {
                                Text(
                                    text = label,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))
                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    PlayerActionPill(
                        label = if (isLiked) "Liked" else "Like",
                        icon = if (isLiked) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                        active = isLiked,
                        activeTint = Color(0xFFE53935),
                        onClick = onToggleLike
                    )
                }

                Spacer(Modifier.height(12.dp))
                FullPlayerSeekSection(
                    songId = song.id,
                    progressFlow = progressFlow,
                    onSeek = onSeek
                )

                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    ToggleTransportIcon(
                        active = playerState.shuffleEnabled,
                        onClick = onToggleShuffle
                    ) {
                        Icon(
                            Icons.Rounded.Shuffle,
                            contentDescription = "Shuffle",
                            tint = if (playerState.shuffleEnabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = onPrevious) {
                        Icon(Icons.Rounded.SkipPrevious, contentDescription = "Previous", modifier = Modifier.size(34.dp))
                    }
                    PlayPauseButtonWithBuffering(
                        isPlaying = playerState.isPlaying,
                        isBuffering = playerState.isBuffering,
                        onClick = onTogglePlay,
                        buttonSize = 66.dp,
                        iconSize = 36.dp,
                        filled = true
                    )
                    IconButton(
                        onClick = onNext,
                        enabled = playerState.hasNext,
                        modifier = Modifier.alpha(if (playerState.hasNext) 1f else 0.32f)
                    ) {
                        Icon(Icons.Rounded.SkipNext, contentDescription = "Next", modifier = Modifier.size(34.dp))
                    }
                    val repeatActive = playerState.repeatMode != Player.REPEAT_MODE_OFF
                    ToggleTransportIcon(
                        active = repeatActive,
                        onClick = onCycleRepeat
                    ) {
                        val icon = if (playerState.repeatMode == Player.REPEAT_MODE_ONE) Icons.Rounded.RepeatOne else Icons.Rounded.Repeat
                        Icon(
                            icon,
                            contentDescription = "Repeat",
                            tint = if (repeatActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        if (playerState.queue.isNotEmpty()) {
            item(key = "queue_header") {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (playerState.isSmartMix) {
                                "Up Next · ${playerState.queue.size}"
                            } else {
                                "Playlist Queue · ${playerState.queue.size}"
                            },
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        if (playerState.priorityQueueCount > 0) {
                            Text(
                                text = "${playerState.priorityQueueCount} queued",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }

                    if (queueTags.size > 1) {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            items(items = queueTags, key = { "qt_$it" }) { tag ->
                                val selected = tag == selectedQueueTag
                                FilterChip(
                                    selected = selected,
                                    onClick = { selectedQueueTag = tag },
                                    label = { Text(tag, style = MaterialTheme.typography.labelMedium) },
                                    shape = RoundedCornerShape(10.dp),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                                        selectedLabelColor = MaterialTheme.colorScheme.primary
                                    )
                                )
                            }
                        }
                    }
                }
            }
            items(
                items = indexedQueue,
                key = { (index, item) -> "q_${index}_${item.id}" },
                contentType = { "queue_row" }
            ) { (index, item) ->
                val isCurrentRow = if (playerState.currentIndex >= 0) index == playerState.currentIndex else item.id == song.id
                val isUserQueued = playerState.currentIndex >= 0 &&
                    playerState.priorityQueueCount > 0 &&
                    index in (playerState.currentIndex + 1)..(playerState.currentIndex + playerState.priorityQueueCount)
                SongRow(
                    song = item,
                    isActive = isCurrentRow,
                    isPlaying = playerState.isPlaying && isCurrentRow,
                    isLiked = item.id in likedSongIds,
                    badgeLabel = if (isUserQueued) "Queued" else null,
                    onClick = { onSelectQueueIndex(index) },
                    onOpenMenu = { onOpenQueueItemMenu(index, item) }
                )
            }
        }

        item(key = "bottom_spacer") {
            Spacer(Modifier.height(12.dp))
        }
    }
}
