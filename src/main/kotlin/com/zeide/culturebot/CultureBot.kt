package com.zeide.culturebot

import com.zeide.culturebot.gelbooru.PostTags
import dev.kord.common.Color
import dev.kord.common.entity.PresenceStatus
import dev.kord.common.entity.Snowflake
import dev.kord.core.Kord
import dev.kord.core.behavior.channel.MessageChannelBehavior
import dev.kord.core.behavior.channel.createEmbed
import dev.kord.core.entity.Message
import dev.kord.core.entity.User
import dev.kord.core.entity.channel.DmChannel
import dev.kord.core.event.message.MessageCreateEvent
import dev.kord.core.event.message.ReactionAddEvent
import dev.kord.core.on
import dev.kord.x.emoji.Emojis
import dev.kord.x.emoji.addReaction
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentMap

object CultureBot {
    private val TOKEN = System.getenv("BOT_TOKEN")
        ?: error("Environment variable BOT_TOKEN is missing !")
    private const val PREFIX = "?"

    private val taskQueue = TaskQueue()
    private val multiPosts: ConcurrentMap<Snowflake, MultiPostDescriptor> = ConcurrentHashMap()

    suspend fun login() {
        logger.info { "Initializing discord bot instance." }

        Kord(TOKEN) {
            httpClient = com.zeide.culturebot.httpClient
        }.also { kordClient ->
            initialize(kordClient)
            taskQueue.startProcessing()
            logger.info { "Attempt to login the bot." }
            kordClient.login {
                status = PresenceStatus.DoNotDisturb
                watching("des posts sur Gelbooru !")
            }
        }
    }

    suspend fun registerMultiPost(message: Message, multiPostDescriptor: MultiPostDescriptor) {
        message.addReaction(Emojis.arrowBackward)
        message.addReaction(Emojis.arrowForward)

        multiPosts[message.id] = multiPostDescriptor
    }

    private suspend fun sendHelpEmbed(channel: MessageChannelBehavior) {
        channel.createEmbed {
            title = "**Commandes du CultureBot**"
            description = """
                            *Note: Tous les tags peuvent être utilisés, plus d'infos sur l'utilisation des tags [Gelbooru Cheatsheet](https://gelbooru.com/index.php?page=help&topic=cheatsheet)*
                            *Note: Vous pouvez ajouter :n a la fin de la commande (remplacer 'n' par un nombre entre 1 et 200) pour afficher au maximum n posts (plus rapide que de faire plusieurs fois la même commande).*
                            
                            *Attention: Le rating questionable représente la bordure entre le safe et le nsfw, de ce fait, des post nsfw peuvent apparaître avec le rating questionable.*
                        """.trimIndent()

            color = Color(204, 195, 169)

            field("${PREFIX}post [tags]") { "Affiche le ou les derniers posts" }
            field("${PREFIX}spost [tags]") { "Affiche le ou les derniers posts avec le rating safe" }
            field("${PREFIX}qpost [tags]") { "Affiche le ou les derniers posts avec le rating questionable" }
            field("${PREFIX}epost [tags]") { "Affiche le ou les derniers posts avec le rating explicit" }

            field("${PREFIX}random [tags]") { "Affiche un ou plusieurs posts au hasard" }
            field("${PREFIX}srandom [tags]") { "Affiche un ou plusieurs posts au hasard avec le rating safe" }
            field("${PREFIX}qrandom [tags]") { "Affiche un ou plusieurs posts au hasard avec le rating questionable" }
            field("${PREFIX}erandom [tags]") { "Affiche un ou plusieurs posts au hasard avec le rating explicit" }
        }
    }

    private suspend fun sendPosts(issuer: User, channel: MessageChannelBehavior, limit: Int, tags: PostTags) {
        taskQueue.offer(issuer, PostTask(channel, limit, tags))
    }

    private suspend fun initialize(kordClient: Kord) {
        kordClient.on<MessageCreateEvent> {
            fun insertTags(tags: Iterable<String>, vararg toInsert: String) = tags.filterNot { tag -> /* Remove tags that are being inserted from default tag list */
                toInsert.any { tagToRemove ->
                    tag.startsWith(tagToRemove.removeRange(tagToRemove.indexOf(':') until tagToRemove.length)) /* Remove if identifier is matching, example: 'limit:' */
                }
            }.let { safeTags -> safeTags + toInsert /* Add tags */ }.toSet()

            val author = message.author
            val channel = message.getChannel()
            val content = message.content

            if (author == null || author.isBot || channel is DmChannel)
                return@on

            if (content.startsWith(PREFIX)) {
                val parts = content.removePrefix(PREFIX).split(' ').toMutableList()

                when(val command = parts.removeFirst()) {
                    "help" -> sendHelpEmbed(channel)

                    else -> {
                        val commandParts = command.split(':')
                        val limit = when (commandParts.size) {
                            1 -> 1
                            2 -> {
                                val unsafeLimit = commandParts[1].toIntOrNull()

                                if (unsafeLimit == null) {
                                    channel.createMessage("Le tag limit est invalide, exemple: limit:10")
                                    return@on
                                }

                                if (unsafeLimit > 200) {
                                    channel.createMessage("La valeur du tag limit ne peut pas être supérieur a 200.")
                                    return@on
                                }

                                unsafeLimit
                            }
                            else -> {
                                return@on
                            }
                        }

                        when (commandParts.first()) {
                            "post" -> sendPosts(author, channel, limit, parts.toSet())
                            "spost" -> sendPosts(author, channel, limit, insertTags(parts, "rating:safe"))
                            "qpost" -> sendPosts(author, channel, limit, insertTags(parts, "rating:questionable"))
                            "epost" -> sendPosts(author, channel, limit, insertTags(parts, "rating:explicit"))

                            "random" -> sendPosts(author, channel, limit, insertTags(parts, "sort:random"))
                            "srandom" -> sendPosts(author, channel, limit, insertTags(parts, "rating:safe", "sort:random"))
                            "qrandom" -> sendPosts(author, channel, limit, insertTags(parts, "rating:questionable", "sort:random"))
                            "erandom" -> sendPosts(author, channel, limit, insertTags(parts, "rating:explicit", "sort:random"))
                        }
                    }
                }
            }
        }

        kordClient.on<ReactionAddEvent> {
            if (getUser().isBot)
                return@on

            val multiPostDescriptor = multiPosts[messageId]
                ?: return@on

            when (emoji.name) {
                Emojis.arrowBackward.unicode -> multiPostDescriptor.previous(message)
                Emojis.arrowForward.unicode -> multiPostDescriptor.next(message)
            }

            message.deleteReaction(userId, emoji)
        }
    }
}