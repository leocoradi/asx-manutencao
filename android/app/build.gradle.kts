import java.io.File

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Assinatura: keystore vindo do CI (variáveis ASX_KEYSTORE, ASX_KEYSTORE_SENHA, ASX_CHAVE, ASX_CHAVE_SENHA);
// sem ele, usa a chave de debug. Trocar de chave exige desinstalar o app antes de atualizar.
val keystore = System.getenv("ASX_KEYSTORE")?.let { File(it) }?.takeIf { it.exists() }

android {
    namespace = "br.asx.manutencao"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.asx.manutencao"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

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
    kotlinOptions { jvmTarget = "17" }
}
