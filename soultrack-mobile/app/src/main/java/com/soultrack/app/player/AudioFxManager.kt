package com.soultrack.app.player

import android.content.Context
import android.content.SharedPreferences
import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import androidx.compose.runtime.Immutable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

@Immutable
data class EqualizerBand(
    val bandIndex: Short,
    val centerFreqHz: Int,
    val levelMb: Short,
    val minMb: Short = -1500,
    val maxMb: Short = 1500
) {
    val displayFrequency: String
        get() = if (centerFreqHz >= 1000) {
            val kHz = centerFreqHz / 1000f
            if (kHz % 1f == 0f) "${kHz.toInt()} kHz" else "%.1f kHz".format(kHz)
        } else {
            "$centerFreqHz Hz"
        }

    val displayLevel: String
        get() {
            val dB = levelMb / 100
            return if (dB > 0) "+$dB dB" else "$dB dB"
        }
}

@Immutable
data class AudioFxState(
    val isAvailable: Boolean = true,
    val isEnabled: Boolean = false,
    val bassBoostStrength: Int = 0, // 0..1000
    val selectedPreset: String = "Flat",
    val bands: List<EqualizerBand> = emptyList(),
    val presets: List<String> = listOf("Flat", "Bass Boost", "Vocal", "Party", "Rock", "Acoustic", "Classical", "Custom")
)

