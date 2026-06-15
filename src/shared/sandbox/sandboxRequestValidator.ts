import {
  sandboxFilesystemPolicies,
  sandboxNetworkPolicies,
  sandboxSourceTypes,
  type SandboxFilesystemPolicy,
  type SandboxNetworkPolicy,
  type SandboxRequestInput,
  type SandboxValidationIssue,
  type SandboxValidationResult
} from "./sandboxHandoffTypes";

const secretPatterns = [
  { code: "env_file", pattern: /(^|[\s/\\])\.env([\s/\\.]|$)/i, label: ".env file reference" },
  { code: "api_key", pattern: /API[_-]?KEY\s*[:=]/i, label: "API key-like text" },
  { code: "secret", pattern: /SECRET\s*[:=]/i, label: "secret-like text" },
  { code: "token", pattern: /TOKEN\s*[:=]/i, label: "token-like text" },
  { code: "password", pattern: /PASSWORD\s*[:=]/i, label: "password-like text" },
  { code: "private_key", pattern: /BEGIN [A-Z ]*PRIVATE KEY/i, label: "private key material" },
  { code: "openai_key", pattern: /sk-[A-Za-z0-9_-]{12,}/, label: "secret key-like token" },
  { code: "github_token", pattern: /(ghp_|github_pat_)[A-Za-z0-9_]+/i, label: "GitHub token-like text" },
  { code: "aws_key", pattern: /AWS_ACCESS_KEY_ID\s*[:=]/i, label: "AWS key-like text" },
  { code: "service_role", pattern: /(SUPABASE_SERVICE_ROLE|service_role)/i, label: "service-role reference" },
  { code: "home_path", pattern: /(^|\s)\/home\//i, label: "private home path" },
  { code: "windows_path", pattern: /[A-Z]:\\/i, label: "absolute Windows path" },
  { code: "vault", pattern: /\b(vault|credentials?)\b/i, label: "vault/credential reference" }
];

const dangerousCommandPatterns = [
  { code: "curl_bash", pattern: /curl\b[^\n|]*\|\s*(sh|bash)/i, label: "curl piped to shell" },
  { code: "wget_bash", pattern: /wget\b[^\n|]*\|\s*(sh|bash)/i, label: "wget piped to shell" },
  { code: "rm_rf", pattern: /rm\s+-rf/i, label: "recursive delete command" },
  { code: "sudo", pattern: /(^|\s)sudo(\s|$)/i, label: "sudo command" },
  { code: "chmod_exec", pattern: /chmod\s+\+x/i, label: "chmod executable command" },
  { code: "npm_install", pattern: /npm\s+install/i, label: "dependency install command" },
  { code: "pip_remote", pattern: /pip\s+install\s+https?:\/\//i, label: "remote dependency install command" },
  { code: "postinstall", pattern: /postinstall/i, label: "package install hook" },
  { code: "preinstall", pattern: /preinstall/i, label: "package install hook" },
  { code: "eval", pattern: /eval\s*\(/i, label: "dynamic code evaluation" },
  { code: "new_function", pattern: /new\s+Function\b/i, label: "dynamic function construction" },
  { code: "child_process", pattern: /child_process/i, label: "process execution API" },
  { code: "exec", pattern: /\bexec\s*\(/i, label: "process execution call" },
  { code: "spawn", pattern: /\bspawn\s*\(/i, label: "process spawn call" },
  { code: "git_clone", pattern: /git\s+clone/i, label: "repository clone command" }
];

function issue(level: SandboxValidationIssue["level"], code: string, message: string, path?: string, suggestion?: string): SandboxValidationIssue {
  return { level, code, message, path, suggestion };
}

function asList(value?: string[] | null) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

export function detectSecretLikeSandboxText(text: string): string[] {
  return secretPatterns.filter((item) => item.pattern.test(text)).map((item) => item.label);
}

export function sanitizeExpectedCommand(command?: string | null) {
  return (command ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
}

export function sanitizeDeclaredDomains(domains?: string[] | string | null): string[] {
  const source = Array.isArray(domains) ? domains : String(domains ?? "").split(/[\n,]/);
  return source.map((domain) => domain.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase()).filter(Boolean);
}

export function sanitizeDeclaredFileScopes(scopes?: string[] | string | null): string[] {
  const source = Array.isArray(scopes) ? scopes : String(scopes ?? "").split(/[\n,]/);
  return source.map((scope) => scope.trim()).filter(Boolean).slice(0, 25);
}

function privateDomain(domain: string) {
  return /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1|.*\.local)$/i.test(domain);
}

function unsafeFileScope(scope: string) {
  return /(^|\s)(\/home\/|~\/|[A-Z]:\\|\.\.\/|\.\.\\|\.ssh|\.env|vault|credentials?)/i.test(scope);
}

export function validateSandboxRequestInput(input: SandboxRequestInput): SandboxValidationResult {
  const errors: SandboxValidationIssue[] = [];
  const warnings: SandboxValidationIssue[] = [];
  const info: SandboxValidationIssue[] = [];
  const command = sanitizeExpectedCommand(input.expected_command);
  const dependencies = asList(input.declared_dependencies);
  const domains = sanitizeDeclaredDomains(input.declared_network_domains ?? []);
  const scopes = sanitizeDeclaredFileScopes(input.declared_file_scopes ?? []);
  const networkPolicy = input.declared_network_policy as SandboxNetworkPolicy;
  const filesystemPolicy = input.declared_filesystem_policy as SandboxFilesystemPolicy;
  const aggregate = [input.title, input.summary, input.language, input.code_text, input.risk_notes, command, ...dependencies, ...domains, ...scopes].join("\n");

  if (!input.title?.trim()) errors.push(issue("error", "title_required", "Title is required.", "title"));
  if (!sandboxSourceTypes.includes(input.source_type)) errors.push(issue("error", "unknown_source_type", "Choose a known sandbox request source type.", "source_type"));
  if (!sandboxNetworkPolicies.includes(networkPolicy)) errors.push(issue("error", "unknown_network_policy", "Choose a supported network policy.", "declared_network_policy"));
  if (!sandboxFilesystemPolicies.includes(filesystemPolicy)) errors.push(issue("error", "unknown_filesystem_policy", "Choose a supported filesystem policy.", "declared_filesystem_policy"));
  if (!input.user_acknowledged_no_execution) errors.push(issue("error", "ack_no_execution_required", "Acknowledge that the website will not execute this request.", "user_acknowledged_no_execution"));
  if (!input.user_acknowledged_no_secrets) errors.push(issue("error", "ack_no_secrets_required", "Confirm the bundle contains no secrets or private local Elysia material.", "user_acknowledged_no_secrets"));
  if (!input.user_acknowledged_local_elysia_final_authority) errors.push(issue("error", "ack_local_authority_required", "Acknowledge that Local Elysia must revalidate and ask approval before any execution.", "user_acknowledged_local_elysia_final_authority"));

  for (const item of secretPatterns) if (item.pattern.test(aggregate)) errors.push(issue("error", `secret_${item.code}`, `Remove ${item.label}; sandbox handoff bundles must not contain secrets or private local material.`, "request"));
  for (const item of dangerousCommandPatterns) if (item.pattern.test(command)) errors.push(issue("error", `dangerous_command_${item.code}`, `Expected command contains ${item.label}. It is metadata only, but unsafe command patterns are not accepted for handoff.`, "expected_command"));
  for (const dependency of dependencies) if (/\b(npm|pip|pnpm|yarn|curl|wget|git)\b/i.test(dependency)) errors.push(issue("error", "dependency_is_command", "Declared dependencies must be package/tool names only, not install commands.", "declared_dependencies"));

  if (networkPolicy === "declared_domains_only" && domains.length === 0) errors.push(issue("error", "domains_required", "Declared-domains-only network policy requires at least one public domain.", "declared_network_domains"));
  for (const domain of domains) if (privateDomain(domain)) errors.push(issue("error", "private_network_domain", `Domain ${domain} is local/private and cannot be exported for public handoff review.`, "declared_network_domains"));
  if (networkPolicy === "disabled" && domains.length > 0) warnings.push(issue("warning", "domains_ignored", "Domains were listed while network policy is disabled. Local Elysia must treat network as disabled by default.", "declared_network_domains"));

  if (filesystemPolicy === "declared_read_only_inputs" && scopes.length === 0) errors.push(issue("error", "file_scopes_required", "Declared read-only inputs require explicit safe file scope labels.", "declared_file_scopes"));
  for (const scope of scopes) if (unsafeFileScope(scope)) errors.push(issue("error", "unsafe_file_scope", "File scopes must not include home directories, absolute paths, credentials, vaults, .ssh, .env, or traversal.", "declared_file_scopes"));
  if (["none", "temporary_workspace_only"].includes(filesystemPolicy) && scopes.length > 0) warnings.push(issue("warning", "file_scopes_limited", "File scopes were listed, but the selected filesystem policy does not grant broad file access.", "declared_file_scopes"));

  const timeout = Number(input.requested_timeout_seconds ?? 0);
  if (timeout && (timeout < 1 || timeout > 300)) errors.push(issue("error", "timeout_out_of_range", "Requested timeout must stay between 1 and 300 seconds for review metadata.", "requested_timeout_seconds"));
  if (/high|unlimited|large|gpu/i.test(`${input.requested_cpu_limit ?? ""} ${input.requested_memory_limit ?? ""}`)) warnings.push(issue("warning", "resource_review_needed", "Requested resources look elevated. Local Elysia must apply its own limits later.", "requested_limits"));
  if (!command) info.push(issue("info", "command_optional", "No expected command supplied. This may be fine for metadata-only review, but Local Elysia will need explicit instructions later.", "expected_command"));
  info.push(issue("info", "metadata_only", "Validation analyzed text only. The website did not run, install, clone, or execute anything."));

  const risk_level = errors.length ? "blocked" : warnings.length > 2 || networkPolicy !== "disabled" || filesystemPolicy === "future_review_required" ? "high" : warnings.length ? "medium" : "low";
  return { errors, warnings, info, risk_level, ok: errors.length === 0 };
}
