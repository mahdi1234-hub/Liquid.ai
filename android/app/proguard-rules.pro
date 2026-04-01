# Koog framework
-keep class ai.koog.** { *; }
-keepclassmembers class ai.koog.** { *; }

# Keep tool annotations
-keep @ai.koog.agents.core.tools.annotations.Tool class * { *; }
-keepclassmembers class * {
    @ai.koog.agents.core.tools.annotations.Tool *;
}

# Ktor
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**

# Kotlinx serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
