import { GelbooruClient, GelbooruPost, GelbooruPostListSearchOptions } from "@modules/culture/api/GelbooruAPI";
import CultureModule from "@modules/culture/module";
import DiscordJS from "discord.js";

export type CarouselError = { success: false, error: "MissingPost", postId: number } 
                          | { success: false, error: "PostsNotFound" } 
                          | { success: false, error: "ErrorFetchingPost",  stacktrace: unknown }

export type CarouselResult = { success: true, post: GelbooruPost } | CarouselError;

export abstract class CarouselData {
  protected readonly gelbooruClient: GelbooruClient;

  constructor(gelbooruClient: GelbooruClient) {
    this.gelbooruClient = gelbooruClient;
  }
  
  public static async fromUserFavorites(module: CultureModule, userId: DiscordJS.Snowflake): Promise<CarouselData> {
    try {
      const postIds = await module.favoritesManager.getFavorites(userId);
      if (postIds.length === 0)
        return new DelegatedSingleCarouselData(module.gelbooruClient, { success: false, error: "PostsNotFound" });

      return new LazyMultiCarouselData(module.gelbooruClient, postIds);
    } catch (error) {
      return new DelegatedSingleCarouselData(module.gelbooruClient, { success: false, error: "ErrorFetchingPost", stacktrace: error });
    }
  }

  public static async fromSearch(module: CultureModule, searchOptions: GelbooruPostListSearchOptions): Promise<CarouselData> {
    try {
      const posts = await module.gelbooruClient.getPosts(searchOptions);
      if (posts.length === 0)
        return new DelegatedSingleCarouselData(module.gelbooruClient, { success: false, error: "PostsNotFound" });

      if (searchOptions.limit === 1)
        return new DelegatedSingleCarouselData(module.gelbooruClient, { success: true, post: posts[0] });
      else
        return new DelegatedMultiCarouselData(module.gelbooruClient, posts.map(post => { return { success: true, post: post }; }));
    } catch (error) {
      return new DelegatedSingleCarouselData(module.gelbooruClient, { success: false, error: "ErrorFetchingPost", stacktrace: error });
    }
  }

  public static empty(module: CultureModule): CarouselData {
    return new DelegatedSingleCarouselData(module.gelbooruClient, { success: false, error: "PostsNotFound" });
  }

  abstract fetch(): Promise<CarouselResult>;
}

export abstract class MultiCarouselData extends CarouselData {
  abstract current: number;
  abstract readonly length: number;

  abstract next(): Promise<CarouselResult>;
  abstract previous(): Promise<CarouselResult>;
}

class DelegatedSingleCarouselData extends CarouselData {
  private readonly _result: CarouselResult;

  constructor(gelbooruClient: GelbooruClient, result: CarouselResult) {
    super(gelbooruClient);
    this._result = result;
  }

  public fetch(): Promise<CarouselResult> {
    return Promise.resolve(this._result);
  }
}

// Can be used in the future if we want to implement a carousel that fetch a single post lazily
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class LazySingleCarouselData extends CarouselData {
  private readonly _postId: number;
  private _result: CarouselResult | null;

  constructor(gelbooruClient: GelbooruClient, postId: number) {
    super(gelbooruClient);
    this._postId = postId;
    this._result = null;
  }

  public async fetch(): Promise<CarouselResult> {
    if (this._result !== null)
      return Promise.resolve(this._result);

    try {
      const response = await this.gelbooruClient.getPosts({ id: this._postId });
      this._result = { success: true, post: response[0] } ?? { success: false, error: "MissingPost", postId: this._postId };
    } catch (error) {
      this._result = { success: false, error: "ErrorFetchingPost", stacktrace: error };
    }

    return Promise.resolve(this._result);
  }
}

class DelegatedMultiCarouselData extends MultiCarouselData {
  public _current: number;
  private readonly _results: CarouselResult[];

  public get current(): number {
    return this._current;
  }

  public get length(): number {
    return this._results.length;
  }

  constructor(gelbooruClient: GelbooruClient, posts: CarouselResult[]) {
    super(gelbooruClient);
    this._current = 0;
    this._results = posts;
  }

  public async next(): Promise<CarouselResult> {
    if (this._results.length === 0)
      return Promise.resolve({ success: false, error: "PostsNotFound" });

    this._current = this._current + 1 === this._results.length ? this._current : this._current + 1;
    return Promise.resolve(this._results[this._current]);
  }

  public async previous(): Promise<CarouselResult> {
    if (this._results.length === 0)
      return Promise.resolve({ success: false, error: "PostsNotFound" });

    this._current = this._current - 1 < 0 ? this._current : this._current - 1;
    return Promise.resolve(this._results[this._current]);
  }

  public async fetch(): Promise<CarouselResult> {
    return Promise.resolve(this._results[this._current]);
  }
}

class LazyMultiCarouselData extends MultiCarouselData {
  private readonly _postIds: number[];
  private _results: CarouselResult[];
  private _current: number;

  public get current(): number {
    return this._current;
  }

  public get length(): number {
    return this._postIds.length;
  }

  constructor(gelbooruClient: GelbooruClient, postIds: number[]) {
    super(gelbooruClient);
    this._postIds = postIds;
    this._results = new Array(postIds.length).fill(null);
    this._current = 0;
  }

  public async next(): Promise<CarouselResult> {
    if (this._postIds.length === 0)
      return Promise.resolve({ success: false, error: "PostsNotFound" });

    this._current = this._current + 1 === this._results.length ? this._current : this._current + 1;
    return await this.fetch();
  }

  public async previous(): Promise<CarouselResult> {
    if (this._postIds.length === 0)
      return Promise.resolve({ success: false, error: "PostsNotFound" });

    this._current = this._current - 1 < 0 ? this._current : this._current - 1;
    return await this.fetch();
  }

  public async fetch(): Promise<CarouselResult> {
    if (this._postIds.length === 0)
      return Promise.resolve({ success: false, error: "PostsNotFound" });

    if (this._results[this._current] === null) {
      try {
        const response = await this.gelbooruClient.getPosts({ id: this._postIds[this._current] });
        this._results[this._current] = { success: true, post: response[0] } ?? { success: false, error: "MissingPost", postId: this._postIds[this._current] };
      } catch (error) {
        this._results[this._current] = { success: false, error: "ErrorFetchingPost", stacktrace: error };
      }
    }

    return Promise.resolve(this._results[this._current]);
  }
}