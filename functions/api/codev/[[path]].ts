/** Pairing identity only. Source, workspace grants and native credentials never enter Pages. */
import { z } from "zod";

const ORIGINS = ["https://elysiaecobotics.com", "https://www.elysiaecobotics.com"] as const;
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const publicKey = z.object({ kty: z.literal("EC"), crv: z.literal("P-256"), x: token, y: token }).strict();
const browserId = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);
const surface = z.enum(["marketplace", "forge"]);
const createInput = z.object({ surface, browser_session_id: browserId, browser_public_key: publicKey }).strict();
const browserInput = z.object({ pairing_id: z.uuid(), surface, browser_session_id: browserId,
  action: z.enum(["status", "finish", "revoke"]) }).strict();
const claimInput = z.object({ code: z.string().regex(/^EC1\.[AW]\.[A-Za-z0-9_-]{43}$/),
  native_public_key: publicKey, native_secret: token }).strict();
const nativeInput = z.object({ pairing_id: z.uuid(), native_secret: token,
  action: z.enum(["confirm", "lease", "deny", "revoke"]) }).strict();
const pairingOutput = z.object({ pairing_id: z.uuid(), native_public_key: publicKey.nullable(),
  intent: z.object({ contract_version: z.literal("codev-pairing-1"), intent_id: z.uuid(), online_account_id: z.uuid(),
    account_label: z.string().min(1).max(200), origin: z.enum(ORIGINS), surface, browser_session_id: browserId,
    browser_public_key: publicKey, expires_at: z.string().max(50),
    status: z.enum(["pending", "native_approved", "paired", "denied", "expired", "revoked"]) }).strict(),
  workspace_grants: z.array(z.never()).length(0) }).strict();
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, max-age=0",
  "cross-origin-resource-policy": "same-origin", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const fail = (status: number, error: string) => reply({ ok: false, error }, status);
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hash = async (text: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, "0")).join("");
async function validKey(value: z.infer<typeof publicKey>) {
  for (const coordinate of [value.x, value.y]) {
    const raw = Uint8Array.from(atob(coordinate.replace(/-/g, "+").replace(/_/g, "/") + "="), char => char.charCodeAt(0));
    if (raw.length !== 32 || encode(raw) !== coordinate) throw new Error("invalid_key");
  }
  await crypto.subtle.importKey("jwk", value, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}
async function boundedBody(body: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  if (!body) throw new Error("missing_body");
  const reader = body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("body_limit"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function handleCodevPairing(request: Request, env: CodevPagesBindings): Promise<Response> {
  const url = new URL(request.url);
  if (!ORIGINS.includes(url.origin as typeof ORIGINS[number]) || url.search
    || !/^\/api\/codev\/(create|browser|claim|native)$/.test(url.pathname)) return fail(404, "codev_route_unavailable");
  if (request.method !== "POST") return fail(405, "method_not_allowed");
  const route = url.pathname.slice("/api/codev/".length);
  const native = route === "claim" || route === "native";
  const origin = request.headers.get("origin");
  // No browser CORS to native claim endpoints. Native has only single-purpose pairing secrets.
  if (native ? origin !== null || request.headers.get("x-codev-native") !== "pairing-1" : origin !== url.origin) return fail(403, "codev_origin_denied");
  const authorization = request.headers.get("authorization");
  if (native ? authorization !== null : !authorization || !/^Bearer [A-Za-z0-9._-]{40,8192}$/.test(authorization)) return fail(401, "codev_account_required");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
    || request.headers.has("content-encoding")) return fail(415, "codev_json_required");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 8192)) return fail(413, "codev_body_limit");
  let rpc: string; let params: Record<string, unknown>; let manualCode: string | undefined;
  try {
    const input: unknown = JSON.parse(await boundedBody(request.body, 8192));
    if (route === "create") {
      const data = createInput.parse(input); await validKey(data.browser_public_key);
      manualCode = `EC1.${url.origin === ORIGINS[0] ? "A" : "W"}.${encode(crypto.getRandomValues(new Uint8Array(32)))}`;
      rpc = "codev_create_pairing_intent";
      params = { p_origin: url.origin, p_surface: data.surface, p_browser_session_id: data.browser_session_id,
        p_browser_public_key: data.browser_public_key, p_code_hash: await hash(manualCode) };
    } else if (route === "browser") {
      const data = browserInput.parse(input); rpc = "codev_browser_pairing";
      params = { p_pairing_id: data.pairing_id, p_origin: url.origin, p_surface: data.surface,
        p_browser_session_id: data.browser_session_id, p_action: data.action };
    } else if (route === "claim") {
      const data = claimInput.parse(input); await validKey(data.native_public_key);
      if ((data.code.startsWith("EC1.A.") ? ORIGINS[0] : ORIGINS[1]) !== url.origin) return fail(403, "codev_origin_denied");
      rpc = "codev_claim_pairing_intent";
      params = { p_code_hash: await hash(data.code), p_native_public_key: data.native_public_key, p_native_secret_hash: await hash(data.native_secret) };
    } else {
      const data = nativeInput.parse(input); rpc = "codev_native_pairing";
      params = { p_pairing_id: data.pairing_id, p_native_secret_hash: await hash(data.native_secret), p_action: data.action };
    }
  } catch { return fail(400, "codev_pairing_input_invalid"); }
  try {
    const project = new URL(env.SUPABASE_URL);
    if (project.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(project.hostname)
      || project.port || project.username || project.password || project.search || project.hash || project.pathname !== "/"
      || !env.SUPABASE_PUBLISHABLE_KEY) return fail(503, "codev_pairing_unavailable");
    // JWT and live login/session authorization are checked by PostgREST + the narrow database RPC.
    // Workers supports manual redirects; reject every redirect below before any
    // second request can forward the account token or pairing secret hashes.
    const upstream = await fetch(new URL(`/rest/v1/rpc/${rpc}`, project), { method: "POST", redirect: "manual",
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json", ...(native ? {} : { authorization: authorization! }) },
      body: JSON.stringify(params), signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) { await upstream.body?.cancel(); return fail(upstream.status === 401 || upstream.status === 403 ? 403 : 409, "codev_pairing_unavailable"); }
    const parsed: unknown = JSON.parse(await boundedBody(upstream.body, 8192));
    if (parsed === null) return fail(403, "codev_pairing_unavailable");
    const pairing = pairingOutput.parse(parsed);
    if (pairing.intent.origin !== url.origin || pairing.pairing_id !== pairing.intent.intent_id) return fail(503, "codev_pairing_unavailable");
    return reply({ ok: true, pairing, ...(manualCode ? { manual_code: manualCode } : {}) });
  } catch { return fail(503, "codev_pairing_unavailable"); }
}
export const onRequest: PagesFunction<CodevPagesBindings> = context => handleCodevPairing(context.request, context.env);
