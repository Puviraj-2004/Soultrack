package com.soultrack.app.ui

import android.content.Context
import android.content.SharedPreferences
import com.soultrack.app.data.SongDto
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.abs

/**
 * Caches measured image aspect ratios by thumbnail URL and provides immediate aspect-ratio
 * predictions from [SongDto.sourceType] / [SongDto.youtubeId] so Home cards never flash square
 * before resizing to widescreen on load or scroll.
 */
internal object ArtworkRatioRegistry {
    private const val PREFS_NAME = "soultrack_artwork_ratios"
    private const val MIN_STORED_RATIO = 0.25f
    private const val MAX_STORED_RATIO = 4f

    private val memoryCache = ConcurrentHashMap<String, Float>()

    @Volatile
    private var prefs: SharedPreferences? = null

    fun attach(context: Context) {
        if (prefs == null) {
            prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }
    }

    fun get(url: String?): Float? {
        if (url.isNullOrBlank()) return null
        memoryCache[url]?.let { return it }
        val stored = prefs?.getFloat(url, -1f) ?: -1f
        if (stored > 0f) {
            memoryCache[url] = stored
            return stored
        }
        return null
    }

    fun put(url: String?, ratio: Float) {
        if (url.isNullOrBlank() || !ratio.isFinite() || ratio <= 0f) return
        val clamped = ratio.coerceIn(MIN_STORED_RATIO, MAX_STORED_RATIO)
        val prev = memoryCache[url]
        if (prev != null && abs(prev - clamped) < 0.01f) return
        memoryCache[url] = clamped
        prefs?.edit()?.putFloat(url, clamped)?.apply()
    }

    fun resolveInitialAspectRatio(
        url: String?,
        sourceType: String = "upload",
        youtubeId: String? = null,
        minRatio: Float = 1f,
        maxRatio: Float = 16f / 9f
    ): Float {
        get(url)?.let { return it.coerceIn(minRatio, maxRatio) }
        return predictAspectRatioFromSource(url, sourceType, youtubeId, minRatio, maxRatio)
    }

    fun predictAspectRatioFromSource(
        url: String?,
        sourceType: String = "upload",
        youtubeId: String? = null,
        minRatio: Float = 1f,
        maxRatio: Float = 16f / 9f
    ): Float {
        val isYoutube = sourceType.equals("youtube", ignoreCase = true) ||
            !youtubeId.isNullOrBlank() ||
            url?.contains("ytimg", ignoreCase = true) == true ||
            url?.contains("youtube", ignoreCase = true) == true
        return (if (isYoutube) 16f / 9f else 1f).coerceIn(minRatio, maxRatio)
    }

    internal fun clearForTests() {
        memoryCache.clear()
        prefs = null
    }
}
