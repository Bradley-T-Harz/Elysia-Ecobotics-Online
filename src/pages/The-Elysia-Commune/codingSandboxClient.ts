import { type CodingDiagnostic, type SandboxRunResult } from "./codeDiagnosticTypes";
import { getCodingLanguagePolicy, normalizeCodingLanguage } from "./codeLanguagePolicies";

export type SandboxSourceType =
  | "commune_post_snippet"
  | "commune_code_document"
  | "commune_code_version"
  | "commune_code_revision_proposal"
  | "repository_showcase_artifact"
  | "iteration_showcase_artifact"
  | "manual_snapshot";

export type SandboxRunRequest = {
  clientRequestId?: string;
  snapshotId: string;
  sourceType: SandboxSourceType;
  sourceId?: string | null;
  language: string;
  fileName?: string | null;
  code: string;
};

const MAX_PROXY_RESPONSE_BYTES = 120_000;

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

async function readBoundedResponseText(response: Response): Promise<string | null> {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_PROXY_RESPONSE_BYTES) return null;
  if (!response.body) {
    const text = await response.text().catch(() => null);
    return text !== null && utf8Bytes(text) <= MAX_PROXY_RESPONSE_BYTES ? text : null;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PROXY_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function sandboxEndpointState() {
  return {
    configured: true,
    endpoint: "/api/sandbox",
    message: "Sandbox requests use the signed-in session through the governed same-origin Cloudflare proxy."
  };
}

function fallbackDiagnostic(message: string, language: string, category: CodingDiagnostic["category"] = "sandbox_internal_failure"): CodingDiagnostic {
  return {
    severity: "error",
    phase: "sandbox",
    category,
    language,
    file: null,
    line: null,
    column: null,
    source: "Coding Cornucopia sandbox client",
    message
  };
}

function failedResult(request: SandboxRunRequest, status: SandboxRunResult["status"], message: string, category: CodingDiagnostic["category"] = "sandbox_internal_failure"): SandboxRunResult {
  const language = normalizeCodingLanguage(request.language);
  return {
    ok: false,
    status,
    language,
    file: request.fileName ?? null,
    snapshotId: request.snapshotId,
    diagnostics: [fallbackDiagnostic(message, language, category)],
    message
  };
}

function isSandboxRunResult(value: unknown): value is SandboxRunResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Partial<SandboxRunResult>;
  const statuses = new Set(["completed", "failed", "denied", "policy_blocked", "sandbox_unavailable"]);
  return typeof result.ok === "boolean"
    && typeof result.status === "string" && statuses.has(result.status)
    && typeof result.language === "string" && result.language.length <= 32
    && typeof result.message === "string" && result.message.length <= 500
    && (result.runId === undefined || (typeof result.runId === "string" && result.runId.length <= 64))
    && (result.stdout === undefined || (typeof result.stdout === "string" && utf8Bytes(result.stdout) <= 32_768))
    && (result.stderr === undefined || (typeof result.stderr === "string" && utf8Bytes(result.stderr) <= 32_768))
    && Array.isArray(result.diagnostics) && result.diagnostics.length <= 40
    && result.diagnostics.every((item) => item && typeof item === "object" && typeof item.message === "string" && utf8Bytes(item.message) <= 1_000);
}

export async function requestSandboxRun(request: SandboxRunRequest, accessToken: string | null): Promise<SandboxRunResult> {
  const language = normalizeCodingLanguage(request.language);
  const policy = getCodingLanguagePolicy(language);
  if (!accessToken) return failedResult(request, "denied", "Sign in again before requesting governed sandbox execution.");
  if (policy.status !== "active_sandbox" && policy.status !== "static_diagnostics") {
    return failedResult(request, "policy_blocked", `${policy.label} is not enabled for this sandbox policy.`, "unsupported_language");
  }

  const clientRequestId = request.clientRequestId ?? crypto.randomUUID();
  const body = JSON.stringify({
    clientRequestId,
    snapshotId: request.snapshotId,
    sourceType: request.sourceType,
    sourceId: request.sourceId ?? null,
    language,
    fileName: request.fileName ?? null,
    code: request.code
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      response = await fetch("/api/sandbox/run", {
        method: "POST",
        headers: {
          "authorization": `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body,
        signal: controller.signal
      });
    } catch {
      if (attempt === 0) continue;
      return failedResult(request, "sandbox_unavailable", "The governed sandbox proxy is temporarily unreachable.");
    } finally {
      window.clearTimeout(timeout);
    }

    const responseText = await readBoundedResponseText(response);
    const payload = responseText !== null ? (() => { try { return JSON.parse(responseText) as unknown; } catch { return null; } })() : null;
    if (response.ok && isSandboxRunResult(payload)) return payload;
    if (attempt === 0 && [502, 504].includes(response.status)) continue;
    if (response.status === 401 || response.status === 403) return failedResult(request, "denied", "This sandbox request was not authorized.");
    if (response.status === 422) return failedResult(request, "policy_blocked", "This sandbox request was blocked by policy.");
    if (response.status === 429) return failedResult(request, "sandbox_unavailable", "The sandbox is busy or the current quota is exhausted. Please wait before retrying.");
    return failedResult(request, "sandbox_unavailable", "The governed sandbox is temporarily unavailable.");
  }
  return failedResult(request, "sandbox_unavailable", "The governed sandbox is temporarily unavailable.");
}
