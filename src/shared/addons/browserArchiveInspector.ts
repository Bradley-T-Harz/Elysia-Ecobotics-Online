import JSZip from "jszip";

export type BrowserArchiveIssue = { code: string; message: string; path?: string; suggestion?: string };
export type BrowserArchiveInspectionResult = {
  status: "pass" | "warning" | "fail";
  risk_level: "low" | "medium" | "high" | "blocked";
  summary: string;
  errors: BrowserArchiveIssue[];
  warnings: BrowserArchiveIssue[];
  info: BrowserArchiveIssue[];
  file_inventory: Array<{ path: string; kind: "file" | "directory"; size: number; scanned_as_text: boolean; sha256?: string }>;
  manifest_summary: null | { addon_id?: string; name?: string; version?: string; runtime_kind?: string; permissions: string[]; declared_domains: string[] };
  checksums_summary: null | { algorithm?: string; file_count: number; package_format_version?: string };
  archive_size: number;
  total_uncompressed_size: number;
  sha256: string;
};

const maxTextScanBytes = 512 * 1024;
const maxArchiveBytes = 50 * 1024 * 1024;
const maxUncompressedBytes = 75 * 1024 * 1024;
const maxFileCount = 1000;

function issue(code: string, message: string, path?: string): BrowserArchiveIssue {
  return { code, message, path };
}

