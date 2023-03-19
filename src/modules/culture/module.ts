import { CultureBot } from "@core/CultureBot";
import { Module } from "@core/ModulesManager";
import { CarouselsManager } from "@modules/culture/CarouselsManager";
import { ColorsProcessor } from "@modules/culture/ColorsProcessor";
import { CultureCommand } from "@modules/culture/CultureCommand";
import { FavoritesCommand } from "@modules/culture/FavoritesCommand";
import { FavoritesManager } from "@modules/culture/FavoritesManager";
import { GelbooruClient } from "@modules/culture/api/GelbooruAPI";

class CultureModule extends Module {
  public readonly gelbooruClient: GelbooruClient;
  public readonly favoritesManager: FavoritesManager;
  public readonly colorsProcessor: ColorsProcessor;
  public readonly carouselsManager: CarouselsManager;

  constructor(bot: CultureBot) {
    super(bot);

    const apiKey = process.env.GELBOORU_API_KEY;
    const apiUser = process.env.GELBOORU_API_USER;

    if (apiKey === undefined || apiUser === undefined)
      throw Error(
        "Gelbooru API key or user not set ! Use the GELBOORU_API_KEY and GELBOORU_API_USER environment variables."
      );

    this.gelbooruClient = new GelbooruClient(apiKey, apiUser);
    this.favoritesManager = new FavoritesManager(bot.database);
    this.colorsProcessor = new ColorsProcessor();
    this.carouselsManager = new CarouselsManager(bot, this);
  }

  public async init(bot: CultureBot): Promise<void> {
    await this.favoritesManager.init();

    bot.addCommand(new CultureCommand(this));
    bot.addCommand(new FavoritesCommand(this));
  }

  public async dispose(_bot: CultureBot): Promise<void> {
    return Promise.resolve();
  }
}

export = CultureModule;
