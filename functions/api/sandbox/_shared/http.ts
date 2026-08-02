import type { Env } from "./types.ts";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer"
};

export class PublicHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter: number | null;

  constructor(status: number, code: string, retryAfter: number | null = null) {
    super(code);
    this.name = "PublicHttpError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

const PUBLIC_ERROR_CODES = new Set([
  "authentication_required",
  "authentication_invalid",
  "profile_required",
  "account_inactive",
  "sandbox_not_authorized",
  "source_unauthorized",
  "origin_denied",
  "sandbox_disabled",
  "sandbox_service_unavailable",
  "runner_unavailable",
  "internal_failure",
  "method_not_allowed",
  "json_required",
  "request_too_large",
  "request_encoding_invalid",
  "request_schema_invalid",
  "client_request_id_invalid",
  "snapshot_id_invalid",
  "source_type_invalid",
  "source_id_invalid",
  "language_invalid",
  "code_required",
  "code_invalid",
  "code_too_large",
  "file_name_invalid",
  "json_invalid",
  "source_snapshot_changed",
  "sandbox_credits_required",
  "sandbox_credit_summary_invalid",
  "sandbox_quota_exceeded",
  "sandbox_busy",
  "idempotent_request_pending"
]);

const PUBLIC_ERROR_ALIASES: Record<string, string> = {
  account_disabled: "account_inactive",
  authorization_unavailable: "sandbox_service_unavailable",
  sandbox_misconfigured: "sandbox_service_unavailable",
  reservation_failed: "sandbox_service_unavailable",
  reservation_unavailable: "sandbox_service_unavailable",
  reservation_start_failed: "sandbox_service_unavailable",
  reservation_start_invalid: "sandbox_service_unavailable",
  source_file_unauthorized: "source_unauthorized",
  source_language_unauthorized: "source_unauthorized",
  source_code_invalid: "source_unauthorized",
  sandbox_upstream_failed: "runner_unavailable",
  sandbox_upstream_invalid: "runner_unavailable",
  upstream_redirect_denied: "runner_unavailable",
  upstream_response_invalid: "runner_unavailable",
  upstream_timeout: "runner_unavailable"
};

export function publicErrorCode(code: string): string {
  const aliased = PUBLIC_ERROR_ALIASES[code] ?? code;
  return PUBLIC_ERROR_CODES.has(aliased) ? aliased : "internal_failure";
}

export function jsonResponse(body: unknown, status = 200, retryAfter: number | null = null): Response {
  const headers = new Headers(JSON_HEADERS);
  if (retryAfter !== null) headers.set("retry-after", String(Math.max(1, Math.ceil(retryAfter))));
  return new Response(JSON.stringify(body), { status, headers });
}

export function safeErrorResponse(error: unknown): Response {
  if (error instanceof PublicHttpError) {
    const code = publicErrorCode(error.code);
    const stableStatus: Record<string, number> = {
      authentication_required: 401,
      authentication_invalid: 401,
      profile_required: 403,
      account_inactive: 403,
      sandbox_not_authorized: 403,
      source_unauthorized: 403,
      origin_denied: 403,
      sandbox_disabled: 503,
      sandbox_service_unavailable: 503,
      runner_unavailable: 503,
      internal_failure: 500
    };
    const status = stableStatus[code] ?? error.status;
    return jsonResponse({ ok: false, error: code }, status, error.retryAfter);
  }
  return jsonResponse({ ok: false, error: "internal_failure" }, 500);
}

export function assertSandboxReadConfigured(request: Request, env: Env): void {
  const rawOrigin = env.SANDBOX_PUBLIC_ORIGIN?.replace(/\/$/, "");
  let configuredOrigin: URL;
  try {
    if (!rawOrigin) throw new Error("missing");
    configuredOrigin = new URL(rawOrigin);
  } catch {
    throw new PublicHttpError(503, "sandbox_disabled");
  }
  const local = configuredOrigin.protocol === "http:"
    && (configuredOrigin.hostname === "127.0.0.1" || configuredOrigin.hostname === "localhost");
  const requestUrl = new URL(request.url);
  if (
    (configuredOrigin.protocol !== "https:" && !local)
    || configuredOrigin.username
    || configuredOrigin.password
    || (configuredOrigin.pathname !== "/" && configuredOrigin.pathname !== "")
    || configuredOrigin.search
    || configuredOrigin.hash
    || configuredOrigin.hostname.endsWith(".pages.dev")
    || requestUrl.origin !== configuredOrigin.origin
  ) throw new PublicHttpError(503, "sandbox_disabled");

  const origin = request.headers.get("origin");
  if (origin && origin !== configuredOrigin.origin) throw new PublicHttpError(403, "origin_denied");
}

export function assertProductionEnabled(request: Request, env: Env): void {
  assertSandboxReadConfigured(request, env);
  const requestUrl = new URL(request.url);
  const configuredOrigin = env.SANDBOX_PUBLIC_ORIGIN?.replace(/\/$/, "");
  if (
    env.SANDBOX_ENABLED !== "true"
    || env.SANDBOX_DEPLOYMENT_ENV !== "production"
    || !configuredOrigin
    || requestUrl.origin !== configuredOrigin
  ) {
    throw new PublicHttpError(503, "sandbox_disabled");
  }
}

export function requireSameOriginMutation(request: Request, env: Env): void {
  const configuredOrigin = env.SANDBOX_PUBLIC_ORIGIN?.replace(/\/$/, "");
  if (!configuredOrigin || request.headers.get("origin") !== configuredOrigin) {
    throw new PublicHttpError(403, "origin_denied");
  }
}

export function requireJsonPost(request: Request): void {
  if (request.method !== "POST") throw new PublicHttpError(405, "method_not_allowed");
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new PublicHttpError(415, "json_required");
}

export async function readBoundedText(request: Request, maximumBytes: number): Promise<string> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBytes)) {
    throw new PublicHttpError(413, "request_too_large");
  }

  if (!request.body) return "";
  const reader = request.body.getReader();
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
        throw new PublicHttpError(413, "request_too_large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch (error) {
    if (error instanceof PublicHttpError) throw error;
    throw new PublicHttpError(400, "request_encoding_invalid");
  } finally {
    reader.releaseLock();
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  fetcher: typeof fetch = fetch
): Promise<Response> {
  const controller = new AbortController();
  const rejectRedirects = init.redirect === "error";
  const requestInit: RequestInit = rejectRedirects
    ? { ...init, redirect: "manual" }
    : init;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(input, {
      ...requestInit,
      signal: controller.signal
    });
    if (
      rejectRedirects
      && response.status >= 300
      && response.status < 400
    ) {
      throw new PublicHttpError(502, "upstream_redirect_denied");
    }
    return response;
  } catch (error) {
    if (error instanceof PublicHttpError) throw error;
    throw new PublicHttpError(504, "upstream_timeout");
  } finally {
    clearTimeout(timeout);
  }
}

export async function readBoundedResponseJson(response: Response, maximumBytes: number): Promise<unknown> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBytes)) {
    throw new PublicHttpError(502, "upstream_response_invalid");
  }
  if (!response.body) throw new PublicHttpError(502, "upstream_response_invalid");
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
        throw new PublicHttpError(502, "upstream_response_invalid");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof PublicHttpError) throw error;
    throw new PublicHttpError(502, "upstream_response_invalid");
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new PublicHttpError(502, "upstream_response_invalid");
  }
}
