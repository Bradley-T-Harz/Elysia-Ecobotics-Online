import { assertAbuseControls } from "./config.ts";
import { IdentityHttpError } from "./http.ts";
import type { IdentityEnv } from "./types.ts";

export async function requireRateLimit(env: IdentityEnv, userId: string, operation: string): Promise<void> {
  assertAbuseControls(env);
  if (!env.IDENTITY_RATE_LIMITER) throw new IdentityHttpError(503, "rate_limiter_misconfigured");
  const key = `${operation}:${userId}`;
  const result = await env.IDENTITY_RATE_LIMITER.limit({ key });
  if (!result.success) throw new IdentityHttpError(429, "rate_limited", 60);
}
