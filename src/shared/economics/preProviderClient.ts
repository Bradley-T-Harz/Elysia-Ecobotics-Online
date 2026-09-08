import { preparationCommandSchema, preparationMutationResultSchema, preparationOverviewSchema, type PreparationAudience, type PreparationCommand } from "./preProviderContracts.ts";

export class PreparationError extends Error {
  constructor(readonly code: "disabled" | "conflict" | "forbidden" | "unavailable" | "invalid") {
    super({ disabled: "Internal financial preparation is not published here yet. No request was sent.", conflict: "The record changed or the action is blocked. Reload its current state before trying again.", forbidden: "This account does not have the required authority for that record.", unavailable: "Preparation state is unavailable. No completed action should be assumed.", invalid: "Check the required fields. Do not include banking, card or credential information." }[code]);
  }
}
export function preparationPublished() {
  return typeof document !== "undefined" && document.head.querySelector<HTMLMetaElement>('meta[name="elysia-economic-preparation-publication"]')?.content === "pre_provider";
}
async function preparationFetch(path: string, accessToken: string, body?: PreparationCommand, callerSignal?: AbortSignal): Promise<Record<string, unknown>> {
  if (!preparationPublished()) throw new PreparationError("disabled");
  if (!accessToken || accessToken.length > 4096 || /[\s,]/.test(accessToken)) throw new PreparationError("forbidden");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  callerSignal?.addEventListener("abort", cancel, { once: true });
  if (callerSignal?.aborted) controller.abort();
  const timeout = setTimeout(cancel, 10_000);
  try {
    const response = await fetch(`/api/economic-preparation/${path}`, {
      method: body ? "POST" : "GET", headers: { accept: "application/json", authorization: `Bearer ${accessToken}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined, cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal
    });
    if (!response.ok) throw new PreparationError(response.status === 409 ? "conflict" : response.status === 403 || response.status === 401 ? "forbidden" : response.status === 400 ? "invalid" : "unavailable");
    if (!response.headers.get("content-type")?.startsWith("application/json") || !response.body) throw new PreparationError("unavailable");
    const reader = response.body.getReader(); const decoder = new TextDecoder("utf-8", { fatal: true }); let bytes = 0; let raw = "";
    try {
      while (true) { const item = await reader.read(); if (item.done) break; bytes += item.value.byteLength; if (bytes > 131_072) { await reader.cancel(); throw new PreparationError("unavailable"); } raw += decoder.decode(item.value, { stream: true }); }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data) || !("ok" in data) || data.ok !== true) throw new PreparationError("unavailable");
    return data as Record<string, unknown>;
  } catch (error) { if (error instanceof PreparationError) throw error; throw new PreparationError("unavailable"); }
  finally { clearTimeout(timeout); callerSignal?.removeEventListener("abort", cancel); }
}
export async function loadPreparation(accessToken: string, audience: PreparationAudience, signal?: AbortSignal) {
  const data = await preparationFetch(`state?audience=${audience}`, accessToken, undefined, signal);
  const result = preparationOverviewSchema.safeParse(data.state);
  if (!result.success || Object.keys(data).sort().join(",") !== "ok,state") throw new PreparationError("unavailable");
  return result.data;
}
export async function commandPreparation(accessToken: string, input: PreparationCommand) {
  const parsed = preparationCommandSchema.safeParse(input);
  if (!parsed.success) throw new PreparationError("invalid");
  const data = await preparationFetch("command", accessToken, parsed.data);
  const result = preparationMutationResultSchema.safeParse(data.result);
  if (!result.success || result.data.requestId !== input.requestId || Object.keys(data).sort().join(",") !== "ok,result") throw new PreparationError("unavailable");
  return result.data;
}
