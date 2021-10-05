package com.zeide.culturebot

import com.zeide.culturebot.gelbooru.GelbooruPost
import com.zeide.culturebot.gelbooru.GelbooruPost.Companion.forPost
import dev.kord.core.behavior.MessageBehavior
import dev.kord.core.behavior.edit
import dev.kord.rest.builder.message.modify.embed

data class MultiPostDescriptor(
    val posts: List<GelbooruPost>,
    var currentIndex: Int
) {
    init {
        require(currentIndex in posts.indices) { "currentIndex should be a valid index in posts !" }
    }

    private suspend fun update(message: MessageBehavior) {
        val post = posts[currentIndex]

        message.edit {
            embed {
                forPost(post)
                footer {
                    text = "Posts: ${currentIndex + 1}/${posts.size}"
                }
            }
        }
    }

    suspend fun previous(message: MessageBehavior) {
        if (--currentIndex !in posts.indices)
            currentIndex = posts.size - 1

        update(message)
    }

    suspend fun next(message: MessageBehavior) {
        if (++currentIndex !in posts.indices)
            currentIndex = 0

        update(message)
    }
}