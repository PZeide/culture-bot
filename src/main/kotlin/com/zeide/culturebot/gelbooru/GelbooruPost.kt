package com.zeide.culturebot.gelbooru

import com.zeide.culturebot.httpClient
import de.androidpit.colorthief.ColorThief
import dev.kord.common.Color
import dev.kord.rest.builder.message.EmbedBuilder
import io.ktor.client.request.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import org.apache.tika.Tika
import java.io.InputStream
import javax.imageio.ImageIO

@Serializable
data class GelbooruPost(
    val id: Int,
    val source: String,
    val height: Int,
    val width: Int,
    val owner: String,
    val rating: PostRating,
    val score: Int,
    @Serializable(with = PostTagsSerializer::class) val tags: PostTags,
    val title: String,
    @SerialName("file_url") val fileUrl: String,
    val directory: String,
    val hash: String
) {
    suspend fun fetchProminentColor() = prominentColorCache.getOrPut(id) {
        withContext(Dispatchers.IO) {
            val rgb = httpClient.get<InputStream>("https://gelbooru.com/thumbnails/$directory/thumbnail_$hash.jpg").use { inputStream ->
                ColorThief.getColor(ImageIO.read(inputStream), 3, true)
            }

            Color(rgb[0], rgb[1], rgb[2])
        }
    }

    companion object {
        private val urlPattern = Regex("^(https://|http://)(?!-.)[^\\s/\$.?#].[^\\s]*$")
        private val tika = Tika()
        private val prominentColorCache = mutableMapOf<Int, Color>()

        suspend fun EmbedBuilder.forPost(post: GelbooruPost) {
            val source = if (post.source.isNotBlank()) {
                post.source.split(' ').joinToString(" ", prefix = " | ") { singleSource ->
                    if (urlPattern.matches(singleSource)) {
                        "[Source]($singleSource)"
                    } else { singleSource }
                }
            } else ""

            val mimeType = tika.detect(post.fileUrl)

            title = post.title
            description = """
                        [Lien du post](https://gelbooru.com/index.php?page=post&s=view&id=${post.id})$source
                        Rating: ${post.rating.displayName} | Score: ${post.score}
                    """.trimIndent()
            color = post.fetchProminentColor()

            when {
                mimeType.startsWith("image") -> image = post.fileUrl
                mimeType.startsWith("video") -> {
                    field("Chargement impossible") {
                        """Le post est une vidéo et Discord ne permet pas de charger des vidéos. 
                            |[Lien direct de la vidéo](${post.fileUrl})""".trimMargin()
                    }
                }

                else -> {
                    field("Chargement impossible") {
                        """Le post est une est un type inconnu. 
                            |[Lien direct](${post.fileUrl})""".trimMargin()
                    }
                }
            }
        }
    }
}