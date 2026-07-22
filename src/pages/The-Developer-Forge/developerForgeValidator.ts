
import semver from "semver";
import generatedManifestShapeValidator from "./developerForgeManifestValidator.generated";

export type ValidationSeverity = "blocked" | "error" | "warning" | "needs_reviewer" | "info";

export type ForgeValidationResult = {
  severity: ValidationSeverity;
  code: string;
  message: string;
  field_path?: string;
  fix_suggestion?: string;
};

export type PermissionDefinition = {
  permission_key: string;
  title: string;
  description: string;
  risk_level: "low" | "medium" | "high" | "blocked";
  requires_user_approval?: boolean;
  requires_reviewer_approval?: boolean;
  requires_local_runtime_gate?: boolean;
  allowed_scope_format?: string | null;
  examples?: string[] | null;
  blocked_examples?: string[] | null;
  is_active?: boolean;
};

export type ForgeManifest = {
  schema_version?: string;
  addon_id?: string;
  name?: string;
  version?: string;
  description?: string;
  author?: { name?: string; url?: string };
  license?: string;
  entrypoints?: unknown[];
  permissions?: string[];
  compatibility?: {
    elysia_min_version?: string;
    elysia_max_version?: string | null;
    addon_api_version?: string;
  };
  runtime?: {
    kind?: string;
    requires_network?: boolean;
    requires_filesystem?: boolean;
  };
  security?: {
    sandbox_required?: boolean;
    network_domains?: string[];
    file_access?: string[];
  };
  [key: string]: unknown;
};

export type StaticScanInput = {
  manifestText?: string;
  fileName?: string;
  fileSize?: number;
  declaredDomains?: string[];
  extraText?: string;
};

export type CompatibilityResult = {
  status: "compatible" | "warning" | "incompatible" | "unknown";
  warnings: string[];
  errors: string[];
};

export const supportedManifestSchema = "1.0";
export const supportedAddonApi = "0.1";
export const allowedRuntimeKinds = ["static", "local_worker", "connector", "theme", "skill_pack"];
export const blockedPermissionKeys = ["vault_access", "credential_access", "private_memory_access", "silent_shell_execution", "read_all_files", "write_arbitrary_files", "silent_network_access", "silent_install"];
export const forbiddenManifestFields = ["service_role_key", "private_key", "env", "local_elysia_memory", "hidden_reviewer_note", "install_command", "postinstall", "preinstall", "shell_command"];

export const defaultPermissionCatalog: PermissionDefinition[] = [
  { permission_key: "theme_assets_read", title: "Theme assets read", description: "Read public theme or visual assets bundled with the add-on.", risk_level: "low", requires_user_approval: false },
  { permission_key: "marketplace_metadata_read", title: "Marketplace metadata read", description: "Read public Marketplace catalog metadata.", risk_level: "low", requires_user_approval: false },
  { permission_key: "living_library_metadata_read", title: "Living Library metadata read", description: "Read public Living Library source metadata.", risk_level: "low", requires_user_approval: false },
  { permission_key: "public_docs_read", title: "Public docs read", description: "Read public Elysia Ecobotics documentation.", risk_level: "low", requires_user_approval: false },
  { permission_key: "network_declared_domains", title: "Network to declared domains", description: "Request network access only to explicitly declared domains.", risk_level: "medium", requires_user_approval: true, requires_reviewer_approval: true },
  { permission_key: "user_selected_file_read", title: "Read user-selected file", description: "Read a file the user explicitly picks in local Elysia.", risk_level: "medium" },
  { permission_key: "user_selected_file_write", title: "Write user-selected file", description: "Write only to a file/location the user explicitly picks in local Elysia.", risk_level: "medium" },
  { permission_key: "project_folder_read", title: "Read approved project folder", description: "Read a project folder after explicit local approval.", risk_level: "high", requires_reviewer_approval: true },
  { permission_key: "project_folder_write", title: "Write approved project folder", description: "Write inside a project folder after explicit local approval.", risk_level: "high", requires_reviewer_approval: true },
  { permission_key: "local_model_request", title: "Local model request", description: "Request local model inference through an approved local router.", risk_level: "high", requires_reviewer_approval: true },
  { permission_key: "sandboxed_worker", title: "Sandboxed worker", description: "Run bounded work only inside a future reviewed local sandbox.", risk_level: "high", requires_reviewer_approval: true },
  ...blockedPermissionKeys.map((key) => ({ permission_key: key, title: key.replace(/_/g, " "), description: "Blocked permission. It is listed for clarity and must not be selected.", risk_level: "blocked" as const, requires_user_approval: true, requires_reviewer_approval: true }))
];

