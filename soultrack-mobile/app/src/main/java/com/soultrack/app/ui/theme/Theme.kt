package com.soultrack.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

enum class AppThemeMode(val storageKey: String, val label: String) {
    SYSTEM("system", "Auto"),
    LIGHT("light", "Light"),
    DARK("dark", "Dark");

    companion object {
        fun fromStorageKey(raw: String?): AppThemeMode {
            return entries.firstOrNull { it.storageKey.equals(raw, ignoreCase = true) } ?: SYSTEM
        }
    }
}

val SoulBlue = Color(0xFF0096FF)
val SoulBlueBright = Color(0xFF38B2FF)
val SoulBlueSoft = Color(0xFFE6F5FF)
val SoulBackground = Color(0xFFFFFFFF)
val SoulSurface = Color(0xFFF7F9FC)
val SoulBorder = Color(0xFFE5EAF2)
val SoulText = Color(0xFF111827)
val SoulMuted = Color(0xFF6B7280)

private val SoulDarkBackground = Color(0xFF0B0E14)
private val SoulDarkSurface = Color(0xFF151A23)
private val SoulDarkSurfaceVariant = Color(0xFF1C2330)
private val SoulDarkBlueSoft = Color(0xFF0F2740)
private val SoulDarkBlueContainerText = Color(0xFF8CD3FF)
private val SoulDarkBorder = Color(0xFF273142)
private val SoulDarkText = Color(0xFFF3F6FA)
private val SoulDarkMuted = Color(0xFF9CA3AF)

private val SoulLightColorScheme = lightColorScheme(
    primary = SoulBlue,
    onPrimary = Color.White,
    primaryContainer = SoulBlueSoft,
    onPrimaryContainer = SoulBlue,
    background = SoulBackground,
    onBackground = SoulText,
    surface = SoulBackground,
    onSurface = SoulText,
    surfaceVariant = SoulSurface,
    onSurfaceVariant = SoulMuted,
    outline = SoulBorder,
    outlineVariant = SoulBorder
)

private val SoulDarkColorScheme = darkColorScheme(
    primary = SoulBlueBright,
    onPrimary = Color(0xFF031926),
    primaryContainer = SoulDarkBlueSoft,
    onPrimaryContainer = SoulDarkBlueContainerText,
    background = SoulDarkBackground,
    onBackground = SoulDarkText,
    surface = SoulDarkSurface,
    onSurface = SoulDarkText,
    surfaceVariant = SoulDarkSurfaceVariant,
    onSurfaceVariant = SoulDarkMuted,
    outline = SoulDarkBorder,
    outlineVariant = SoulDarkBorder
)

@Composable
fun isSoulDarkTheme(mode: AppThemeMode): Boolean = when (mode) {
    AppThemeMode.SYSTEM -> isSystemInDarkTheme()
    AppThemeMode.LIGHT -> false
    AppThemeMode.DARK -> true
}

@Composable
fun SoultrackTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) SoulDarkColorScheme else SoulLightColorScheme,
        content = content
    )
}
