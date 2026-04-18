#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOL_DEFINITIONS } from './tools/definitions.js';
import {
  handleGetHomeTimeline,
  handleSearchTweets,
  handleGetTweet,
  handleCreateTweet,
  handleReplyToTweet,
  handleQuoteTweet,
  handleDeleteTweet,
  handleLikeTweet,
  handleUnlikeTweet,
  handleRetweet,
  handleUndoRetweet,
  handleBookmarkTweet,
  handleUnbookmarkTweet,
  handleGetBookmarks,
  handleGetUser,
  handleGetUserTweets,
  handleGetArticle,
} from './tools/handlers.js';

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
}>;

const HANDLERS: Readonly<Record<string, ToolHandler>> = {
  get_home_timeline: handleGetHomeTimeline,
  search_tweets: handleSearchTweets,
  get_tweet: handleGetTweet,
  create_tweet: handleCreateTweet,
  reply_to_tweet: handleReplyToTweet,
  quote_tweet: handleQuoteTweet,
  delete_tweet: handleDeleteTweet,
  like_tweet: handleLikeTweet,
  unlike_tweet: handleUnlikeTweet,
  retweet: handleRetweet,
  undo_retweet: handleUndoRetweet,
  bookmark_tweet: handleBookmarkTweet,
  unbookmark_tweet: handleUnbookmarkTweet,
  get_bookmarks: handleGetBookmarks,
  get_user: handleGetUser,
  get_user_tweets: handleGetUserTweets,
  get_article: handleGetArticle,
};

class XMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: 'x-mcp-server', version: '2.0.0' },
      { capabilities: { tools: {} } }
    );

    this.setupToolHandlers();
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOL_DEFINITIONS,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const handler = HANDLERS[name];

      if (!handler) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      try {
        return await handler((args ?? {}) as Record<string, unknown>);
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(
          ErrorCode.InternalError,
          `X API error: ${(error as Error).message}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('X MCP server v2.0.0 running on stdio');
  }
}

const server = new XMcpServer();
server.run().catch(console.error);
