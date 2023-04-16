export enum GelbooruPostRating {
  General = "general",
  Safe = "safe",
  Sensitive = "sensitive",
  Questionable = "questionable",
  Explicit = "explicit"
}

export interface GelbooruPost {
  id: number;
  created_at: string;
  score: number;
  width: number;
  height: number;
  md5: string;
  directory: string;
  image: string;
  rating: GelbooruPostRating;
  source: string;
  change: number;
  owner: string;
  creator_id: number;
  parent_id: number;
  sample: number;
  preview_width: number;
  preview_height: number;
  tags: string;
  title: string;
  has_notes: string;
  has_comments: string;
  file_url: string;
  preview_url: string;
  sample_url: string;
  sample_width: number;
  sample_height: number;
  status: string;
  post_locked: number;
  has_children: string;
}

export interface GelbooruPostListSearchOptions {
  id?: number;
  limit?: number;
  pid?: number;
  tags?: string;
  change_id?: number;
}

export class GelbooruClient {
  private readonly apiKey: string;
  private readonly apiUser: string;

  constructor(apiKey: string, apiUser: string) {
    this.apiKey = apiKey;
    this.apiUser = apiUser;
  }

  private async request(type: string, options: any): Promise<unknown> {
    const url = new URL("https://gelbooru.com/index.php");
    url.searchParams.append("page", "dapi");
    url.searchParams.append("s", type);
    url.searchParams.append("q", "index");
    url.searchParams.append("json", "1");
    url.searchParams.append("api_key", this.apiKey);
    url.searchParams.append("api_user", this.apiUser);

    for (const [key, value] of Object.entries(options)) {
      url.searchParams.append(key, String(value));
    }
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
  }

  public async getPosts(
    options: GelbooruPostListSearchOptions
  ): Promise<GelbooruPost[]> {
    const response = await this.request("post", options);
    if (
      typeof response !== "object" ||
      !Object.prototype.hasOwnProperty.call(response, "post")
    )
      return [];

    return (response as any).post as GelbooruPost[];
  }
}
