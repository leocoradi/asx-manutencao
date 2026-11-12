import java.io.File
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
}

// Assinatura: keystore vindo do CI (variáveis ASX_KEYSTORE, ASX_KEYSTORE_SENHA, ASX_CHAVE, ASX_CHAVE_SENHA);
// sem ele, usa a chave de debug. Trocar de chave exige desinstalar o app antes de atualizar.
val keystore = System.getenv("ASX_KEYSTORE")?.let { File(it) }?.takeIf { it.exists() }

// Chave do Google para o Navigation SDK: vem do secret MAPS_API_KEY no CI e nunca entra no repositório.
// Sem ela o APK compila igual e o app usa o mapa web no lugar do nativo.
val chaveMaps = System.getenv("MAPS_API_KEY")?.trim().orEmpty()

android {
    namespace = "br.asx.manutencao"
    compileSdk = 37

    defaultConfig {
        applicationId = "br.asx.manutencao"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "1.1"
        manifestPlaceholders["MAPS_API_KEY"] = chaveMaps.ifEmpty { "SEM_CHAVE" }
        buildConfigField("boolean", "TEM_NAV", chaveMaps.isNotEmpty().toString())
    }

    buildFeatures { buildConfig = true }

    // Só os idiomas usados; sem isso entram os textos do SDK em todos os idiomas.
    androidResources { localeFilters += listOf("pt-rBR", "en") }

    signingConfigs {
        if (keystore != null) create("ci") {
            storeFile = keystore
            storePassword = System.getenv("ASX_KEYSTORE_SENHA")
            keyAlias = System.getenv("ASX_CHAVE")
            keyPassword = System.getenv("ASX_CHAVE_SENHA")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (keystore != null) signingConfigs.getByName("ci") else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    implementation("com.google.android.libraries.navigation:navigation:8.0.0")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs_nio:2.1.5")
}
