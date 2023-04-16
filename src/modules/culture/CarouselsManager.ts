import { CultureBot } from "@core/CultureBot";
import {
  CarouselData,
  CarouselResult,
  MultiCarouselData
} from "@modules/culture/CarouselData";
import { GelbooruPostListSearchOptions } from "@modules/culture/api/GelbooruAPI";
import CultureModule from "@modules/culture/module";
import * as datefns from "date-fns";
import Discord from "discord.js";
import mime from "mime";
import { v4 as uuid } from "uuid";

export interface Carousel {
  uuid: string;

  onButtonAction(action: Discord.ButtonInteraction): Promise<boolean>;
  buildMessage(): Promise<Discord.BaseMessageOptions>;
}

abstract class BaseCarousel implements Carousel {
  protected readonly module: CultureModule;
  protected readonly ownerId: Discord.Snowflake;
  public readonly uuid: string;
  protected data: CarouselData;

  constructor(
    module: CultureModule,
    ownerId: Discord.Snowflake,
    data: CarouselData
  ) {
    this.module = module;
    this.ownerId = ownerId;
    this.uuid = uuid();
    this.data = data;
  }

  protected action(text: string): string {
    return `act/${text}/${this.uuid}`;
  }

  public async onButtonAction(
    action: Discord.ButtonInteraction
  ): Promise<boolean> {
    if (
      action.customId === this.action("previous") &&
      this.data instanceof MultiCarouselData
    ) {
      await this.data.previous();
      await action.update(await this.buildMessage());
      return true;
    } else if (
      action.customId === this.action("next") &&
      this.data instanceof MultiCarouselData
    ) {
      await this.data.next();
      await action.update(await this.buildMessage());
      return true;
    }

    return false;
  }

  protected async buildEmbed(
    carouselResult: CarouselResult
  ): Promise<Discord.EmbedBuilder> {
    if (!carouselResult.success) {
      if (carouselResult.error === "MissingPost") {
        return new Discord.EmbedBuilder()
          .setDescription("**Le post n'existe pas**")
          .setColor("DarkRed");
      } else if (carouselResult.error === "PostsNotFound") {
        return new Discord.EmbedBuilder()
          .setDescription("**Aucun post trouvé**")
          .setColor("DarkRed");
      } else if (carouselResult.error === "ErrorFetchingPost") {
        return new Discord.EmbedBuilder()
          .setDescription(
            "**Une erreur est survenue lors de la récupération du post**"
          )
          .setColor("DarkRed");
      }
    }

    const post = carouselResult.post;

    let description = null;
    if (this.data instanceof MultiCarouselData) {
      description = `**Post ${this.data.current + 1} sur ${
        this.data.length
      }**\n`;
    }

    const timestamp = datefns.parse(
      post.created_at,
      "EEE MMM dd HH:mm:ss xxxx yyyy",
      new Date()
    );

    if (mime.getType(post.file_url)?.startsWith("image/")) {
      return new Discord.EmbedBuilder()
        .setDescription(description)
        .setImage(post.file_url.toString())
        .setTimestamp(timestamp)
        .setFooter({ text: `Score: ${post.score} • Rating: ${post.rating}` })
        .setColor(await this.module.colorsProcessor.getDominantColor(post));
    } else {
      if (description === null) description = "";
      description +=
        "\n\n**Ce format n'est pas supporté !**\nVous pouvez quand même le voir directement sur Gelbooru en cliquant sur le bouton 🔎\n\n";

      return new Discord.EmbedBuilder()
        .setDescription(description)
        .setTimestamp(timestamp)
        .setFooter({ text: `Score: ${post.score} • Rating: ${post.rating}` })
        .setColor(await this.module.colorsProcessor.getDominantColor(post));
    }
  }

  protected async buildComponents(
    carouselResult: CarouselResult
  ): Promise<
    Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>[]
  > {
    if (!carouselResult.success && carouselResult.error === "PostsNotFound")
      return [];

    const components: Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>[] =
      [];
    const baseRow =
      new Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>();

    if (this.data instanceof MultiCarouselData) {
      baseRow.addComponents(
        new Discord.ButtonBuilder()
          .setLabel("◀")
          .setStyle(Discord.ButtonStyle.Secondary)
          .setCustomId(this.action("previous"))
          .setDisabled(this.data.current === 0),
        new Discord.ButtonBuilder()
          .setLabel("▶")
          .setStyle(Discord.ButtonStyle.Secondary)
          .setCustomId(this.action("next"))
          .setDisabled(this.data.current === this.data.length - 1)
      );
    }

    if (carouselResult.success) {
      baseRow.addComponents(
        new Discord.ButtonBuilder()
          .setLabel("🔎")
          .setStyle(Discord.ButtonStyle.Link)
          .setURL(
            `https://gelbooru.com/index.php?page=post&s=view&id=${carouselResult.post.id}`
          ),
        new Discord.ButtonBuilder()
          .setLabel("💾")
          .setStyle(Discord.ButtonStyle.Link)
          .setURL(carouselResult.post.file_url)
      );
    }

    components.push(baseRow);
    return components;
  }

