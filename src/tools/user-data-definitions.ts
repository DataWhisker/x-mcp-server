import { Tool } from '@modelcontextprotocol/sdk/types.js';

function usernameLimitTool(
  name: string,
  description: string,
  limitDescription: string,
  defaultLimit: number
): Tool {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'The username (without @)',
        },
        limit: {
          type: 'number',
          description: `${limitDescription} (1-100, default ${defaultLimit})`,
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['username'],
    },
  };
}

function limitOnlyTool(
  name: string,
  description: string,
  limitDescription: string
): Tool {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: `${limitDescription} (1-100, default 20)`,
          minimum: 1,
          maximum: 100,
        },
      },
    },
  };
}

export const USER_DATA_TOOL_DEFINITIONS: Tool[] = [
  usernameLimitTool(
    'get_user_mentions',
    'Get recent posts mentioning a user by username',
    'Number of mentions to retrieve',
    10
  ),
  usernameLimitTool(
    'get_user_liked_tweets',
    "Get a user's recently liked posts by username",
    'Number of liked posts to retrieve',
    10
  ),
  usernameLimitTool(
    'get_user_followers',
    "Get a user's followers by username",
    'Number of followers to retrieve',
    20
  ),
  usernameLimitTool(
    'get_user_following',
    'Get accounts a user follows by username',
    'Number of followed accounts to retrieve',
    20
  ),
  limitOnlyTool(
    'get_blocking_users',
    'Get users blocked by the authenticated account',
    'Number of blocked users to retrieve'
  ),
  limitOnlyTool(
    'get_muting_users',
    'Get users muted by the authenticated account',
    'Number of muted users to retrieve'
  ),
  usernameLimitTool(
    'get_owned_lists',
    'Get lists owned by a user by username',
    'Number of lists to retrieve',
    20
  ),
  usernameLimitTool(
    'get_followed_lists',
    'Get lists followed by a user by username',
    'Number of lists to retrieve',
    20
  ),
  usernameLimitTool(
    'get_list_memberships',
    'Get lists a user belongs to by username',
    'Number of lists to retrieve',
    20
  ),
];
