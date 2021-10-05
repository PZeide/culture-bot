package com.zeide.culturebot

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.features.json.*
import io.ktor.client.features.json.serializer.*
import kotlinx.serialization.json.Json
import mu.KotlinLogging

val logger = KotlinLogging.logger("CultureBot")

val jsonSerializer = Json {
    ignoreUnknownKeys = true
}

val httpClient = HttpClient(CIO) {
    Json {
        serializer = KotlinxSerializer(jsonSerializer)
    }
}

suspend fun main() {
    logger.info { "Running on ${System.getProperty("java.version")} (${System.getProperty("java.home")})." }
    CultureBot.login()
}