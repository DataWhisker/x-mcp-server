import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

const rateLimitResets: Record<string, number> = {};

export async function withRateLimit<T>(
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const resetTime = rateLimitResets[endpoint] ?? 0;

  if (now < resetTime) {
    const waitSeconds = Math.ceil((resetTime - now) / 1000);
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Rate limited on '${endpoint}'. Try again in ${waitSeconds} seconds.`
    );
  }

  try {
    return await fn();
  } catch (error: unknown) {
    const err = error as { code?: number; rateLimit?: { reset?: number } };

    if (err?.code === 429) {
      const resetEpoch = err.rateLimit?.reset;
      rateLimitResets[endpoint] = resetEpoch
        ? resetEpoch * 1000
        : now + 15 * 60 * 1000;

      throw new McpError(
        ErrorCode.InvalidRequest,
        `Rate limit exceeded for '${endpoint}'. Please try again later.`
      );
    }

    throw error;
  }
}
