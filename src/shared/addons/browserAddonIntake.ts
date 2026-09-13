import JSZip from "jszip";
import { inspectArchiveFile, type BrowserArchiveIssue } from "./browserArchiveInspector";
import { containsPrivateAbsolutePath, generatedVendorDirectoryForPath } from "./addonIntakePolicy";
import { assessLocalElysiaManifestText, type LocalElysiaManifestAssessment } from "./localElysiaManifestContract";

export type AddonIntakeKind = "manifest" | "archive" | "source_bundle" | "folder";
export type AddonIntakeTransitionState = "selected_locally" | "needs_manifest" | "needs_review" | "blocked_from_transfer";

export type AddonIntakeFile = {
  path: string;
  size: number;
  kind: "text" | "binary" | "script" | "dependency" | "manifest" | "license";
  text?: string;
  /** Exact included bytes; placeholders and decoded previews never become package content. */
  bytes?: Uint8Array;
};

export type AddonIntakeExcludedGroup = {
  directory: string;
  fileCount: number;
  totalBytes: number;
};

export type AddonIntakeIssueGroup = {
  severity: "blocked" | "warning";
  code: string;
  message: string;
  count: number;
  examples: string[];
};

export type AddonIntakeResult = {
  sourceKind: AddonIntakeKind;
  label: string;
  selectedFileCount: number;
  selectedTotalBytes: number;
  fileCount: number;
  totalBytes: number;
  excludedFileCount: number;
  excludedTotalBytes: number;
  excludedDirectoryGroups: AddonIntakeExcludedGroup[];
  deferredFileCount: number;
  deferredTotalBytes: number;
  manifestText: string | null;
  manifestCount: number;
  manifestCandidates: string[];
  nodeProjectDetected: boolean;
  transitionState: AddonIntakeTransitionState;
  localElysiaContract: LocalElysiaManifestAssessment;
  licensePresent: boolean;
  dependencyFiles: string[];
  scriptFiles: string[];
  binaryFiles: string[];
  errors: BrowserArchiveIssue[];
  warnings: BrowserArchiveIssue[];
  issueGroups: AddonIntakeIssueGroup[];
  files: AddonIntakeFile[];
  packageFile: File | null;
};

