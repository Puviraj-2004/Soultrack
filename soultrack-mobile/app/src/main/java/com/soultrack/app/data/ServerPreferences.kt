package com.soultrack.app.data

import android.content.Context
import com.soultrack.app.BuildConfig
import com.soultrack.app.ui.theme.AppThemeMode

class ServerPreferences(context: Context) {
    private val prefs = context.getSharedPreferences("soultrack_prefs", Context.MODE_PRIVATE)

    fun getServerUrl(): String {
        val saved = prefs.getString(KEY_SERVER_URL, null)
        return normalizeServerUrl(saved ?: BuildConfig.DEFAULT_SERVER_URL)
    }

    fun setServerUrl(url: String) {
        prefs.edit().putString(KEY_SERVER_URL, normalizeServerUrl(url)).apply()
    }

    fun getThemeMode(): AppThemeMode {
        return AppThemeMode.fromStorageKey(prefs.getString(KEY_THEME_MODE, null))
    }

    fun setThemeMode(mode: AppThemeMode) {
        prefs.edit().putString(KEY_THEME_MODE, mode.storageKey).apply()
    }

    companion object {
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_THEME_MODE = "theme_mode"

        fun normalizeServerUrl(raw: String): String {
            val trimmed = raw.trim().trimEnd('/')
            if (trimmed.isEmpty()) return BuildConfig.DEFAULT_SERVER_URL.trimEnd('/')
            return if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                trimmed
            } else {
                "https://$trimmed"
            }
        }
    }
}
