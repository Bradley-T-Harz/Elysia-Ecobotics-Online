import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchWithTimeout, IdentityHttpError } from "./http.ts";
import type { AuthenticatedIdentityRequest, IdentityEnv } from "./types.ts";

export const STAFF_MFA_MAX_AGE_SECONDS = 15 * 60;
export const DESTRUCTIVE_MFA_MAX_AGE_SECONDS = 5 * 60;

export type SafeIdentityJwtMetadata = Readonly<{
  tokenKind: "jwt" | "non_jwt";
  issuerHostname: string | null;
  issuerProjectRef: string | null;
  audience: string | null;
  expiresAt: number | null;
  expired: boolean | null;
  subjectPresent: boolean;
}>;

function safeAudience(value: unknown): string | null {
  const values = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  if (
    values.length < 1
    || values.length > 4
    || values.some((item) => typeof item !== "string" || !/^[A-Za-z0-9:._/-]{1,80}$/.test(item))
  ) return null;
  return (values as string[]).join(",");
}

export function safeIdentityJwtMetadata(
  accessToken: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): SafeIdentityJwtMetadata {
  const unavailable: SafeIdentityJwtMetadata = {
    tokenKind: "non_jwt",
    issuerHostname: null,
    issuerProjectRef: null,
    audience: null,
    expiresAt: null,
    expired: null,
    subjectPresent: false,
  };
  const parts = accessToken.split(".");
  if (parts.length !== 3) return unavailable;
  try {
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>;
    let issuerHostname: string | null = null;
    let issuerProjectRef: string | null = null;
    if (typeof payload.iss === "string" && payload.iss.length <= 300) {
      try {
        const issuer = new URL(payload.iss);
        if (issuer.protocol === "https:" && /^[a-z0-9.-]+$/.test(issuer.hostname)) {
          issuerHostname = issuer.hostname;
          const hosted = /^([a-z0-9-]+)\.supabase\.co$/.exec(issuer.hostname);
          issuerProjectRef = hosted?.[1] ?? null;
        }
      } catch {
        // Invalid issuer metadata remains unavailable and is never echoed.
      }
    }
    const expiresAt = typeof payload.exp === "number"
      && Number.isInteger(payload.exp)
      && payload.exp > 0
      && payload.exp < 10_000_000_000
      ? payload.exp
      : null;
    return {
      tokenKind: "jwt",
      issuerHostname,
      issuerProjectRef,
      audience: safeAudience(payload.aud),
      expiresAt,
      expired: expiresAt === null ? null : expiresAt <= nowSeconds,
      subjectPresent: typeof payload.sub === "string" && payload.sub.length > 0,
    };
  } catch {
    return unavailable;
  }
}

function publishableKeyKind(key: string): "sb_publishable" | "legacy_anon_jwt" {
  return key.startsWith("sb_publishable_") ? "sb_publishable" : "legacy_anon_jwt";
}

function safeAuthErrorMetadata(error: unknown): Readonly<{
  upstreamStatus: number | null;
  upstreamCode: string | null;
  errorClass: string;
}> {
  const record = error && typeof error === "object" && !Array.isArray(error)
    ? error as Record<string, unknown>
    : {};
  return {
    upstreamStatus: typeof record.status === "number" && Number.isInteger(record.status)
      ? record.status
      : null,
    upstreamCode: typeof record.code === "string" && /^[a-z][a-z0-9_]{1,80}$/.test(record.code)
      ? record.code
      : null,
    errorClass: typeof record.name === "string" && /^Auth[A-Za-z]{1,60}Error$/.test(record.name)
      ? record.name
      : "unknown",
  };
}

function logAuthenticationDiagnostic(
  outcome: "verified" | "rejected",
  stage: "token_shape" | "supabase_user",
  supabaseUrl: string,
  publishableKey: string,
  jwt: SafeIdentityJwtMetadata,
  upstream: ReturnType<typeof safeAuthErrorMetadata> | null,
): void {
  console.info(JSON.stringify({
    event: "identity.authentication",
    outcome,
    stage,
    supabaseHostname: new URL(supabaseUrl).hostname,
    jwtIssuerHostname: jwt.issuerHostname,
    jwtIssuerProjectRef: jwt.issuerProjectRef,
    jwtAudience: jwt.audience,
    jwtExpiresAt: jwt.expiresAt,
    jwtExpired: jwt.expired,
    jwtSubjectPresent: jwt.subjectPresent,
    tokenKind: jwt.tokenKind,
    keyKind: publishableKeyKind(publishableKey),
    upstreamStatus: upstream?.upstreamStatus ?? null,
    upstreamCode: upstream?.upstreamCode ?? null,
    errorClass: upstream?.errorClass ?? null,
  }));
}

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
  const supabaseUrl = requiredSupabaseUrl(env.SUPABASE_URL);
  const publishableKey = requiredPublishableKey(env);
  const jwt = safeIdentityJwtMetadata(accessToken);
  if (!accessToken || /[\s,]/.test(accessToken)) {
    logAuthenticationDiagnostic("rejected", "token_shape", supabaseUrl, publishableKey, jwt, null);
    throw new IdentityHttpError(401, "authentication_invalid");
  }
  const supabase = client(supabaseUrl, publishableKey, `Bearer ${accessToken}`);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    logAuthenticationDiagnostic("rejected", "supabase_user", supabaseUrl, publishableKey, jwt, safeAuthErrorMetadata(error));
    throw new IdentityHttpError(401, "authentication_invalid");
  }
  logAuthenticationDiagnostic("verified", "supabase_user", supabaseUrl, publishableKey, jwt, null);

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