class AudioFxManager(private val context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("soultrack_audio_fx", Context.MODE_PRIVATE)

    private val _state = MutableStateFlow(AudioFxState())
    val state: StateFlow<AudioFxState> = _state.asStateFlow()

    private var equalizer: Equalizer? = null
    private var bassBoost: BassBoost? = null
    private var currentSessionId: Int = 0

    companion object {
        // Preset band levels in millibels [-1500..+1500] for standard 5-band setup
        // [60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz]
        val PRESET_LEVELS = mapOf(
            "Flat" to listOf(0, 0, 0, 0, 0),
            "Bass Boost" to listOf(1200, 800, 0, 0, 0),
            "Vocal" to listOf(-300, 200, 900, 600, 100),
            "Party" to listOf(800, 500, 100, 600, 900),
            "Rock" to listOf(900, 400, -200, 500, 900),
            "Acoustic" to listOf(500, 300, 200, 500, 700),
            "Classical" to listOf(600, 300, 0, 300, 600)
        )

        val PRESET_BASS = mapOf(
            "Flat" to 0,
            "Bass Boost" to 850,
            "Vocal" to 0,
            "Party" to 600,
            "Rock" to 500,
            "Acoustic" to 200,
            "Classical" to 100
        )

        private val DEFAULT_CENTER_FREQS = listOf(60, 230, 910, 3600, 14000)
    }

    init {
        loadSavedState()
    }

    private fun loadSavedState() {
        val enabled = prefs.getBoolean("enabled", false)
        val bass = prefs.getInt("bass_boost", 0)
        val preset = prefs.getString("preset", "Flat") ?: "Flat"

        val initialBands = DEFAULT_CENTER_FREQS.mapIndexed { idx, freq ->
            val savedLevel = prefs.getInt("band_$idx", 0).toShort()
            EqualizerBand(
                bandIndex = idx.toShort(),
                centerFreqHz = freq,
                levelMb = savedLevel,
                minMb = -1500,
                maxMb = 1500
            )
        }

        _state.value = AudioFxState(
            isAvailable = true,
            isEnabled = enabled,
            bassBoostStrength = bass,
            selectedPreset = preset,
            bands = initialBands
        )
    }

    @Synchronized
    fun attachSession(audioSessionId: Int) {
        if (audioSessionId == 0 && equalizer != null) return
        if (audioSessionId == currentSessionId && equalizer != null) return

        releaseEffects()
        currentSessionId = audioSessionId

        runCatching {
            val eq = Equalizer(0, audioSessionId)
            val bb = BassBoost(0, audioSessionId)

            equalizer = eq
            bassBoost = bb

            val isEnabled = _state.value.isEnabled
            eq.enabled = isEnabled
            bb.enabled = isEnabled

            // Configure BassBoost
            val bassStrength = _state.value.bassBoostStrength
            if (bb.strengthSupported) {
                bb.setStrength(bassStrength.toShort())
            }

            // Configure Equalizer Bands
            val numBands = eq.numberOfBands.toInt().coerceAtLeast(1)
            val range = eq.bandLevelRange ?: shortArrayOf(-1500, 1500)
            val minMb = range[0]
            val maxMb = range[1]

            val updatedBands = (0 until numBands).map { idx ->
                val sIdx = idx.toShort()
                val centerFreqMhz = runCatching { eq.getCenterFreq(sIdx) }.getOrDefault(0)
                val centerFreqHz = if (centerFreqMhz > 0) centerFreqMhz / 1000 else DEFAULT_CENTER_FREQS.getOrElse(idx) { 1000 }
                val savedLevel = prefs.getInt("band_$idx", 0).toShort().coerceIn(minMb, maxMb)

                runCatching { eq.setBandLevel(sIdx, savedLevel) }

                EqualizerBand(
                    bandIndex = sIdx,
                    centerFreqHz = centerFreqHz,
                    levelMb = savedLevel,
                    minMb = minMb,
                    maxMb = maxMb
                )
            }

            _state.update {
                it.copy(
                    isAvailable = true,
                    bands = updatedBands
                )
            }
        }.onFailure {
            // Devices or emulators with missing audiofx HAL still allow simulated UI controls
            _state.update { it.copy(isAvailable = true) }
        }
    }

    @Synchronized
    fun detachSession() {
        releaseEffects()
        currentSessionId = 0
    }

    private fun releaseEffects() {
        runCatching {
            equalizer?.release()
            bassBoost?.release()
        }
        equalizer = null
        bassBoost = null
    }

    fun setEnabled(enabled: Boolean) {
        prefs.edit().putBoolean("enabled", enabled).apply()
        runCatching {
            equalizer?.enabled = enabled
            bassBoost?.enabled = enabled
        }
        _state.update { it.copy(isEnabled = enabled) }
    }

    fun setBassBoost(strength: Int) {
        val clamped = strength.coerceIn(0, 1000)
        prefs.edit().putInt("bass_boost", clamped).apply()
        runCatching {
            bassBoost?.let {
                if (it.strengthSupported) {
                    it.setStrength(clamped.toShort())
                }
            }
        }
        _state.update {
            it.copy(
                bassBoostStrength = clamped,
                selectedPreset = if (it.selectedPreset == "Custom" || it.selectedPreset == "Flat") it.selectedPreset else "Custom"
            )
        }
    }

    fun setPreset(presetName: String) {
        val levels = PRESET_LEVELS[presetName] ?: return
        val bass = PRESET_BASS[presetName] ?: 0

        prefs.edit().putString("preset", presetName).putInt("bass_boost", bass).apply()
        setBassBoost(bass)

        val updatedBands = _state.value.bands.mapIndexed { idx, band ->
            val newLevel = levels.getOrElse(idx) { 0 }.toShort().coerceIn(band.minMb, band.maxMb)
            prefs.edit().putInt("band_$idx", newLevel.toInt()).apply()
            runCatching { equalizer?.setBandLevel(band.bandIndex, newLevel) }
            band.copy(levelMb = newLevel)
        }

        _state.update {
            it.copy(
                selectedPreset = presetName,
                bassBoostStrength = bass,
                bands = updatedBands
            )
        }
    }

    fun setBandLevel(bandIndex: Short, levelMb: Short) {
        val idx = bandIndex.toInt()
        prefs.edit()
            .putString("preset", "Custom")
            .putInt("band_$idx", levelMb.toInt())
            .apply()

        runCatching {
            equalizer?.setBandLevel(bandIndex, levelMb)
        }

        val updatedBands = _state.value.bands.map { band ->
            if (band.bandIndex == bandIndex) {
                band.copy(levelMb = levelMb.coerceIn(band.minMb, band.maxMb))
            } else {
                band
            }
        }

        _state.update {
            it.copy(
                selectedPreset = "Custom",
                bands = updatedBands
            )
        }
    }
}
