import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) {
        keystorePropsFile.inputStream().use { load(it) }
    }
}

android {
    namespace = "com.soultrack.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.soultrack.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "1.0.1"

        // Override at build time with -PSOULTRACK_SERVER_URL=https://your-render-app.onrender.com
        val defaultServerUrl = (project.findProperty("SOULTRACK_SERVER_URL") as String?)
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: "http://10.0.2.2:3000"
        buildConfigField("String", "DEFAULT_SERVER_URL", "\"$defaultServerUrl\"")
    }

    signingConfigs {
        if (keystorePropsFile.exists()) {
            create("release") {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            val releaseServerUrl = (project.findProperty("SOULTRACK_SERVER_URL") as String?)
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
                ?: "https://soultrack-u6xm.onrender.com"
            buildConfigField("String", "DEFAULT_SERVER_URL", "\"$releaseServerUrl\"")
            isMinifyEnabled = true
            isShrinkResources = true
            if (keystorePropsFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)

    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.androidx.media3.session)
    implementation(libs.androidx.media3.datasource)
    implementation(libs.androidx.media3.datasource.okhttp)

    implementation(libs.coil.compose)
    implementation(libs.okhttp)
    implementation(libs.kotlinx.serialization.json)

    testImplementation(libs.junit)
}
