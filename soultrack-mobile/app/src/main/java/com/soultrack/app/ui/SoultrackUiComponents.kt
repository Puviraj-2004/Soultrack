package com.soultrack.app.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.PlaylistAdd
import androidx.compose.material.icons.automirrored.rounded.PlaylistPlay
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter
import coil.request.ImageRequest
import coil.size.Scale
import com.soultrack.app.data.AppVersionDto
import com.soultrack.app.data.PlaylistDto
import com.soultrack.app.data.SongDto
import com.soultrack.app.ui.theme.SoulBlue
import kotlin.math.max

@Composable
internal fun rememberShimmerBrush(): Brush {
    val transition = rememberInfiniteTransition(label = "soultrackShimmer")
    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = 900f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1050, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerOffset"
    )
    val baseColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.72f)
    val highlightColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.85f)
    return Brush.linearGradient(
        colors = listOf(baseColor, highlightColor, baseColor),
        start = Offset(translateAnim - 300f, 0f),
        end = Offset(translateAnim, 240f)
    )
}

@Composable
internal fun HomeSkeletonLoading(brush: Brush) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        Box(
            modifier = Modifier
                .width(140.dp)
                .height(22.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(brush)
        )
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            repeat(3) {
                Box(
                    modifier = Modifier
                        .width(136.dp)
                        .height(148.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(brush)
                )
            }
        }
        Box(
            modifier = Modifier
                .width(120.dp)
                .height(20.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(brush)
        )
        Surface(
            shape = RoundedCornerShape(18.dp),
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(18.dp))
        ) {
            Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                repeat(3) { SkeletonSongRowPlaceholder(brush) }
            }
        }
        Box(
            modifier = Modifier
                .width(150.dp)
                .height(20.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(brush)
        )
        repeat(4) { SkeletonSongRowPlaceholder(brush) }
    }
}

@Composable
internal fun CollectionSkeletonLoading(brush: Brush, count: Int = 6) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        repeat(count) {
            SkeletonSongRowPlaceholder(brush)
        }
    }
}

@Composable
private fun SkeletonSongRowPlaceholder(brush: Brush) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(brush)
        )
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.72f)
                    .height(14.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(brush)
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.45f)
                    .height(11.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(brush)
            )
        }
    }
}

@Composable
internal fun SongTile(
    song: SongDto,
    isActive: Boolean,
    isPlaying: Boolean,
    onClick: () -> Unit
) {
    var aspectRatio by remember(song.thumbnailUrl, song.sourceType, song.youtubeId) {
        mutableFloatStateOf(
            ArtworkRatioRegistry.resolveInitialAspectRatio(
                url = song.thumbnailUrl,
                sourceType = song.sourceType,
                youtubeId = song.youtubeId
            )
        )
    }
    val artHeight = 104.dp
    val artWidth = artHeight * aspectRatio.coerceIn(1f, 16f / 9f)

    Column(
        modifier = Modifier
            .width(artWidth + 14.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(if (isActive) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface)
            .border(
                1.dp,
                if (isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                RoundedCornerShape(16.dp)
            )
            .clickable(onClick = onClick)
            .padding(7.dp)
    ) {
        ArtworkBox(
            url = song.thumbnailUrl,
            width = artWidth,
            height = artHeight,
            corner = 12.dp,
            showActiveBadge = isActive,
            isPlaying = isPlaying,
            onAspectRatioMeasured = { aspectRatio = it }
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = song.title,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            fontWeight = FontWeight.Bold,
            color = if (isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.bodySmall
        )
        Text(
            text = song.artist,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelSmall
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun SpeedDialSquareTile(
    song: SongDto,
    isActive: Boolean,
    isPlaying: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(12.dp))
            .then(
                if (isActive) {
                    Modifier.border(2.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(12.dp))
                } else {
                    Modifier
                }
            )
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            )
    ) {
        CoverImage(
            url = song.thumbnailUrl,
            fallbackColor = MaterialTheme.colorScheme.surfaceVariant,
            targetMaxPx = 280,
            modifier = Modifier.fillMaxSize()
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(44.dp)
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f))
                    )
                )
        )
        if (isActive) {
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.92f),
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(5.dp)
                    .size(20.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Rounded.GraphicEq else Icons.Rounded.PlayArrow,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(13.dp)
                    )
                }
            }
        }
        Text(
            text = song.title,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(horizontal = 7.dp, vertical = 6.dp)
        )
    }
}