  public async buildMessage(): Promise<Discord.BaseMessageOptions> {
    const carouselResult = await this.data.fetch();
    const embed = await this.buildEmbed(carouselResult);
    const components = (await this.buildComponents(carouselResult)).filter(
      (row) => row.components.length > 0
    );

    return {
      embeds: [embed],
      components: components
    };
  }
}

class SearchCarousel extends BaseCarousel {
  private readonly searchOptions: GelbooruPostListSearchOptions;
  private hidden: boolean;

  public constructor(
    module: CultureModule,
    ownerId: Discord.Snowflake,
    searchOptions: GelbooruPostListSearchOptions
  ) {
    super(module, ownerId, CarouselData.empty(module));
    this.searchOptions = searchOptions;
    this.hidden = false;
  }

  public async refresh(): Promise<void> {
    this.data = await CarouselData.fromSearch(this.module, this.searchOptions);
  }

  public override async onButtonAction(
    action: Discord.ButtonInteraction
  ): Promise<boolean> {
    if (await super.onButtonAction(action)) return true;

    if (action.customId === this.action("favorite")) {
      const carouselResult = await this.data.fetch();
      if (carouselResult.success) {
        if (
          await this.module.favoritesManager.isFavorite(
            action.user.id,
            carouselResult.post.id
          )
        ) {
          await this.module.favoritesManager.removeFavorite(
            action.user.id,
            carouselResult.post.id
          );
          await action.reply({
            embeds: [
              new Discord.EmbedBuilder()
                .setDescription("**Post retiré des favoris**")
                .setColor("DarkRed")
            ],
            ephemeral: true
          });
        } else {
          await this.module.favoritesManager.addFavorite(
            action.user.id,
            carouselResult.post.id
          );
          await action.reply({
            embeds: [
              new Discord.EmbedBuilder()
                .setDescription("**Post ajouté aux favoris**")
                .setColor("Gold")
            ],
            ephemeral: true
          });
        }
      } else {
        await action.reply({
          embeds: [
            new Discord.EmbedBuilder()
              .setDescription("**Le post n'existe plus**")
              .setColor("DarkRed")
          ],
          ephemeral: true
        });
      }

      return true;
    } else if (action.customId === this.action("hide")) {
      if (this.ownerId === action.user.id) {
        this.hidden = !this.hidden;
        await action.update(await this.buildMessage());
      } else {
        await action.reply({
          embeds: [
            new Discord.EmbedBuilder()
              .setDescription(
                "**Seul le propriétaire peut cacher ou afficher un post**"
              )
              .setColor("DarkRed")
          ],
          ephemeral: true
        });
      }

      return true;
    } else if (action.customId === this.action("refresh")) {
      if (this.ownerId === action.user.id) {
        this.data = await CarouselData.fromSearch(
          this.module,
          this.searchOptions
        );
        await action.update(await this.buildMessage());
      } else {
        await action.reply({
          embeds: [
            new Discord.EmbedBuilder()
              .setDescription("**Seul le propriétaire peut rafrîchir un post**")
              .setColor("DarkRed")
          ],
          ephemeral: true
        });
      }

      return true;
    }

    return false;
  }

  protected override async buildEmbed(
    carouselResult: CarouselResult
  ): Promise<Discord.EmbedBuilder> {
    if (this.hidden) {
      return new Discord.EmbedBuilder()
        .setDescription("**Le contenu est caché**")
        .setColor("DarkRed");
    }

    return await super.buildEmbed(carouselResult);
  }

  protected override async buildComponents(
    carouselResult: CarouselResult
  ): Promise<
    Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>[]
  > {
    if (this.hidden) {
      return [
        new Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>().addComponents(
          new Discord.ButtonBuilder()
            .setLabel("👀")
            .setStyle(Discord.ButtonStyle.Success)
            .setCustomId(this.action("hide"))
        )
      ];
    }

    const components = await super.buildComponents(carouselResult);
    if (components.length === 0) return [];

    const userRow =
      new Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>();
    userRow.addComponents(
      new Discord.ButtonBuilder()
        .setLabel("❤️")
        .setStyle(Discord.ButtonStyle.Primary)
        .setCustomId(this.action("favorite")),
      new Discord.ButtonBuilder()
        .setLabel("👀")
        .setStyle(Discord.ButtonStyle.Danger)
        .setCustomId(this.action("hide")),
      new Discord.ButtonBuilder()
        .setLabel("🔄")
        .setStyle(Discord.ButtonStyle.Secondary)
        .setCustomId(this.action("refresh"))
    );

    components.push(userRow);
    return components;
  }
}

class FavoritesCarousel extends BaseCarousel {
  private readonly favoritesUserId: Discord.Snowflake;

  public constructor(
    module: CultureModule,
    ownerId: Discord.Snowflake,
    favoritesUserId: Discord.Snowflake
  ) {
    super(module, ownerId, CarouselData.empty(module));
    this.favoritesUserId = favoritesUserId;
  }

