package com.soultrack.app.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.FileProvider
import com.soultrack.app.BuildConfig
import com.soultrack.app.data.AppVersionDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException

class AppUpdater(
    private val context: Context,
    private val httpClient: OkHttpClient
) {
    suspend fun downloadApk(url: String, onProgress: (Float) -> Unit): File = withContext(Dispatchers.IO) {
        if (!isSafeDownloadUrl(url)) {
            throw IOException("APK update URL must use HTTPS in production builds.")
        }
        val updatesDir = File(context.cacheDir, "updates").apply { mkdirs() }
        val target = File(updatesDir, "soultrack-update.apk")
        val request = Request.Builder().url(url).get().build()

        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("Download failed (${response.code})")
            }
            val body = response.body ?: throw IOException("Empty APK response")
            val total = body.contentLength()

            body.byteStream().use { input ->
                target.outputStream().use { output ->
                    val buffer = ByteArray(16 * 1024)
                    var readTotal = 0L
                    while (true) {
                        val read = input.read(buffer)
                        if (read == -1) break
                        output.write(buffer, 0, read)
                        readTotal += read
                        if (total > 0L) {
                            onProgress((readTotal.toFloat() / total.toFloat()).coerceIn(0f, 1f))
                        }
                    }
                }
            }
        }
        onProgress(1f)
        target
    }

    fun installApk(apkFile: File): Boolean {
        if (!context.packageManager.canRequestPackageInstalls()) {
            val settingsIntent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(settingsIntent)
            return false
        }

        val apkUri = FileProvider.getUriForFile(
            context,
            "${BuildConfig.APPLICATION_ID}.fileprovider",
            apkFile
        )
        val installIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(installIntent)
        return true
    }

    companion object {
        fun isSafeDownloadUrl(url: String, requireHttps: Boolean = !BuildConfig.DEBUG): Boolean {
            val trimmed = url.trim()
            if (trimmed.isEmpty()) return false
            return if (requireHttps) {
                trimmed.startsWith("https://", ignoreCase = true)
            } else {
                trimmed.startsWith("https://", ignoreCase = true) ||
                    trimmed.startsWith("http://", ignoreCase = true)
            }
        }

        fun isUpdateAvailable(
            latest: AppVersionDto,
            currentVersionCode: Int = BuildConfig.VERSION_CODE,
            requireHttps: Boolean = !BuildConfig.DEBUG
        ): Boolean {
            return latest.versionCode > currentVersionCode &&
                isSafeDownloadUrl(latest.downloadUrl, requireHttps = requireHttps)
        }
    }
}