function unsafePath(path: string) {
  const value = path.replace(/\\/g, "/").replace(/\/$/, "");
  if (!value || value.includes("\0")) return "empty or invalid filename";
  if (value.startsWith("/") || /^[A-Za-z]:\//.test(value)) return "absolute paths are blocked";
  if (value.split("/").some((part: string) => part === "..")) return "path traversal is blocked";
  if (/(^|\/)\.env($|\.)/i.test(value)) return ".env files are blocked";
  if (/(^|\/)(id_rsa|id_dsa|id_ed25519|credentials|credential|secrets?|vault)(\.|$)/i.test(value)) return "credential/private-key filenames are blocked";
  if (/\.(pem|p12|pfx|key)$/i.test(value)) return "private key/certificate containers are blocked";
  return null;
}

function likelyText(path: string) {
  return /\.(json|md|txt|ts|tsx|js|jsx|mjs|cjs|css|html|yml|yaml|toml|csv|svg)$/i.test(path) || ["README", "LICENSE", "CHANGELOG", "PERMISSIONS"].some((name) => path.toUpperCase().endsWith(name));
}

function archiveEntryKind(unixPermissions: number | string | null | undefined) {
  if (typeof unixPermissions === "string") {
    if (unixPermissions.startsWith("l")) return "symlink";
    if (!unixPermissions.startsWith("-") && !unixPermissions.startsWith("d")) return "special";
  }
  if (typeof unixPermissions === "number") {
    const kind = unixPermissions & 0o170000;
    if (kind === 0o120000) return "symlink";
    if (kind !== 0 && kind !== 0o100000 && kind !== 0o040000) return "special";
  }
  return "ordinary";
}

async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function scanText(text: string, path: string) {
  const errors: BrowserArchiveIssue[] = [];
  const warnings: BrowserArchiveIssue[] = [];
  if (/\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|AWS_ACCESS_KEY_ID|SUPABASE_SERVICE_ROLE|service_role)\b/i.test(text)) errors.push(issue("secret_api_key", "Secret-looking token or service-role text found.", path));
  if (/BEGIN [A-Z ]*PRIVATE KEY/i.test(text)) errors.push(issue("secret_private_key", "Private key material found.", path));
  if (/\b(postinstall|preinstall|npm\s+install|pnpm\s+install|yarn\s+install|curl\s+\|\s*bash|wget\s+\|\s*bash|sudo\s|chmod\s+\+x|rm\s+-rf)\b/i.test(text)) warnings.push(issue("dangerous_shell_text", "Package hook, install, or shell-like wording found. It was not executed.", path));
  if (/\b(child_process|exec\s*\(|spawn\s*\(|eval\s*\(|new\s+Function)\b/i.test(text)) warnings.push(issue("code_execution_api_text", "Code-execution API wording found. It was not executed.", path));
  if (/\b(read all files|write all files|whole home directory|entire disk|arbitrary filesystem|all local files)\b/i.test(text)) errors.push(issue("broad_filesystem_claim", "Broad filesystem access claim found.", path));
  return { errors, warnings };
}

export async function inspectArchiveFile(file: File): Promise<BrowserArchiveInspectionResult> {
  const archiveBytes = file.size;
  const errors: BrowserArchiveIssue[] = [];
  const warnings: BrowserArchiveIssue[] = [];
  const info: BrowserArchiveIssue[] = [];
  const file_inventory: BrowserArchiveInspectionResult["file_inventory"] = [];
  if (archiveBytes > maxArchiveBytes) errors.push(issue("archive_too_large", `Archive exceeds ${maxArchiveBytes} byte limit.`));
  const bytes = new Uint8Array(await file.arrayBuffer());
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes, { checkCRC32: false });
  } catch {
    const archiveHash = await sha256(bytes);
    return { status: "fail", risk_level: "blocked", summary: "Archive could not be opened as ZIP/.elysia-addon.", errors: [issue("invalid_archive", "Archive could not be opened as ZIP/.elysia-addon.")], warnings, info, file_inventory, manifest_summary: null, checksums_summary: null, archive_size: archiveBytes, total_uncompressed_size: 0, sha256: archiveHash };
  }
  const entries = Object.values(zip.files);
  if (entries.length > maxFileCount) errors.push(issue("too_many_files", `Archive contains ${entries.length} entries; limit is ${maxFileCount}.`));
  let total = 0;
  let manifestSummary: BrowserArchiveInspectionResult["manifest_summary"] = null;
  let checksumsSummary: BrowserArchiveInspectionResult["checksums_summary"] = null;
  for (const entry of entries) {
    const originalPath = entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name ? entry.unsafeOriginalName : entry.name;
    const pathProblem = unsafePath(entry.name) ?? (originalPath !== entry.name ? unsafePath(originalPath) : null);
    if (pathProblem) errors.push(issue("unsafe_path", `${originalPath}: ${pathProblem}`, entry.name));
    const entryKind = archiveEntryKind(entry.unixPermissions);
    if (entryKind !== "ordinary") {
      errors.push(issue(entryKind === "symlink" ? "symlink_blocked" : "special_file_blocked", `${entryKind} archive entry is blocked.`, entry.name));
      continue;
    }
    if (entry.dir) {
      file_inventory.push({ path: entry.name, kind: "directory", size: 0, scanned_as_text: false });
      continue;
    }
    const data = await entry.async("uint8array");
    total += data.byteLength;
    const scanned = likelyText(entry.name) && data.byteLength <= maxTextScanBytes;
    file_inventory.push({ path: entry.name, kind: "file", size: data.byteLength, scanned_as_text: scanned, sha256: await sha256(data) });
    if (/\.(exe|dll|dylib|so|app)$/i.test(entry.name)) warnings.push(issue("binary_executable", "Executable/binary-like file needs reviewer scrutiny.", entry.name));
    if (/\.(sh|bat|cmd|ps1)$/i.test(entry.name)) warnings.push(issue("script_file", "Script-like file present. It was not executed.", entry.name));
    if (!scanned) continue;
    const text = new TextDecoder("utf-8", { fatal: false }).decode(data);
    const scan = scanText(text, entry.name);
    errors.push(...scan.errors);
    warnings.push(...scan.warnings);
    if (entry.name === "manifest.json") {
      try {
        const manifest = JSON.parse(text) as Record<string, unknown>;
        const runtime = manifest.runtime && typeof manifest.runtime === "object" ? manifest.runtime as Record<string, unknown> : {};
        const security = manifest.security && typeof manifest.security === "object" ? manifest.security as Record<string, unknown> : {};
        manifestSummary = { addon_id: String(manifest.addon_id ?? ""), name: String(manifest.name ?? ""), version: String(manifest.version ?? ""), runtime_kind: String(manifest.runtime_kind ?? runtime.kind ?? ""), permissions: Array.isArray(manifest.permissions) ? manifest.permissions.map(String) : [], declared_domains: Array.isArray(manifest.declared_domains) ? manifest.declared_domains.map(String) : Array.isArray(security.network_domains) ? security.network_domains.map(String) : [] };
      } catch {
        errors.push(issue("invalid_manifest_json", "manifest.json is not valid JSON.", entry.name));
      }
    }
    if (entry.name === "checksums.json") {
      try {
        const checksums = JSON.parse(text) as { algorithm?: string; package_format_version?: string; files?: Record<string, string> };
        checksumsSummary = { algorithm: checksums.algorithm, package_format_version: checksums.package_format_version, file_count: Object.keys(checksums.files ?? {}).length };
      } catch {
        errors.push(issue("invalid_checksums_json", "checksums.json is not valid JSON.", entry.name));
      }
    }
  }
  if (total > maxUncompressedBytes) errors.push(issue("uncompressed_too_large", `Archive expands to ${total} bytes; limit is ${maxUncompressedBytes}.`));
  if (archiveBytes > 0 && total / archiveBytes > 80) errors.push(issue("suspicious_compression_ratio", `Archive compression ratio looks suspicious (${Math.round(total / archiveBytes)}x).`));
  const paths = new Set(file_inventory.map((item) => item.path));
  if (!paths.has("manifest.json")) errors.push(issue("missing_manifest", "Archive is missing manifest.json."));
  for (const required of ["README.md", "LICENSE", "CHANGELOG.md", "PERMISSIONS.md", "checksums.json"]) if (!paths.has(required)) warnings.push(issue(`missing_${required.toLowerCase().replace(/[^a-z0-9]/g, "_")}`, `Archive is missing ${required}.`));
  const status = errors.length ? "fail" : warnings.length ? "warning" : "pass";
  const risk_level = errors.length ? "blocked" : warnings.length > 8 ? "high" : warnings.length ? "medium" : "low";
  const summary = status === "pass" ? "No blocking issues found by static/archive inspection. This does not prove safety." : status === "warning" ? "Archive inspection found warnings. No archive code was executed." : "Archive inspection found blocking issues. No archive code was executed.";
  return { status, risk_level, summary, errors, warnings, info, file_inventory, manifest_summary: manifestSummary, checksums_summary: checksumsSummary, archive_size: archiveBytes, total_uncompressed_size: total, sha256: await sha256(bytes) };
}
