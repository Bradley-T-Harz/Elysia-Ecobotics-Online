import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../../pages/The-Elysia-Marketplace/lib/supabase";

export { emptyOwnership, ownershipSelectionSchema, publisherWorkspaceSchema } from "./publisherOwnershipContracts";
export type { OwnershipSelection, PublisherWorkspace } from "./publisherOwnershipContracts";
import { publisherWorkspaceSchema, type PublisherWorkspace } from "./publisherOwnershipContracts";

export async function publisherRpc(token: string, name: "current_user_publisher_workspace" | "save_own_marketplace_publisher", args: Record<string, unknown> = {}) {
  if (!supabase || !token) throw new Error("Sign in to manage a publisher identity.");
  const session = await supabase.auth.getSession();
  if (session.error || session.data.session?.access_token !== token) throw new Error("Your account session changed. Reload before continuing.");
  const { data, error } = await supabase.rpc(name, args).setHeader("Authorization", `Bearer ${token}`).abortSignal(AbortSignal.timeout(12_000));
  if (error) throw new Error(error.code === "42501" ? "This account is not authorized for that publisher action. Complete your Commons profile and check your publisher relationship." : "Publisher records could not be confirmed. No ownership or saved change should be assumed.");
  return data as unknown;
}

export function usePublisherWorkspace() {
  const { userId, accessToken, loading: authLoading } = useAuth();
  const [record, setRecord] = useState<{ token: string; state: PublisherWorkspace | null; error: string } | null>(null);
  const [generation, setGeneration] = useState(0);
  const refresh = useCallback(() => setGeneration(value => value + 1), []);
  useEffect(() => {
    let current = true;
    if (!userId || !accessToken) return;
    void publisherRpc(accessToken, "current_user_publisher_workspace").then(raw => {
      const state = publisherWorkspaceSchema.parse(raw);
      if (current) setRecord({ token: accessToken, state, error: "" });
    }).catch(() => { if (current) setRecord({ token: accessToken, state: null, error: "Publisher records are unavailable. Local draft preparation remains available; no publisher authority is inferred." }); });
    return () => { current = false; };
  }, [userId, accessToken, generation]);
  const resolved = Boolean(accessToken && record?.token === accessToken);
  return { state: resolved ? record!.state : null, error: resolved ? record!.error : "", loading: authLoading || Boolean(accessToken && !resolved), signedIn: Boolean(userId && accessToken), token: accessToken, refresh };
}
