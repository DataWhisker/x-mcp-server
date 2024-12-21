# X MCP Server

A Model Context Protocol (MCP) server for X (Twitter) integration that provides tools for reading your timeline and engaging with tweets. Designed for use with Claude desktop.

<a href="https://glama.ai/mcp/servers/5nx3qqiunw"><img width="380" height="200" src="https://glama.ai/mcp/servers/5nx3qqiunw/badge" alt="X Server MCP server" /></a>

## Features

- Get tweets from your home timeline
- Create new tweets
- Reply to tweets
- Built-in rate limit handling for the Basic API tier
- TypeScript implementation with full type safety

## Prerequisites

- Node.js (v16 or higher)
- X (Twitter) Developer Account with Basic API access ($100/month)
- Claude desktop app

## X API Access

As of 2024, X (Twitter) requires a paid subscription for API access:

### Basic Tier ($100/month)
- **Tweet Creation:** 
  - 100 tweets per user per 24 hours
  - 1,667 tweets per app per 24 hours
- **Read Access:** Limited read capabilities
- **Features:**
  - Access to essential endpoints
  - Basic search functionality
  - Community search feature
  - "Reposts of me" endpoint
  - Rate limits reset every 15 minutes

Note: Free API access is no longer available. The Basic tier is the minimum required for API functionality. For higher volume needs, Pro tier ($5000/month) is available with increased limits.

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

You need to set up your X (Twitter) API credentials. Follow these detailed steps:

1. Go to the [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
   - Sign in with your X (Twitter) account
   - If you don't have a developer account, you'll be prompted to create one

2. Subscribe to the Basic tier ($100/month)
   - Click on "Products" in the left sidebar
   - Select the Basic tier subscription
   - Complete the payment process

3. Create a new project:
   - Click "Add Project" button
   - Enter a project name (e.g., "MCP Integration")
   - Select your use case
   - Click "Next"

4. Create a new app within your project:
   - Click "Add App"
   - Enter an app name
   - Click "Next"

5. Configure app settings:
   - In your app dashboard, click "App Settings"
   - Under "User authentication settings":
     - Click "Set Up"
     - Enable OAuth 1.0a
     - Select "Web App" or "Native App"
     - Enter any URL for callback (e.g., https://example.com/callback)
     - Enter any URL for website (e.g., https://example.com)
     - Click "Save"

6. Set app permissions:
   - In app settings, find "App permissions"
   - Change to "Read and Write"
   - Click "Save"

7. Generate API Keys and Tokens:
   - Go to "Keys and Tokens" tab
   - Under "Consumer Keys":
     - Click "Regenerate" or "View"
     - Save your API Key and API Key Secret
   - Under "Authentication Tokens":
     - Click "Generate"
     - Make sure to select tokens with "Read and Write" permissions
     - Save your Access Token and Access Token Secret

Important: Keep your keys and tokens secure and never share them publicly. You'll need all four values:
- API Key (also called Consumer Key)
- API Key Secret (also called Consumer Secret)
- Access Token
- Access Token Secret

## Claude Desktop Configuration

To connect the X MCP server with Claude desktop, you need to configure it in the Claude settings. Follow these steps:

1. Open File Explorer
2. Navigate to the Claude config directory:
   - Press Win + R
   - Type `%APPDATA%/Claude` and press Enter
   - If the Claude folder doesn't exist, create it

3. Create or edit `claude_desktop_config.json`:
   - If the file doesn't exist, create a new file named `claude_desktop_config.json`
   - If it exists, open it in a text editor (like Notepad)

4. Add the following configuration, replacing the placeholder values with your actual API credentials from the previous section:
```json
{
  "mcpServers": {
    "x": {
      "command": "node",
      "args": ["%USERPROFILE%/Projects/MCP Basket/x-server/build/index.js"],
      "env": {
        "TWITTER_API_KEY": "paste-your-api-key-here",
        "TWITTER_API_SECRET": "paste-your-api-key-secret-here",
        "TWITTER_ACCESS_TOKEN": "paste-your-access-token-here",
        "TWITTER_ACCESS_SECRET": "paste-your-access-token-secret-here"
      }
    }
  }
}
```

5. Save the file and restart Claude desktop

Note: Make sure to:
- Replace all four credential values with your actual API keys and tokens
- Keep the quotes ("") around each value
- Maintain the exact spacing and formatting shown above
- Save the file with the `.json` extension

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

The server includes built-in rate limit handling for X's Basic API tier:
- Implements 15-minute rate limit windows
- Limits tweet creation to 100 tweets per user per 24 hours
- Limits total app tweets to 1,667 per 24 hours
- Provides exponential backoff for rate limit errors
- Clear error messages when limits are reached
- Automatic retry after rate limit window expires

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
