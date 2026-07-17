import type { BillingEnv } from "./types.ts";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer"
};

export class BillingHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter: number | null;

  constructor(status: number, code: string, retryAfter: number | null = null) {
    super(code);
    this.name = "BillingHttpError";
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

export function safeBillingErrorResponse(error: unknown): Response {
  if (error instanceof BillingHttpError) {
    return jsonResponse({ ok: false, error: error.code }, error.status, error.retryAfter);
  }
  return jsonResponse({ ok: false, error: "billing_request_failed" }, 502);
}

export function requireJsonPost(request: Request): void {
  if (request.method !== "POST") throw new BillingHttpError(405, "method_not_allowed");
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new BillingHttpError(415, "json_required");
}

export function requireGet(request: Request): void {
  if (request.method !== "GET") throw new BillingHttpError(405, "method_not_allowed");
}

export function requireSameOriginMutation(request: Request, env: BillingEnv): void {
  const configuredOrigin = validatedPublicOrigin(env);
  if (request.headers.get("origin") !== configuredOrigin) throw new BillingHttpError(403, "origin_denied");
}

export function validatedPublicOrigin(env: BillingEnv): string {
  const raw = env.BILLING_PUBLIC_ORIGIN?.replace(/\/$/, "");
  if (!raw) throw new BillingHttpError(503, "billing_misconfigured");
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new BillingHttpError(503, "billing_misconfigured"); }
  const local = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (
    (url.protocol !== "https:" && !local)
    || url.username
    || url.password
    || (url.pathname !== "/" && url.pathname !== "")
    || url.search
    || url.hash
  ) throw new BillingHttpError(503, "billing_misconfigured");
  return url.origin;
}

export async function readBoundedText(request: Request, maximumBytes: number): Promise<string> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBytes)) {
    throw new BillingHttpError(413, "request_too_large");
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
        throw new BillingHttpError(413, "request_too_large");
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } catch (error) {
    if (error instanceof BillingHttpError) throw error;
    throw new BillingHttpError(400, "request_encoding_invalid");
  } finally {
    reader.releaseLock();
  }
}

export async function parseBoundedJsonRequest(request: Request, maximumBytes = 32_768): Promise<unknown> {
  const body = await readBoundedText(request, maximumBytes);
  try { return JSON.parse(body) as unknown; }
  catch { throw new BillingHttpError(400, "json_invalid"); }
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
    return await fetcher(input, { ...init, signal: controller.signal });
  } catch {
    throw new BillingHttpError(504, "billing_upstream_timeout");
  } finally {
    clearTimeout(timeout);
  }
}

export async function readBoundedResponseJson(response: Response, maximumBytes = 131_072): Promise<unknown> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBytes)) {
    throw new BillingHttpError(502, "billing_upstream_invalid");
  }
  if (!response.body) throw new BillingHttpError(502, "billing_upstream_invalid");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maximumBytes) {
        await reader.cancel();
        throw new BillingHttpError(502, "billing_upstream_invalid");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof BillingHttpError) throw error;
    throw new BillingHttpError(502, "billing_upstream_invalid");
  } finally {
    reader.releaseLock();
  }
  try { return JSON.parse(text) as unknown; }
  catch { throw new BillingHttpError(502, "billing_upstream_invalid"); }
}
