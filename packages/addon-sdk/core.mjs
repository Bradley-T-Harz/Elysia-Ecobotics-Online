import JSZip from "jszip";
import { createHash } from "node:crypto";

export const supportedManifestSchema = "1.0";
export const supportedAddonApi = "0.1";
export const packageFormatVersion = "0.1";
export const allowedRuntimeKinds = ["static", "local_worker", "connector", "theme", "skill_pack"];
export const blockedPermissionKeys = ["vault_access", "credential_access", "private_memory_access", "silent_shell_execution", "read_all_files", "write_arbitrary_files", "silent_network_access", "silent_install"];

export const permissionCatalog = [
  { id: "theme_assets_read", label: "Theme assets read", description: "Read public theme or visual assets bundled with the add-on.", risk: "low", requires_user_approval: false, requires_reviewer_approval: false, local_runtime_gate: true, scope_format: "bundled asset paths only" },
  { id: "marketplace_metadata_read", label: "Marketplace metadata read", description: "Read public Marketplace catalog metadata.", risk: "low", requires_user_approval: false, requires_reviewer_approval: false, local_runtime_gate: true, scope_format: "public catalog records" },
  { id: "living_library_metadata_read", label: "Living Library metadata read", description: "Read public Living Library source metadata.", risk: "low", requires_user_approval: false, requires_reviewer_approval: false, local_runtime_gate: true, scope_format: "public source metadata" },
  { id: "public_docs_read", label: "Public docs read", description: "Read public Elysia Ecobotics documentation.", risk: "low", requires_user_approval: false, requires_reviewer_approval: false, local_runtime_gate: true, scope_format: "public documentation" },
  { id: "network_declared_domains", label: "Network to declared domains", description: "Request network access only to explicitly declared domains.", risk: "medium", requires_user_approval: true, requires_reviewer_approval: true, local_runtime_gate: true, scope_format: "explicit domain allowlist" },
  { id: "user_selected_file_read", label: "Read user-selected file", description: "Read only a file the user explicitly selects in Local Elysia.", risk: "medium", requires_user_approval: true, requires_reviewer_approval: false, local_runtime_gate: true, scope_format: "user-picked file" },
  { id: "user_selected_file_write", label: "Write user-selected file", description: "Write only to a file or location the user explicitly selects in Local Elysia.", risk: "medium", requires_user_approval: true, requires_reviewer_approval: false, local_runtime_gate: true, scope_format: "user-picked file" },
  { id: "project_folder_read", label: "Read approved project folder", description: "Read a project folder after explicit local approval.", risk: "high", requires_user_approval: true, requires_reviewer_approval: true, local_runtime_gate: true, scope_format: "project-scoped path" },
  { id: "project_folder_write", label: "Write approved project folder", description: "Write inside a project folder after explicit local approval.", risk: "high", requires_user_approval: true, requires_reviewer_approval: true, local_runtime_gate: true, scope_format: "project-scoped path" },
  { id: "local_model_request", label: "Local model request", description: "Request local model inference through an approved local router.", risk: "high", requires_user_approval: true, requires_reviewer_approval: true, local_runtime_gate: true, scope_format: "approved local model route" },
  { id: "sandboxed_worker", label: "Sandboxed worker", description: "Run bounded work only inside a future reviewed local sandbox.", risk: "high", requires_user_approval: true, requires_reviewer_approval: true, local_runtime_gate: true, scope_format: "future sandbox policy" },
  ...blockedPermissionKeys.map((id) => ({ id, label: id.replaceAll("_", " "), description: "Blocked permission. It is listed for clarity and must not be selected.", risk: "blocked", requires_user_approval: true, requires_reviewer_approval: true, local_runtime_gate: true, scope_format: "blocked" }))
];

export const inspectionLimits = {
  maxArchiveBytes: 50 * 1024 * 1024,
  maxFileCount: 1000,
  maxUncompressedBytes: 75 * 1024 * 1024,
  maxIndividualTextScanBytes: 512 * 1024,
  suspiciousCompressionRatio: 80
};

