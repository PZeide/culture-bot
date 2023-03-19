import { Command } from "@core/CommandsManager";
import { GelbooruPostRating } from "@modules/culture/api/GelbooruAPI";
import CultureModule from "@modules/culture/module";
import Discord from "discord.js";

export class CultureCommand extends Command {
  private readonly module: CultureModule;

  constructor(module: CultureModule) {
    super({
      name: "culture",
      description: "Retrieves culture (posts) from Gelbooru",
      options: [
        {
          name: "tags",
          description: "The tags to search for",
          type: Discord.ApplicationCommandOptionType.String,
          required: false
        },
        {
          name: "random",
          description: "Whether to retrieve random post(s)",
          type: Discord.ApplicationCommandOptionType.Boolean,
          required: false
        },
        {
          name: "count",
          description: "The number of posts to retrieve",
          type: Discord.ApplicationCommandOptionType.Number,
          required: false,
          minValue: 1
        },
        {
          name: "rating",
          description: "The rating of post(s) to retrieve",
          type: Discord.ApplicationCommandOptionType.String,
          required: false,
          choices: [
            {
              name: "General",
              value: GelbooruPostRating.General
            },
            {
              name: "Safe",
              value: GelbooruPostRating.Safe
            },
            {
              name: "Sensitive",
              value: GelbooruPostRating.Sensitive
            },
            {
              name: "Questionable",
              value: GelbooruPostRating.Questionable
            },
            {
              name: "Explicit",
              value: GelbooruPostRating.Explicit
            }
          ]
        }
      ]
    });

    this.module = module;
  }

  public async execute(
    interaction: Discord.ChatInputCommandInteraction
  ): Promise<void> {
    const tags = interaction.options.getString("tags") ?? "";
    const random = interaction.options.getBoolean("random") ?? true;
    const count = interaction.options.getNumber("count") ?? 1;
    const rating = interaction.options.getString("rating") ?? undefined;

    const searchTags = tags.split(" ");

    if (random) searchTags.push("sort:random");

    if (rating !== undefined) searchTags.push(`rating:${rating}`);

    /*if (rating === undefined && interaction.channel instanceof Discord.TextChannel && interaction.channel.nsfw) {
      searchTags.push("rating:safe");
      searchTags.push("rating:general");
    } else if (rating !== undefined) {
      searchTags.push(`rating:${rating}`);
    }*/

    const carousel = await this.module.carouselsManager.createSearchCarousel(
      interaction.user.id,
      {
        tags: searchTags.join(" "),
        limit: count
      }
    );

    const message = await carousel.buildMessage();
    await interaction.reply(message);
  }
}
