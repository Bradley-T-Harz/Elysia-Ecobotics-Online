import { PublicHttpError, fetchWithTimeout, readBoundedResponseJson } from "./http.ts";
import type { AuthorizedSource, Env, RunnerResult, SandboxDiagnostic, SandboxFinalStatus, StartedReservation } from "./types.ts";

const FINAL_STATUSES = new Set<SandboxFinalStatus>([
  "completed",
  "failed",
  "denied",
  "policy_blocked",
  "sandbox_unavailable"
]);
const SEVERITIES = new Set(["info", "warning", "error"]);
const PHASES = new Set(["static", "policy", "runtime", "sandbox", "security"]);
const CATEGORIES = new Set([
  "syntax_error", "type_error", "compile_error", "runtime_error", "test_failure",
  "lint_warning", "dependency_blocked", "network_denied", "filesystem_denied",
  "timeout", "memory_exceeded", "output_truncated", "forbidden_operation",
  "secret_scan_warning", "unsupported_language", "sandbox_internal_failure", "policy_info"
]);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function cleanText(value: unknown, maximum: number, env?: Env): string {
  let clean = String(value ?? "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/(API[_-]?KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/\/(home|root|opt|workspace|tmp)(\/[^\s:'"]*)?/gi, "[SANDBOX_PATH]")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED_SECRET]");
  for (const sensitive of [
    env?.SANDBOX_SERVICE_TOKEN,
    env?.SANDBOX_DB_FINALIZER_TOKEN,
    env?.CLOUDFLARE_ACCESS_CLIENT_ID,
    env?.CLOUDFLARE_ACCESS_CLIENT_SECRET
  ]) {
    if (sensitive && sensitive.length >= 8) clean = clean.replaceAll(sensitive, "[REDACTED_SECRET]");
  }
  const encoded = new TextEncoder().encode(clean);
  if (encoded.byteLength <= maximum) return clean;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let end = Math.max(0, maximum);
  while (end > 0) {
    try {
      return decoder.decode(encoded.subarray(0, end));
    } catch {
      end -= 1;
    }
  }
  return "";
}

function finiteInteger(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum ? value : null;
}

function parseDiagnostics(value: unknown, language: string, file: string | null, env?: Env): SandboxDiagnostic[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).map((item): SandboxDiagnostic => {
    const row = record(item) ?? {};
    const severity = typeof row.severity === "string" && SEVERITIES.has(row.severity) ? row.severity : "info";
    const phase = typeof row.phase === "string" && PHASES.has(row.phase) ? row.phase : "sandbox";
    const category = typeof row.category === "string" && CATEGORIES.has(row.category) ? row.category : "sandbox_internal_failure";
    return {
      severity: severity as SandboxDiagnostic["severity"],
      phase: phase as SandboxDiagnostic["phase"],
      category,
      language,
      file,
      line: finiteInteger(row.line, 1, 10_000_000),
      column: finiteInteger(row.column, 1, 10_000_000),
      message: cleanText(row.message || "Sandbox diagnostic.", 1_000, env),
      source: "Coding Cornucopia sandbox"
    };
  });
}

function runnerHeaders(env: Env): Headers {
  const serviceToken = env.SANDBOX_SERVICE_TOKEN;
  const accessId = env.CLOUDFLARE_ACCESS_CLIENT_ID;
  const accessSecret = env.CLOUDFLARE_ACCESS_CLIENT_SECRET;
  if (!serviceToken || !accessId || !accessSecret) throw new PublicHttpError(503, "sandbox_misconfigured");
  return new Headers({
    "content-type": "application/json",
    "authorization": `Bearer ${serviceToken}`,
    "cf-access-client-id": accessId,
    "cf-access-client-secret": accessSecret
  });
}

function validSecret(value: string | undefined): boolean {
  return typeof value === "string"
    && value.length >= 32
    && value.length <= 512
    && !/[\r\n]/.test(value)
    && !/(replace|placeholder|changeme|enter[_ -]?directly)/i.test(value);
}

function runnerUrl(env: Env, path: string): URL {
  let base: URL;
  try {
    base = new URL(env.SANDBOX_SERVICE_URL);
  } catch {
    throw new PublicHttpError(503, "sandbox_misconfigured");
  }
  if (
    base.protocol !== "https:"
    || base.hostname !== "sandbox.elysiaecobotics.com"
    || base.port
    || base.username
    || base.password
    || (base.pathname !== "/" && base.pathname !== "")
    || base.search
    || base.hash
  ) throw new PublicHttpError(503, "sandbox_misconfigured");
  return new URL(path, base);
}

