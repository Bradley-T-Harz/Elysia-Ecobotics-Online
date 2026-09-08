import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { commandPreparation, loadPreparation, PreparationError, preparationPublished } from "./preProviderClient.ts";
import type { PreparationAudience, PreparationCommand, PreparationOverview } from "./preProviderContracts.ts";
type WithoutRequest<T> = T extends unknown ? Omit<T, "requestId"> : never;
export type PreparationInput = WithoutRequest<PreparationCommand>;

export function usePreparation(audience: PreparationAudience) {
  const { accessToken, loading: authLoading } = useAuth();
  const [state, setState] = useState<PreparationOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  const lifecycle = useRef(0);
  const pending = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const inFlight = useRef(false);
  const actor = useRef(accessToken); actor.current = accessToken;
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    if (!accessToken || !preparationPublished()) { setState(null); setLoading(false); return; }
    setLoading(true); setError("");
    try { const result = await loadPreparation(accessToken, audience); if (current === generation.current) setState(result); }
    catch (cause) { if (current === generation.current) { setState(null); setError(cause instanceof PreparationError ? cause.message : "Preparation is unavailable."); } }
    finally { if (current === generation.current) setLoading(false); }
  }, [accessToken, audience]);
  useEffect(() => {
    lifecycle.current++;
    setState(null); setError(""); setMessage(""); setBusy(false); inFlight.current = false; pending.current = null;
    void refresh();
    return () => { generation.current++; lifecycle.current++; };
  }, [refresh]);
  async function run(input: PreparationInput) {
    if (!accessToken || busy || loading || inFlight.current) return false;
    inFlight.current = true;
    const token = accessToken;
    const started = lifecycle.current;
    const fingerprint = JSON.stringify(input);
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, requestId: crypto.randomUUID() };
    setBusy(true); setError(""); setMessage("");
    try {
      await commandPreparation(token, { ...input, requestId: pending.current.requestId });
      if (actor.current !== token || lifecycle.current !== started) return false;
      pending.current = null;
      setMessage("Internal preparation recorded. No payment, provider onboarding, refund or payout was executed.");
      await refresh();
      return true;
    } catch (cause) {
      if (actor.current === token && lifecycle.current === started) setError(cause instanceof PreparationError ? cause.message : "The preparation request could not be confirmed.");
      return false;
    } finally { if (actor.current === token && lifecycle.current === started) { setBusy(false); inFlight.current = false; } }
  }
  return { state, loading: authLoading || loading, busy, error, message, run, refresh, signedIn: Boolean(accessToken), published: preparationPublished() };
}
