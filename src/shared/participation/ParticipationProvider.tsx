import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../auth/useAuth";
import { friendlyIdentityError, loadIdentityBootstrap } from "./participationClient";
import type { IdentityBootstrap, ParticipationLoadState } from "./participationTypes";

export type ParticipationContextValue = Readonly<{
  state: ParticipationLoadState;
  bootstrap: IdentityBootstrap | null;
  error: string | null;
  refresh: () => void;
}>;

export const ParticipationContext = createContext<ParticipationContextValue>({
  state: "signed_out",
  bootstrap: null,
  error: null,
  refresh: () => undefined,
});

export function ParticipationProvider({ children }: { children: ReactNode }) {
  const { accessToken, configured, loading: authLoading, userId } = useAuth();
  const [state, setState] = useState<ParticipationLoadState>(authLoading ? "loading" : "signed_out");
  const [bootstrap, setBootstrap] = useState<IdentityBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshSequence, setRefreshSequence] = useState(0);

  const refresh = useCallback(() => setRefreshSequence((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    if (authLoading) {
      setState("loading");
      setBootstrap(null);
      setError(null);
      return () => controller.abort();
    }
    if (!configured) {
      setState("unconfigured");
      setBootstrap(null);
      setError(null);
      return () => controller.abort();
    }
    if (!accessToken || !userId) {
      setState("signed_out");
      setBootstrap(null);
      setError(null);
      return () => controller.abort();
    }

    setState("loading");
    setBootstrap(null);
    setError(null);
    void loadIdentityBootstrap(accessToken, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.communityAccess.userId !== userId) {
          setState("error");
          setError("The shared account service returned an identity mismatch and access was stopped safely.");
          return;
        }
        setBootstrap(result);
        setState("ready");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setBootstrap(null);
        setError(friendlyIdentityError(reason));
        setState("error");
      });

    return () => controller.abort();
  }, [accessToken, authLoading, configured, refreshSequence, userId]);

  const value = useMemo<ParticipationContextValue>(() => ({ state, bootstrap, error, refresh }), [bootstrap, error, refresh, state]);
  return <ParticipationContext.Provider value={value}>{children}</ParticipationContext.Provider>;
}