export const addonIntakeLimits = {
  maxFiles: 1000,
  maxTotalBytes: 75 * 1024 * 1024,
  maxTextBytes: 512 * 1024,
  maxRenderedFiles: 200,
  maxIssueExamplesPerGroup: 10
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

function unsafePathIssue(path: string) {
  if (!path || path.includes("\0")) return "Invalid or empty path.";
  if (path.startsWith("/") || /^[A-Za-z]:\//.test(path)) return "Absolute paths are not accepted.";
  if (path.split("/").some((part) => part === "..")) return "Path traversal is not accepted.";
  return null;
}

function credentialPathIssue(path: string) {
  if (/(^|\/)\.env($|\.)/i.test(path)) return ".env files are not accepted for remote transfer.";
  if (/(^|\/)(\.npmrc|\.pypirc|\.netrc|\.git-credentials)$/i.test(path) || /(^|\/)\.docker\/config\.json$/i.test(path)) return "Credential-bearing configuration filenames are not accepted for remote transfer.";
  if (/(^|\/)(id_rsa|id_dsa|id_ed25519|credentials?|secrets?|vault)(\.|$)/i.test(path)) return "Credential or private-key filenames are not accepted for remote transfer.";
  if (/\.(pem|p12|pfx|key)$/i.test(path)) return "Private-key or credential containers are not accepted for remote transfer.";
  return null;
}

function isTextPath(path: string) {
  return /\.(c|cc|cpp|cs|css|csv|go|h|hpp|html|java|js|jsx|json|kt|kts|md|mjs|cjs|php|properties|py|rb|rs|sh|sql|svg|toml|ts|tsx|txt|xml|ya?ml)$/i.test(path)
    || /(^|\/)(README|LICENSE|CHANGELOG|PERMISSIONS)(\.[^/]*)?$/i.test(path);
}

function fileKind(path: string): AddonIntakeFile["kind"] {
  const leaf = path.split("/").pop()?.toLowerCase() ?? "";
  if (path === "manifest.json") return "manifest";
  if (/^license(\.|$)/i.test(leaf)) return "license";
  if (dependencyNames.has(leaf)) return "dependency";
  if (/\.(bat|cmd|ps1|sh)$/i.test(path)) return "script";
  return isTextPath(path) ? "text" : "binary";
}

function isBehavioralSourcePath(path: string) {
  return /\.(c|cc|cpp|cs|go|html?|java|js|jsx|kt|kts|mjs|cjs|php|py|rb|rs|ts|tsx)$/i.test(path);
}

function scanText(path: string, text: string, errors: BrowserArchiveIssue[], warnings: BrowserArchiveIssue[]) {
  if (/\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|AWS_ACCESS_KEY_ID|SUPABASE_SERVICE_ROLE|service_role)\b/i.test(text)) {
    errors.push({ code: "secret_api_key", message: "Secret-looking token or service-role text found.", path });
  }
  if (/BEGIN [A-Z ]*PRIVATE KEY/i.test(text)) errors.push({ code: "secret_private_key", message: "Private key material found.", path });
  if (containsPrivateAbsolutePath(text)) {
    errors.push({ code: "private_absolute_path", message: "Private or machine-specific absolute path found in file content.", path });
  }
  if (/\b(postinstall|preinstall|curl\s+[^\n|]*\|\s*(ba)?sh|wget\s+[^\n|]*\|\s*(ba)?sh|sudo\s|rm\s+-rf)\b/i.test(text)) {
    warnings.push({ code: "install_or_shell_indicator", message: "Install hook or dangerous shell-like text found. Nothing was executed.", path });
  }
  // Documentation and manifest metadata commonly contain URLs. Only executable
  // source can establish behavioral evidence that must match network authority.
  if (isBehavioralSourcePath(path) && /\b(fetch\s*\(|axios\.|https?:\/\/|WebSocket\s*\(|net\.connect|requests\.(get|post)|urllib\.)/i.test(text)) {
    warnings.push({ code: "network_behavior_indicator", message: "Possible network behavior found; the manifest must declare it for review.", path });
  }
}

async function readEntry(path: string, bytes: Uint8Array, errors: BrowserArchiveIssue[], warnings: BrowserArchiveIssue[]): Promise<AddonIntakeFile> {
  const kind = fileKind(path);
  let text: string | undefined;
  if (isTextPath(path) && bytes.byteLength <= addonIntakeLimits.maxTextBytes) {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.includes("\0")) text = undefined;
    } catch { text = undefined; }
    if (text !== undefined) scanText(path, text, errors, warnings);
  }
  if (kind === "script") warnings.push({ code: "script_file", message: "Script file requires explicit reviewer attention. It was not executed.", path });
  if (/\.(app|dll|dylib|exe|msi|so|wasm)$/i.test(path)) warnings.push({ code: "binary_or_executable", message: "Binary or executable-like payload requires explicit reviewer attention.", path });
  return { path, size: bytes.byteLength, kind, text, bytes };
}

function addOnce(target: BrowserArchiveIssue[], issue: BrowserArchiveIssue) {
  if (!target.some((item) => item.code === issue.code && item.path === issue.path)) target.push(issue);
}

export function groupAddonIntakeIssues(errors: BrowserArchiveIssue[], warnings: BrowserArchiveIssue[]) {
  const groups = new Map<string, AddonIntakeIssueGroup>();
  for (const [severity, issues] of [["blocked", errors], ["warning", warnings]] as const) {
    for (const item of issues) {
      const key = `${severity}:${item.code}`;
      const current = groups.get(key) ?? { severity, code: item.code, message: item.message, count: 0, examples: [] };
      current.count += 1;
      if (item.path && current.examples.length < addonIntakeLimits.maxIssueExamplesPerGroup && !current.examples.includes(item.path)) current.examples.push(item.path);
      groups.set(key, current);
    }
  }
  return [...groups.values()].sort((left, right) => left.severity === right.severity ? left.code.localeCompare(right.code) : left.severity === "blocked" ? -1 : 1);
}

function transitionState(errors: BrowserArchiveIssue[], warnings: BrowserArchiveIssue[]): AddonIntakeTransitionState {
  const nonManifestErrors = errors.filter((item) => item.code !== "missing_manifest");
  if (nonManifestErrors.length) return "blocked_from_transfer";
  if (errors.some((item) => item.code === "missing_manifest")) return "needs_manifest";
  if (warnings.length) return "needs_review";
  return "selected_locally";
}

type IntakeSummaryMeta = {
  selectedFileCount: number;
  selectedTotalBytes: number;
  excludedDirectoryGroups: AddonIntakeExcludedGroup[];
  deferredFileCount: number;
  deferredTotalBytes: number;
};

function summarize(sourceKind: AddonIntakeKind, label: string, files: AddonIntakeFile[], errors: BrowserArchiveIssue[], warnings: BrowserArchiveIssue[], packageFile: File | null, meta: IntakeSummaryMeta): AddonIntakeResult {
  const rootManifests = files.filter((file) => file.path === "manifest.json");
  const manifestCandidates = files.filter((file) => file.path === "manifest.json" || file.path.endsWith("/manifest.json")).map((file) => file.path);
  if (!rootManifests.length) addOnce(errors, { code: "missing_manifest", message: "Repository imported locally; Elysia add-on manifest is missing. Select the add-on package root or add manifest.json." });
  if (rootManifests.length > 1) addOnce(errors, { code: "duplicate_manifest", message: "Selection contains more than one root manifest.json; choose one package root." });
  if (!rootManifests.length && manifestCandidates.length) addOnce(warnings, { code: "nested_manifest_candidates", message: `${manifestCandidates.length} nested manifest candidate${manifestCandidates.length === 1 ? " was" : "s were"} found. Nested dependency manifests are not trusted as the Elysia add-on manifest.` });
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const manifestText = rootManifests.length === 1 ? rootManifests[0].text ?? null : null;
  const localElysiaContract = manifestText
    ? assessLocalElysiaManifestText(manifestText)
    : { schemaVersion: "unavailable", status: "unreadable" as const, summary: "A readable root manifest.json is required before Local Elysia compatibility can be assessed.", issues: ["manifest_unavailable"] };
  if (rootManifests.length === 1 && manifestText === null) addOnce(errors, { code: "manifest_not_readable", message: "manifest.json is too large or not readable as text.", path: rootManifests[0].path });
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
        addOnce(errors, { code: "undeclared_network_behavior", message: "Source contains network indicators but the manifest does not declare network behavior." });
      }
    } catch {
      addOnce(errors, { code: "invalid_manifest_json", message: "manifest.json is not valid JSON.", path: rootManifests[0].path });
    }
  }
  const excludedFileCount = meta.excludedDirectoryGroups.reduce((sum, item) => sum + item.fileCount, 0);
  const excludedTotalBytes = meta.excludedDirectoryGroups.reduce((sum, item) => sum + item.totalBytes, 0);
  const issueGroups = groupAddonIntakeIssues(errors, warnings);
  return {
    sourceKind,
    label,
    selectedFileCount: meta.selectedFileCount,
    selectedTotalBytes: meta.selectedTotalBytes,
    fileCount: files.length,
    totalBytes,
    excludedFileCount,
    excludedTotalBytes,
    excludedDirectoryGroups: meta.excludedDirectoryGroups,
    deferredFileCount: meta.deferredFileCount,
    deferredTotalBytes: meta.deferredTotalBytes,
    manifestText,
    manifestCount: rootManifests.length,
    manifestCandidates,
    nodeProjectDetected: files.some((file) => file.path === "package.json"),
    transitionState: transitionState(errors, warnings),
    localElysiaContract,
    licensePresent: files.some((file) => file.kind === "license"),
    dependencyFiles: files.filter((file) => file.kind === "dependency").map((file) => file.path),
    scriptFiles: files.filter((file) => file.kind === "script").map((file) => file.path),
    binaryFiles: files.filter((file) => file.kind === "binary").map((file) => file.path),
    errors,
    warnings,
    issueGroups,
    files,
    packageFile
  };
}

