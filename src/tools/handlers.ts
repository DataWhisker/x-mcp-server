import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getClient, getAuthenticatedUserId } from '../client.js';
import { uploadMedia } from '../media.js';
import { withRateLimit } from '../rate-limit.js';

type HandlerResult = {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
};

function jsonResult(data: unknown): HandlerResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

const TWEET_ID_RE = /^\d{1,20}$/;
const USERNAME_RE = /^[A-Za-z0-9_]{1,15}$/;

function requireString(args: Record<string, unknown>, field: string): string {
  const value = args[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Missing or invalid required parameter: '${field}' (expected non-empty string)`
    );
  }
  return value;
}

function requireTweetId(args: Record<string, unknown>, field: string): string {
  const value = requireString(args, field);
  if (!TWEET_ID_RE.test(value)) {
    throw new McpError(ErrorCode.InvalidRequest, `Invalid tweet ID format for '${field}'`);
  }
  return value;
}

function requireUsername(args: Record<string, unknown>, field: string): string {
  const value = requireString(args, field);
  if (!USERNAME_RE.test(value)) {
    throw new McpError(ErrorCode.InvalidRequest, `Invalid username format for '${field}'`);
  }
  return value;
}

function optionalString(args: Record<string, unknown>, field: string): string | undefined {
  const value = args[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Invalid parameter: '${field}' (expected string)`
    );
  }
  return value;
}

function optionalNumber(args: Record<string, unknown>, field: string, fallback: number): number {
  const value = args[field];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Invalid parameter: '${field}' (expected number)`
    );
  }
  return value;
}

async function resolveMediaId(
  imagePath?: string,
  videoPath?: string
): Promise<string | undefined> {
  if (imagePath && videoPath) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Cannot attach both image and video. Provide only one.'
    );
  }

  if (!imagePath && !videoPath) return undefined;

  const filePath = (imagePath ?? videoPath)!;
  try {
    return await uploadMedia(filePath);
  } catch (error) {
    const mediaType = imagePath ? 'image' : 'video';
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Failed to upload ${mediaType}: ${(error as Error).message}`
    );
  }
}

// --- Timeline & Search ---

export async function handleGetHomeTimeline(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const limit = optionalNumber(args, 'limit', 20);
  const client = await getClient();

  const timeline = await withRateLimit('home_timeline', () =>
    client.v2.homeTimeline({
      max_results: Math.max(1, Math.min(limit, 100)),
      'tweet.fields': ['author_id', 'created_at', 'public_metrics', 'referenced_tweets'],
      expansions: ['author_id', 'referenced_tweets.id'],
      'user.fields': ['name', 'username'],
    })
  );

  return jsonResult(timeline.data);
}

export async function handleSearchTweets(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const query = requireString(args, 'query');
  const limit = optionalNumber(args, 'limit', 10);
  const client = await getClient();

  const results = await withRateLimit('search', () =>
    client.v2.search(query, {
      max_results: Math.max(1, Math.min(limit, 100)),
      'tweet.fields': ['author_id', 'created_at', 'public_metrics'],
      expansions: ['author_id'],
      'user.fields': ['name', 'username'],
    })
  );

  return jsonResult(results.data);
}

// --- Tweet CRUD ---

export async function handleGetTweet(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const tweetId = requireTweetId(args, 'tweet_id');
  const client = await getClient();

  const tweet = await withRateLimit('get_tweet', () =>
    client.v2.singleTweet(tweetId, {
      'tweet.fields': [
        'author_id',
        'created_at',
        'public_metrics',
        'referenced_tweets',
        'conversation_id',
      ],
      expansions: ['author_id', 'referenced_tweets.id'],
      'user.fields': ['name', 'username'],
    })
  );

  return jsonResult(tweet.data);
}

export async function handleCreateTweet(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const text = requireString(args, 'text');
  const imagePath = optionalString(args, 'image_path');
  const videoPath = optionalString(args, 'video_path');
  const client = await getClient();

  const mediaId = await resolveMediaId(imagePath, videoPath);

  const tweet = await withRateLimit('create_tweet', () =>
    mediaId
      ? client.v2.tweet({ text, media: { media_ids: [mediaId] } })
      : client.v2.tweet(text)
  );

  return jsonResult(tweet.data);
}

