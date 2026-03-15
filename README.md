# X MCP Server

A Model Context Protocol (MCP) server for X (Twitter) integration. Provides 16 tools for reading timelines, posting, searching, engagement (likes, retweets, bookmarks), and user lookup. Designed for use with Claude desktop and other MCP-compatible clients.

<a href="https://glama.ai/mcp/servers/5nx3qqiunw"><img width="380" height="200" src="https://glama.ai/mcp/servers/5nx3qqiunw/badge" alt="X Server MCP server" /></a>

## Features

- **Timeline & Search** — Home timeline, search recent posts (7-day window)
- **Post Management** — Create, reply, quote, delete posts with optional media
- **Engagement** — Like/unlike, retweet/undo, bookmark/unbookmark
- **User Lookup** — Get user profiles and their recent posts
- **Media Upload** — Images (PNG, JPEG, GIF, WEBP) and videos (MP4, MOV, AVI, WEBM, M4V) via v2 upload API
- **Dual Auth** — OAuth 1.0a for post operations, OAuth 2.0 for media upload (v1.1 upload was sunset June 2025)
- **Rate Limiting** — Automatic per-endpoint rate limit tracking with clear error messages
- **TypeScript** — Full type safety, modular file structure

## Prerequisites

- Node.js >= 18.0.0
- X (Twitter) Developer Account
- Claude desktop app (or any MCP-compatible client)

## X API Access & Pricing

| Tier | Cost | Post Reads | Post Writes | Notes |
|------|------|-----------|-------------|-------|
| **Free** | $0 | ~100/month | ~500/month | No likes/follows; media upload requires OAuth 2.0 |
| **Basic** | $200/month | 10,000/month | 3,000/month | Search, limited read access |
| **Pro** | $5,000/month | 1,000,000/month | 300,000/month | Full search, filtered stream |
| **Pay-Per-Use** | Credit-based | ~$0.005/read | Varies | Launched Feb 2026, 2M reads cap |

> Like and Follow endpoints were removed from the Free tier in August 2025.
> Follows/Blocks endpoints are Enterprise-only as of 2025.

## Installation

```bash
git clone https://github.com/DataWhisker/x-mcp-server.git
cd x-mcp-server
npm install
npm run build
```

## Authentication

The server supports two authentication methods. You need **at least one** configured.

### OAuth 1.0a (Required for basic operations)

Works for all post/engagement/search/user operations.

| Environment Variable | Description |
|---------------------|-------------|
| `TWITTER_API_KEY` | Consumer Key (API Key) |
| `TWITTER_API_SECRET` | Consumer Secret (API Key Secret) |
| `TWITTER_ACCESS_TOKEN` | User Access Token |
| `TWITTER_ACCESS_SECRET` | User Access Token Secret |

