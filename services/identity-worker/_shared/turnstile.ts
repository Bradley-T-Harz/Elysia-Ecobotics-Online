import { nonPlaceholder } from "./config.ts";
import { fetchWithTimeout, IdentityHttpError, readBoundedResponseJson } from "./http.ts";
import type { IdentityEnv, TurnstileRequest } from "./types.ts";

type SiteverifyResult = {
  success?: unknown;
  challenge_ts?: unknown;
  hostname?: unknown;
  action?: unknown;
  "error-codes"?: unknown;
};

function expectedHostnames(env: IdentityEnv): ReadonlySet<string> {
  const values = env.TURNSTILE_EXPECTED_HOSTNAMES?.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean) ?? [];
  if (values.length < 1 || values.length > 8 || values.some((value) => !/^[a-z0-9.-]{1,253}$/.test(value))) {
    throw new IdentityHttpError(503, "turnstile_misconfigured");
  }
  return new Set(values);
}

function safeRemoteIp(value: string | undefined): string | undefined {
  if (!value || value.length > 64 || !/^[0-9a-f:.]+$/i.test(value)) return undefined;
  return value;
}

export async function verifyTurnstile(
  env: IdentityEnv,
  input: TurnstileRequest,
  fetcher: typeof fetch = fetch,
  now: number = Date.now()
): Promise<void> {
  if (env.TURNSTILE_REQUIRED !== "true") throw new IdentityHttpError(503, "turnstile_misconfigured");
  const secret = nonPlaceholder(env.TURNSTILE_SECRET_KEY, 16, 512);
  if (input.token.length < 1 || input.token.length > 2_048 || /[\s,]/.test(input.token)) {
    throw new IdentityHttpError(400, "turnstile_token_invalid");
  }
  if (!/^[a-z][a-z0-9_]{1,31}$/.test(input.action)) throw new IdentityHttpError(500, "turnstile_action_invalid");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey)) {
    throw new IdentityHttpError(400, "request_invalid");
  }

  const form = new URLSearchParams({
    secret,
    response: input.token,
    idempotency_key: input.idempotencyKey
  });
  const remoteIp = safeRemoteIp(input.remoteIp);
  if (remoteIp) form.set("remoteip", remoteIp);
  const response = await fetchWithTimeout(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString()
    },
    5_000,
    fetcher
  );
  if (!response.ok) throw new IdentityHttpError(502, "turnstile_unavailable");
  const result = await readBoundedResponseJson(response, 16_384) as SiteverifyResult;
  if (result.success !== true) throw new IdentityHttpError(403, "turnstile_rejected");
  if (typeof result.hostname !== "string" || !expectedHostnames(env).has(result.hostname.toLowerCase())) {
    throw new IdentityHttpError(403, "turnstile_hostname_mismatch");
  }
  if (result.action !== input.action) throw new IdentityHttpError(403, "turnstile_action_mismatch");
  if (typeof result.challenge_ts !== "string") throw new IdentityHttpError(403, "turnstile_timestamp_invalid");
  const challengedAt = Date.parse(result.challenge_ts);
  if (!Number.isFinite(challengedAt) || challengedAt > now + 60_000 || now - challengedAt > 330_000) {
    throw new IdentityHttpError(403, "turnstile_token_expired");
  }
}