function excludedGroupsFromMap(groups: Map<string, { fileCount: number; totalBytes: number }>) {
  return [...groups.entries()].map(([directory, value]) => ({ directory, ...value })).sort((left, right) => right.fileCount - left.fileCount || left.directory.localeCompare(right.directory));
}

function addExcluded(groups: Map<string, { fileCount: number; totalBytes: number }>, directory: string, size: number) {
  const current = groups.get(directory) ?? { fileCount: 0, totalBytes: 0 };
  current.fileCount += 1;
  current.totalBytes += size;
  groups.set(directory, current);
}

function declaredZipEntrySize(entry: JSZip.JSZipObject) {
  const internal = entry as JSZip.JSZipObject & { _data?: { uncompressedSize?: number } };
  return internal._data?.uncompressedSize ?? 0;
}

export async function inspectAddonArchive(file: File): Promise<AddonIntakeResult> {
  const inspection = await inspectArchiveFile(file);
  const errors = [...inspection.errors];
  const warnings = [...inspection.warnings];
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const files: AddonIntakeFile[] = [];
  const excluded = new Map<string, { fileCount: number; totalBytes: number }>();
  let selectedFileCount = 0;
  let selectedTotalBytes = 0;
  let deferredFileCount = 0;
  let deferredTotalBytes = 0;
  let includedBytes = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    selectedFileCount += 1;
    const declaredSize = declaredZipEntrySize(entry);
    selectedTotalBytes += declaredSize;
    const original = entry.unsafeOriginalName || entry.name;
    const unsafe = unsafePathIssue(original);
    if (unsafe) {
      addOnce(errors, { code: "unsafe_path", message: unsafe, path: original });
      continue;
    }
    const mode = entry.unixPermissions;
    const symlink = typeof mode === "string" ? mode.startsWith("l") : typeof mode === "number" && (mode & 0o170000) === 0o120000;
    const special = typeof mode === "string" ? !mode.startsWith("-") && !mode.startsWith("d") && !mode.startsWith("l") : typeof mode === "number" && ![0, 0o100000, 0o040000, 0o120000].includes(mode & 0o170000);
    if (symlink || special) {
      addOnce(errors, { code: symlink ? "symlink_blocked" : "special_file_blocked", message: `${symlink ? "Symlink" : "Special file"} archive entries are not accepted.`, path: original });
      continue;
    }
    const generatedDirectory = generatedVendorDirectoryForPath(entry.name);
    if (generatedDirectory) {
      addExcluded(excluded, generatedDirectory, declaredSize);
      continue;
    }
    const credentialProblem = credentialPathIssue(entry.name);
    if (credentialProblem) {
      addOnce(errors, { code: "credential_path", message: credentialProblem, path: entry.name });
      continue;
    }
    if (files.length >= addonIntakeLimits.maxFiles || includedBytes + declaredSize > addonIntakeLimits.maxTotalBytes) {
      deferredFileCount += 1;
      deferredTotalBytes += declaredSize;
      continue;
    }
    const bytes = await entry.async("uint8array");
    includedBytes += bytes.byteLength;
    files.push(await readEntry(entry.name, bytes, errors, warnings));
  }
  if (deferredFileCount) addOnce(errors, { code: "scan_incomplete", message: `${deferredFileCount} included file${deferredFileCount === 1 ? " was" : "s were"} left unscanned by browser safety limits. Local selection succeeded, but remote transfer requires a smaller add-on root or package.` });
  if (excluded.size) addOnce(errors, { code: "excluded_content_requires_repack", message: "This archive contains generated/vendor directories. Local inspection succeeded, but remote transfer requires an archive repacked without excluded content." });
  return summarize(file.name.endsWith(".elysia-addon") ? "archive" : "source_bundle", file.name, files, errors, warnings, file, {
    selectedFileCount,
    selectedTotalBytes: selectedTotalBytes || file.size,
    excludedDirectoryGroups: excludedGroupsFromMap(excluded),
    deferredFileCount,
    deferredTotalBytes
  });
}

