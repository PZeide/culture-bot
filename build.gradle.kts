import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "1.5.31"
    kotlin("plugin.serialization") version "1.5.31"

    id("com.github.johnrengelman.shadow") version "7.1.0"
}

group = "com.zeide"
version = "1.0.1"

repositories {
    mavenCentral()
}

dependencies {
    implementation(kotlin("stdlib-jdk8"))

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.3.0")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.5.2")

    implementation("io.ktor:ktor-client-core:1.6.4")
    implementation("io.ktor:ktor-client-serialization:1.6.4")

    implementation("org.slf4j:slf4j-api:1.7.32")
    implementation("org.apache.logging.log4j:log4j-slf4j-impl:2.14.1")
    implementation("io.github.microutils:kotlin-logging:2.0.11")

    implementation("dev.kord:kord-core:0.8.0-M5")
    implementation("dev.kord.x:emoji:0.5.0")

    implementation("de.androidpit:color-thief:1.1.2")

    implementation("org.apache.tika:tika-core:2.0.0")
}

tasks.withType<Jar> {
    manifest {
        attributes(mapOf(
            "Main-Class" to "com.zeide.culturebot.LaunchKt",
            "Multi-Release" to true
        ))
    }
}

tasks.withType<KotlinCompile>() {
    kotlinOptions.jvmTarget = "1.8"
    kotlinOptions.freeCompilerArgs += "-Xopt-in=kotlin.RequiresOptIn"
}

tasks.create("stage") {
    dependsOn("clean", "shadowJar")
}

tasks.getByName("shadowJar").mustRunAfter(tasks.getByName("clean"))