import { parseDocument } from "yaml";
import { getCodingLanguagePolicy, normalizeCodingLanguage } from "./codeLanguagePolicies";
import { scanCommuneTextForSecrets } from "./communeSafety";

export type CodingDiagnosticSeverity = "info" | "warning" | "error";
export type CodingDiagnosticPhase = "static" | "policy" | "runtime" | "sandbox" | "security";
export type CodingDiagnosticCategory =
  | "syntax_error"
  | "type_error"
  | "compile_error"
  | "runtime_error"
  | "test_failure"
  | "lint_warning"
  | "dependency_blocked"
  | "network_denied"
  | "filesystem_denied"
  | "timeout"
  | "memory_exceeded"
  | "output_truncated"
  | "forbidden_operation"
  | "secret_scan_warning"
  | "unsupported_language"
  | "sandbox_credits_required"
  | "authentication_required"
  | "authentication_invalid"
  | "profile_required"
  | "account_inactive"
  | "sandbox_not_authorized"
  | "source_unauthorized"
  | "origin_denied"
  | "sandbox_disabled"
  | "sandbox_service_unavailable"
  | "runner_unavailable"
  | "internal_failure"
  | "sandbox_internal_failure"
  | "policy_info";

export type CodingDiagnostic = {
  severity: CodingDiagnosticSeverity;
  phase: CodingDiagnosticPhase;
  category: CodingDiagnosticCategory;
  language: string;
  file?: string | null;
  line?: number | null;
  column?: number | null;
  message: string;
  source: string;
};

export type SandboxRunStatus =
  | "draft"
  | "requested"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "denied"
  | "policy_blocked"
  | "sandbox_unavailable";

export type SandboxRunResult = {
  ok: boolean;
  runId?: string;
  status: SandboxRunStatus;
  language: string;
  file?: string | null;
  snapshotId?: string | null;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  durationMs?: number | null;
  outputTruncated?: boolean;
  recordingStatus?: "recorded" | "failed";
  idempotentReplay?: boolean;
  errorCode?: import("./sandboxRunErrors").SandboxRunPublicErrorCode;
  diagnostics: CodingDiagnostic[];
  message: string;
};

function diagnostic(input: Partial<CodingDiagnostic> & Pick<CodingDiagnostic, "message" | "category" | "source">, language: string, file?: string | null): CodingDiagnostic {
  return {
    severity: input.severity ?? "info",
    phase: input.phase ?? "static",
    category: input.category,
    language,
    file,
    line: input.line ?? null,
    column: input.column ?? null,
    message: input.message,
    source: input.source
  };
}

function lineColumnFromIndex(text: string, index: number | undefined) {
  if (!Number.isFinite(index)) return {};
  const before = text.slice(0, Math.max(0, Number(index)));
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export function runStaticCodingDiagnostics(input: { language?: string | null; fileName?: string | null; code: string }): CodingDiagnostic[] {
  const language = normalizeCodingLanguage(input.language);
  const policy = getCodingLanguagePolicy(language);
  const file = input.fileName || null;
  const code = input.code ?? "";
  const diagnostics: CodingDiagnostic[] = [];
  const secretScan = scanCommuneTextForSecrets([language, file ?? "", code].join("\n"));

  if (secretScan.warnings.length) {
    diagnostics.push(diagnostic({
      severity: secretScan.blocked ? "error" : "warning",
      phase: "security",
      category: "secret_scan_warning",
      source: "Commune secret scanner",
      message: secretScan.blocked
        ? `Remove private/secret material before sharing or running: ${secretScan.warnings.join(", ")}.`
        : `Review possible private material before sharing: ${secretScan.warnings.join(", ")}.`
    }, language, file));
  }

  if (policy.status === "disabled") {
    diagnostics.push(diagnostic({
      severity: "error",
      phase: "policy",
      category: "unsupported_language",
      source: "Coding Cornucopia language policy",
      message: `${policy.label} is disabled for public sandbox execution.`
    }, language, file));
  } else if (policy.status === "future") {
    diagnostics.push(diagnostic({
      severity: "warning",
      phase: "policy",
      category: "unsupported_language",
      source: "Coding Cornucopia language policy",
      message: `${policy.label} is planned for a later sandbox policy pass and is static-review only right now.`
    }, language, file));
  } else {
    diagnostics.push(diagnostic({
      phase: "policy",
      category: "policy_info",
      source: "Coding Cornucopia language policy",
      message: `${policy.label}: ${policy.summary}`
    }, language, file));
  }

  if (language === "json") {
    try {
      JSON.parse(code || "null");
    } catch (error) {
      const match = (error instanceof Error ? error.message : "").match(/position\s+(\d+)/i);
      diagnostics.push(diagnostic({
        severity: "error",
        category: "syntax_error",
        source: "JSON parser",
        message: error instanceof Error ? error.message : "JSON could not be parsed.",
        ...lineColumnFromIndex(code, match ? Number(match[1]) : undefined)
      }, language, file));
    }
  }

  if (language === "yaml") {
    const document = parseDocument(code || "");
    for (const error of document.errors) {
      const pos = Array.isArray(error.pos) ? error.pos[0] : undefined;
      diagnostics.push(diagnostic({
        severity: "error",
        category: "syntax_error",
        source: "YAML parser",
        message: error.message,
        ...lineColumnFromIndex(code, pos)
      }, language, file));
    }
  }

  if (language === "html" && /<script\b|on\w+\s*=/i.test(code)) {
    diagnostics.push(diagnostic({
      severity: "warning",
      phase: "security",
      category: "forbidden_operation",
      source: "HTML static policy",
      message: "Script tags and inline event handlers are flagged. Commune displays HTML as inert text only."
    }, language, file));
  }

  if (language === "css") {
    const open = (code.match(/{/g) ?? []).length;
    const close = (code.match(/}/g) ?? []).length;
    if (open !== close) {
      diagnostics.push(diagnostic({
        severity: "warning",
        category: "syntax_error",
        source: "CSS static checker",
        message: "CSS braces appear unbalanced."
      }, language, file));
    }
  }

  if (language === "markdown" && /\]\((file:|\/home\/|[A-Z]:\\)/i.test(code)) {
    diagnostics.push(diagnostic({
      severity: "warning",
      phase: "security",
      category: "filesystem_denied",
      source: "Markdown static policy",
      message: "Markdown references to local file paths are not public-safe."
    }, language, file));
  }

  return diagnostics;
}

export function mergeDiagnostics(...groups: Array<CodingDiagnostic[] | undefined>) {
  return groups.flatMap((group) => group ?? []);
}
