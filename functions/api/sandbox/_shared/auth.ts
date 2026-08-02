import { createClient } from "@supabase/supabase-js";
import { fetchWithTimeout, PublicHttpError } from "./http.ts";
import type { AuthenticatedRequest, Env } from "./types.ts";

function requiredEnv(value: string | undefined, code: string): string {
  if (!value || value.length > 2_048 || /(replace|placeholder|changeme)/i.test(value)) throw new PublicHttpError(503, code);
  return value;
}

function requiredSupabaseUrl(value: string | undefined): string {
  const configured = requiredEnv(value, "sandbox_misconfigured");
  let url: URL;
  try { url = new URL(configured); }
  catch { throw new PublicHttpError(503, "sandbox_misconfigured"); }
  if (
    url.protocol !== "https:"
    || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)
    || url.port
    || url.username
    || url.password
    || (url.pathname !== "/" && url.pathname !== "")
    || url.search
    || url.hash
  ) throw new PublicHttpError(503, "sandbox_misconfigured");
  return url.origin;
}

function legacyJwtRole(value: string): string | null {
  const pieces = value.split(".");
  if (pieces.length !== 3) return null;
  try {
    const encoded = pieces[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function requiredPublishableKey(value: string | undefined): string {
  const key = requiredEnv(value, "sandbox_misconfigured");
  const legacyRole = legacyJwtRole(key);
  if (
    /^sb_secret_/i.test(key)
    || (key.startsWith("sb_") && !key.startsWith("sb_publishable_"))
    || (legacyRole !== null && legacyRole !== "anon")
  ) throw new PublicHttpError(503, "sandbox_misconfigured");
  return key;
}

export function sandboxAccessDeniedError(reason: unknown): PublicHttpError {
  if (reason === "authentication_required") return new PublicHttpError(401, "authentication_required");
  if (reason === "profile_required") return new PublicHttpError(403, "profile_required");
  if (reason === "account_disabled") return new PublicHttpError(403, "account_inactive");
  return new PublicHttpError(403, "sandbox_not_authorized");
}

export async function authenticateRequest(request: Request, env: Env): Promise<AuthenticatedRequest> {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.length > 4_096 || !authorization.startsWith("Bearer ")) {
    throw new PublicHttpError(401, "authentication_required");
  }
  const accessToken = authorization.slice(7);
  if (!accessToken || /[\s,]/.test(accessToken)) throw new PublicHttpError(401, "authentication_invalid");

  const supabaseUrl = requiredSupabaseUrl(env.SUPABASE_URL);
  const publishableKey = requiredPublishableKey(env.SUPABASE_PUBLISHABLE_KEY);
  const supabase = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
      fetch: (input, init) => fetchWithTimeout(input, { ...(init ?? {}), redirect: "error" }, 5_000)
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) throw new PublicHttpError(401, "authentication_invalid");

  const { data: accessData, error: accessError } = await supabase.rpc("current_user_sandbox_access");
  if (accessError || typeof accessData !== "object" || accessData === null) {
    throw new PublicHttpError(503, "authorization_unavailable");
  }
  const access = accessData as Record<string, unknown>;
  if (access.authorized !== true) throw sandboxAccessDeniedError(access.reason);
  const accessTier = access.tier;
  if (accessTier !== "member" && accessTier !== "reviewer" && accessTier !== "admin") {
    throw new PublicHttpError(503, "authorization_unavailable");
  }

  return { accessToken, userId: userData.user.id, accessTier, supabase };
}
