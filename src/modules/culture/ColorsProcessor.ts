import { GelbooruPost } from "@modules/culture/api/GelbooruAPI";
import Discord from "discord.js";
import LRUCache from "lru-cache";
import Vibrant from "node-vibrant";

export class ColorsProcessor {
  private readonly cache: LRUCache<number, Discord.HexColorString>;

  constructor() {
    this.cache = new LRUCache({ max: 1000 });
  }

  private async computeDominantColorFromUrl(url: string): Promise<Discord.HexColorString> {
    const palette = await Vibrant.from(url).getPalette();
    if (palette.Vibrant === null)
      return "#000000";
      
    return palette.Vibrant.hex as Discord.HexColorString;
  }

  public async getDominantColor(post: GelbooruPost): Promise<Discord.HexColorString> {
    const cached = this.cache.get(post.id);
    if (cached !== undefined) {
      return cached;
    }

    const color = await this.computeDominantColorFromUrl(post.preview_url);
    this.cache.set(post.id, color);
    return color;
  }
}