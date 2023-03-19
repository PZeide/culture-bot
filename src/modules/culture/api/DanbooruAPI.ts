export enum DanbooruTagCategory {
  General = 0,
  Artist = 1,
  Copyright = 3,
  Character = 4,
  Meta = 5,
}

export interface DanbooruTag {
  id: number
  name: string
  category: DanbooruTagCategory
  post_count: number
  is_locked: boolean
  is_deprecated: boolean
  created_at: number
  updated_at: number
}

export interface DanbooruTagListSearchOptions {
  id?: number
  category?: DanbooruTagCategory
  post_count?: number
  created_at?: string
  updated_at?: number
  name?: string
  search?: Record<string, unknown>
}

export class DanbooruClient {
  private async request(type: string, options: any): Promise<unknown> {
    const url = new URL(`https://danbooru.donmai.us/${type}.json`);
    for (const [key, value] of Object.entries(options)) {
      if (typeof value === "object") {
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          url.searchParams.append(`${key}[${subKey}]`, String(subValue));
        }
      } else {
        url.searchParams.append(key, String(value));
      }
    }
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
  }

  public async getTags(options: DanbooruTagListSearchOptions): Promise<DanbooruTag[]> {
    const response = await this.request("tags", options);
    if (!Array.isArray(response))
      return [];

    return response as DanbooruTag[];
  }
}