const addonIdPattern = /^[a-z0-9][a-z0-9_.-]{2,80}\.[a-z0-9][a-z0-9_-]{1,80}$/;
const semverPattern = /^\d+\.\d+\.\d+([+-][A-Za-z0-9.-]+)?$/;
const localhostPattern = /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i;
const localPathPattern = /(^|[\s"'=:\[])(\/home\/|\/Users\/|C:\\|[A-Z]:\\|~\/)/i;
const reservedNamePattern = /\b(elysia|elysia ecobotics|ecosyneva|ecosyneva commons)\b/i;
const authorityPattern = /\b(admin|administrator|official partner|trusted reviewer|guaranteed safe|auto[- ]?approved|endorsed by elysia|officially approved)\b/i;
const broadFilesystemPattern = /\b(read all files|write all files|whole home directory|entire disk|arbitrary filesystem|all local files|recursive home)\b/i;
const dangerousShellPattern = /\b(postinstall|preinstall|install script|curl\s+\|\s*bash|wget\s+\|\s*bash|bash\s+-c|powershell|cmd\.exe|sudo\s|chmod\s+\+x|rm\s+-rf|npm\s+install|pnpm\s+install|yarn\s+install)\b/i;
const codeExecutionPattern = /\b(child_process|exec\s*\(|spawn\s*\(|eval\s*\(|new\s+Function)\b/i;
const networkPattern = /https?:\/\/([A-Za-z0-9.-]+)(:\d+)?/g;

const secretPatterns = [
  { code: "secret_api_key", pattern: /\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|AWS_ACCESS_KEY_ID|SUPABASE_SERVICE_ROLE|service_role)\b/i, label: "secret-looking API token or service-role key" },
  { code: "secret_private_key", pattern: /BEGIN [A-Z ]*PRIVATE KEY/i, label: "private key material" },
  { code: "secret_env", pattern: /(^|[\/\\])\.env(\b|$)/i, label: ".env file reference" },
  { code: "secret_words", pattern: /\b(API_KEY|SECRET|TOKEN|PASSWORD|credential|credentials|vault)\b/i, label: "credential-related wording" }
];

function result(level, code, message, path, suggestion) {
  return { level, severity: level, code, message, path, field_path: path, suggestion, fix_suggestion: suggestion };
}

function redact(text) {
  return String(text)
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-[redacted]")
    .replace(/ghp_[A-Za-z0-9_]{8,}/g, "ghp_[redacted]")
    .replace(/github_pat_[A-Za-z0-9_]{8,}/g, "github_pat_[redacted]")
    .replace(/BEGIN [A-Z ]*PRIVATE KEY[\s\S]*?END [A-Z ]*PRIVATE KEY/g, "BEGIN [redacted] PRIVATE KEY");
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isProbablyText(path) {
  return /\.(json|md|txt|ts|tsx|js|jsx|mjs|cjs|css|html|yml|yaml|toml|csv|svg)$/i.test(path) || ["README", "LICENSE", "CHANGELOG", "PERMISSIONS"].some((name) => path.toUpperCase().endsWith(name));
}

function forbiddenFileName(path) {
  const normalized = path.toLowerCase();
  if (/(^|\/)\.env($|\.)/.test(normalized)) return ".env files are blocked";
  if (/(^|\/)(id_rsa|id_dsa|id_ed25519|credentials|credential|secrets?|vault)(\.|$)/.test(normalized)) return "credential/private key filename is blocked";
  if (/\.(pem|p12|pfx|key)$/i.test(path)) return "private key/certificate container is blocked";
  return null;
}

export function isUnsafePackagePath(path) {
  const value = String(path || "").replaceAll("\\", "/").replace(/\/$/, "");
  if (!value || value.trim() !== value || value.includes("\0")) return "empty or invalid filename";
  if (value.startsWith("/") || /^[A-Za-z]:\//.test(value)) return "absolute paths are not allowed";
  if (value.split("/").some((part) => part === "..")) return "path traversal is not allowed";
  if (value.split("/").some((part) => !part || part === ".")) return "empty or current-directory path segments are not allowed";
  return forbiddenFileName(value);
}

export function parseManifestText(text) {
  try {
    const manifest = JSON.parse(text);
    if (!isPlainObject(manifest)) return { manifest: null, results: [result("error", "manifest_not_object", "Manifest must be a JSON object.")] };
    return { manifest, results: [] };
  } catch {
    return { manifest: null, results: [result("error", "invalid_json", "Manifest JSON is not valid.", "manifest.json", "Fix JSON syntax before validating.")] };
  }
}

function permissionIds(catalog = permissionCatalog) {
  return new Map(catalog.map((item) => [item.id ?? item.permission_key, item]));
}

export function validateManifest(input, options = {}) {
  const parsed = typeof input === "string" ? parseManifestText(input) : { manifest: input, results: [] };
  const results = [...parsed.results];
  const manifest = parsed.manifest;
  if (!manifest) return { manifest: null, results };
  const catalog = permissionIds(options.permissionCatalog ?? permissionCatalog);
  for (const field of ["schema_version", "addon_id", "name", "version", "author", "license", "permissions", "compatibility", "runtime"]) {
    if (manifest[field] === undefined || manifest[field] === null || manifest[field] === "") results.push(result("error", `missing_${field}`, `Missing required field: ${field}.`, field));
  }
  if (manifest.schema_version && manifest.schema_version !== supportedManifestSchema) results.push(result("error", "unsupported_schema", `Unsupported schema_version ${manifest.schema_version}.`, "schema_version"));
  if (manifest.addon_id && !addonIdPattern.test(manifest.addon_id)) results.push(result("error", "invalid_addon_id", "addon_id must look like developer.addon-name and use lowercase letters, numbers, dots, hyphens, or underscores.", "addon_id"));
  if (manifest.version && !semverPattern.test(manifest.version)) results.push(result("error", "invalid_version", "version must be semantic version format such as 0.1.0.", "version"));
  if (!manifest.author?.name && typeof manifest.author !== "string") results.push(result("error", "missing_author_name", "author.name is required, or author must be a non-empty string.", "author"));
  if (!Array.isArray(manifest.permissions)) results.push(result("error", "permissions_not_array", "permissions must be an array.", "permissions"));
  if (!manifest.compatibility?.elysia_min_version) results.push(result("error", "missing_elysia_min", "compatibility.elysia_min_version is required.", "compatibility.elysia_min_version"));
  if (!manifest.compatibility?.addon_api_version) results.push(result("error", "missing_addon_api", "compatibility.addon_api_version is required.", "compatibility.addon_api_version"));
  const runtimeKind = manifest.runtime_kind ?? manifest.runtime?.kind;
  if (!runtimeKind) results.push(result("error", "missing_runtime_kind", "runtime.kind or runtime_kind is required.", "runtime.kind"));
  if (runtimeKind && !allowedRuntimeKinds.includes(runtimeKind)) results.push(result("error", "unsupported_runtime", `Unsupported runtime kind: ${runtimeKind}.`, "runtime.kind"));
  for (const permission of manifest.permissions ?? []) {
    const definition = catalog.get(permission);
    if (!definition) results.push(result("error", "unknown_permission", `Unknown permission: ${permission}.`, "permissions"));
    else if (blockedPermissionKeys.includes(permission) || definition.risk === "blocked" || definition.risk_level === "blocked") results.push(result("error", "blocked_permission", `Blocked permission selected: ${permission}.`, "permissions"));
    else if ((definition.risk ?? definition.risk_level) === "high") results.push(result("warning", "high_risk_permission", `High-risk permission requires reviewer and local approval: ${permission}.`, "permissions"));
  }
  const text = JSON.stringify(manifest);
  for (const secret of secretPatterns) if (secret.pattern.test(text)) results.push(result("error", secret.code, `Manifest appears to include ${secret.label}.`, undefined, "Remove secrets and private material."));
  if (localhostPattern.test(text)) results.push(result("error", "localhost_url", "Manifest includes a localhost/private URL unsuitable for public listings."));
  if (localPathPattern.test(text)) results.push(result("error", "local_absolute_path", "Manifest includes an absolute local path."));
  if (authorityPattern.test(text)) results.push(result("warning", "misleading_authority_claim", "Manifest language may imply authority, endorsement, trust, or guaranteed safety before review."));
  if (reservedNamePattern.test(`${manifest.name ?? ""} ${manifest.addon_id ?? ""}`) && !options.allowReservedNames) results.push(result("warning", "reserved_elysia_name", "Elysia/EcoSyneva reserved wording requires admin/reviewer confirmation."));
  if (broadFilesystemPattern.test(text)) results.push(result("error", "broad_filesystem_claim", "Broad filesystem access claims are not allowed."));
  const domains = manifest.declared_domains ?? manifest.security?.network_domains ?? [];
  if ((manifest.runtime?.requires_network || manifest.requires_network) && !domains.length) results.push(result("warning", "declared_domains_missing", "Network-capable add-ons must declare exact domains."));
  if (domains.some((domain) => /\*|all domains|any domain|0\.0\.0\.0/i.test(String(domain)))) results.push(result("error", "broad_network_scope", "Network domains must be exact; wildcard/all-domain scopes are blocked."));
  return { manifest, results };
}

export function staticScanText(input = {}) {
  const results = [];
  const text = [input.path, input.fileName, input.text, input.manifestText, input.extraText].filter(Boolean).join("\n");
  const redacted = redact(text);
  for (const secret of secretPatterns) if (secret.pattern.test(text)) results.push(result(secret.code === "secret_words" ? "warning" : "error", secret.code, `Static scan found ${secret.label}.`));
  if (localPathPattern.test(text)) results.push(result("error", "local_absolute_path", "Static scan found an absolute local path."));
  if (dangerousShellPattern.test(text)) results.push(result("warning", "dangerous_shell_text", "Static scan found shell/package-install hook wording. It was not executed."));
  if (codeExecutionPattern.test(text)) results.push(result("warning", "code_execution_api_text", "Static scan found code-execution API wording. It was not executed."));
  if (broadFilesystemPattern.test(text)) results.push(result("error", "broad_filesystem_claim", "Static scan found broad filesystem permission language."));
  if (authorityPattern.test(text)) results.push(result("warning", "misleading_authority_claim", "Static scan found wording that may imply official trust, approval, or authority."));
  if (/\.(exe|dll|dylib|so|sh|bat|cmd|ps1|app)$/i.test(input.fileName ?? input.path ?? "")) results.push(result("warning", "executable_or_script_file", "Archive includes an executable or script-like file."));
  const declared = new Set((input.declaredDomains ?? []).map((domain) => String(domain).replace(/^https?:\/\//, "").split("/")[0].toLowerCase()));
  for (const match of redacted.matchAll(networkPattern)) {
    const domain = match[1].toLowerCase();
    if (domain && declared.size && !declared.has(domain)) results.push(result("warning", "undeclared_network_domain", `Found undeclared network domain: ${domain}.`));
  }
  return results;
}

export function createDefaultManifest(addonId = "developer.example-addon", name = "Example Add-on", overrides = {}) {
  return {
    schema_version: supportedManifestSchema,
    addon_id: addonId,
    name,
    version: "0.1.0",
    summary: "Short, honest summary of this add-on.",
    description: "Describe what this add-on does without claiming official trust or safety.",
    author: { name: "Developer Name", url: "https://example.com" },
    license: "MIT",
    runtime: { kind: "static", requires_network: false, requires_filesystem: false },
    runtime_kind: "static",
    permissions: ["public_docs_read"],
    compatibility: { elysia_min_version: "0.1.0", elysia_max_version: null, addon_api_version: supportedAddonApi },
    declared_domains: [],
    declared_file_scopes: [],
    entrypoints: [],
    package_format_version: packageFormatVersion,
    security: { sandbox_required: true, network_domains: [], file_access: [] },
    ...overrides
  };
}

const templateOverrides = {
  "theme-pack": { runtime: { kind: "theme", requires_network: false, requires_filesystem: false }, runtime_kind: "theme", permissions: ["theme_assets_read"] },
  "living-library-source-pack": { permissions: ["living_library_metadata_read"] },
  "documentation-helper": { permissions: ["public_docs_read"] },
  "static-skill-manifest": { runtime: { kind: "skill_pack", requires_network: false, requires_filesystem: false }, runtime_kind: "skill_pack", permissions: ["public_docs_read"] },
  "marketplace-metadata-add-on": { permissions: ["marketplace_metadata_read"] },
  "local-worker-skeleton": { runtime: { kind: "local_worker", requires_network: false, requires_filesystem: false }, runtime_kind: "local_worker", permissions: ["sandboxed_worker"], security: { sandbox_required: true, network_domains: [], file_access: [] } },
  "connector-stub-no-secrets": { runtime: { kind: "connector", requires_network: true, requires_filesystem: false }, runtime_kind: "connector", permissions: ["network_declared_domains"], declared_domains: ["api.example.com"], security: { sandbox_required: true, network_domains: ["api.example.com"], file_access: [] } }
};

export const templateNames = Object.keys(templateOverrides);

export function buildTemplateFiles(name = "my-addon", template = "theme-pack") {
  const safeName = String(name).replace(/[^a-zA-Z0-9 _.-]/g, "").trim() || "My Add-on";
  const addonId = `developer.${safeName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "my-addon"}`;
  const manifest = createDefaultManifest(addonId, safeName, templateOverrides[template] ?? templateOverrides["theme-pack"]);
  return [
    { path: "manifest.json", contents: JSON.stringify(manifest, null, 2) },
    { path: "README.md", contents: `# ${safeName}\n\nStarter add-on generated by elysia-addon. Do not include secrets, private local Elysia data, credentials, vault data, logs, or private files.\n` },
    { path: "LICENSE", contents: "MIT placeholder. Replace with the license you actually intend to use.\n" },
    { path: "CHANGELOG.md", contents: "# Changelog\n\n## 0.1.0\n- Initial inert add-on starter.\n" },
    { path: "PERMISSIONS.md", contents: `# Permissions\n\nPermissions are declarations, not grants. Local Elysia can deny them.\n\n${manifest.permissions.map((permission) => `- ${permission}: explain scope and why this is needed.`).join("\n")}\n` },
    { path: "src/README.md", contents: "Source placeholder. The website and CLI do not execute this code.\n" },
    { path: "assets/README.md", contents: "Assets placeholder. Include only public, intentional assets.\n" }
  ];
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

export async function buildPackageArchive(files, options = {}) {
  const zip = new JSZip();
  const checksums = {};
  for (const file of files) {
    const unsafe = isUnsafePackagePath(file.path);
    if (unsafe) throw new Error(`Refusing unsafe package path ${file.path}: ${unsafe}`);
    const contents = typeof file.contents === "string" || file.contents instanceof Uint8Array || Buffer.isBuffer(file.contents) ? file.contents : String(file.contents ?? "");
    zip.file(file.path, contents);
    checksums[file.path] = typeof contents === "string" ? sha256Text(contents) : sha256Bytes(contents);
  }
  zip.file("checksums.json", JSON.stringify({ algorithm: "sha256", package_format_version: packageFormatVersion, generated_by: "elysia-addon inert packager", warning: "Static/archive inspection does not prove safety. Local Elysia remains final authority.", files: checksums }, null, 2));
  const nodebuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 }, comment: options.comment ?? "Elysia add-on inert package. Do not execute during inspection." });
  return { buffer: nodebuffer, sha256: sha256Bytes(nodebuffer), checksums };
}

export async function inspectArchiveBuffer(buffer, options = {}) {
  const limits = { ...inspectionLimits, ...(options.limits ?? {}) };
  const errors = [];
  const warnings = [];
  const info = [];
  const file_inventory = [];
  const archiveBytes = buffer.byteLength ?? buffer.length ?? 0;
  if (archiveBytes > limits.maxArchiveBytes) errors.push(result("error", "archive_too_large", `Archive exceeds ${limits.maxArchiveBytes} byte limit.`));
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
  } catch {
    return { status: "fail", risk_level: "blocked", summary: "Archive could not be opened as ZIP/.elysia-addon.", errors: [result("error", "invalid_archive", "Archive could not be opened as ZIP/.elysia-addon.")], warnings, info, file_inventory, manifest_summary: null, checksums_summary: null, sha256: sha256Bytes(buffer) };
  }
  const entries = Object.values(zip.files);
  if (entries.length > limits.maxFileCount) errors.push(result("error", "too_many_files", `Archive contains ${entries.length} entries; limit is ${limits.maxFileCount}.`));
  let totalUncompressed = 0;
  let manifest = null;
  let checksums = null;
  const declaredDomains = [];
  for (const entry of entries) {
    const path = entry.name;
    const originalPath = entry.unsafeOriginalName && entry.unsafeOriginalName !== path ? entry.unsafeOriginalName : path;
    const unsafe = isUnsafePackagePath(path) ?? (originalPath !== path ? isUnsafePackagePath(originalPath) : null);
    const isSymlink = typeof entry.unixPermissions === "number" && (entry.unixPermissions & 0o170000) === 0o120000;
    if (unsafe) errors.push(result("error", "unsafe_path", `${originalPath}: ${unsafe}`, path));
    if (isSymlink) errors.push(result("error", "symlink_entry", `${path}: symlink-like ZIP entry is blocked.`, path));
    if (entry.dir) {
      file_inventory.push({ path, kind: "directory", size: 0, scanned_as_text: false });
      continue;
    }
    let data = new Uint8Array();
    try {
      data = await entry.async("uint8array");
    } catch {
      errors.push(result("error", "entry_read_failed", `Could not read archive entry ${path}.`, path));
      continue;
    }
    totalUncompressed += data.byteLength;
    const scannedAsText = isProbablyText(path) && data.byteLength <= limits.maxIndividualTextScanBytes;
    file_inventory.push({ path, kind: "file", size: data.byteLength, scanned_as_text: scannedAsText, sha256: sha256Bytes(data) });
    const forbidden = forbiddenFileName(path);
    if (forbidden) errors.push(result("error", "forbidden_filename", `${path}: ${forbidden}`, path));
    if (/\.(exe|dll|dylib|so|app)$/i.test(path)) warnings.push(result("warning", "binary_executable", `${path}: executable/binary-like file needs reviewer scrutiny.`, path));
    if (/\.(sh|bat|cmd|ps1)$/i.test(path)) warnings.push(result("warning", "script_file", `${path}: shell/script file present. It was not executed.`, path));
    if (/\.min\.(js|css)$/i.test(path) || (data.byteLength > 80_000 && /\.(js|css)$/i.test(path))) warnings.push(result("warning", "minified_or_large_source", `${path}: minified or large source-like file may need manual review.`, path));
    if (scannedAsText) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(data);
      const scan = staticScanText({ path, text, declaredDomains });
      for (const item of scan) (item.level === "error" ? errors : warnings).push({ ...item, path: item.path ?? path, field_path: item.field_path ?? path });
      if (path === "manifest.json") {
        const validation = validateManifest(text, options);
        manifest = validation.manifest;
        for (const item of validation.results) (item.level === "error" ? errors : item.level === "warning" ? warnings : info).push(item);
        declaredDomains.push(...(manifest?.declared_domains ?? manifest?.security?.network_domains ?? []));
      }
      if (path === "checksums.json") {
        try { checksums = JSON.parse(text); } catch { errors.push(result("error", "invalid_checksums_json", "checksums.json is not valid JSON.", path)); }
      }
      if (path.endsWith("package.json")) {
        try {
          const pkg = JSON.parse(text);
          if (pkg.scripts && Object.keys(pkg.scripts).length) warnings.push(result("warning", "package_json_scripts", `${path}: package.json contains scripts. They were not executed.`, path));
          if (pkg.scripts?.postinstall || pkg.scripts?.preinstall) errors.push(result("error", "package_install_hook", `${path}: install hook script is blocked.`, path));
        } catch { warnings.push(result("warning", "package_json_parse_failed", `${path}: package.json could not be parsed.`, path)); }
      }
    } else if (data.byteLength > limits.maxIndividualTextScanBytes && isProbablyText(path)) {
      warnings.push(result("warning", "text_file_too_large_to_scan", `${path}: text-like file exceeds text scan limit.`, path));
    }
  }
  if (totalUncompressed > limits.maxUncompressedBytes) errors.push(result("error", "uncompressed_too_large", `Archive expands to ${totalUncompressed} bytes; limit is ${limits.maxUncompressedBytes}.`));
  if (archiveBytes > 0 && totalUncompressed / archiveBytes > limits.suspiciousCompressionRatio) errors.push(result("error", "suspicious_compression_ratio", `Archive compression ratio looks suspicious (${Math.round(totalUncompressed / archiveBytes)}x).`));
  const paths = new Set(file_inventory.map((file) => file.path));
  for (const required of ["manifest.json", "README.md", "LICENSE", "CHANGELOG.md", "PERMISSIONS.md", "checksums.json"]) {
    if (!paths.has(required)) (required === "manifest.json" ? errors : warnings).push(result(required === "manifest.json" ? "error" : "warning", `missing_${required.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`, `Archive is missing ${required}.`));
  }
  if (checksums?.files) {
    for (const file of file_inventory.filter((item) => item.kind === "file" && item.path !== "checksums.json")) {
      const expected = checksums.files[file.path];
      if (!expected) warnings.push(result("warning", "checksum_missing_for_file", `${file.path}: no checksum entry.`, file.path));
      else if (expected !== file.sha256) errors.push(result("error", "checksum_mismatch", `${file.path}: checksum mismatch.`, file.path));
    }
  }
  if (manifest) {
    for (const entrypoint of manifest.entrypoints ?? []) {
      const value = typeof entrypoint === "string" ? entrypoint : entrypoint?.path;
      if (value && !paths.has(value)) warnings.push(result("warning", "entrypoint_missing", `Manifest references missing entrypoint: ${value}.`, "entrypoints"));
    }
  }
  const status = errors.length ? "fail" : warnings.length ? "warning" : "pass";
  const risk_level = errors.length ? "blocked" : warnings.length > 8 ? "high" : warnings.length ? "medium" : "low";
  const summary = status === "pass" ? "No blocking issues found by static/archive inspection. This does not prove safety." : status === "warning" ? "Archive inspection found warnings. No archive code was executed." : "Archive inspection found blocking issues. No archive code was executed.";
  return { status, risk_level, summary, errors, warnings, info, file_inventory, manifest_summary: manifest ? { addon_id: manifest.addon_id, name: manifest.name, version: manifest.version, runtime_kind: manifest.runtime_kind ?? manifest.runtime?.kind, permissions: manifest.permissions ?? [], declared_domains: manifest.declared_domains ?? manifest.security?.network_domains ?? [] } : null, checksums_summary: checksums ? { algorithm: checksums.algorithm, file_count: Object.keys(checksums.files ?? {}).length, package_format_version: checksums.package_format_version } : null, total_uncompressed_size: totalUncompressed, archive_size: archiveBytes, sha256: sha256Bytes(buffer), limits };
}

export async function inspectArchiveFile(file, options = {}) {
  const buffer = file instanceof Uint8Array || Buffer.isBuffer(file) ? file : new Uint8Array(await file.arrayBuffer());
  return inspectArchiveBuffer(buffer, options);
}
