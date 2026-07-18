import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchWithTimeout, IdentityHttpError } from "./http.ts";
import type { AuthenticatedIdentityRequest, IdentityEnv } from "./types.ts";

export const STAFF_MFA_MAX_AGE_SECONDS = 15 * 60;
export const DESTRUCTIVE_MFA_MAX_AGE_SECONDS = 5 * 60;

export function mfaVerifiedAtFromAccessToken(accessToken: string): number | null {
  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { amr?: unknown };
    if (!Array.isArray(payload.amr)) return null;
    let mfaVerifiedAt: number | null = null;
    for (const entry of payload.amr) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const record = entry as Record<string, unknown>;
      if (Object.keys(record).some((key) => key !== "method" && key !== "timestamp")) return null;
      if (
        typeof record.method !== "string"
        || record.method.length < 1
        || typeof record.timestamp !== "number"
        || !Number.isInteger(record.timestamp)
        || record.timestamp <= 0
      ) return null;
      if (record.method !== "totp") continue;
      mfaVerifiedAt = Math.max(mfaVerifiedAt ?? 0, record.timestamp);
    }
    return mfaVerifiedAt;
  } catch {
    return null;
  }
}

export function requireFreshAal2(
  auth: AuthenticatedIdentityRequest,
  maximumAgeSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1_000),
): void {
  if (auth.aal !== "aal2") throw new IdentityHttpError(403, "aal2_required");
  if (
    !Number.isInteger(maximumAgeSeconds)
    || maximumAgeSeconds < 1
    || !Number.isInteger(nowSeconds)
    || auth.mfaVerifiedAt === null
    || !Number.isInteger(auth.mfaVerifiedAt)
    || auth.mfaVerifiedAt > nowSeconds
    || nowSeconds - auth.mfaVerifiedAt > maximumAgeSeconds
  ) throw new IdentityHttpError(403, "fresh_aal2_required");
}

function requiredValue(value: string | undefined, minimum = 1): string {
  if (!value || value.length < minimum || value.length > 2_048 || /[\r\n]/.test(value) || /(replace|placeholder|changeme)/i.test(value)) {
    throw new IdentityHttpError(503, "identity_misconfigured");
  }
  return value;
}

function requiredSupabaseUrl(value: string | undefined): string {
  const configured = requiredValue(value);
  let url: URL;
  try { url = new URL(configured); }
  catch { throw new IdentityHttpError(503, "identity_misconfigured"); }
  const hosted = url.protocol === "https:" && /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) && !url.port;
  const local = url.protocol === "http:"
    && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]")
    && /^\d{2,5}$/.test(url.port);
  if (
    (!hosted && !local)
    || url.username
    || url.password
    || (url.pathname !== "/" && url.pathname !== "")
    || url.search
    || url.hash
  ) throw new IdentityHttpError(503, "identity_misconfigured");
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

function requiredPublishableKey(env: IdentityEnv): string {
  const key = requiredValue(env.SUPABASE_PUBLISHABLE_KEY);
  const role = legacyJwtRole(key);
  if (
    /^sb_secret_/i.test(key)
    || /^service[_-]?role/i.test(key)
    || (key.startsWith("sb_") && !key.startsWith("sb_publishable_"))
    || (role !== null && role !== "anon")
    || (env.SUPABASE_SERVICE_ROLE_KEY !== undefined && key === env.SUPABASE_SERVICE_ROLE_KEY)
  ) throw new IdentityHttpError(503, "identity_misconfigured");
  return key;
}

function requiredServiceRoleKey(env: IdentityEnv): string {
  const key = requiredValue(env.SUPABASE_SERVICE_ROLE_KEY, 20);
  const role = legacyJwtRole(key);
  if (
    /^sb_publishable_/i.test(key)
    || /^anon[_-]?key/i.test(key)
    || (key.startsWith("sb_") && !key.startsWith("sb_secret_"))
    || (role !== null && role !== "service_role")
    || (env.SUPABASE_PUBLISHABLE_KEY !== undefined && key === env.SUPABASE_PUBLISHABLE_KEY)
  ) throw new IdentityHttpError(503, "identity_misconfigured");
  return key;
}

export function identitySupabaseOrigin(env: IdentityEnv): string {
  return requiredSupabaseUrl(env.SUPABASE_URL);
}

export function identityServiceRoleKey(env: IdentityEnv): string {
  return requiredServiceRoleKey(env);
}

function client(url: string, key: string, authorization?: string): SupabaseClient {
  return createClient(url, key, {
    global: {
      headers: authorization ? { Authorization: authorization } : {},
      fetch: (input, init) => fetchWithTimeout(input, init ?? {}, 7_000)
    },
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  });
}

export function createIdentityPublicClient(env: IdentityEnv): SupabaseClient {
  return client(requiredSupabaseUrl(env.SUPABASE_URL), requiredPublishableKey(env));
}

export function createIdentityServerClient(env: IdentityEnv): SupabaseClient {
  return client(requiredSupabaseUrl(env.SUPABASE_URL), requiredServiceRoleKey(env));
}

export async function authenticateIdentityRequest(request: Request, env: IdentityEnv): Promise<AuthenticatedIdentityRequest> {
  const authorization = request.headers.get("authorization");
  if (!authorization || authorization.length > 4_096 || !authorization.startsWith("Bearer ")) {
    throw new IdentityHttpError(401, "authentication_required");
  }
  const accessToken = authorization.slice(7);
  if (!accessToken || /[\s,]/.test(accessToken)) throw new IdentityHttpError(401, "authentication_invalid");
  const supabase = client(requiredSupabaseUrl(env.SUPABASE_URL), requiredPublishableKey(env), `Bearer ${accessToken}`);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new IdentityHttpError(401, "authentication_invalid");

  const confirmedEmail = typeof data.user.email === "string"
    && data.user.email.length > 3
    && typeof data.user.email_confirmed_at === "string"
    && !Number.isNaN(Date.parse(data.user.email_confirmed_at));
  const bannedUntil = typeof data.user.banned_until === "string" ? Date.parse(data.user.banned_until) : Number.NaN;
  if (data.user.is_anonymous === true || !confirmedEmail) throw new IdentityHttpError(403, "recoverable_account_required");
  if (!Number.isNaN(bannedUntil) && bannedUntil > Date.now()) throw new IdentityHttpError(403, "account_unavailable");

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const aal = assurance.error === null && assurance.data.currentLevel === "aal2" ? "aal2" : "aal1";
  return {
    accessToken,
    user: data.user,
    userId: data.user.id,
    aal,
    mfaVerifiedAt: aal === "aal2" ? mfaVerifiedAtFromAccessToken(accessToken) : null,
    supabase,
  };
}