  public async refresh(): Promise<void> {
    this.data = await CarouselData.fromUserFavorites(
      this.module,
      this.favoritesUserId
    );
  }

  private async refreshAndKeepIndex(): Promise<void> {
    let carouselResult = await this.data.fetch();
    let currentPostIndex: number | undefined;
    if (carouselResult.success && carouselResult instanceof MultiCarouselData)
      currentPostIndex = carouselResult.current;

    await this.refresh();

    carouselResult = await this.data.fetch();
    if (
      currentPostIndex !== undefined &&
      carouselResult.success &&
      carouselResult instanceof MultiCarouselData
    )
      carouselResult.current =
        carouselResult.length >= currentPostIndex
          ? currentPostIndex
          : carouselResult.length - 1;
  }

  private async toggleFavorite(
    action: Discord.ButtonInteraction,
    carouselResult: CarouselResult
  ): Promise<void> {
    if (carouselResult.success) {
      if (
        await this.module.favoritesManager.isFavorite(
          action.user.id,
          carouselResult.post.id
        )
      ) {
        await this.module.favoritesManager.removeFavorite(
          action.user.id,
          carouselResult.post.id
        );
        await action.reply({
          embeds: [
            new Discord.EmbedBuilder()
              .setDescription("**Post retiré des favoris**")
              .setColor("DarkRed")
          ],
          ephemeral: true
        });

        if (this.ownerId === action.user.id) {
          await this.refreshAndKeepIndex();
          await action.message.edit(await this.buildMessage());
        }
      } else {
        await this.module.favoritesManager.addFavorite(
          action.user.id,
          carouselResult.post.id
        );
        await action.reply({
          embeds: [
            new Discord.EmbedBuilder()
              .setDescription("**Post ajouté aux favoris**")
              .setColor("Gold")
          ],
          ephemeral: true
        });
      }
    } else {
      await action.reply({
        embeds: [
          new Discord.EmbedBuilder()
            .setDescription("**Le post n'existe plus**")
            .setColor("DarkRed")
        ],
        ephemeral: true
      });
    }
  }

  public override async onButtonAction(
    action: Discord.ButtonInteraction
  ): Promise<boolean> {
    if (await super.onButtonAction(action)) return true;

    if (action.customId === this.action("favorite")) {
      const carouselResult = await this.data.fetch();
      await this.toggleFavorite(action, carouselResult);
      return true;
    }

    return false;
  }

  protected override async buildComponents(
    carouselResult: CarouselResult
  ): Promise<
    Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>[]
  > {
    const components = await super.buildComponents(carouselResult);
    if (components.length === 0) return [];

    const userRow =
      new Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>();
    userRow.addComponents(
      new Discord.ButtonBuilder()
        .setLabel("❤️")
        .setStyle(Discord.ButtonStyle.Primary)
        .setCustomId(this.action("favorite"))
    );

    components.push(userRow);
    return components;
  }
}

export class CarouselsManager {
  private readonly module: CultureModule;
  private readonly carousels: Map<string, BaseCarousel>;

  constructor(bot: CultureBot, module: CultureModule) {
    this.module = module;
    this.carousels = new Map();

    bot.client.on("interactionCreate", this.onInteraction.bind(this));
  }

  public async createSearchCarousel(
    ownerId: Discord.Snowflake,
    searchOptions: GelbooruPostListSearchOptions
  ): Promise<Carousel> {
    const carousel = new SearchCarousel(this.module, ownerId, searchOptions);
    await carousel.refresh();
    this.carousels.set(carousel.uuid, carousel);
    return carousel;
  }

  public async createFavoritesCarousel(
    ownerId: Discord.Snowflake,
    favoritesUserId: Discord.Snowflake
  ): Promise<Carousel> {
    const carousel = new FavoritesCarousel(
      this.module,
      ownerId,
      favoritesUserId
    );
    await carousel.refresh();
    this.carousels.set(carousel.uuid, carousel);
    return carousel;
  }

  private async onInteraction(interaction: Discord.Interaction): Promise<void> {
    if (!interaction.isButton() || !interaction.customId.startsWith("act/"))
      return;

    const carouselUuid = interaction.customId.split("/")[2];
    const carousel = this.carousels.get(carouselUuid);
    if (carousel === undefined) {
      await interaction.reply({
        embeds: [
          new Discord.EmbedBuilder()
            .setDescription(
              "**Il n'est plus possible d'interagir avec ce post**"
            )
            .setColor("DarkRed")
        ],
        ephemeral: true
      });
      return;
    }

    if (!(await carousel.onButtonAction(interaction))) {
      console.error("Unhandled button action", interaction.customId);
      await interaction.reply({
        embeds: [
          new Discord.EmbedBuilder()
            .setDescription("**L'action est indisponible**")
            .setColor("DarkRed")
        ],
        ephemeral: true
      });
    }
  }
}
