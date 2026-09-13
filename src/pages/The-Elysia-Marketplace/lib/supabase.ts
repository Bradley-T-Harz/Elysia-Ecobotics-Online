import { createClient } from "@supabase/supabase-js";
import { observedAuthFetch } from "../components/authSignupDiagnostics";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      global: {
        fetch: observedAuthFetch
      }
    })
  : null;

export const supabaseNotConfiguredMessage =
  "Supabase env vars are not configured, so this panel is running in local demo mode. No marketplace account data is being saved remotely.";

export const supabaseConfiguredMessage =
  "Supabase is configured. Marketplace account and catalog requests will use the remote project when policies allow it.";

// Backward-compatible alias for older components; prefer the explicit messages above.
export const demoModeMessage = supabaseNotConfiguredMessage;

/** Pin a multi-step Forge operation to the initiating account and login session. */
export async function accountBoundSupabase(expectedUserId: string) {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) throw new Error("Account storage is unavailable.");
  const { data } = await supabase.auth.getSession();
  if (!data.session || data.session.user.id !== expectedUserId) throw new Error("The website account changed. Restart this operation.");
  const loginIdentity = (token: string) => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return typeof payload.session_id === "string" ? payload.session_id : token;
    } catch { return token; }
  };
  const initiatingLogin = loginIdentity(data.session.access_token);
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    accessToken: async () => {
      const current = (await supabase.auth.getSession()).data.session;
      if (!current || current.user.id !== expectedUserId || loginIdentity(current.access_token) !== initiatingLogin) {
        throw new Error("The website account or login session changed. No further operation is authorized.");
      }
      return current.access_token;
    },
    global: { fetch: observedAuthFetch }
  });
}
