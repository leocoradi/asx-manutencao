// Versões alinhadas ao exemplo oficial do Navigation SDK 8 (AGP 9 com Kotlin embutido, Gradle 9.4).
plugins {
    id("com.android.application") version "9.2.0" apply false
    id("org.jetbrains.kotlin.android") version "2.3.0" apply false
}

// O Navigation SDK já traz o Maps SDK; uma segunda cópia vinda de outra dependência quebra o build.
allprojects {
    configurations.all { exclude(group = "com.google.android.gms", module = "play-services-maps") }
}
