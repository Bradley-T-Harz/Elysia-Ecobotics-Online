import type { IdentityEnv } from "./types.ts";

const JSON_HEADERS = Object.freeze({
  "cache-control": "no-store, max-age=0",
  "content-type": "application/json; charset=utf-8",
  "cross-origin-resource-policy": "same-origin",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
});

export class IdentityHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter: number | null;

  constructor(status: number, code: string, retryAfter: number | null = null) {
    super(code);
    this.name = "IdentityHttpError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export function jsonResponse(body: unknown, status = 200, retryAfter: number | null = null): Response {
  const headers = new Headers(JSON_HEADERS);
  if (retryAfter !== null) headers.set("retry-after", String(Math.max(1, Math.ceil(retryAfter))));
  return new Response(JSON.stringify(body), { status, headers });
}

export function safeIdentityErrorResponse(error: unknown): Response {
  if (error instanceof IdentityHttpError) {
    return jsonResponse({ ok: false, error: error.code }, error.status, error.retryAfter);
  }
  return jsonResponse({ ok: false, error: "identity_request_failed" }, 502);
}

export function requireGet(request: Request): void {
  if (request.method !== "GET") throw new IdentityHttpError(405, "method_not_allowed");
}

export function requireJsonPost(request: Request): void {
  if (request.method !== "POST") throw new IdentityHttpError(405, "method_not_allowed");
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new IdentityHttpError(415, "json_required");
}

function validateOrigin(value: string): string {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new IdentityHttpError(503, "identity_misconfigured"); }
  const local = url.protocol === "http:"
    && (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    && /^\d{2,5}$/.test(url.port);
  if (
    (!local && url.protocol !== "https:")
    || url.username
    || url.password
    || (url.pathname !== "/" && url.pathname !== "")
    || url.search
    || url.hash
  ) throw new IdentityHttpError(503, "identity_misconfigured");
  return url.origin;
}

export function allowedOrigins(env: IdentityEnv): ReadonlySet<string> {
  const values = env.IDENTITY_ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  if (values.length < 1 || values.length > 8) throw new IdentityHttpError(503, "identity_misconfigured");
  return new Set(values.map(validateOrigin));
}

export function requireSameOriginMutation(request: Request, env: IdentityEnv): string {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(env).has(origin)) throw new IdentityHttpError(403, "origin_denied");
  return origin;
}

export async function readBoundedText(request: Request, maximumBytes: number): Promise<string> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBytes)) {
    throw new IdentityHttpError(413, "request_too_large");
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maximumBytes) {
        await reader.cancel();
        throw new IdentityHttpError(413, "request_too_large");
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } catch (error) {
    if (error instanceof IdentityHttpError) throw error;
    throw new IdentityHttpError(400, "request_encoding_invalid");
  } finally {
    reader.releaseLock();
  }
}

export async function parseBoundedJsonRequest(request: Request, maximumBytes = 32_768): Promise<unknown> {
  const body = await readBoundedText(request, maximumBytes);
  try { return JSON.parse(body) as unknown; }
  catch { throw new IdentityHttpError(400, "json_invalid"); }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  fetcher: typeof fetch = fetch
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(input, { ...init, redirect: "error", signal: controller.signal });
  } catch (error) {
    const record = error && typeof error === "object" && !Array.isArray(error)
      ? error as Record<string, unknown>
      : {};
    const cause = record.cause && typeof record.cause === "object" && !Array.isArray(record.cause)
      ? record.cause as Record<string, unknown>
      : {};
    console.info(JSON.stringify({
      event: "identity.upstream_fetch",
      outcome: "failed",
      errorClass: typeof record.name === "string" && /^[A-Za-z][A-Za-z0-9]{1,80}$/.test(record.name)
        ? record.name
        : "unknown",
      errorCode: typeof record.code === "string" && /^[A-Z0-9_]{1,80}$/.test(record.code)
        ? record.code
        : null,
      causeClass: typeof cause.name === "string" && /^[A-Za-z][A-Za-z0-9]{1,80}$/.test(cause.name)
        ? cause.name
        : null,
      causeCode: typeof cause.code === "string" && /^[A-Z0-9_]{1,80}$/.test(cause.code)
        ? cause.code
        : null,
      aborted: controller.signal.aborted,
    }));
    throw new IdentityHttpError(
      controller.signal.aborted ? 504 : 502,
      controller.signal.aborted ? "identity_upstream_timeout" : "identity_upstream_fetch_failed",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function readBoundedResponseJson(response: Response, maximumBytes = 65_536): Promise<unknown> {
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maximumBytes)) {
    throw new IdentityHttpError(502, "identity_upstream_invalid");
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new IdentityHttpError(502, "identity_upstream_invalid");
  }
  try { return JSON.parse(text) as unknown; }
  catch { throw new IdentityHttpError(502, "identity_upstream_invalid"); }
}

export async function readBoundedResponseBytes(
  response: Response,
  maximumBytes: number,
  errorPrefix = "profile_image"
): Promise<Uint8Array> {
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maximumBytes)) {
    throw new IdentityHttpError(413, `${errorPrefix}_too_large`);
  }
  if (!response.body) throw new IdentityHttpError(502, `${errorPrefix}_upstream_invalid`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new IdentityHttpError(413, `${errorPrefix}_too_large`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
