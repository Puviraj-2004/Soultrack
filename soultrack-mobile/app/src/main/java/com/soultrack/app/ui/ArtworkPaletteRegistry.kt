package com.soultrack.app.ui

import android.content.Context
import android.graphics.drawable.BitmapDrawable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.palette.graphics.Palette
import coil.Coil
import coil.request.ImageRequest
import coil.request.SuccessResult
import com.soultrack.app.ui.theme.SoulBlue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap

@Immutable
data class ArtworkPalette(
    val primary: Color,
    val secondary: Color,
    val darkMuted: Color,
    val accent: Color
) {
    companion object {
        val Default = ArtworkPalette(
            primary = SoulBlue,
            secondary = Color(0xFF005A9C),
            darkMuted = Color(0xFF0B141E),
            accent = SoulBlue
        )
    }
}

object ArtworkPaletteRegistry {
    private val memoryCache = ConcurrentHashMap<String, ArtworkPalette>()

    fun get(url: String?): ArtworkPalette? {
        if (url.isNullOrBlank()) return null
        return memoryCache[url]
    }

    suspend fun resolvePalette(context: Context, url: String?): ArtworkPalette = withContext(Dispatchers.IO) {
        if (url.isNullOrBlank()) return@withContext ArtworkPalette.Default
        memoryCache[url]?.let { return@withContext it }

        val imageLoader = Coil.imageLoader(context)
        val request = ImageRequest.Builder(context)
            .data(url)
            .allowHardware(false)
            .size(120, 120)
            .build()

        val bitmap = runCatching {
            val result = imageLoader.execute(request)
            (result as? SuccessResult)?.drawable?.let { drawable ->
                (drawable as? BitmapDrawable)?.bitmap
            }
        }.getOrNull()

        if (bitmap == null || bitmap.isRecycled) {
            return@withContext ArtworkPalette.Default
        }

        val palette = runCatching {
            Palette.from(bitmap)
                .maximumColorCount(16)
                .clearFilters()
                .generate()
        }.getOrNull()

        val primaryInt = palette?.vibrantSwatch?.rgb
            ?: palette?.dominantSwatch?.rgb
            ?: palette?.lightVibrantSwatch?.rgb
            ?: SoulBlue.value.toLong().toInt()

        val secondaryInt = palette?.darkVibrantSwatch?.rgb
            ?: palette?.mutedSwatch?.rgb
            ?: palette?.dominantSwatch?.rgb
            ?: 0xFF005A9C.toInt()

        val darkMutedInt = palette?.darkMutedSwatch?.rgb
            ?: palette?.darkVibrantSwatch?.rgb
            ?: 0xFF0B141E.toInt()

        val accentInt = palette?.lightVibrantSwatch?.rgb
            ?: palette?.vibrantSwatch?.rgb
            ?: primaryInt

        val resultPalette = ArtworkPalette(
            primary = Color(primaryInt),
            secondary = Color(secondaryInt),
            darkMuted = Color(darkMutedInt),
            accent = Color(accentInt)
        )

        memoryCache[url] = resultPalette
        resultPalette
    }
}

@Composable
fun rememberArtworkPalette(thumbnailUrl: String?): ArtworkPalette {
    val context = LocalContext.current
    var palette by remember(thumbnailUrl) {
        mutableStateOf(ArtworkPaletteRegistry.get(thumbnailUrl) ?: ArtworkPalette.Default)
    }

    LaunchedEffect(thumbnailUrl) {
        if (!thumbnailUrl.isNullOrBlank()) {
            val resolved = ArtworkPaletteRegistry.resolvePalette(context, thumbnailUrl)
            palette = resolved
        } else {
            palette = ArtworkPalette.Default
        }
    }

    return palette
}
