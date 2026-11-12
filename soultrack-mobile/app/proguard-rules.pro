-keepattributes *Annotation*
-keepclassmembers class * {
    @kotlinx.serialization.Serializable <fields>;
}
-keep,allowobfuscation,allowshrinking class kotlinx.serialization.json.** { *; }
