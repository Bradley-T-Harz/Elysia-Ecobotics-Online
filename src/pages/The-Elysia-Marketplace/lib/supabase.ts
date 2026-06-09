import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

export const supabaseNotConfiguredMessage =
  "Supabase env vars are not configured, so this panel is running in local demo mode. No marketplace account data is being saved remotely.";

export const supabaseConfiguredMessage =
  "Supabase is configured. Marketplace account and catalog requests will use the remote project when policies allow it.";

// Backward-compatible alias for older components; prefer the explicit messages above.
export const demoModeMessage = supabaseNotConfiguredMessage;