const secretPatterns = [
  { code: "secret_api_key", pattern: /\b(sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|AWS_ACCESS_KEY_ID|SUPABASE_SERVICE_ROLE|service_role)\b/i, label: "secret-looking API token or service-role key" },
  { code: "secret_private_key", pattern: /BEGIN [A-Z ]*PRIVATE KEY/i, label: "private key material" },
  { code: "secret_env", pattern: /(^|[\/\\])\.env(\b|$)/i, label: ".env file reference" },
  { code: "secret_words", pattern: /\b(API_KEY|SECRET|TOKEN|PASSWORD|password|credential|credentials|secret|token|vault)\b/i, label: "credential-related wording" }
];
const localPathPattern = /(^|[\s"'=:])((\/home\/|\/Users\/|C:\\|[A-Z]:\\|~\/)[^\s"']*)/i;
const localhostPattern = /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i;
const authorityPattern = /\b(admin|administrator|official|official partner|trusted|approved|endorsed by elysia|guaranteed safe|auto[- ]?approved|trusted reviewer)\b/i;
const addonIdPattern = /^[a-z0-9][a-z0-9_.-]{2,80}\.[a-z0-9][a-z0-9_-]{1,80}$/;
const reservedNamePattern = /\b(elysia|elysia ecobotics|ecosyneva|ecosyneva commons)\b/i;
const dangerousShellPattern = /\b(postinstall|preinstall|install script|shell|curl\s|wget\s|bash\s|powershell|cmd\.exe|sudo\s|chmod\s|rm\s+-rf|scp\s|ssh\s|npm\s+install|pnpm\s+install|yarn\s+install)\b/i;
const broadFilesystemPattern = /\b(read all files|write all files|whole home directory|entire disk|arbitrary filesystem|all local files|recursive home)\b/i;

type ManifestShapeError = { instancePath?: string; message?: string };
const validateManifestShape = generatedManifestShapeValidator as ((value: unknown) => boolean) & { errors?: ManifestShapeError[] | null };

function add(results: ForgeValidationResult[], severity: ValidationSeverity, code: string, message: string, field_path?: string, fix_suggestion?: string) {
  results.push({ severity, code, message, field_path, fix_suggestion });
}

function pathFromAjv(instancePath?: string) {
  return instancePath ? instancePath.replace(/^\//, "").replace(/\//g, ".") : "manifest";
}

function validSemver(value: string | undefined | null) {
  return Boolean(value && semver.valid(value));
}

function validUrl(value: string | undefined | null) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isLocalhostUrl(value: string | undefined | null) {
  return Boolean(value && localhostPattern.test(value));
}

export function parseManifestText(text: string): { manifest: ForgeManifest | null; results: ForgeValidationResult[] } {
  try {
    return { manifest: JSON.parse(text) as ForgeManifest, results: [] };
  } catch {
    return { manifest: null, results: [{ severity: "blocked", code: "invalid_json", message: "Manifest JSON is not valid.", fix_suggestion: "Fix JSON syntax before validating." }] };
  }
}

export function validateManifest(input: string | ForgeManifest, catalog: PermissionDefinition[] = defaultPermissionCatalog): { manifest: ForgeManifest | null; results: ForgeValidationResult[] } {
  const parsed = typeof input === "string" ? parseManifestText(input) : { manifest: input, results: [] as ForgeValidationResult[] };
  const results = [...parsed.results];
  const manifest = parsed.manifest;
  if (!manifest) return { manifest: null, results };
  const permissions = new Map(catalog.map((item) => [item.permission_key, item]));

  if (!validateManifestShape(manifest)) {
    for (const error of validateManifestShape.errors ?? []) {
      add(results, "error", "schema_shape_error", error.message ? `Manifest schema shape issue: ${error.message}.` : "Manifest schema shape issue.", pathFromAjv(error.instancePath));
    }
  }

  for (const field of ["schema_version", "addon_id", "name", "version", "description", "license"] as const) {
    if (!manifest[field]) add(results, "error", `missing_${field}`, `Missing required field: ${field}.`, field, `Add ${field} to manifest.json.`);
  }
  if (manifest.schema_version && manifest.schema_version !== supportedManifestSchema) add(results, "error", "unsupported_schema", `Unsupported manifest schema ${manifest.schema_version}.`, "schema_version", `Use schema_version ${supportedManifestSchema}.`);
  if (manifest.addon_id && !addonIdPattern.test(manifest.addon_id)) add(results, "error", "invalid_addon_id", "addon_id must look like developer.addon-name and use lowercase letters, numbers, dots, hyphens, or underscores.", "addon_id");
  if (manifest.version && !validSemver(manifest.version)) add(results, "error", "invalid_version", "version must be semantic version format such as 0.1.0.", "version");
  if (manifest.compatibility?.elysia_min_version && !validSemver(manifest.compatibility.elysia_min_version)) add(results, "warning", "invalid_elysia_min_semver", "compatibility.elysia_min_version should be valid semantic version format.", "compatibility.elysia_min_version");
  if (manifest.compatibility?.elysia_max_version && !validSemver(manifest.compatibility.elysia_max_version)) add(results, "warning", "invalid_elysia_max_semver", "compatibility.elysia_max_version should be valid semantic version format.", "compatibility.elysia_max_version");
  if (!manifest.author?.name) add(results, "error", "missing_author", "author.name is required.", "author.name");
  if (manifest.author?.url && !validUrl(manifest.author.url)) add(results, "warning", "invalid_author_url", "author.url is not a valid HTTP(S) URL.", "author.url");
  for (const [field, value] of Object.entries({ homepage_url: manifest.homepage_url, source_url: manifest.source_url, support_url: manifest.support_url })) {
    if (typeof value === "string" && !validUrl(value)) add(results, "warning", `invalid_${field}`, `${field} is not a valid HTTP(S) URL.`, field);
    if (typeof value === "string" && isLocalhostUrl(value)) add(results, "error", `localhost_${field}`, `${field} cannot be a localhost-only URL in a public add-on listing.`, field, "Use a public documentation, source, or support URL.");
  }
  if (!Array.isArray(manifest.permissions)) add(results, "error", "permissions_not_array", "permissions must be an array.", "permissions");
  if (!manifest.compatibility?.elysia_min_version) add(results, "error", "missing_elysia_min", "compatibility.elysia_min_version is required.", "compatibility.elysia_min_version");
  if (!manifest.compatibility?.addon_api_version) add(results, "error", "missing_addon_api", "compatibility.addon_api_version is required.", "compatibility.addon_api_version");
  if (!manifest.runtime?.kind) add(results, "error", "missing_runtime_kind", "runtime.kind is required.", "runtime.kind");
  if (manifest.runtime?.kind && !allowedRuntimeKinds.includes(manifest.runtime.kind)) add(results, "error", "unsupported_runtime", `runtime.kind ${manifest.runtime.kind} is not supported.`, "runtime.kind");
  if (manifest.runtime?.requires_network && !manifest.security?.network_domains?.length) add(results, "warning", "network_domains_missing", "Runtime requires network but no security.network_domains are declared.", "security.network_domains");
  if (manifest.runtime?.requires_filesystem && !manifest.security?.file_access?.length) add(results, "warning", "file_access_missing", "Runtime requires filesystem but no security.file_access scopes are declared.", "security.file_access");
  if (manifest.security?.sandbox_required !== true && manifest.runtime?.kind !== "theme" && manifest.runtime?.kind !== "static") add(results, "warning", "sandbox_not_required", "Non-static runtimes should require a sandbox.", "security.sandbox_required");
  for (const entrypoint of manifest.entrypoints ?? []) {
    if (typeof entrypoint !== "object" || entrypoint === null || Array.isArray(entrypoint)) {
      add(results, "error", "invalid_entrypoint", "Each entrypoint must be a structured object.", "entrypoints");
      continue;
    }
    const path = "path" in entrypoint && typeof entrypoint.path === "string" ? entrypoint.path : "";
    if (!path) add(results, "warning", "entrypoint_path_missing", "Entrypoint should declare a relative package path.", "entrypoints");
    if (localPathPattern.test(path)) add(results, "error", "entrypoint_local_path", "Entrypoint cannot point to an absolute local path.", "entrypoints");
  }
  for (const field of forbiddenManifestFields) {
    if (Object.prototype.hasOwnProperty.call(manifest, field)) add(results, "blocked", "forbidden_manifest_field", `Forbidden manifest field present: ${field}.`, field, "Remove private, executable, or reviewer-only fields from the public add-on manifest.");
  }

  for (const permission of manifest.permissions ?? []) {
    const definition = permissions.get(permission);
    if (!definition) add(results, "error", "unknown_permission", `Unknown permission: ${permission}.`, "permissions", "Choose from the controlled permission catalog.");
    else if (definition.risk_level === "blocked" || blockedPermissionKeys.includes(permission)) add(results, "blocked", "blocked_permission", `Blocked permission selected: ${permission}.`, "permissions", "Remove blocked permissions; local Elysia will not grant them.");
    else if (definition.risk_level === "high") add(results, "needs_reviewer", "high_risk_permission", `${definition.title} is high risk and requires careful review.`, "permissions");
  }

  const text = JSON.stringify(manifest);
  for (const secret of secretPatterns) if (secret.pattern.test(text)) add(results, "blocked", secret.code, `Manifest appears to include ${secret.label}.`, undefined, "Remove secrets and private material from the manifest.");
  if (localPathPattern.test(text)) add(results, "blocked", "local_path", "Manifest appears to include an absolute local file path.", undefined, "Use relative package paths or user-selected local scopes only.");
  if (localhostPattern.test(text)) add(results, "warning", "localhost_url", "Manifest includes a localhost/private URL that is not suitable for a public listing.");
  if (reservedNamePattern.test(String(manifest.name ?? "")) || reservedNamePattern.test(String(manifest.addon_id ?? ""))) add(results, "warning", "reserved_name", "Add-on name or id uses Elysia/EcoSyneva reserved wording. Reviewers must confirm this is authorized.", "name", "Use a distinct developer or project name unless you have administrator approval.");
  if (authorityPattern.test(text)) add(results, "warning", "authority_claim", "Manifest language may imply authority, endorsement, or guaranteed safety.", undefined, "Use careful public wording and avoid authority claims.");
  if (broadFilesystemPattern.test(text)) add(results, "blocked", "broad_filesystem_claim", "Manifest language suggests broad filesystem access, which is not allowed for public Forge submissions.", undefined, "Replace broad access with explicit user-selected/project-scoped paths.");
  if (manifest.runtime?.requires_network && (manifest.security?.network_domains ?? []).some((domain) => /\*|all domains|any domain|0\.0\.0\.0/i.test(domain))) add(results, "blocked", "undeclared_or_broad_network", "Network access must list specific declared domains, not wildcard/all-domain scopes.", "security.network_domains");
  if (!manifest.source_url) add(results, "info", "source_url_missing", "Consider adding a source URL for reviewer context.", "source_url");
  if (!manifest.support_url) add(results, "info", "support_url_missing", "Consider adding a support URL for users.", "support_url");

  return { manifest, results };
}

export function staticSafetyScan(input: StaticScanInput): ForgeValidationResult[] {
  const results: ForgeValidationResult[] = [];
  const text = [input.manifestText, input.fileName, input.extraText].filter(Boolean).join("\n");
  for (const secret of secretPatterns) if (secret.pattern.test(text)) add(results, "blocked", secret.code, `Static scan found ${secret.label}.`);
  if (localPathPattern.test(text)) add(results, "blocked", "local_path", "Static scan found an absolute local path.");
  if (localhostPattern.test(text)) add(results, "warning", "localhost_url", "Static scan found a localhost/private URL.");
  if (dangerousShellPattern.test(text)) add(results, "needs_reviewer", "script_like_text", "Static scan found script, package-install, or shell-like wording. The website will not execute it.");
  if (broadFilesystemPattern.test(text)) add(results, "blocked", "broad_filesystem_claim", "Static scan found broad filesystem permission language.");
  if (/\b(official|trusted|approved|guaranteed safe|endorsed)\b/i.test(text)) add(results, "warning", "misleading_authority_claim", "Static scan found wording that may imply review, trust, or official authority before approval.");
  if (/\.(exe|dll|dylib|so|sh|bat|cmd|ps1|app)$/i.test(input.fileName ?? "")) add(results, "blocked", "dangerous_extension", "Package file name uses an executable/script extension.");
  if ((input.fileSize ?? 0) > 50 * 1024 * 1024) add(results, "error", "package_too_large", "Package metadata exceeds the 50 MB Developer Forge intake limit.");
  if (!results.length) add(results, "info", "static_scan_initial_pass", "Static scan passed initial checks. This does not guarantee safety; local Elysia still verifies permissions before installation.");
  return results;
}

export function checkCompatibility(manifest: ForgeManifest | null): CompatibilityResult {
  if (!manifest) return { status: "unknown", warnings: ["No manifest available."], errors: [] };
  const warnings: string[] = [];
  const errors: string[] = [];
  if (manifest.schema_version !== supportedManifestSchema) errors.push(`Manifest schema ${manifest.schema_version || "missing"} is unsupported.`);
  if (manifest.compatibility?.addon_api_version !== supportedAddonApi) warnings.push(`Add-on API ${manifest.compatibility?.addon_api_version || "missing"} needs reviewer confirmation for API ${supportedAddonApi}.`);
  if (!manifest.compatibility?.elysia_min_version) errors.push("Missing minimum Elysia version.");
  if (manifest.runtime?.kind && !allowedRuntimeKinds.includes(manifest.runtime.kind)) errors.push(`Runtime ${manifest.runtime.kind} is unsupported.`);
  for (const permission of manifest.permissions ?? []) if (blockedPermissionKeys.includes(permission)) errors.push(`Blocked permission ${permission} cannot be compatible.`);
  if (manifest.runtime?.requires_network && !manifest.security?.network_domains?.length) warnings.push("Network runtime needs declared domains.");
  if (manifest.runtime?.requires_filesystem && !manifest.security?.file_access?.length) warnings.push("Filesystem runtime needs declared file scopes.");
  return { status: errors.length ? "incompatible" : warnings.length ? "warning" : "compatible", warnings, errors };
}

export function validationStatus(results: ForgeValidationResult[]) {
  if (results.some((item) => item.severity === "blocked")) return "blocked";
  if (results.some((item) => item.severity === "error")) return "errors";
  if (results.some((item) => item.severity === "warning" || item.severity === "needs_reviewer")) return "warnings";
  return "valid";
}

export function defaultManifestForTemplate(addonId = "developer.example-addon", name = "Example Add-on"): ForgeManifest {
  return {
    schema_version: supportedManifestSchema,
    addon_id: addonId,
    name,
    version: "0.1.0",
    description: "Short, honest description of what this add-on does.",
    author: { name: "Developer Name", url: "https://example.com" },
    license: "MIT",
    entrypoints: [],
    permissions: ["public_docs_read"],
    compatibility: { elysia_min_version: "0.1.0", elysia_max_version: null, addon_api_version: supportedAddonApi },
    runtime: { kind: "static", requires_network: false, requires_filesystem: false },
    security: { sandbox_required: true, network_domains: [], file_access: [] }
  };
}
