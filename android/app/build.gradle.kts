import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "app.foodtracker"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.foodtracker"
        minSdk = 26
        targetSdk = 35
        // Each port: the patch number and versionCode both go up by one (README, Re-porting).
        versionCode = 6
        versionName = "0.2.4"
    }

    // The release key: ../.secrets/android-release.properties (outside git; keep a copy of it and the .p12 it names).
    // Without it the release APK comes out unsigned (app-release-unsigned.apk), never signed with another key.
    val releaseKeys = rootProject.file("../.secrets/android-release.properties")
    signingConfigs {
        if (releaseKeys.exists()) create("release") {
            val p = Properties().apply { releaseKeys.inputStream().use { load(it) } }
            storeFile = releaseKeys.resolveSibling(p.getProperty("storeFile"))
            storePassword = p.getProperty("storePassword")
            keyAlias = p.getProperty("keyAlias")
            keyPassword = p.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Installing a newer APK over the old one keeps the app's data only if both are signed with this key.
            signingConfig = signingConfigs.findByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
    testOptions { unitTests.isIncludeAndroidResources = true }
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/web"))
}

// The web app (../app), built into the APK's assets under web/: the engine under the native screens, and the
// screens not ported yet (docs/execution/2026-11-03-native-ui.md). Built from the same checkout, so the native
// screens and the logic they call are always the same version.
val webApp = rootProject.file("../app")
val webBuild by tasks.registering(Exec::class) {
    val out = layout.buildDirectory.dir("generated/web/web")
    inputs.dir(webApp.resolve("src"))
    inputs.dir(webApp.resolve("public"))
    inputs.files(webApp.resolve("index.html"), webApp.resolve("package.json"), webApp.resolve("vite.config.js"))
    outputs.dir(out)
    workingDir = webApp
    commandLine("npx", "vite", "build", "--outDir", out.get().asFile.absolutePath, "--emptyOutDir")
}
tasks.named("preBuild") { dependsOn(webBuild) }

dependencies {
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.serialization.json)
    implementation(libs.coroutines.android)
    implementation(libs.zxing.embedded)
    debugImplementation(libs.compose.ui.tooling)
    debugImplementation(libs.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.androidx.test.junit)
    testImplementation(platform(libs.compose.bom))
    testImplementation(libs.compose.ui.test.junit4)
}

tasks.withType<Test>().configureEach {
    maxHeapSize = "1536m"
    // Screenshots of the UI tests land here (see HomeScreenTest).
    systemProperty("screenshots.dir", layout.buildDirectory.dir("screenshots").get().asFile.absolutePath)
    // Optional: a folder of views recorded from the web app (scripts/record-fixtures.mjs), screenshotted too.
    System.getenv("FIXTURES_DIR")?.let { systemProperty("fixtures.dir", it) }
}
