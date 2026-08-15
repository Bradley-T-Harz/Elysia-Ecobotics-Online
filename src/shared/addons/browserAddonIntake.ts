import JSZip from "jszip";
import { inspectArchiveFile, type BrowserArchiveIssue } from "./browserArchiveInspector";

export type AddonIntakeKind = "manifest" | "archive" | "source_bundle" | "folder";

export type AddonIntakeFile = {
  path: string;
  size: number;
  kind: "text" | "binary" | "script" | "dependency" | "manifest" | "license";
  text?: string;
};

export type AddonIntakeResult = {
  sourceKind: AddonIntakeKind;
  label: string;
  fileCount: number;
  totalBytes: number;
  manifestText: string | null;
  manifestCount: number;
  licensePresent: boolean;
  dependencyFiles: string[];
  scriptFiles: string[];
  binaryFiles: string[];
  errors: BrowserArchiveIssue[];
  warnings: BrowserArchiveIssue[];
  files: AddonIntakeFile[];
  packageFile: File | null;
};

export const addonIntakeLimits = {
  maxFiles: 1000,
  maxTotalBytes: 75 * 1024 * 1024,
  maxTextBytes: 512 * 1024
} as const;

const dependencyNames = new Set([
  "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "pyproject.toml",
  "requirements.txt", "poetry.lock", "cargo.toml", "cargo.lock", "go.mod", "go.sum",
  "pom.xml", "build.gradle", "build.gradle.kts"
]);

