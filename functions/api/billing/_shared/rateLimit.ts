import { BillingHttpError } from "./http.ts";
import type { BillingEnv } from "./types.ts";

const protectedPaths = new Set([
  "/api/billing/checkout", "/api/billing/recurring-checkout", "/api/billing/job-post/checkout",
  "/api/billing/organizations/checkout", "/api/billing/sponsorships/checkout",
  "/api/billing/portal", "/api/billing/operator/refund-execution"
]);

/** Front-door abuse control; economic limits and idempotency remain database-owned. */
export async function enforceBillingRateLimit(request: Request, env: BillingEnv): Promise<void> {
  if (request.method !== "POST" || !protectedPaths.has(new URL(request.url).pathname)) return;
  if (!env.BILLING_MUTATION_RATE_LIMITER) {
    if (env.BILLING_MODE === "live" || env.BILLING_MODE === "test") throw new BillingHttpError(503, "billing_rate_limit_unavailable");
    return;
  }
  // Cloudflare supplies this header at the public edge. No request body, token,
  // email or raw IP is stored or logged. One shared budget prevents route cycling.
  const address = request.headers.get("cf-connecting-ip");
  if (!address || address.length > 64 || !/^[0-9a-fA-F:.]+$/.test(address)) throw new BillingHttpError(503, "billing_rate_limit_unavailable");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`first-party:${address}`));
  const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  let success: boolean;
  try { success = (await env.BILLING_MUTATION_RATE_LIMITER.limit({ key })).success; }
  catch { throw new BillingHttpError(503, "billing_rate_limit_unavailable"); }
  if (!success) throw new BillingHttpError(429, "billing_rate_limited", 60);
}
