import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BillingHttpError, fetchWithTimeout } from "./http.ts";
import type { AuthenticatedBillingRequest, BillingEnv } from "./types.ts";

function requiredValue(value: string | undefined, minimum = 1): string {
  if (!value || value.length < minimum || value.length > 2_048 || /[\r\n]/.test(value) || /(replace|placeholder|changeme)/i.test(value)) {
    throw new BillingHttpError(503, "billing_misconfigured");
  }
  return value;
}

function requiredSupabaseUrl(value: string | undefined): string {
  const configured = requiredValue(value);
  let url: URL;
  try { url = new URL(configured); }
  catch { throw new BillingHttpError(503, "billing_misconfigured"); }
  const hosted = url.protocol === "https:" && /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) && !url.port;
  const loopback = url.protocol === "http:"
    && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]")
    && /^\d{2,5}$/.test(url.port);
  if (
    (!hosted && !loopback)
    || url.username
    || url.password
    || (url.pathname !== "/" && url.pathname !== "")
    || url.search
    || url.hash
  ) throw new BillingHttpError(503, "billing_misconfigured");
  return url.origin;
}

function legacyJwtRole(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function requiredPublishableKey(env: BillingEnv): string {
  const key = requiredValue(env.SUPABASE_PUBLISHABLE_KEY);
  const role = legacyJwtRole(key);
  if (
    /^sb_secret_/i.test(key)
    || /^service[_-]?role/i.test(key)
    || (key.startsWith("sb_") && !key.startsWith("sb_publishable_"))
    || (role !== null && role !== "anon")
    || (env.SUPABASE_SERVICE_ROLE_KEY !== undefined && key === env.SUPABASE_SERVICE_ROLE_KEY)
  ) throw new BillingHttpError(503, "billing_misconfigured");
  return key;
}

export function economicPublicClientConfigured(env: BillingEnv): boolean {
  try {
    requiredSupabaseUrl(env.SUPABASE_URL);
    requiredPublishableKey(env);
    return true;
  } catch {
    return false;
  }
}

function requiredServiceRoleKey(env: BillingEnv): string {
  const key = requiredValue(env.SUPABASE_SERVICE_ROLE_KEY, 20);
  const role = legacyJwtRole(key);
  if (
    /^sb_publishable_/i.test(key)
    || /^anon[_-]?key/i.test(key)
    || (key.startsWith("sb_") && !key.startsWith("sb_secret_"))
    || (role !== null && role !== "service_role")
    || (env.SUPABASE_PUBLISHABLE_KEY !== undefined && key === env.SUPABASE_PUBLISHABLE_KEY)
  ) throw new BillingHttpError(503, "billing_misconfigured");
  return key;
}

export function economicServerClientConfigured(env: BillingEnv): boolean {
  try {
    requiredSupabaseUrl(env.SUPABASE_URL);
    requiredServiceRoleKey(env);
    return true;
  } catch {
    return false;
  }
}

function client(url: string, key: string, authorization?: string, extraHeaders: Record<string, string> = {}): SupabaseClient {
  return createClient(url, key, {
    global: {
      headers: { ...extraHeaders, ...(authorization ? { Authorization: authorization } : {}) },
      fetch: (input, init) => fetchWithTimeout(input, { ...(init ?? {}), redirect: "error" }, 7_000)
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export async function authenticateOptional(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest | null> {
  const authorization = request.headers.get("authorization");
  if (authorization === null || authorization === "") return null;
  if (authorization.length > 4_096 || !authorization.startsWith("Bearer ")) {
    throw new BillingHttpError(401, "authentication_invalid");
  }
  const accessToken = authorization.slice(7);
  if (!accessToken || /[\s,]/.test(accessToken)) throw new BillingHttpError(401, "authentication_invalid");
  const supabaseUrl = requiredSupabaseUrl(env.SUPABASE_URL);
  const publishableKey = requiredPublishableKey(env);
  const supabase = client(supabaseUrl, publishableKey, `Bearer ${accessToken}`);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new BillingHttpError(401, "authentication_invalid");
  const confirmedEmail = typeof data.user.email === "string"
    && data.user.email.length > 3
    && typeof data.user.email_confirmed_at === "string"
    && !Number.isNaN(Date.parse(data.user.email_confirmed_at));
  const bannedUntil = typeof data.user.banned_until === "string"
    ? Date.parse(data.user.banned_until)
    : Number.NaN;
  if (data.user.is_anonymous === true || !confirmedEmail) {
    throw new BillingHttpError(403, "economic_recoverable_account_required");
  }
  if (!Number.isNaN(bannedUntil) && bannedUntil > Date.now()) {
    throw new BillingHttpError(403, "economic_account_unavailable");
  }
  return {
    accessToken,
    userId: data.user.id,
    email: data.user.email ?? null,
    supabase
  };
}

export async function authenticateRequired(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest> {
  const auth = await authenticateOptional(request, env);
  if (!auth) throw new BillingHttpError(401, "authentication_required");
  return auth;
}

export function createEconomicServerClient(env: BillingEnv): SupabaseClient {
  const supabaseUrl = requiredSupabaseUrl(env.SUPABASE_URL);
  const serviceRoleKey = requiredServiceRoleKey(env);
  return client(supabaseUrl, serviceRoleKey, undefined, { "x-elysia-billing-mode": env.BILLING_MODE ?? "disabled", "x-elysia-stripe-account": env.STRIPE_ACCOUNT_ID ?? "" });
}

export function createEconomicPublicClient(env: BillingEnv): SupabaseClient {
  const supabaseUrl = requiredSupabaseUrl(env.SUPABASE_URL);
  const publishableKey = requiredPublishableKey(env);
  return client(supabaseUrl, publishableKey);
}
