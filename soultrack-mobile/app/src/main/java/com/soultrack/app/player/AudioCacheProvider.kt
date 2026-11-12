package com.soultrack.app.player

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.datasource.okhttp.OkHttpDataSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.OkHttpClient
import java.io.File

@OptIn(UnstableApi::class)
object AudioCacheProvider {
    private const val MAX_CACHE_BYTES = 150L * 1024L * 1024L // 150 MB
    private const val PREFETCH_HEAD_BYTES = 256L * 1024L // 256 KB instant-start head

    @Volatile
    private var instance: SimpleCache? = null

    fun get(context: Context): SimpleCache {
        return instance ?: synchronized(this) {
            instance ?: SimpleCache(
                File(context.applicationContext.cacheDir, "audio_cache"),
                LeastRecentlyUsedCacheEvictor(MAX_CACHE_BYTES),
                StandaloneDatabaseProvider(context.applicationContext)
            ).also { instance = it }
        }
    }

    /** Creates an ExoPlayer cache data source backed by the shared OkHttp connection pool. */
    fun createCacheDataSourceFactory(context: Context, httpClient: OkHttpClient): CacheDataSource.Factory {
        val upstreamFactory = OkHttpDataSource.Factory(httpClient as Call.Factory)
            .setUserAgent("Soultrack-Android")
        return CacheDataSource.Factory()
            .setCache(get(context))
            .setUpstreamDataSourceFactory(upstreamFactory)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
    }

    /** Pre-fetches the initial bytes of an upcoming track for near-instant skips. */
    suspend fun prefetchAudioHead(
        context: Context,
        httpClient: OkHttpClient,
        url: String
    ) = withContext(Dispatchers.IO) {
        if (url.isBlank()) return@withContext
        val dataSource = createCacheDataSourceFactory(context, httpClient).createDataSource()
        val dataSpec = DataSpec.Builder()
            .setUri(url)
            .setPosition(0L)
            .setLength(PREFETCH_HEAD_BYTES)
            .build()
        val writer = CacheWriter(dataSource, dataSpec, ByteArray(16 * 1024), null)
        val job = coroutineContext[Job]
        val handle = job?.invokeOnCompletion { if (job.isCancelled) writer.cancel() }
        try {
            writer.cache()
        } catch (_: Throwable) {
            // Best-effort pre-warm; live playback reports errors directly if needed.
        } finally {
            handle?.dispose()
        }
    }
}
