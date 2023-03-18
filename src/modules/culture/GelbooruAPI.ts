export interface PostListSearchOptions {
  id?: number
  limit?: number
  pid?: number
  tags?: string
  change_id?: number
}

export interface TagListSearchOptions {
  id?: number
  after_id?: number
  limit?: number
  pid?: number
  name?: string
  names?: string[]
  name_pattern?: string
  order? : "ASC" | "DESC"
  order_by?: "date" | "count" | "name"
}

export interface GelbooruPost {
  id: number
  created_at: string
  score: number
  width: number
  height: number
  md5: string
  directory: string
  image: string
  rating: GelbooruPostRating
  source: string
  change: number
  owner: string
  creator_id: number
  parent_id: number
  sample: number
  preview_width: number
  preview_height: number
  tags: string
  title: string
  has_notes: string
  has_comments: string
  file_url: string
  preview_url: string
  sample_url: string
  sample_width: number
  sample_height: number
  status: string
  post_locked: number
  has_children: string
}

export enum GelbooruTagType {
  General = 0,
  Artist = 1,
  // No idea what is the 2nd tag type
  Copyright = 3,
  Character = 4,
  Metadata = 5,
}

export interface GelbooruTag {
  id: number
  type: GelbooruTagType
  name: string
  count: number
  ambiguous: number
}

export enum GelbooruPostRating {
  General = "general",
  Safe = "safe",
  Sensitive = "sensitive",
  Questionable = "questionable",
  Explicit = "explicit",
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

  public async getPosts(options: PostListSearchOptions): Promise<GelbooruPost[]> {
    const response = await this.request("post", options);
    if (typeof response !== "object" || !Object.prototype.hasOwnProperty.call(response, "post"))
      return [];

    return (response as any).post as GelbooruPost[];
  }

  public async getTags(options: TagListSearchOptions): Promise<GelbooruTag[]> {
    const response = await this.request("tag", options);
    if (typeof response !== "object" || !Object.prototype.hasOwnProperty.call(response, "tag"))
      return [];

    return (response as any).tag as GelbooruTag[];
  }
}