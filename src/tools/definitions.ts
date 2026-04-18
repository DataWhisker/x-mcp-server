import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const TOOL_DEFINITIONS: Tool[] = [
  // --- Timeline & Search ---
  {
    name: 'get_home_timeline',
    description: 'Get recent posts from your home timeline',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of posts to retrieve (1-100, default 20)',
          minimum: 1,
          maximum: 100,
        },
      },
    },
  },
  {
    name: 'search_tweets',
    description: 'Search recent posts from the last 7 days. Requires Basic tier or above.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (supports X search operators like from:, to:, has:, is:)',
        },
        limit: {
          type: 'number',
          description: 'Number of results (1-100, default 10)',
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['query'],
    },
  },

  // --- Tweet CRUD ---
  {
    name: 'get_tweet',
    description: 'Look up a specific post by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        tweet_id: {
          type: 'string',
          description: 'The ID of the post to look up',
        },
      },
      required: ['tweet_id'],
    },
  },
  {
    name: 'create_tweet',
    description: 'Create a new post with optional media attachment. Media upload requires OAuth 2.0 credentials.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text content of the post (max 280 characters)',
          maxLength: 280,
        },
        image_path: {
          type: 'string',
          description: 'Absolute path to an image file (PNG, JPEG, GIF, WEBP, max 5MB)',
        },
        video_path: {
          type: 'string',
          description: 'Absolute path to a video file (MP4, MOV, AVI, WEBM, M4V, max 512MB). Cannot be used with image_path.',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'reply_to_tweet',
    description: 'Reply to a post with optional media attachment',
    inputSchema: {
      type: 'object',
      properties: {
        tweet_id: {
          type: 'string',
          description: 'The ID of the post to reply to',
        },
        text: {
          type: 'string',
          description: 'The text content of the reply (max 280 characters)',
          maxLength: 280,
        },
        image_path: {
          type: 'string',
          description: 'Absolute path to an image file (PNG, JPEG, GIF, WEBP, max 5MB)',
        },
        video_path: {
          type: 'string',
          description: 'Absolute path to a video file (MP4, MOV, AVI, WEBM, M4V, max 512MB)',
        },
      },
      required: ['tweet_id', 'text'],
    },
  },
  {
    name: 'quote_tweet',
    description: 'Quote a post with your own commentary',
    inputSchema: {
      type: 'object',
      properties: {
        tweet_id: {
          type: 'string',
          description: 'The ID of the post to quote',
        },
        text: {
          type: 'string',
          description: 'Your commentary text (max 280 characters)',
          maxLength: 280,
        },
      },
      required: ['tweet_id', 'text'],
    },
  },
  {
    name: 'delete_tweet',
    description: 'Delete one of your posts',
    inputSchema: {
      type: 'object',
      properties: {
        tweet_id: {
          type: 'string',
          description: 'The ID of the post to delete',
        },
      },
      required: ['tweet_id'],
    },
  },

  // --- Engagement ---
  {
    name: 'like_tweet',
    description: 'Like a post. Not available on Free tier (removed Aug 2025). Requires Basic tier or above.',
    inputSchema: {
      type: 'object',
      properties: {
        tweet_id: {
          type: 'string',
          description: 'The ID of the post to like',
        },
      },
      required: ['tweet_id'],
    },
  },
  {
    name: 'unlike_tweet',
    description: 'Remove a like from a post',
    inputSchema: {
      type: 'object',
      properties: {
        tweet_id: {
          type: 'string',
          description: 'The ID of the post to unlike',
        },
      },
      required: ['tweet_id'],
    },
  },
  {
    name: 'retweet',
    description: 'Repost a post to your timeline',
    inputSchema: {
      type: 'object',
      properties: {
        tweet_id: {
          type: 'string',
          description: 'The ID of the post to repost',
        },
      },
      required: ['tweet_id'],
    },
  },
  {
    name: 'undo_retweet',
    description: 'Remove a repost from your timeline',
    inputSchema: {
      type: 'object',
      properties: {
        tweet_id: {
          type: 'string',
          description: 'The ID of the reposted post to undo',
        },
      },
      required: ['tweet_id'],
    },
  },
  {
    name: 'bookmark_tweet',
    description: 'Bookmark a post for later',
    inputSchema: {
      type: 'object',
      properties: {
        tweet_id: {
          type: 'string',
          description: 'The ID of the post to bookmark',
        },
      },
      required: ['tweet_id'],
    },
  },
  {
    name: 'unbookmark_tweet',
    description: 'Remove a bookmarked post',
    inputSchema: {
      type: 'object',
      properties: {
        tweet_id: {
          type: 'string',
          description: 'The ID of the bookmarked post to remove',
        },
      },
      required: ['tweet_id'],
    },
  },
  {
    name: 'get_bookmarks',
    description: 'Get your bookmarked posts',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of bookmarks to retrieve (1-100, default 20)',
          minimum: 1,
          maximum: 100,
        },
      },
    },
  },

  // --- Users ---
  {
    name: 'get_user',
    description: 'Look up a user by their username',
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'The username to look up (without the @ symbol)',
        },
      },
      required: ['username'],
    },
  },
  {
    name: 'get_user_tweets',
    description: "Get a user's recent posts by username",
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'The username (without @)',
        },
        limit: {
          type: 'number',
          description: 'Number of posts to retrieve (1-100, default 10)',
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['username'],
    },
  },
  {
    name: 'get_article',
    description: 'Fetch the full body content of an X Article post by its tweet ID',
    inputSchema: {
      type: 'object',
      properties: {
        tweet_id: {
          type: 'string',
          description: 'The ID of the X Article post',
        },
      },
      required: ['tweet_id'],
    },
  },
];