**Setup:** In the [X Developer Portal](https://developer.x.com/en/portal/dashboard):
1. Create a project and app
2. Enable OAuth 1.0a under "User authentication settings"
3. Set permissions to "Read and Write"
4. Generate Consumer Keys and Access Tokens

### OAuth 2.0 (Required for media upload)

The v1.1 media upload endpoint was sunset in June 2025. Media upload now requires OAuth 2.0 via the v2 upload API.

**Option A — Direct access token:**

| Variable | Description |
|----------|-------------|
| `TWITTER_OAUTH2_ACCESS_TOKEN` | OAuth 2.0 user access token (expires in 2 hours) |

**Option B — Auto-refresh (recommended for long-running servers):**

| Variable | Description |
|----------|-------------|
| `TWITTER_CLIENT_ID` | OAuth 2.0 Client ID |
| `TWITTER_CLIENT_SECRET` | OAuth 2.0 Client Secret (optional for public clients) |
| `TWITTER_OAUTH2_REFRESH_TOKEN` | OAuth 2.0 Refresh Token |

Tokens are auto-refreshed and persisted to `~/.x-mcp-tokens.json`.

**Setup:** In the [X Developer Portal](https://developer.x.com/en/portal/dashboard):
1. In your app settings, enable OAuth 2.0
2. Set type to "Confidential client" or "Public client"
3. Add a callback URL
4. Request scopes: `tweet.read`, `tweet.write`, `users.read`, `media.write`, `offline.access`, `like.read`, `like.write`, `bookmark.read`, `bookmark.write`

## Claude Desktop Configuration

Add to `%APPDATA%/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "x": {
      "command": "node",
      "args": ["C:/path/to/x-mcp-server/build/index.js"],
      "env": {
        "TWITTER_API_KEY": "your-api-key",
        "TWITTER_API_SECRET": "your-api-secret",
        "TWITTER_ACCESS_TOKEN": "your-access-token",
        "TWITTER_ACCESS_SECRET": "your-access-secret",
        "TWITTER_OAUTH2_ACCESS_TOKEN": "your-oauth2-token"
      }
    }
  }
}
```

## Available Tools (16)

### Timeline & Search

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `get_home_timeline` | Get recent posts from home timeline | `limit` (1-100) |
| `search_tweets` | Search recent posts (7-day window) | `query`, `limit` |

### Post Management

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `get_tweet` | Look up a post by ID | `tweet_id` |
| `create_tweet` | Create a post with optional media | `text`, `image_path?`, `video_path?` |
| `reply_to_tweet` | Reply to a post with optional media | `tweet_id`, `text`, `image_path?`, `video_path?` |
| `quote_tweet` | Quote a post with commentary | `tweet_id`, `text` |
| `delete_tweet` | Delete your post | `tweet_id` |

### Engagement

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `like_tweet` | Like a post (Basic+ tier) | `tweet_id` |
| `unlike_tweet` | Remove a like | `tweet_id` |
| `retweet` | Repost to your timeline | `tweet_id` |
| `undo_retweet` | Remove a repost | `tweet_id` |
| `bookmark_tweet` | Bookmark for later | `tweet_id` |
| `unbookmark_tweet` | Remove a bookmark | `tweet_id` |
| `get_bookmarks` | Get your bookmarks | `limit` (1-100) |

### Users

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `get_user` | Look up user by username | `username` |
| `get_user_tweets` | Get a user's recent posts | `username`, `limit` |

## Media Support

- **Images:** PNG, JPEG, GIF, WEBP (max 5MB)
- **Videos:** MP4, MOV, AVI, WEBM, M4V (max 512MB, streamed chunked upload)
- Cannot attach both image and video to the same post
- Requires OAuth 2.0 credentials (v1.1 upload sunset June 2025)
- **Path restriction:** Only files within your home directory or system temp directory can be uploaded (prevents path traversal)

## Security

- **Input validation:** Tweet IDs must be numeric (1-20 digits), usernames must match `[A-Za-z0-9_]{1,15}`
- **Media path restriction:** Upload paths are validated against an allow-list (home directory, temp directory)
- **Token storage:** OAuth 2.0 tokens persisted to `~/.x-mcp-tokens.json` with `0o600` permissions (Unix). On Windows, file permissions are not enforced by the OS — protect the file via NTFS ACLs or use environment variables instead.
- **Error sanitization:** X API error details are logged server-side only; sanitized messages are returned to MCP clients
- **Refresh mutex:** Concurrent token refresh attempts are deduplicated to prevent race conditions

## Development

```bash
npm run build    # Compile TypeScript
npm run dev      # Watch mode
npm start        # Run the server
```

## Project Structure

```
src/
  index.ts              # MCP server entry point & handler dispatch
  client.ts             # Twitter client setup (OAuth 1.0a + OAuth 2.0)
  media.ts              # v2 media upload (simple + chunked)
  rate-limit.ts         # Per-endpoint rate limiting
  tools/
    definitions.ts      # All 16 tool schemas
    handlers.ts         # Tool handler implementations
```

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
