import { Command } from "@core/CommandsManager";
import CultureModule from "@modules/culture/module";
import Discord from "discord.js";

export class FavoritesCommand extends Command {
  private readonly module: CultureModule;

  constructor(module: CultureModule) {
    super({
      name: "favorites",
      description: "Retrieves user favorites",
      options: [
        {
          name: "user",
          description: "The user to retrieve favorites from",
          type: Discord.ApplicationCommandOptionType.User,
          required: false
        }
      ]
    });

    this.module = module;
  }

  public override async execute(
    interaction: Discord.CommandInteraction
  ): Promise<void> {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const carousel = await this.module.carouselsManager.createFavoritesCarousel(
      interaction.user.id,
      user.id
    );
    const message = await carousel.buildMessage();
    await interaction.reply(message);
  }
}
