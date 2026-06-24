import { parseDocument } from "yaml";
import { dangerousCommandPatterns, disabledLanguages, futureLanguages, languagePolicyStatus, normalizeLanguage, secretPatterns } from "./policy.mjs";

export function diagnostic(input) {
  return {
    severity: input.severity || "info",
    phase: input.phase || "static",
    category: input.category || "policy_info",
    language: normalizeLanguage(input.language),
    file: input.file || null,
    line: input.line || null,
    column: input.column || null,
    message: input.message,
    source: input.source || "Elysia sandbox runner"
  };
}

function lineColumnFromIndex(text, index) {
  if (!Number.isFinite(index)) return {};
  const before = text.slice(0, Math.max(0, Number(index)));
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export function staticDiagnostics({ language, code, fileName }) {
  const normalized = normalizeLanguage(language);
  const text = String(code || "");
  const file = fileName || null;
  const diagnostics = [];
  const aggregate = `${normalized}\n${file || ""}\n${text}`;

  for (const item of secretPatterns) {
    if (item.pattern.test(aggregate)) diagnostics.push(diagnostic({ severity: "error", phase: "security", category: "secret_scan_warning", language: normalized, file, message: `Secret-like or private local material detected: ${item.code}.`, source: "Sandbox secret scanner" }));
  }
  for (const item of dangerousCommandPatterns) {
    if (item.pattern.test(text)) diagnostics.push(diagnostic({ severity: "error", phase: "security", category: "forbidden_operation", language: normalized, file, message: `Blocked unsafe code/command pattern: ${item.code}.`, source: "Sandbox policy scanner" }));
  }

  const status = languagePolicyStatus(normalized);
  if (status === "disabled" || disabledLanguages.includes(normalized)) diagnostics.push(diagnostic({ severity: "error", phase: "policy", category: "unsupported_language", language: normalized, file, message: `${normalized} is disabled for public sandbox execution.`, source: "Language policy" }));
  if (status === "future" || futureLanguages.includes(normalized)) diagnostics.push(diagnostic({ severity: "warning", phase: "policy", category: "unsupported_language", language: normalized, file, message: `${normalized} is planned for a later sandbox/toolchain policy pass.`, source: "Language policy" }));
  if (status === "unsupported") diagnostics.push(diagnostic({ severity: "warning", phase: "policy", category: "unsupported_language", language: normalized, file, message: `${normalized} is not in the V1 language allowlist.`, source: "Language policy" }));

  if (normalized === "json") {
    try { JSON.parse(text || "null"); }
    catch (error) {
      const match = String(error.message || "").match(/position\s+(\d+)/i);
      diagnostics.push(diagnostic({ severity: "error", category: "syntax_error", language: normalized, file, message: error.message, source: "JSON parser", ...lineColumnFromIndex(text, match ? Number(match[1]) : undefined) }));
    }
  }
  if (normalized === "yaml") {
    const document = parseDocument(text || "");
    for (const error of document.errors) diagnostics.push(diagnostic({ severity: "error", category: "syntax_error", language: normalized, file, message: error.message, source: "YAML parser", ...lineColumnFromIndex(text, Array.isArray(error.pos) ? error.pos[0] : undefined) }));
  }
  if (normalized === "html" && /<script\b|on\w+\s*=/i.test(text)) diagnostics.push(diagnostic({ severity: "warning", phase: "security", category: "forbidden_operation", language: normalized, file, message: "HTML script/event-handler content is flagged and never executed by this service.", source: "HTML static policy" }));
  if (normalized === "css" && ((text.match(/{/g) || []).length !== (text.match(/}/g) || []).length)) diagnostics.push(diagnostic({ severity: "warning", category: "syntax_error", language: normalized, file, message: "CSS braces appear unbalanced.", source: "CSS static checker" }));
  if (normalized === "markdown" && /\]\((file:|\/home\/|[A-Z]:\\)/i.test(text)) diagnostics.push(diagnostic({ severity: "warning", phase: "security", category: "filesystem_denied", language: normalized, file, message: "Markdown references to local file paths are not public-safe.", source: "Markdown static policy" }));
  return diagnostics;
}

export function diagnosticsBlockExecution(diagnostics) {
  return diagnostics.some((item) => item.severity === "error" && ["secret_scan_warning", "forbidden_operation", "unsupported_language"].includes(item.category));
}
