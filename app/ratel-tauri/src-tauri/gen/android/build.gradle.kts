buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:9.4.0")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.1.21")
        // FCM: processes google-services.json into resources at build time.
        classpath("com.google.gms:google-services:4.5.0")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// tauri-plugin-google-auth 0.5.1 and tauri-plugin-opener 2.5.3 declare
// `consumerProguardFiles("consumer-rules.pro")` but ship no such file. AGP 8
// skipped the missing file; AGP 9 fails mergeReleaseConsumerProguardFiles. Those
// modules live in the cargo registry, so drop the dangling entries here — a file
// that does not exist contributed no rules, so R8 sees the same input as before.
subprojects {
    afterEvaluate {
        extensions.findByType(com.android.build.gradle.LibraryExtension::class.java)?.defaultConfig?.let { config ->
            val existing = config.consumerProguardFiles.filter { it.exists() }
            config.consumerProguardFiles.clear()
            config.consumerProguardFiles.addAll(existing)
        }
    }
}

tasks.register("clean").configure {
    delete("build")
}