export async function handleReplyToTweet(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const tweetId = requireTweetId(args, 'tweet_id');
  const text = requireString(args, 'text');
  const imagePath = optionalString(args, 'image_path');
  const videoPath = optionalString(args, 'video_path');
  const client = await getClient();

  const mediaId = await resolveMediaId(imagePath, videoPath);

  const reply = await withRateLimit('reply', () =>
    mediaId
      ? client.v2.tweet({
          text,
          reply: { in_reply_to_tweet_id: tweetId },
          media: { media_ids: [mediaId] },
        })
      : client.v2.reply(text, tweetId)
  );

  return jsonResult(reply.data);
}

export async function handleQuoteTweet(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const tweetId = requireTweetId(args, 'tweet_id');
  const text = requireString(args, 'text');
  const client = await getClient();

  const tweet = await withRateLimit('quote', () =>
    client.v2.tweet({ text, quote_tweet_id: tweetId })
  );

  return jsonResult(tweet.data);
}

export async function handleDeleteTweet(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const tweetId = requireTweetId(args, 'tweet_id');
  const client = await getClient();

  const deleted = await withRateLimit('delete_tweet', () =>
    client.v2.deleteTweet(tweetId)
  );

  return jsonResult(deleted.data);
}

// --- Engagement ---

export async function handleLikeTweet(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const tweetId = requireTweetId(args, 'tweet_id');
  const client = await getClient();
  const userId = await getAuthenticatedUserId();

  const result = await withRateLimit('like', () =>
    client.v2.like(userId, tweetId)
  );

  return jsonResult(result.data);
}

export async function handleUnlikeTweet(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const tweetId = requireTweetId(args, 'tweet_id');
  const client = await getClient();
  const userId = await getAuthenticatedUserId();

  const result = await withRateLimit('unlike', () =>
    client.v2.unlike(userId, tweetId)
  );

  return jsonResult(result.data);
}

export async function handleRetweet(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const tweetId = requireTweetId(args, 'tweet_id');
  const client = await getClient();
  const userId = await getAuthenticatedUserId();

  const result = await withRateLimit('retweet', () =>
    client.v2.retweet(userId, tweetId)
  );

  return jsonResult(result.data);
}

export async function handleUndoRetweet(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const tweetId = requireTweetId(args, 'tweet_id');
  const client = await getClient();
  const userId = await getAuthenticatedUserId();

  const result = await withRateLimit('unretweet', () =>
    client.v2.unretweet(userId, tweetId)
  );

  return jsonResult(result.data);
}

export async function handleBookmarkTweet(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const tweetId = requireTweetId(args, 'tweet_id');
  const client = await getClient();

  const result = await withRateLimit('bookmark', () =>
    client.v2.bookmark(tweetId)
  );

  return jsonResult(result.data);
}

export async function handleUnbookmarkTweet(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const tweetId = requireTweetId(args, 'tweet_id');
  const client = await getClient();

  const result = await withRateLimit('unbookmark', () =>
    client.v2.deleteBookmark(tweetId)
  );

  return jsonResult(result.data);
}

export async function handleGetBookmarks(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const limit = optionalNumber(args, 'limit', 20);
  const client = await getClient();

  const bookmarks = await withRateLimit('get_bookmarks', () =>
    client.v2.bookmarks({
      max_results: Math.max(1, Math.min(limit, 100)),
      'tweet.fields': ['author_id', 'created_at', 'public_metrics'],
      expansions: ['author_id'],
      'user.fields': ['name', 'username'],
    })
  );

  return jsonResult(bookmarks.data);
}

// --- Users ---

export async function handleGetUser(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const username = requireUsername(args, 'username');
  const client = await getClient();

  const user = await withRateLimit('get_user', () =>
    client.v2.userByUsername(username, {
      'user.fields': [
        'description',
        'public_metrics',
        'created_at',
        'location',
        'url',
        'verified',
      ],
    })
  );

  return jsonResult(user.data);
}

export async function handleGetUserTweets(
  args: Record<string, unknown>
): Promise<HandlerResult> {
  const username = requireUsername(args, 'username');
  const limit = optionalNumber(args, 'limit', 10);
  const client = await getClient();

  const user = await withRateLimit('get_user', () =>
    client.v2.userByUsername(username)
  );

  if (!user.data) {
    throw new McpError(ErrorCode.InvalidRequest, `User @${username} not found`);
  }

  const tweets = await withRateLimit('user_tweets', () =>
    client.v2.userTimeline(user.data.id, {
      max_results: Math.max(1, Math.min(limit, 100)),
      'tweet.fields': ['created_at', 'public_metrics', 'referenced_tweets'],
    })
  );

  return jsonResult(tweets.data);
}
