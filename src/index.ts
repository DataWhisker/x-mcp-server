#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { TwitterApi } from 'twitter-api-v2';

// Track rate limit reset times
const rateLimitResets: { [key: string]: number } = {
  'home': 0,
  'tweet': 0,
  'reply': 0
};

// Helper function for rate limit handling
async function withRateLimit<T>(endpoint: 'home' | 'tweet' | 'reply', fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const resetTime = rateLimitResets[endpoint];
  
  if (now < resetTime) {
    const waitTime = resetTime - now + 1000; // Add 1 second buffer
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  try {
    const result = await fn();
    // Set next reset time to 15 minutes from now for free tier
    rateLimitResets[endpoint] = now + (15 * 60 * 1000);
    return result;
  } catch (error: any) {
    if (error?.code === 429) {
      // If we get a rate limit error, wait 15 minutes before next attempt
      rateLimitResets[endpoint] = now + (15 * 60 * 1000);
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Rate limit exceeded for ${endpoint}. Please try again in 15 minutes.`
      );
    }
    throw error;
  }
}

// Twitter API client setup
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY ?? '',
  appSecret: process.env.TWITTER_API_SECRET ?? '',
  accessToken: process.env.TWITTER_ACCESS_TOKEN ?? '',
  accessSecret: process.env.TWITTER_ACCESS_SECRET ?? '',
});

class XMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'x-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_home_timeline',
          description: 'Get the most recent tweets from your home timeline',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Number of tweets to retrieve (max 100)',
                minimum: 1,
                maximum: 100,
                default: 20,
              },
            },
          },
        },
        {
          name: 'create_tweet',
          description: 'Create a new tweet',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'The text content of the tweet',
                maxLength: 280,
              },
            },
            required: ['text'],
          },
        },
        {
          name: 'reply_to_tweet',
          description: 'Reply to a tweet',
          inputSchema: {
            type: 'object',
            properties: {
              tweet_id: {
                type: 'string',
                description: 'The ID of the tweet to reply to',
              },
              text: {
                type: 'string',
                description: 'The text content of the reply',
                maxLength: 280,
              },
            },
            required: ['tweet_id', 'text'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'get_home_timeline': {
            const { limit = 20 } = request.params.arguments as { limit?: number };
            
            const timeline = await withRateLimit('home', () => client.v2.homeTimeline({
              max_results: Math.min(limit, 5), // Limit to max 5 tweets for free tier
              'tweet.fields': ['author_id', 'created_at', 'referenced_tweets'],
              expansions: ['author_id', 'referenced_tweets.id'],
            }));
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(timeline.data, null, 2),
                },
              ],
            };
          }

          case 'create_tweet': {
            const { text } = request.params.arguments as { text: string };
            const tweet = await withRateLimit('tweet', () => client.v2.tweet(text));
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(tweet.data, null, 2),
                },
              ],
            };
          }

          case 'reply_to_tweet': {
            const { tweet_id, text } = request.params.arguments as {
              tweet_id: string;
              text: string;
            };
            const reply = await withRateLimit('reply', () => client.v2.reply(text, tweet_id));
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(reply.data, null, 2),
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Twitter API error: ${(error as Error).message}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('X MCP server running on stdio');
  }
}

const server = new XMcpServer();
server.run().catch(console.error);
