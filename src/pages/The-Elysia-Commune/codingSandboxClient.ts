import { type CodingDiagnostic, type SandboxRunResult } from "./codeDiagnosticTypes";
import { getCodingLanguagePolicy, normalizeCodingLanguage } from "./codeLanguagePolicies";

export type SandboxRunRequest = {
  snapshotId: string;
  sourceType: "commune_post_snippet" | "commune_code_document" | "commune_code_version" | "repository_showcase_artifact";
  sourceId?: string | null;
  language: string;
  fileName?: string | null;
  code: string;
};

export function configuredSandboxEndpoint() {
  return String(import.meta.env.VITE_CODING_SANDBOX_ENDPOINT ?? "").replace(/\/+$/, "");
}

export function sandboxEndpointState() {
  const endpoint = configuredSandboxEndpoint();
  return {
    configured: Boolean(endpoint),
    endpoint,
    message: endpoint
      ? "Sandbox service endpoint configured. Runs still use snapshot, language, resource, and safety policies."
      : "Sandbox execution is fail-closed until VITE_CODING_SANDBOX_ENDPOINT points at the isolated Coding Cornucopia sandbox service."
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

export async function requestSandboxRun(request: SandboxRunRequest): Promise<SandboxRunResult> {
  const language = normalizeCodingLanguage(request.language);
  const policy = getCodingLanguagePolicy(language);
  const endpoint = configuredSandboxEndpoint();
  if (!endpoint) {
    return {
      ok: false,
      status: "sandbox_unavailable",
      language,
      file: request.fileName ?? null,
      snapshotId: request.snapshotId,
      diagnostics: [fallbackDiagnostic("Sandbox service endpoint is not configured for this deployment.", language)],
      message: "Sandbox service unavailable. Configure VITE_CODING_SANDBOX_ENDPOINT and deploy the isolated runner service."
    };
  }
  if (policy.status !== "active_sandbox" && policy.status !== "static_diagnostics") {
    return {
      ok: false,
      status: "policy_blocked",
      language,
      file: request.fileName ?? null,
      snapshotId: request.snapshotId,
      diagnostics: [fallbackDiagnostic(`${policy.label} is not enabled for this sandbox policy.`, language, "unsupported_language")],
      message: `${policy.label} is not enabled for this sandbox policy.`
    };
  }

  const response = await fetch(`${endpoint}/v1/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      snapshot_id: request.snapshotId,
      source_type: request.sourceType,
      source_id: request.sourceId ?? null,
      language,
      file_name: request.fileName ?? null,
      code: request.code,
      network_policy: "disabled",
      filesystem_policy: "temporary_workspace_only"
    })
  });
  const payload = await response.json().catch(() => null) as Partial<SandboxRunResult> | null;
  if (!response.ok || !payload) {
    return {
      ok: false,
      status: response.status === 403 ? "denied" : "failed",
      language,
      file: request.fileName ?? null,
      snapshotId: request.snapshotId,
      diagnostics: [fallbackDiagnostic(`Sandbox service returned HTTP ${response.status}.`, language)],
      message: `Sandbox service returned HTTP ${response.status}.`
    };
  }
  return {
    ok: Boolean(payload.ok),
    runId: payload.runId,
    status: payload.status ?? "failed",
    language: payload.language ?? language,
    file: payload.file ?? request.fileName ?? null,
    snapshotId: payload.snapshotId ?? request.snapshotId,
    stdout: payload.stdout ?? "",
    stderr: payload.stderr ?? "",
    exitCode: payload.exitCode ?? null,
    durationMs: payload.durationMs ?? null,
    diagnostics: payload.diagnostics ?? [],
    message: payload.message ?? "Sandbox run completed."
  };
}
