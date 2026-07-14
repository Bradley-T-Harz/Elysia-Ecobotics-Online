import { createHash } from "node:crypto";
import { dangerousCommandPatterns, defaultLimits, maxCodeBytes, runtimeForLanguage, secretPatterns } from "./policy.mjs";

function issue(level, code, message, path = "bundle") { return { level, code, message, path }; }
function list(value) { return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []; }
function textOf(bundle) { return JSON.stringify(bundle ?? {}); }
function privateDomain(domain) { return /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1|.*\.local)$/i.test(domain); }
function unsafePath(value) { return /(^|\s)(\/home\/|~\/|[A-Z]:\\|\.\.\/|\.\.\\|\.ssh|\.env|vault|credentials?|id_rsa)/i.test(value); }

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function sha256Text(text) { return createHash("sha256").update(text).digest("hex"); }

export function validateHandoffBundle(bundle) {
  const errors = [];
  const warnings = [];
  const info = [];
  const aggregate = textOf(bundle);
  const contract = bundle?.safety_contract ?? {};
  const review = bundle?.review ?? {};
  const intent = bundle?.execution_intent ?? {};
  const payload = bundle?.payload ?? {};
  const expectedCommand = String(intent.expected_command ?? "").trim();
  const runtime = runtimeForLanguage(intent.language);

  if (bundle?.schema_version !== "elysia.sandbox_request.v1") errors.push(issue("error", "schema_version", "Unsupported handoff schema version.", "schema_version"));
  if (bundle?.handoff_kind !== "local_elysia_sandbox_request") errors.push(issue("error", "handoff_kind", "Unsupported handoff kind.", "handoff_kind"));
  if (review.approved_for_local_handoff !== true || review.review_status !== "approved") errors.push(issue("error", "not_approved", "Bundle is not approved for local handoff.", "review"));
  if (contract.website_executed_code !== false) errors.push(issue("error", "website_execution_flag", "Safety contract must state website_executed_code=false.", "safety_contract.website_executed_code"));
  if (contract.requires_local_elysia_revalidation !== true) errors.push(issue("error", "revalidation_required", "Local revalidation must be required.", "safety_contract.requires_local_elysia_revalidation"));
  if (contract.requires_explicit_local_user_approval !== true) errors.push(issue("error", "local_confirmation_required", "Explicit local user approval must be required.", "safety_contract.requires_explicit_local_user_approval"));
  if (contract.network_default !== "disabled") errors.push(issue("error", "network_default", "Network default must be disabled.", "safety_contract.network_default"));
  if (contract.secrets_included !== false) errors.push(issue("error", "secrets_flag", "Bundle must state secrets_included=false.", "safety_contract.secrets_included"));
  if (contract.private_reviewer_notes_included !== false) errors.push(issue("error", "private_notes_flag", "Private reviewer notes must be excluded.", "safety_contract.private_reviewer_notes_included"));
  if ("reviewer_private_note" in review || "reviewer_private_note" in bundle) errors.push(issue("error", "private_note_present", "Private reviewer note is present in the bundle.", "review"));
  for (const pattern of secretPatterns) if (pattern.pattern.test(aggregate)) errors.push(issue("error", `secret_${pattern.code}`, "Secret-like or private local material detected."));
  for (const pattern of dangerousCommandPatterns) if (pattern.pattern.test(expectedCommand)) errors.push(issue("error", `dangerous_command_${pattern.code}`, "Expected command contains a blocked pattern.", "execution_intent.expected_command"));
  if (!runtime) errors.push(issue("error", "unsupported_language", "Only python and javascript snippet runtimes are supported in V1.", "execution_intent.language"));
  else if (expectedCommand && expectedCommand !== runtime.allowedCommand.join(" ")) errors.push(issue("error", "command_not_allowlisted", `Allowed command for this runtime is exactly: ${runtime.allowedCommand.join(" ")}.`, "execution_intent.expected_command"));
  if (!String(payload.code_text ?? "").trim()) errors.push(issue("error", "missing_code_text", "V1 runner supports code_text payloads only.", "payload.code_text"));
  if (Buffer.byteLength(String(payload.code_text ?? ""), "utf8") > maxCodeBytes) errors.push(issue("error", "code_too_large", "Code payload exceeds the governed runner limit.", "payload.code_text"));
  if (payload.package_reference) errors.push(issue("error", "package_reference_unsupported", "Package references are not executable in this runner pass.", "payload.package_reference"));
  if (intent.declared_network_policy !== "disabled" || list(intent.declared_network_domains).length) errors.push(issue("error", "network_not_disabled", "V1 runner requires network disabled and no declared runtime domains.", "execution_intent.declared_network_policy"));
  for (const domain of list(intent.declared_network_domains)) if (privateDomain(domain)) errors.push(issue("error", "private_domain", "Local/private domains are blocked.", "execution_intent.declared_network_domains"));
  if (!["none", "temporary_workspace_only"].includes(intent.declared_filesystem_policy)) errors.push(issue("error", "filesystem_policy", "Filesystem access must be none or temporary_workspace_only.", "execution_intent.declared_filesystem_policy"));
  for (const scope of list(intent.declared_file_scopes)) if (unsafePath(scope)) errors.push(issue("error", "unsafe_file_scope", "Unsafe file scope detected.", "execution_intent.declared_file_scopes"));
  const timeout = Number(intent.requested_limits?.timeout_seconds ?? defaultLimits.timeoutSeconds);
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > defaultLimits.timeoutSeconds) errors.push(issue("error", "timeout_limit", `Timeout must be between 1 and ${defaultLimits.timeoutSeconds} seconds for V1.`, "execution_intent.requested_limits.timeout_seconds"));
  if (/high|unlimited|large|gpu/i.test(`${intent.requested_limits?.cpu ?? ""} ${intent.requested_limits?.memory ?? ""}`)) errors.push(issue("error", "resource_limit", "High/unlimited resource requests are blocked.", "execution_intent.requested_limits"));
  if (bundle?.integrity?.bundle_sha256) info.push(issue("info", "bundle_checksum_present", "Bundle contains a checksum; runner records its own local hash before execution.", "integrity.bundle_sha256"));
  info.push(issue("info", "local_only", "Validation did not execute code. Runner remains local-only and fails closed."));
  return { ok: errors.length === 0, errors, warnings, info, runtime, bundleSha256: sha256Text(canonicalJson(bundle)) };
}
