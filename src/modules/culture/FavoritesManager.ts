import { CultureDataTypes } from "@core/DatabaseManager";
import { Snowflake } from "discord.js";
import { DataTypes, Model, Sequelize } from "sequelize";

export class FavoritesEntry extends Model {
  public declare userId: Snowflake;
  public declare favorites: number[];
}

export class FavoritesManager {
  private readonly database: Sequelize;

  constructor(database: Sequelize) {
    this.database = database;
  }

  public async init(): Promise<void> {
    FavoritesEntry.init({
      userId: {
        type: CultureDataTypes.SNOWFLAKE,
        primaryKey: true,
      },
      favorites: {
        type: CultureDataTypes.JSARRAY(DataTypes.INTEGER),
        defaultValue: [],
      },
    }, { sequelize: this.database, modelName: "favorites" });

    await FavoritesEntry.sync({ alter: true });
  }

  public async getFavorites(userId: Snowflake): Promise<number[]> {
    const entry = await FavoritesEntry.findByPk(userId);
    return entry?.favorites ?? [];
  }

  public async addFavorite(userId: Snowflake, favorite: number): Promise<void> {
    const favorites = await this.getFavorites(userId);
    if (favorites.includes(favorite))
      return;

    favorites.push(favorite);
    await FavoritesEntry.upsert({ userId, favorites });
  }

  public async removeFavorite(userId: Snowflake, favorite: number): Promise<void> {
    const favorites = await this.getFavorites(userId);
    if (!favorites.includes(favorite))
      return;

    const index = favorites.indexOf(favorite);
    favorites.splice(index, 1);
    await FavoritesEntry.upsert({ userId, favorites });
  }

  public async isFavorite(userId: Snowflake, favorite: number): Promise<boolean> {
    const favorites = await this.getFavorites(userId);
    return favorites.includes(favorite);
  }
}