function normalizedPath(file: File) {
  const browserFile = file as File & { webkitRelativePath?: string };
  return (browserFile.webkitRelativePath || file.name).replace(/\\/g, "/").replace(/^\.\//, "");
}

function pathIssue(path: string) {
  if (!path || path.includes("\0")) return "Invalid or empty path.";
  if (path.startsWith("/") || /^[A-Za-z]:\//.test(path)) return "Absolute paths are not accepted.";
  if (path.split("/").some((part) => part === "..")) return "Path traversal is not accepted.";
  if (/(^|\/)\.env($|\.)/i.test(path)) return ".env files are not accepted.";
  if (/(^|\/)(\.npmrc|\.pypirc|\.netrc|\.git-credentials)$/i.test(path) || /(^|\/)\.docker\/config\.json$/i.test(path)) return "Credential-bearing configuration filenames are not accepted.";
  if (/(^|\/)(id_rsa|id_dsa|id_ed25519|credentials?|secrets?|vault)(\.|$)/i.test(path)) return "Credential or private-key filenames are not accepted.";
  if (/\.(pem|p12|pfx|key)$/i.test(path)) return "Private-key or credential containers are not accepted.";
  return null;
}

function isTextPath(path: string) {
  return /\.(c|cc|cpp|cs|css|csv|go|h|hpp|html|java|js|jsx|json|kt|kts|md|mjs|cjs|php|properties|py|rb|rs|sh|sql|svg|toml|ts|tsx|txt|xml|ya?ml)$/i.test(path)
    || /(^|\/)(README|LICENSE|CHANGELOG|PERMISSIONS)(\.[^/]*)?$/i.test(path);
}

function fileKind(path: string): AddonIntakeFile["kind"] {
  const leaf = path.split("/").pop()?.toLowerCase() ?? "";
  if (path === "manifest.json" || leaf === "manifest.json") return "manifest";
  if (/^license(\.|$)/i.test(leaf)) return "license";
  if (dependencyNames.has(leaf)) return "dependency";
  if (/\.(bat|cmd|ps1|sh)$/i.test(path)) return "script";
  return isTextPath(path) ? "text" : "binary";
}

function scanText(path: string, text: string, errors: BrowserArchiveIssue[], warnings: BrowserArchiveIssue[]) {
  if (/\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|AWS_ACCESS_KEY_ID|SUPABASE_SERVICE_ROLE|service_role)\b/i.test(text)) {
    errors.push({ code: "secret_api_key", message: "Secret-looking token or service-role text found.", path });
  }
  if (/BEGIN [A-Z ]*PRIVATE KEY/i.test(text)) errors.push({ code: "secret_private_key", message: "Private key material found.", path });
  if (/(^|[\s"'=])(\/home\/|\/Users\/|[A-Za-z]:\\|~\/)[^\s"']+/m.test(text)) {
    errors.push({ code: "private_absolute_path", message: "Private or machine-specific absolute path found.", path });
  }
  if (/\b(postinstall|preinstall|curl\s+[^\n|]*\|\s*(ba)?sh|wget\s+[^\n|]*\|\s*(ba)?sh|sudo\s|rm\s+-rf)\b/i.test(text)) {
    warnings.push({ code: "install_or_shell_indicator", message: "Install hook or dangerous shell-like text found. Nothing was executed.", path });
  }
  if (/\b(fetch\s*\(|axios\.|https?:\/\/|WebSocket\s*\(|net\.connect|requests\.(get|post)|urllib\.)/i.test(text)) {
    warnings.push({ code: "network_behavior_indicator", message: "Possible network behavior found; the manifest must declare it for review.", path });
  }
}

async function readEntry(path: string, bytes: Uint8Array, errors: BrowserArchiveIssue[], warnings: BrowserArchiveIssue[]): Promise<AddonIntakeFile> {
  const kind = fileKind(path);
  let text: string | undefined;
  if (isTextPath(path) && bytes.byteLength <= addonIntakeLimits.maxTextBytes) {
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    scanText(path, text, errors, warnings);
  }
  if (kind === "script") warnings.push({ code: "script_file", message: "Script file requires explicit reviewer attention. It was not executed.", path });
  if (/\.(app|dll|dylib|exe|msi|so|wasm)$/i.test(path)) warnings.push({ code: "binary_or_executable", message: "Binary or executable-like payload requires explicit reviewer attention.", path });
  return { path, size: bytes.byteLength, kind, text };
}

function summarize(sourceKind: AddonIntakeKind, label: string, files: AddonIntakeFile[], errors: BrowserArchiveIssue[], warnings: BrowserArchiveIssue[], packageFile: File | null): AddonIntakeResult {
  const manifests = files.filter((file) => file.path === "manifest.json" || file.path.endsWith("/manifest.json"));
  if (!manifests.length) errors.push({ code: "missing_manifest", message: "Selection is missing manifest.json." });
  if (manifests.length > 1) errors.push({ code: "duplicate_manifest", message: "Selection contains more than one manifest.json; choose one package root." });
  if (files.length > addonIntakeLimits.maxFiles) errors.push({ code: "too_many_files", message: `Selection has ${files.length} files; limit is ${addonIntakeLimits.maxFiles}.` });
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > addonIntakeLimits.maxTotalBytes) errors.push({ code: "selection_too_large", message: `Selection expands to ${totalBytes} bytes; limit is ${addonIntakeLimits.maxTotalBytes}.` });
  const manifestText = manifests.length === 1 ? manifests[0].text ?? null : null;
  if (manifests.length === 1 && manifestText === null) errors.push({ code: "manifest_not_readable", message: "manifest.json is too large or not readable as text.", path: manifests[0].path });
  if (manifestText) {
    try {
      const manifest = JSON.parse(manifestText) as Record<string, unknown>;
      const runtime = typeof manifest.runtime === "object" && manifest.runtime ? manifest.runtime as Record<string, unknown> : {};
      const networkPolicy = typeof manifest.network_policy === "object" && manifest.network_policy ? manifest.network_policy as Record<string, unknown> : {};
      const security = typeof manifest.security === "object" && manifest.security ? manifest.security as Record<string, unknown> : {};
      const networkDeclared = runtime.requires_network === true
        || manifest.network_access === true
        || (Array.isArray(networkPolicy.declared_hosts) && networkPolicy.declared_hosts.length > 0)
        || (Array.isArray(security.network_domains) && security.network_domains.length > 0);
      if (!networkDeclared && warnings.some((item) => item.code === "network_behavior_indicator")) {
        errors.push({ code: "undeclared_network_behavior", message: "Source contains network indicators but the manifest does not declare network behavior." });
      }
    } catch { errors.push({ code: "invalid_manifest_json", message: "manifest.json is not valid JSON.", path: manifests[0].path }); }
  }
  return {
    sourceKind,
    label,
    fileCount: files.length,
    totalBytes,
    manifestText,
    manifestCount: manifests.length,
    licensePresent: files.some((file) => file.kind === "license"),
    dependencyFiles: files.filter((file) => file.kind === "dependency").map((file) => file.path),
    scriptFiles: files.filter((file) => file.kind === "script").map((file) => file.path),
    binaryFiles: files.filter((file) => file.kind === "binary").map((file) => file.path),
    errors,
    warnings,
    files,
    packageFile
  };
}

export async function inspectAddonArchive(file: File): Promise<AddonIntakeResult> {
  const inspection = await inspectArchiveFile(file);
  const errors = [...inspection.errors];
  const warnings = [...inspection.warnings];
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const files: AddonIntakeFile[] = [];
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const original = entry.unsafeOriginalName || entry.name;
    const problem = pathIssue(original);
    if (problem) {
      errors.push({ code: "unsafe_path", message: problem, path: original });
      continue;
    }
    const mode = entry.unixPermissions;
    const symlink = typeof mode === "string" ? mode.startsWith("l") : typeof mode === "number" && (mode & 0o170000) === 0o120000;
    const special = typeof mode === "string" ? !mode.startsWith("-") && !mode.startsWith("d") && !mode.startsWith("l") : typeof mode === "number" && ![0, 0o100000, 0o040000, 0o120000].includes(mode & 0o170000);
    if (symlink || special) {
      errors.push({ code: symlink ? "symlink_blocked" : "special_file_blocked", message: `${symlink ? "Symlink" : "Special file"} archive entries are not accepted.`, path: original });
      continue;
    }
    files.push(await readEntry(entry.name, await entry.async("uint8array"), errors, warnings));
  }
  return summarize(file.name.endsWith(".elysia-addon") ? "archive" : "source_bundle", file.name, files, errors, warnings, file);
}

export async function inspectAddonFiles(fileList: FileList | File[], sourceKind: "folder" | "manifest" = "folder"): Promise<AddonIntakeResult> {
  const selected = Array.from(fileList);
  const selectedPaths = selected.map(normalizedPath);
  const rootCandidate = sourceKind === "folder" && selectedPaths.length && selectedPaths.every((path) => path.includes("/") && path.split("/")[0] === selectedPaths[0].split("/")[0])
    ? `${selectedPaths[0].split("/")[0]}/`
    : "";
  const errors: BrowserArchiveIssue[] = [];
  const warnings: BrowserArchiveIssue[] = [];
  const files: AddonIntakeFile[] = [];
  const zip = new JSZip();
  for (let index = 0; index < selected.length; index += 1) {
    const file = selected[index];
    const path = rootCandidate ? selectedPaths[index].slice(rootCandidate.length) : selectedPaths[index];
    const problem = pathIssue(path);
    if (problem) {
      errors.push({ code: "unsafe_path", message: problem, path });
      continue;
    }
    if (/(^|\/)\.git(\/|$)/i.test(path)) {
      warnings.push({ code: "git_metadata_excluded", message: ".git metadata was excluded from the prepared source package.", path });
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    files.push(await readEntry(path, bytes, errors, warnings));
    zip.file(path, bytes);
  }
  const packageBlob = sourceKind === "folder"
    ? await zip.generateAsync({ type: "blob", mimeType: "application/vnd.elysia-addon+zip" })
    : null;
  const packageFile = packageBlob ? new File([packageBlob], "browser-selected-source.elysia-addon", { type: "application/vnd.elysia-addon+zip" }) : selected[0] ?? null;
  return summarize(sourceKind, sourceKind === "folder" ? "Browser-selected folder/repository" : selected[0]?.name ?? "manifest.json", files, errors, warnings, packageFile);
}

export function formatAddonIntakeBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
