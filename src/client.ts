import { TwitterApi } from 'twitter-api-v2';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const TOKEN_FILE = join(homedir(), '.x-mcp-tokens.json');
const TOKEN_EXPIRY_BUFFER_MS = 60_000; // Refresh 1 minute before actual expiry

interface StoredTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}

let cachedUserId: string | null = null;
let oauth2Token: string | null = null;
let oauth2RefreshToken: string | null = null;
let oauth2ExpiresAt = 0;
let refreshInProgress: Promise<string> | null = null;

// Warn on Windows where file mode 0o600 is silently ignored
if (process.platform === 'win32') {
  console.error(
    '[Security] Running on Windows — token file permissions (mode 0o600) are not enforced. ' +
    'Ensure ~/.x-mcp-tokens.json is protected via NTFS ACLs or use environment variables instead.'
  );
}

function createOAuth1Client(): TwitterApi | null {
  const appKey = process.env.TWITTER_API_KEY;
  const appSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    return null;
  }

  return new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
}

async function loadStoredTokens(): Promise<StoredTokens | null> {
  try {
    const data = await readFile(TOKEN_FILE, 'utf-8');
    return JSON.parse(data) as StoredTokens;
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.error('[OAuth2] Token file read error:', (error as Error).message);
    }
    return null;
  }
}

async function saveStoredTokens(tokens: StoredTokens): Promise<void> {
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

async function refreshOAuth2TokenFromSource(): Promise<string> {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const refreshToken = oauth2RefreshToken ?? process.env.TWITTER_OAUTH2_REFRESH_TOKEN;

  if (!clientId || !refreshToken) {
    throw new Error(
      'OAuth 2.0 client ID and refresh token required for token refresh'
    );
  }

  // twitter-api-v2 types don't expose { clientId, clientSecret } as a constructor overload,
  // but the library accepts it at runtime for OAuth2 refresh flows (tested with v1.15+).
  // See: https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/auth.md
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authClient = clientSecret
    ? new TwitterApi({ clientId, clientSecret } as any)
    : new TwitterApi({ clientId } as any);

  const result = await authClient.refreshOAuth2Token(refreshToken);

  oauth2Token = result.accessToken;
  oauth2RefreshToken = result.refreshToken ?? null;
  oauth2ExpiresAt = Date.now() + result.expiresIn * 1000 - TOKEN_EXPIRY_BUFFER_MS;

  await saveStoredTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? refreshToken,
    expiresAt: oauth2ExpiresAt,
  });

  return result.accessToken;
}

export async function getOAuth2Token(): Promise<string | null> {
  if (process.env.TWITTER_OAUTH2_ACCESS_TOKEN) {
    return process.env.TWITTER_OAUTH2_ACCESS_TOKEN;
  }

  if (oauth2Token && Date.now() < oauth2ExpiresAt) {
    return oauth2Token;
  }

  const stored = await loadStoredTokens();
  if (stored && Date.now() < stored.expiresAt) {
    oauth2Token = stored.accessToken;
    oauth2RefreshToken = stored.refreshToken;
    oauth2ExpiresAt = stored.expiresAt;
    return stored.accessToken;
  }

  if (stored?.refreshToken) {
    oauth2RefreshToken = stored.refreshToken;
  }

  const clientId = process.env.TWITTER_CLIENT_ID ?? null;
  const refreshAvailable = oauth2RefreshToken ?? process.env.TWITTER_OAUTH2_REFRESH_TOKEN ?? null;

  if (clientId && refreshAvailable) {
    // Prevent concurrent refresh attempts from racing
    if (refreshInProgress) {
      try {
        return await refreshInProgress;
      } catch {
        return null;
      }
    }
    try {
      refreshInProgress = refreshOAuth2TokenFromSource();
      return await refreshInProgress;
    } catch (error) {
      console.error('[OAuth2 Refresh] Token refresh failed:', (error as Error).message);
      return null;
    } finally {
      refreshInProgress = null;
    }
  }

  return null;
}

export async function getClient(): Promise<TwitterApi> {
  const token = await getOAuth2Token();
  if (token) {
    return new TwitterApi(token);
  }

  const oauth1 = createOAuth1Client();
  if (oauth1) {
    return oauth1;
  }

  throw new Error(
    'No Twitter credentials configured. ' +
    'Set OAuth 1.0a vars (TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET) ' +
    'or OAuth 2.0 vars (TWITTER_OAUTH2_ACCESS_TOKEN or TWITTER_CLIENT_ID + TWITTER_OAUTH2_REFRESH_TOKEN).'
  );
}

export async function getAuthenticatedUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const client = await getClient();
  const me = await client.v2.me();
  cachedUserId = me.data.id;
  return cachedUserId;
}

export function hasOAuth2Config(): boolean {
  return !!(
    process.env.TWITTER_OAUTH2_ACCESS_TOKEN ||
    (process.env.TWITTER_CLIENT_ID && process.env.TWITTER_OAUTH2_REFRESH_TOKEN)
  );
}
