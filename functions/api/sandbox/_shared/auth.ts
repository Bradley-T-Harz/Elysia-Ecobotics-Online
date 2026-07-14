import { createClient } from "@supabase/supabase-js";
import { fetchWithTimeout, PublicHttpError } from "./http.ts";
import type { AuthenticatedRequest, Env } from "./types.ts";

function requiredEnv(value: string | undefined, code: string): string {
  if (!value || value.length > 2_048) throw new PublicHttpError(503, code);
  return value;
}

export async function authenticateRequest(request: Request, env: Env): Promise<AuthenticatedRequest> {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.length > 4_096 || !authorization.startsWith("Bearer ")) {
    throw new PublicHttpError(401, "authentication_required");
  }
  const accessToken = authorization.slice(7);
  if (!accessToken || /[\s,]/.test(accessToken)) throw new PublicHttpError(401, "authentication_invalid");

  const supabaseUrl = requiredEnv(env.SUPABASE_URL, "sandbox_misconfigured");
  const publishableKey = requiredEnv(env.SUPABASE_PUBLISHABLE_KEY, "sandbox_misconfigured");
  const supabase = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
      fetch: (input, init) => fetchWithTimeout(input, init ?? {}, 5_000)
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
  if (access.authorized !== true) throw new PublicHttpError(403, "sandbox_not_authorized");
  const accessTier = access.tier;
  if (accessTier !== "member" && accessTier !== "reviewer" && accessTier !== "admin") {
    throw new PublicHttpError(503, "authorization_unavailable");
  }

  return { accessToken, userId: userData.user.id, accessTier, supabase };
}
