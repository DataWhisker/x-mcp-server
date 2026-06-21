const DEFAULT_XQUIK_BASE_URL = 'https://xquik.com/api/v1';
const XQUIK_BACKEND_NAME = 'xquik';

type JsonObject = Readonly<Record<string, unknown>>;

interface XquikSearchResponse extends JsonObject {
  readonly tweets?: unknown;
  readonly data?: unknown;
  readonly results?: unknown;
}

interface XquikMappedTweet extends JsonObject {
  readonly id?: string;
  readonly text?: string;
  readonly author_id?: string;
  readonly created_at?: string;
  readonly public_metrics?: JsonObject;
  readonly author?: unknown;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: JsonObject, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(source: JsonObject, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function compactObject(source: Record<string, unknown>): JsonObject {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined)
  );
}

function readXquikTweets(body: XquikSearchResponse): readonly unknown[] {
  const tweets = body.tweets ?? body.data ?? body.results;
  return Array.isArray(tweets) ? tweets : [];
}

function mapPublicMetrics(tweet: JsonObject): JsonObject | undefined {
  const metrics = compactObject({
    retweet_count:
      readNumber(tweet, 'retweetCount') ?? readNumber(tweet, 'retweet_count'),
    reply_count: readNumber(tweet, 'replyCount') ?? readNumber(tweet, 'reply_count'),
    like_count: readNumber(tweet, 'likeCount') ?? readNumber(tweet, 'like_count'),
    quote_count: readNumber(tweet, 'quoteCount') ?? readNumber(tweet, 'quote_count'),
    bookmark_count:
      readNumber(tweet, 'bookmarkCount') ?? readNumber(tweet, 'bookmark_count'),
    impression_count:
      readNumber(tweet, 'viewCount') ?? readNumber(tweet, 'impression_count'),
  });
  return Object.keys(metrics).length > 0 ? metrics : undefined;
}

function mapXquikTweet(tweet: unknown): XquikMappedTweet {
  if (!isObject(tweet)) return {};
  const author = isObject(tweet.author) ? tweet.author : undefined;
  return compactObject({
    id: readString(tweet, 'id'),
    text: readString(tweet, 'text'),
    author_id:
      readString(tweet, 'author_id') ??
      (author ? readString(author, 'id') : undefined),
    created_at: readString(tweet, 'created_at') ?? readString(tweet, 'createdAt'),
    public_metrics: mapPublicMetrics(tweet),
    author,
  });
}

function getXquikApiKey(): string {
  const apiKey = process.env.XQUIK_API_KEY;
  if (!apiKey) {
    throw new Error('XQUIK_API_KEY is required when X_MCP_SEARCH_BACKEND=xquik');
  }
  return apiKey;
}

function getXquikBaseUrl(): string {
  return (process.env.XQUIK_API_BASE_URL ?? DEFAULT_XQUIK_BASE_URL).replace(
    /\/+$/,
    ''
  );
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown;
    if (isObject(body)) {
      return (
        readString(body, 'message') ??
        readString(body, 'error') ??
        response.statusText
      );
    }
  } catch {
    return response.statusText;
  }
  return response.statusText;
}

export function useXquikSearchBackend(): boolean {
  return process.env.X_MCP_SEARCH_BACKEND === XQUIK_BACKEND_NAME;
}

export async function searchTweetsWithXquik(
  query: string,
  limit: number
): Promise<readonly XquikMappedTweet[]> {
  const url = new URL(`${getXquikBaseUrl()}/x/tweets/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-api-key': getXquikApiKey(),
    },
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(
      `Xquik search failed with HTTP ${response.status}: ${message}`
    );
  }

  const body = (await response.json()) as XquikSearchResponse;
  return readXquikTweets(body).map(mapXquikTweet);
}