export async function inspectAddonFiles(fileList: FileList | File[], sourceKind: "folder" | "manifest" = "folder"): Promise<AddonIntakeResult> {
  const selected = Array.from(fileList);
  const selectedPaths = selected.map(normalizedPath);
  const rootCandidate = sourceKind === "folder" && selectedPaths.length && selectedPaths.every((path) => path.includes("/") && path.split("/")[0] === selectedPaths[0].split("/")[0])
    ? `${selectedPaths[0].split("/")[0]}/`
    : "";
  const normalized = selected.map((file, index) => ({ file, path: rootCandidate ? selectedPaths[index].slice(rootCandidate.length) : selectedPaths[index] }));
  const errors: BrowserArchiveIssue[] = [];
  const warnings: BrowserArchiveIssue[] = [];
  const files: AddonIntakeFile[] = [];
  const excluded = new Map<string, { fileCount: number; totalBytes: number }>();
  const zip = new JSZip();
  let deferredFileCount = 0;
  let deferredTotalBytes = 0;
  let includedBytes = 0;
  for (const { file, path } of normalized) {
    const unsafe = unsafePathIssue(path);
    if (unsafe) {
      addOnce(errors, { code: "unsafe_path", message: unsafe, path });
      continue;
    }
    const generatedDirectory = generatedVendorDirectoryForPath(path);
    if (generatedDirectory) {
      addExcluded(excluded, generatedDirectory, file.size);
      continue;
    }
    const credentialProblem = credentialPathIssue(path);
    if (credentialProblem) {
      addOnce(errors, { code: "credential_path", message: credentialProblem, path });
      continue;
    }
    if (files.length >= addonIntakeLimits.maxFiles || includedBytes + file.size > addonIntakeLimits.maxTotalBytes) {
      deferredFileCount += 1;
      deferredTotalBytes += file.size;
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    includedBytes += bytes.byteLength;
    files.push(await readEntry(path, bytes, errors, warnings));
    zip.file(path, bytes);
  }
  if (deferredFileCount) {
    addOnce(errors, { code: "scan_incomplete", message: `${deferredFileCount} included file${deferredFileCount === 1 ? " was" : "s were"} left unscanned by browser safety limits. Local selection succeeded, but remote transfer requires a smaller add-on root or package.` });
  }
  const packageBlob = sourceKind === "folder"
    ? await zip.generateAsync({ type: "blob", mimeType: "application/vnd.elysia-addon+zip" })
    : null;
  const packageFile = packageBlob ? new File([packageBlob], "browser-selected-source.elysia-addon", { type: "application/vnd.elysia-addon+zip" }) : selected[0] ?? null;
  return summarize(sourceKind, sourceKind === "folder" ? "Browser-selected folder/repository" : selected[0]?.name ?? "manifest.json", files, errors, warnings, packageFile, {
    selectedFileCount: selected.length,
    selectedTotalBytes: selected.reduce((sum, file) => sum + file.size, 0),
    excludedDirectoryGroups: excludedGroupsFromMap(excluded),
    deferredFileCount,
    deferredTotalBytes
  });
}

export function formatAddonIntakeBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Reassess current buffers; an original archive is never a current package. */
export function reassessAddonWorkspace(previous: Partial<AddonIntakeResult> | null, current: readonly { path: string; text: string | null; sizeBytes: number }[]): AddonIntakeResult {
  const repairable = new Set(["missing_manifest", "invalid_manifest_json", "manifest_not_readable", "undeclared_network_behavior", "secret_api_key", "secret_private_key", "private_absolute_path", "excluded_content_requires_repack"]);
  const errors = (previous?.errors ?? []).filter(issue => !repairable.has(issue.code));
  const warnings: BrowserArchiveIssue[] = [];
  const files = current.map(file => ({ path: file.path, size: file.sizeBytes, kind: fileKind(file.path), text: file.text ?? undefined }));
  for (const file of files) {
    if (file.text !== undefined) scanText(file.path, file.text, errors, warnings);
    if (file.kind === "script") warnings.push({ code: "script_file", message: "Script file requires explicit reviewer attention. It was not executed.", path: file.path });
    if (/\.(app|dll|dylib|exe|msi|so|wasm)$/i.test(file.path)) warnings.push({ code: "binary_or_executable", message: "Binary or executable-like payload requires explicit reviewer attention.", path: file.path });
  }
  return summarize(previous?.sourceKind ?? "manifest", previous?.label ?? "Current browser workspace", files, errors, warnings, null, {
    selectedFileCount: previous?.selectedFileCount ?? files.length,
    selectedTotalBytes: previous?.selectedTotalBytes ?? files.reduce((sum, file) => sum + file.size, 0),
    excludedDirectoryGroups: previous?.excludedDirectoryGroups ?? [], deferredFileCount: previous?.deferredFileCount ?? 0,
    deferredTotalBytes: previous?.deferredTotalBytes ?? 0,
  });
}
