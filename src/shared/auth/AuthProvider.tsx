import { createContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase } from "../../pages/The-Elysia-Marketplace/lib/supabase";

type AuthContextValue = {
  configured: boolean;
  session: Session | null;
  userId: string | null;
  accessToken: string | null;
  email: string | null;
  loading: boolean;
  recoveryMode: boolean;
};

export const AuthContext = createContext<AuthContextValue>({ configured: hasSupabaseConfig, session: null, userId: null, accessToken: null, email: null, loading: false, recoveryMode: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      if (event === "SIGNED_OUT" || event === "USER_UPDATED") setRecoveryMode(false);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    configured: hasSupabaseConfig,
    session,
    userId: session?.user.id ?? null,
    accessToken: session?.access_token ?? null,
    email: session?.user.email ?? null,
    loading,
    recoveryMode
  }), [session, loading, recoveryMode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
