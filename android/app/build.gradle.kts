import java.io.File
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
}

// Assinatura: keystore fixo vindo do CI (variáveis ASX_KEYSTORE, ASX_KEYSTORE_SENHA, ASX_CHAVE, ASX_CHAVE_SENHA);
// sem ele (build local), usa a chave de debug da máquina, que não atualiza um app instalado pelo CI.
val keystore = System.getenv("ASX_KEYSTORE")?.let { File(it) }?.takeIf { it.exists() }

android {
    namespace = "br.asx.manutencao"
    compileSdk = 37

    defaultConfig {
        applicationId = "br.asx.manutencao"
        minSdk = 26
        targetSdk = 35
        // Número do build no GitHub Actions: cresce a cada build e é o que o botão "Procurar atualização" compara.
        val build = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1
        versionCode = build
        versionName = "1.$build"
    }

    buildFeatures { buildConfig = true }

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
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

