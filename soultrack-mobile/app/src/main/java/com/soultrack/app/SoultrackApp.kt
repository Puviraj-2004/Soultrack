package com.soultrack.app

import android.app.Application
import coil.Coil
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.ImageRequest
import coil.size.Scale
import com.soultrack.app.data.CatalogCache
import com.soultrack.app.data.ServerPreferences
import com.soultrack.app.data.SoultrackApi
import com.soultrack.app.data.UserLibraryStore
import com.soultrack.app.player.PlayerController
import com.soultrack.app.ui.ArtworkRatioRegistry
import com.soultrack.app.update.AppUpdater

class SoultrackApp : Application(), ImageLoaderFactory {
    lateinit var prefs: ServerPreferences
        private set
    lateinit var catalogCache: CatalogCache
        private set
    lateinit var userLibraryStore: UserLibraryStore
        private set
    lateinit var api: SoultrackApi
        private set
    lateinit var playerController: PlayerController
        private set
    lateinit var appUpdater: AppUpdater
        private set

    override fun onCreate() {
        super.onCreate()
        ArtworkRatioRegistry.attach(this)
        prefs = ServerPreferences(this)
        catalogCache = CatalogCache(this)
        userLibraryStore = UserLibraryStore(this)
        api = SoultrackApi()
        playerController = PlayerController(
            context = this,
            api = api,
            prefs = prefs,
            onTrackPlayed = userLibraryStore::recordPlayed
        )
        appUpdater = AppUpdater(this, api.httpClient)
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .okHttpClient(api.httpClient)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.25)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizeBytes(64L * 1024L * 1024L)
                    .build()
            }
            .crossfade(160)
            .respectCacheHeaders(false)
            .build()
    }

    /** Pre-warms downsampled thumbnails and caches intrinsic aspect ratios before rendering Home. */
    fun prefetchThumbnails(urls: List<String>) {
        val loader = Coil.imageLoader(this)
        urls.asSequence()
            .filter { it.isNotBlank() }
            .distinct()
            .take(24)
            .forEach { url ->
                val request = ImageRequest.Builder(this)
                    .data(url)
                    .size(480, 480)
                    .scale(Scale.FIT)
                    .listener(
                        onSuccess = { _, result ->
                            val drawable = result.drawable
                            val w = drawable.intrinsicWidth
                            val h = drawable.intrinsicHeight
                            if (w > 0 && h > 0) {
                                ArtworkRatioRegistry.put(url, w.toFloat() / h.toFloat())
                            }
                        }
                    )
                    .build()
                loader.enqueue(request)
            }
    }
}
