package com.zeide.culturebot.gelbooru

import com.zeide.culturebot.httpClient
import io.ktor.client.request.*
import io.ktor.http.*
import kotlinx.serialization.SerializationException

typealias PostTags = Set<String>

object GelbooruAPI {
    private val API_KEY = System.getenv("GELBOORU_API_KEY")
        ?: error("Environment variable GELBOORU_API_KEY is missing !")
    private val USER_ID = System.getenv("GELBOORU_USER_ID")
        ?: error("Environment variable GELBOORU_USER_ID is missing !")

    private val BASE_URL = "https://gelbooru.com/index.php?page=dapi&q=index&api_key=$API_KEY&user_id=$USER_ID"

    suspend fun fetchPosts(
        limit: Int? = null,
        tags: PostTags? = null
    ) = try {
        httpClient.get<List<GelbooruPost>>(buildString {
            append("$BASE_URL&s=post&json=1")
            limit?.let { append("&limit=$limit") }
            tags?.let { append("&tags=${tags.joinToString(" ").encodeURLParameter()}") }
        })
    } catch (e: SerializationException) {
        listOf()
    }
}