@Composable
internal fun CompactChartRow(
    song: SongDto,
    rank: Int,
    isActive: Boolean,
    isPlaying: Boolean,
    isLiked: Boolean,
    onClick: () -> Unit,
    onOpenMenu: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (isActive) MaterialTheme.colorScheme.primaryContainer
                else Color.Transparent
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 6.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = rank.toString(),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = if (isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(20.dp)
        )
        AutoSizedRowArtwork(
            song = song,
            height = 46.dp,
            corner = 10.dp,
            showActiveBadge = isActive,
            isPlaying = isPlaying
        )
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = song.title,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.bodyMedium,
                color = if (isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
            )
            val metaDetail = listOfNotNull(
                song.artist,
                song.genre.takeIf { it.isNotBlank() },
                song.playCount.takeIf { it > 0 }?.let { "$it plays" }
            ).joinToString(" · ")
            Text(
                text = metaDetail,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        if (isLiked) {
            Icon(
                imageVector = Icons.Rounded.Favorite,
                contentDescription = "Liked",
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(16.dp).padding(end = 2.dp)
            )
        }
        IconButton(onClick = onOpenMenu, modifier = Modifier.size(34.dp)) {
            Icon(
                imageVector = Icons.Rounded.MoreVert,
                contentDescription = "Song options",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@Composable
internal fun SongRow(
    song: SongDto,
    isActive: Boolean,
    isPlaying: Boolean,
    isLiked: Boolean = false,
    onClick: () -> Unit,
    onOpenMenu: (() -> Unit)? = null,
    onRemoveFromQueue: (() -> Unit)? = null,
    badgeLabel: String? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (isActive) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface)
            .border(
                1.dp,
                if (isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                RoundedCornerShape(16.dp)
            )
            .clickable(onClick = onClick)
            .padding(start = 10.dp, top = 9.dp, bottom = 9.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AutoSizedRowArtwork(
            song = song,
            height = 50.dp,
            corner = 11.dp,
            showActiveBadge = isActive,
            isPlaying = isPlaying
        )
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = song.title,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontWeight = FontWeight.Bold,
                color = if (isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
            )
            val subtitle = buildString {
                append(song.artist)
                if (song.genre.isNotBlank()) {
                    append(" · ")
                    append(song.genre)
                }
                append(" · ")
                append(formatDurationSec(song.durationSeconds))
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = subtitle,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f, fill = false)
                )
                if (!badgeLabel.isNullOrBlank()) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)
                    ) {
                        Text(
                            text = badgeLabel,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 1.dp)
                        )
                    }
                }
            }
        }
        if (isLiked) {
            Icon(
                imageVector = Icons.Rounded.Favorite,
                contentDescription = "Liked",
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(17.dp).padding(end = 2.dp)
            )
        }
        when {
            onOpenMenu != null -> {
                IconButton(onClick = onOpenMenu) {
                    Icon(Icons.Rounded.MoreVert, contentDescription = "Song options", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            onRemoveFromQueue != null -> {
                IconButton(onClick = onRemoveFromQueue) {
                    Icon(
                        Icons.Rounded.Close,
                        contentDescription = "Remove from queue",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
            else -> Spacer(Modifier.width(8.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
internal fun SongOptionsSheet(
    song: SongDto,
    isLiked: Boolean,
    onDismiss: () -> Unit,
    onToggleLike: () -> Unit,
    onPlayNow: (() -> Unit)? = null,
    onPlayNext: (() -> Unit)? = null,
    onAddToQueue: (() -> Unit)? = null,
    onRemoveFromQueue: (() -> Unit)? = null
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = 18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AutoSizedRowArtwork(song = song, height = 52.dp, corner = 12.dp)
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = song.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = song.artist,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            val metaPills = listOf(song.genre, song.mood, song.language, song.album)
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .distinct()
            if (metaPills.isNotEmpty()) {
                FlowRow(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    metaPills.forEach { pill ->
                        Surface(
                            shape = RoundedCornerShape(999.dp),
                            color = MaterialTheme.colorScheme.primaryContainer
                        ) {
                            Text(
                                text = pill,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outline)

            ListItem(
                headlineContent = { Text(if (isLiked) "Remove from Liked Songs" else "Add to Liked Songs") },
                leadingContent = {
                    Icon(
                        imageVector = if (isLiked) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                        contentDescription = null,
                        tint = if (isLiked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                modifier = Modifier.clickable {
                    onToggleLike()
                    onDismiss()
                }
            )
            if (onPlayNow != null) {
                ListItem(
                    headlineContent = { Text("Play Now") },
                    leadingContent = { Icon(Icons.Rounded.PlayArrow, contentDescription = null) },
                    modifier = Modifier.clickable {
                        onPlayNow()
                        onDismiss()
                    }
                )
            }
            if (onPlayNext != null) {
                ListItem(
                    headlineContent = { Text("Play Next") },
                    leadingContent = { Icon(Icons.AutoMirrored.Rounded.PlaylistPlay, contentDescription = null) },
                    modifier = Modifier.clickable {
                        onPlayNext()
                        onDismiss()
                    }
                )
            }
            if (onAddToQueue != null) {
                ListItem(
                    headlineContent = { Text("Add to Queue") },
                    leadingContent = { Icon(Icons.AutoMirrored.Rounded.PlaylistAdd, contentDescription = null) },
                    modifier = Modifier.clickable {
                        onAddToQueue()
                        onDismiss()
                    }
                )
            }
            if (onRemoveFromQueue != null) {
                ListItem(
                    headlineContent = { Text("Remove from Queue") },
                    leadingContent = {
                        Icon(
                            Icons.Rounded.DeleteOutline,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error
                        )
                    },
                    modifier = Modifier.clickable {
                        onRemoveFromQueue()
                        onDismiss()
                    }
                )
            }
        }
    }
}

@Composable
internal fun PlaylistCard(playlist: PlaylistDto, onClick: () -> Unit) {
    val coverColor = runCatching { Color(android.graphics.Color.parseColor(playlist.coverColor)) }
        .getOrDefault(SoulBlue)
    val thumbs = remember(playlist.coverImage, playlist.coverThumbnails) {
        if (!playlist.coverImage.isNullOrBlank()) listOf(playlist.coverImage)
        else playlist.coverThumbnails.filter { it.isNotBlank() }.distinct()
    }

    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1.25f)
                .background(coverColor),
            contentAlignment = Alignment.Center
        ) {
            when {
                thumbs.size >= 4 -> {
                    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                        Row(modifier = Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                            CoverImage(url = thumbs[0], fallbackColor = coverColor, targetMaxPx = 260, modifier = Modifier.weight(1f).fillMaxHeight())
                            CoverImage(url = thumbs[1], fallbackColor = coverColor, targetMaxPx = 260, modifier = Modifier.weight(1f).fillMaxHeight())
                        }
                        Row(modifier = Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                            CoverImage(url = thumbs[2], fallbackColor = coverColor, targetMaxPx = 260, modifier = Modifier.weight(1f).fillMaxHeight())
                            CoverImage(url = thumbs[3], fallbackColor = coverColor, targetMaxPx = 260, modifier = Modifier.weight(1f).fillMaxHeight())
                        }
                    }
                }
                thumbs.isNotEmpty() -> {
                    CoverImage(url = thumbs.first(), fallbackColor = coverColor, targetMaxPx = 420, modifier = Modifier.fillMaxSize())
                }
                else -> {
                    Icon(Icons.Rounded.MusicNote, contentDescription = null, tint = Color.White, modifier = Modifier.size(40.dp))
                }
            }
        }
        Column(modifier = Modifier.padding(10.dp)) {
            Text(playlist.name, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("${playlist.songCount} songs", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
internal fun CoverImage(
    url: String?,
    fallbackColor: Color,
    modifier: Modifier = Modifier,
    fallbackIconTint: Color = Color.White,
    fallbackIconSize: Dp = 24.dp,
    targetMaxPx: Int = 360,
    onAspectRatioMeasured: ((Float) -> Unit)? = null
) {
    val context = LocalContext.current
    var loadState by remember(url) { mutableStateOf<AsyncImagePainter.State>(AsyncImagePainter.State.Empty) }
    val isLoaded = !url.isNullOrBlank() && loadState is AsyncImagePainter.State.Success

    Box(modifier = modifier.background(fallbackColor), contentAlignment = Alignment.Center) {
        if (!isLoaded) {
            Icon(
                imageVector = Icons.Rounded.MusicNote,
                contentDescription = null,
                tint = fallbackIconTint.copy(alpha = if (loadState is AsyncImagePainter.State.Loading) 0.5f else 0.9f),
                modifier = Modifier.size(fallbackIconSize)
            )
        }
        if (!url.isNullOrBlank()) {
            AsyncImage(
                model = remember(url, context, targetMaxPx) {
                    ImageRequest.Builder(context)
                        .data(url)
                        .size(targetMaxPx, targetMaxPx)
                        .scale(Scale.FIT)
                        .crossfade(true)
                        .build()
                },
                contentDescription = null,
                contentScale = ContentScale.Crop,
                onState = { state ->
                    loadState = state
                    if (state is AsyncImagePainter.State.Success) {
                        val drawable = state.result.drawable
                        val w = drawable.intrinsicWidth
                        val h = drawable.intrinsicHeight
                        if (w > 0 && h > 0) {
                            val measured = w.toFloat() / h.toFloat()
                            ArtworkRatioRegistry.put(url, measured)
                            onAspectRatioMeasured?.invoke(measured)
                        }
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

@Composable
internal fun ArtworkBox(
    url: String?,
    width: Dp,
    height: Dp,
    corner: Dp,
    modifier: Modifier = Modifier,
    showActiveBadge: Boolean = false,
    isPlaying: Boolean = false,
    onAspectRatioMeasured: ((Float) -> Unit)? = null
) {
    val iconSize = (minOf(width, height) * 0.42f).coerceIn(18.dp, 48.dp)
    val targetMaxPx = with(LocalDensity.current) {
        max(width.roundToPx(), height.roundToPx()).coerceIn(96, 840)
    }

    Box(
        modifier = modifier
            .size(width = width, height = height)
            .clip(RoundedCornerShape(corner))
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(corner)),
        contentAlignment = Alignment.Center
    ) {
        CoverImage(
            url = url,
            fallbackColor = MaterialTheme.colorScheme.primaryContainer,
            fallbackIconTint = MaterialTheme.colorScheme.primary,
            fallbackIconSize = iconSize,
            targetMaxPx = targetMaxPx,
            onAspectRatioMeasured = onAspectRatioMeasured,
            modifier = Modifier.fillMaxSize()
        )
        if (showActiveBadge) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.35f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isPlaying) Icons.Rounded.GraphicEq else Icons.Rounded.PlayArrow,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size((minOf(width, height) * 0.45f).coerceIn(18.dp, 28.dp))
                )
            }
        }
    }
}

@Composable
internal fun FullPlayerArtwork(song: SongDto) {
    var measuredRatio by remember(song.thumbnailUrl, song.sourceType, song.youtubeId) {
        mutableFloatStateOf(
            ArtworkRatioRegistry.resolveInitialAspectRatio(
                url = song.thumbnailUrl,
                sourceType = song.sourceType,
                youtubeId = song.youtubeId,
                minRatio = 0.85f,
                maxRatio = 16f / 9f
            )
        )
    }
    val animatedRatio by animateFloatAsState(
        targetValue = measuredRatio.coerceIn(0.85f, 16f / 9f),
        label = "fullPlayerArtworkRatio"
    )

    BoxWithConstraints(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
    ) {
        val maxW = maxWidth.coerceAtMost(356.dp)
        val maxH = 264.dp
        val targetWidth: Dp
        val targetHeight: Dp
        if (maxW / animatedRatio <= maxH) {
            targetWidth = maxW
            targetHeight = maxW / animatedRatio
        } else {
            targetHeight = maxH
            targetWidth = maxH * animatedRatio
        }

        ArtworkBox(
            url = song.thumbnailUrl,
            width = targetWidth,
            height = targetHeight,
            corner = 20.dp,
            modifier = Modifier.shadow(10.dp, RoundedCornerShape(20.dp), clip = false),
            onAspectRatioMeasured = { measuredRatio = it }
        )
    }
}

@Composable
internal fun AutoSizedRowArtwork(
    song: SongDto,
    height: Dp,
    corner: Dp,
    showActiveBadge: Boolean = false,
    isPlaying: Boolean = false
) {
    var measuredRatio by remember(song.thumbnailUrl, song.sourceType, song.youtubeId) {
        mutableFloatStateOf(
            ArtworkRatioRegistry.resolveInitialAspectRatio(
                url = song.thumbnailUrl,
                sourceType = song.sourceType,
                youtubeId = song.youtubeId
            )
        )
    }
    ArtworkBox(
        url = song.thumbnailUrl,
        width = height * measuredRatio.coerceIn(1f, 16f / 9f),
        height = height,
        corner = corner,
        showActiveBadge = showActiveBadge,
        isPlaying = isPlaying,
        onAspectRatioMeasured = { measuredRatio = it }
    )
}

@Composable
internal fun PlayPauseButtonWithBuffering(
    isPlaying: Boolean,
    isBuffering: Boolean,
    onClick: () -> Unit,
    buttonSize: Dp,
    iconSize: Dp,
    filled: Boolean
) {
    Box(modifier = Modifier.size(buttonSize), contentAlignment = Alignment.Center) {
        if (filled) {
            FilledIconButton(
                onClick = onClick,
                modifier = Modifier.fillMaxSize().clip(CircleShape)
            ) {
                Icon(
                    imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                    contentDescription = if (isPlaying) "Pause" else "Play",
                    modifier = Modifier.size(iconSize)
                )
            }
        } else {
            IconButton(onClick = onClick, modifier = Modifier.fillMaxSize()) {
                Icon(
                    imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                    contentDescription = if (isPlaying) "Pause" else "Play",
                    tint = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.size(iconSize)
                )
            }
        }
        if (isBuffering) {
            CircularProgressIndicator(
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

@Composable
internal fun ToggleTransportIcon(
    active: Boolean,
    onClick: () -> Unit,
    icon: @Composable () -> Unit
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        IconButton(onClick = onClick) { icon() }
        Box(
            modifier = Modifier
                .size(4.dp)
                .clip(CircleShape)
                .background(if (active) MaterialTheme.colorScheme.primary else Color.Transparent)
        )
    }
}

@Composable
internal fun UpdateDialog(
    release: AppVersionDto,
    isDownloading: Boolean,
    progress: Float,
    message: String?,
    onUpdateClick: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = { if (!release.forceUpdate && !isDownloading) onDismiss() },
        title = { Text("Update Available (v${release.versionName})") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (release.releaseNotes.isNotBlank()) {
                    Text(release.releaseNotes)
                } else {
                    Text("A newer version of Soultrack is ready to install.")
                }
                if (isDownloading) {
                    LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth())
                    Text(
                        "${(progress * 100).toInt()}%",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (!message.isNullOrBlank()) {
                    Text(message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            Button(onClick = onUpdateClick, enabled = !isDownloading) {
                Text(if (isDownloading) "Downloading..." else "Update Now")
            }
        },
        dismissButton = if (!release.forceUpdate && !isDownloading) {
            { TextButton(onClick = onDismiss) { Text("Later") } }
        } else null
    )
}

@Composable
internal fun EmptyOrErrorCard(title: String, subtitle: String, actionLabel: String, onAction: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
    ) {
        Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(6.dp))
            Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(14.dp))
            Button(onClick = onAction) { Text(actionLabel) }
        }
    }
}