export function assertRunnerConfiguration(env: Env): void {
  if (
    !validSecret(env.SANDBOX_SERVICE_TOKEN)
    || !env.CLOUDFLARE_ACCESS_CLIENT_ID
    || env.CLOUDFLARE_ACCESS_CLIENT_ID.length > 512
    || /[\r\n]/.test(env.CLOUDFLARE_ACCESS_CLIENT_ID)
    || /(replace|placeholder|changeme|enter[_ -]?directly)/i.test(env.CLOUDFLARE_ACCESS_CLIENT_ID)
    || !env.CLOUDFLARE_ACCESS_CLIENT_SECRET
    || env.CLOUDFLARE_ACCESS_CLIENT_SECRET.length > 2_048
    || /[\r\n]/.test(env.CLOUDFLARE_ACCESS_CLIENT_SECRET)
    || /(replace|placeholder|changeme|enter[_ -]?directly)/i.test(env.CLOUDFLARE_ACCESS_CLIENT_SECRET)
  ) {
    throw new PublicHttpError(503, "sandbox_misconfigured");
  }
  runnerUrl(env, "/health");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function requestRunnerHealth(env: Env, fetcher: typeof fetch = fetch): Promise<boolean> {
  assertRunnerConfiguration(env);
  const response = await fetchWithTimeout(runnerUrl(env, "/health"), {
    method: "GET",
    headers: runnerHeaders(env),
    redirect: "error"
  }, 3_000, fetcher);
  if (!response.ok) return false;
  const payload = record(await readBoundedResponseJson(response, 8_192));
  return payload?.ok === true;
}

export async function executeRunner(
  env: Env,
  reservation: StartedReservation,
  source: AuthorizedSource,
  fetcher: typeof fetch = fetch
): Promise<RunnerResult> {
  assertRunnerConfiguration(env);
  const codeBytes = new TextEncoder().encode(source.code).byteLength;
  const codeSha256 = await sha256Hex(source.code);
  const response = await fetchWithTimeout(runnerUrl(env, "/v1/runs"), {
    method: "POST",
    headers: runnerHeaders(env),
    redirect: "error",
    body: JSON.stringify({
      reservation_id: reservation.runId,
      client_request_id: reservation.clientRequestId,
      lease_expires_at: reservation.leaseExpiresAt,
      snapshot_id: `reservation-${reservation.runId}`,
      language: source.language,
      file_name: source.fileName,
      code: source.code,
      code_sha256: codeSha256,
      code_bytes: codeBytes,
      network_policy: "disabled",
      filesystem_policy: "temporary_workspace_only"
    })
  }, 15_000, fetcher);

  if (response.status === 429) throw new PublicHttpError(429, "sandbox_busy", 4);
  if (!response.ok) throw new PublicHttpError(502, "sandbox_upstream_failed");
  const payload = record(await readBoundedResponseJson(response, 110_000));
  if (!payload) throw new PublicHttpError(502, "sandbox_upstream_invalid");
  return sanitizeRunnerResult(payload, source, env);
}

export function sanitizeRunnerResult(value: unknown, source: AuthorizedSource, env?: Env): RunnerResult {
  const payload = record(value) ?? {};
  const status = typeof payload.status === "string" && FINAL_STATUSES.has(payload.status as SandboxFinalStatus)
    ? payload.status as SandboxFinalStatus
    : "failed";
  const language = source.language;
  const file = source.fileName ? cleanText(source.fileName, 160, env) : null;
  return {
    ok: payload.ok === true && status === "completed",
    status,
    language,
    file,
    snapshotId: source.snapshotId,
    stdout: cleanText(payload.stdout, 32_768, env),
    stderr: cleanText(payload.stderr, 32_768, env),
    exitCode: finiteInteger(payload.exitCode, -1, 255),
    durationMs: finiteInteger(payload.durationMs, 0, 15_000),
    outputTruncated: payload.outputTruncated === true,
    diagnostics: parseDiagnostics(payload.diagnostics, language, file, env),
    message: status === "completed"
      ? "Sandbox execution completed. This is evidence only, never trust or approval."
      : status === "policy_blocked"
        ? "Sandbox execution was blocked by policy."
        : status === "sandbox_unavailable"
          ? "Sandbox execution is temporarily unavailable."
          : status === "denied"
            ? "Sandbox execution was denied."
            : "Sandbox execution failed safely."
  };
}

export function unavailableRunnerResult(source: AuthorizedSource, message = "Sandbox execution is temporarily unavailable."): RunnerResult {
  return {
    ok: false,
    status: "sandbox_unavailable",
    language: source.language,
    file: source.fileName,
    snapshotId: source.snapshotId,
    stdout: "",
    stderr: "",
    exitCode: null,
    durationMs: null,
    outputTruncated: false,
    diagnostics: [],
    message
  };
}
