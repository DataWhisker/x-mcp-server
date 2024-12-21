# X MCP Server

A Model Context Protocol (MCP) server for X (Twitter) integration that provides tools for reading your timeline and engaging with tweets. Designed for use with Claude desktop.

<a href="https://glama.ai/mcp/servers/5nx3qqiunw"><img width="380" height="200" src="https://glama.ai/mcp/servers/5nx3qqiunw/badge" alt="X Server MCP server" /></a>

## Features

- Get tweets from your home timeline
- Create new tweets
- Reply to tweets
- Built-in rate limit handling for the free API tier
- TypeScript implementation with full type safety

## Prerequisites

- Node.js (v16 or higher)
- X (Twitter) Developer Account with API access
- Claude desktop app

## Installation

1. Clone the repository:
```bash
git clone [your-repo-url]
cd x-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
```

## Configuration

You need to set up your X (Twitter) API credentials. Follow these steps:

1. Go to the [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new project and app (if you haven't already)
3. In your app settings:
   - Set app permissions to "Read and Write"
   - Enable OAuth 1.0a
   - Set app type to "Native App" or "Web App"
   - Configure callback URL (e.g., https://example.com/callback)
4. Generate your API credentials:
   - API Key and Secret
   - Access Token and Secret (with Read and Write permissions)

## Claude Desktop Configuration

Add to your Claude desktop config file (`%APPDATA%/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "x": {
      "command": "node",
      "args": ["%USERPROFILE%/Projects/MCP Basket/x-server/build/index.js"],
      "env": {
        "TWITTER_API_KEY": "your-api-key",
        "TWITTER_API_SECRET": "your-api-secret",
        "TWITTER_ACCESS_TOKEN": "your-access-token",
        "TWITTER_ACCESS_SECRET": "your-access-secret"
      }
    }
  }
}
```

## Available Tools

### get_home_timeline
Get the most recent tweets from your home timeline.

Parameters:
- `limit` (optional): Number of tweets to retrieve (default: 20, max: 100)

Example:
```typescript
await use_mcp_tool({
  server_name: "x",
  tool_name: "get_home_timeline",
  arguments: { limit: 5 }
});
```

### create_tweet
Create a new tweet.

Parameters:
- `text` (required): The text content of the tweet (max 280 characters)

Example:
```typescript
await use_mcp_tool({
  server_name: "x",
  tool_name: "create_tweet",
  arguments: { text: "Hello from MCP! 🤖" }
});
```

### reply_to_tweet
Reply to a tweet.

Parameters:
- `tweet_id` (required): The ID of the tweet to reply to
- `text` (required): The text content of the reply (max 280 characters)

Example:
```typescript
await use_mcp_tool({
  server_name: "x",
  tool_name: "reply_to_tweet",
  arguments: {
    tweet_id: "1234567890",
    text: "Great tweet! 👍"
  }
});
```

## Development

- `npm run build`: Build the TypeScript code
- `npm run dev`: Run TypeScript in watch mode
- `npm start`: Start the MCP server

## Rate Limiting

The server includes built-in rate limit handling for X's free API tier:
- Implements exponential backoff
- Respects rate limit windows
- Provides clear error messages when limits are hit

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
