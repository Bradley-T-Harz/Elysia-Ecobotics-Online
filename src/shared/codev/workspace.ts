/** Canonical browser-owned files. This store grants no native or network access. */
import JSZip from "jszip";
import type { WorkspaceFile } from "./contracts";
import { generatedVendorDirectoryForPath, containsPrivateAbsolutePath } from "../addons/addonIntakePolicy";

export const workspaceLimits = { files: 1000, bytes: 75 * 1024 * 1024, textBytes: 512 * 1024 } as const;
export type WorkspaceOwner = { accountId: string | null; browserId: string; surface: "marketplace" | "forge"; draftId: string | null };
export type BrowserFileInput = { path: string; bytes?: Uint8Array; text?: string; availability?: WorkspaceFile["availability"]; provenance: WorkspaceFile["provenance"]; sizeBytes?: number };
export type BrowserFileView = Readonly<{ path: string; text: string | null; availability: WorkspaceFile["availability"]; sizeBytes: number; provenance: WorkspaceFile["provenance"]; mimeType: "text/plain" | "application/octet-stream"; encoding: "utf-8" | null }>;
export type WorkspaceState = Readonly<{ id: string; owner: WorkspaceOwner; label: string; baseRevision: number; revision: number; manifestRevision: number; savedRevision: number | null; validationRevision: number | null; packageRevision: number | null; packageHash: string | null; dirty: boolean; metadata: Readonly<Record<string, unknown>>; files: readonly BrowserFileView[] }>;
export type WorkspaceCapture = { workspaceId: string; owner: WorkspaceOwner; revision: number; baseRevision: number; baseHash: string; contentHash: string; files: WorkspaceFile[] };
export type WorkspaceRecovery = { contract: "browser-workspace-1"; state: WorkspaceState; files: BrowserFileInput[]; baseHash: string; contentHash: string; savedAt: string };
type StoredFile = BrowserFileView & { bytes: Uint8Array | null };
export class WorkspaceConflict extends Error {}

export function canonicalWorkspacePath(value: string): string {
  if (!value || value.length > 512 || value !== value.normalize("NFC") || /[\\:\x00-\x1f\x7f]/.test(value) || value.startsWith("/")
    || value.split("/").some(part => !part || [".", ".."].includes(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(part))) {
    throw new Error("Unsafe or noncanonical workspace path.");
  }
  // TextEncoder replaces lone surrogates. Refuse them so browser/Python hashes agree.
  if (new TextDecoder("utf-8", { fatal: true }).decode(new TextEncoder().encode(value)) !== value) throw new Error("Invalid Unicode workspace path.");
  return value;
}
export function workspacePathDenied(path: string): boolean {
  const safe = canonicalWorkspacePath(path);
  return /(^|\/)\.docker\/config\.json$/i.test(safe) || !!generatedVendorDirectoryForPath(safe) || safe.toLowerCase().split("/").some(part =>
    [".git", ".ssh", ".gnupg", ".aws", ".azure", ".local_secrets", "vault", "sealed", ".elysia_backups", "node_modules", ".venv", "__pycache__", ".npmrc", ".pypirc", ".netrc", ".git-credentials"].includes(part)
    || part === ".env" || part.startsWith(".env.") || /\.(pem|key|p12|pfx)$/.test(part) || /^(id_rsa|id_dsa|id_ed25519|credentials?|secrets?)(\.|$)/.test(part));
}
export async function browserHash(bytes: Uint8Array): Promise<string> {
  const result = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return Array.from(new Uint8Array(result), value => value.toString(16).padStart(2, "0")).join("");
}
export async function browserWorkspaceHash(files: WorkspaceFile[]): Promise<string> {
  const seen = new Set<string>();
  for (const file of files) {
    const path = canonicalWorkspacePath(file.path);
    if (seen.has(path.toUpperCase())) throw new Error("Workspace contains colliding paths.");
    seen.add(path.toUpperCase());
    if (file.text != null) {
      const bytes = new TextEncoder().encode(file.text);
      if (file.availability !== "text" || bytes.length !== file.size_bytes || await browserHash(bytes) !== file.content_hash) throw new Error("Workspace file content/hash mismatch.");
    }
  }
  const rows = [...files].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
    .map(file => [file.path, file.content_hash ?? null, file.size_bytes]);
  return browserHash(new TextEncoder().encode(JSON.stringify(rows)));
}
export function workspaceOwnerKey(owner: WorkspaceOwner) {
  return JSON.stringify([owner.accountId, owner.browserId, owner.surface, owner.draftId]);
}
export function unsafeWorkspaceText(text: string) {
  return /\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|AWS_ACCESS_KEY_ID|SUPABASE_SERVICE_ROLE|service_role)\b/i.test(text)
    || /BEGIN [A-Z ]*PRIVATE KEY/i.test(text) || containsPrivateAbsolutePath(text);
}

function safeWorkspaceMetadata(value: Record<string, unknown>): Readonly<Record<string, unknown>> {
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).length > 65536 || unsafeWorkspaceText(text)) throw new Error("Workspace form recovery exceeds the safe metadata limit.");
  const copy = JSON.parse(text);
  if (!copy || typeof copy !== "object" || Array.isArray(copy)) throw new Error("Workspace metadata must be an object.");
  const inspect = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      if (/token|password|credential|secret|approval|grant|consent|accepted|risk_acknowledged/i.test(key)) throw new Error("Authorization or credential state cannot be persisted as workspace metadata.");
      inspect(child);
    }
    Object.freeze(item);
  };
  inspect(copy);
  return copy;
}

function storeFile(input: BrowserFileInput): StoredFile {
  const path = canonicalWorkspacePath(input.path);
  if (workspacePathDenied(path)) throw new Error("This file class cannot enter a browser development workspace.");
  const bytes = input.bytes ? Uint8Array.from(input.bytes) : input.text !== undefined ? new TextEncoder().encode(input.text) : null;
  if (!input.bytes && input.text !== undefined && bytes && new TextDecoder().decode(bytes) !== input.text) throw new Error("Invalid Unicode workspace text.");
  let text: string | null = null;
  let availability: WorkspaceFile["availability"] = input.availability ?? (bytes ? "binary" : "metadata_only");
  if (bytes && input.text !== undefined && bytes.length <= workspaceLimits.textBytes) {
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); if (text.includes("\0")) text = null; } catch { text = null; }
    availability = text !== null ? "text" : "binary";
  } else if (bytes && bytes.length > workspaceLimits.textBytes) availability = "oversized";
  if (!bytes) availability = "metadata_only";
  return { path, bytes, text, availability, sizeBytes: bytes?.length ?? input.sizeBytes ?? 0, provenance: input.provenance, mimeType: text !== null ? "text/plain" : "application/octet-stream", encoding: text !== null ? "utf-8" : null };
}

export class BrowserWorkspace {
  private files = new Map<string, StoredFile>();
  private listeners = new Set<() => void>();
  private state: WorkspaceState;
  private usedPlans = new Set<string>();
  private disposed = false;
  private baseHash: Promise<string>;
  constructor(owner: WorkspaceOwner, label: string, inputs: BrowserFileInput[], id = `workspace_${crypto.randomUUID().replace(/-/g, "")}`, metadata: Record<string, unknown> = {}) {
    this.files = this.admit(inputs);
    this.state = Object.freeze({ id, owner: Object.freeze({ ...owner }), label: label.slice(0, 120), baseRevision: 0, revision: 0, manifestRevision: 0,
      savedRevision: null, validationRevision: null, packageRevision: null, packageHash: null, dirty: false, metadata: safeWorkspaceMetadata(metadata), files: this.views() });
    this.baseHash = this.captureFiles([...this.files.values()]).then(browserWorkspaceHash);
  }
  private admit(inputs: BrowserFileInput[]) {
    const next = new Map<string, StoredFile>();
    const seen = new Set<string>();
    for (const input of inputs) {
      const path = canonicalWorkspacePath(input.path);
      // checksums.json is a derived packaging artifact, never an editable source buffer.
      if (path === "checksums.json") continue;
      if (seen.has(path.toUpperCase())) throw new Error("Workspace contains colliding paths.");
      seen.add(path.toUpperCase()); next.set(path, storeFile(input));
    }
    if (next.size > workspaceLimits.files || [...next.values()].reduce((sum, file) => sum + file.sizeBytes, 0) > workspaceLimits.bytes) throw new Error("Workspace exceeds the bounded file or byte limit.");
    return next;
  }
  private views(): readonly BrowserFileView[] { return Object.freeze([...this.files.values()].map(({ bytes: _bytes, ...file }) => Object.freeze(file))); }
  private publish(update: Partial<WorkspaceState> = {}) {
    if (this.disposed) throw new WorkspaceConflict("This workspace session was closed.");
    this.state = Object.freeze({ ...this.state, ...update, files: this.views() });
    this.listeners.forEach(listener => listener());
  }
  private changed(manifestChanged: boolean, update: Partial<WorkspaceState> = {}) {
    const revision = this.state.revision + 1;
    this.publish({ ...update, revision, manifestRevision: manifestChanged ? revision : this.state.manifestRevision, dirty: true, validationRevision: null, packageRevision: null, packageHash: null });
  }
  getSnapshot = () => this.state;
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  assertRevision(revision: number) { if (this.disposed || this.state.revision !== revision) throw new WorkspaceConflict("Workspace revision changed. Review the current files and try again."); }
  assertOwner(owner: WorkspaceOwner) { if (this.disposed || workspaceOwnerKey(owner) !== workspaceOwnerKey(this.state.owner)) throw new WorkspaceConflict("Workspace belongs to a different account, browser session, surface, or draft."); }
  dispose() { this.disposed = true; this.files.clear(); this.listeners.clear(); this.usedPlans.clear(); this.state = Object.freeze({ ...this.state, files: [], label: "Closed workspace" }); }
  updateText(path: string, text: string, expectedRevision = this.state.revision) {
    this.assertRevision(expectedRevision);
    const existing = this.files.get(canonicalWorkspacePath(path));
    if (!existing || existing.text === null) throw new Error("Only available text source can be edited.");
    if (existing.text === text) return;
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > workspaceLimits.textBytes || new TextDecoder().decode(bytes) !== text || text.includes("\0")) throw new Error("Proposed text exceeds the valid UTF-8 text limit.");
    this.files = this.admit([...this.files.values()].map(file => file.path === path ? { path, text, provenance: "editor" } : this.input(file)));
    this.changed(path === "manifest.json");
  }
  updateMetadata(metadata: Record<string, unknown>) {
    const safe = safeWorkspaceMetadata(metadata);
    if (JSON.stringify(safe) === JSON.stringify(this.state.metadata)) return;
    this.changed(false, { metadata: safe });
  }
  private input(file: StoredFile): BrowserFileInput { return { path: file.path, bytes: file.bytes ?? undefined, text: file.text ?? undefined, availability: file.availability, provenance: file.provenance, sizeBytes: file.sizeBytes }; }
  importFiles(inputs: BrowserFileInput[], expectedRevision = this.state.revision, replace = false) {
    this.assertRevision(expectedRevision);
    const imported = this.admit(inputs);
    const existing = replace ? [] : [...this.files.values()].filter(file => !imported.has(file.path)).map(file => this.input(file));
    this.files = this.admit([...existing, ...inputs]);
    this.changed(imported.has("manifest.json"));
  }
  async capture(): Promise<WorkspaceCapture> {
    this.assertRevision(this.state.revision);
    const state = this.state;
    const stored = [...this.files.values()];
    const files = await this.captureFiles(stored);
    const contentHash = await browserWorkspaceHash(files);
    return { workspaceId: state.id, owner: { ...state.owner }, revision: state.revision, baseRevision: state.baseRevision, baseHash: await this.baseHash, contentHash, files };
  }
  private captureFiles(stored: StoredFile[]) {
    return Promise.all(stored.map(async file => ({ path: file.path, text: file.text, availability: file.availability,
      size_bytes: file.sizeBytes, provenance: file.provenance, content_hash: file.bytes ? await browserHash(file.bytes) : null } satisfies WorkspaceFile)));
  }
  async applyReviewedPatch(input: { planId: string; revision: number; contentHash: string; owner: WorkspaceOwner; explicitlyApproved: boolean; assertAuthority?: () => void; changes: Array<{ path: string; baseHash: string; newHash: string; text: string }> }) {
    input.assertAuthority?.();
    this.assertOwner(input.owner); this.assertRevision(input.revision);
    if (!input.explicitlyApproved || this.usedPlans.has(input.planId) || !input.changes.length || input.changes.length > 20) throw new Error("A fresh exact patch approval is required.");
    const captured = await this.capture();
    if (captured.contentHash !== input.contentHash) throw new WorkspaceConflict("The approved workspace hash is stale.");
    const byPath = new Map(captured.files.map(file => [file.path, file]));
    const changed = new Map<string, BrowserFileInput>();
    for (const change of input.changes) {
      const original = byPath.get(change.path);
      const bytes = new TextEncoder().encode(change.text);
      if (changed.has(change.path) || !original || original.text == null || original.content_hash !== change.baseHash
        || bytes.length > workspaceLimits.textBytes || new TextDecoder().decode(bytes) !== change.text || change.text.includes("\0") || await browserHash(bytes) !== change.newHash || unsafeWorkspaceText(change.text)) throw new WorkspaceConflict("An exact file hash, available text source, or safe patch is missing.");
      changed.set(change.path, { path: change.path, text: change.text, provenance: "codev_patch" });
    }
    input.assertAuthority?.();
    this.assertRevision(input.revision); this.assertOwner(input.owner);
    this.files = this.admit([...this.files.values()].map(file => changed.get(file.path) ?? this.input(file)));
    if (this.usedPlans.size >= 128) this.usedPlans.delete(this.usedPlans.values().next().value!);
    this.usedPlans.add(input.planId); this.changed(changed.has("manifest.json"));
    return this.capture();
  }
  markValidated(revision: number) { this.assertRevision(revision); this.publish({ validationRevision: revision }); }
  markSaved(revision: number) { this.assertRevision(revision); this.publish({ savedRevision: revision, dirty: false }); }
  async recovery(): Promise<WorkspaceRecovery> {
    const captured = await this.capture();
    this.assertRevision(captured.revision);
    if ([...this.files.values()].some(file => file.text !== null && unsafeWorkspaceText(file.text))) throw new Error("Remove secret-looking or private-path content before saving browser recovery.");
    return { contract: "browser-workspace-1", state: this.state, files: [...this.files.values()].map(file => ({ ...this.input(file), bytes: file.bytes ? Uint8Array.from(file.bytes) : undefined })), baseHash: captured.baseHash, contentHash: captured.contentHash, savedAt: new Date().toISOString() };
  }
  static async restore(owner: WorkspaceOwner, recovery: WorkspaceRecovery) {
    if (recovery.contract !== "browser-workspace-1" || workspaceOwnerKey(owner) !== workspaceOwnerKey(recovery.state.owner)) throw new WorkspaceConflict("Recovery belongs to a different workspace owner.");
    const restored = new BrowserWorkspace(owner, recovery.state.label, recovery.files, recovery.state.id);
    if ((await restored.capture()).contentHash !== recovery.contentHash) throw new WorkspaceConflict("Recovery content hash does not match its receipt.");
    const state = recovery.state;
    if (!/^[a-f0-9]{64}$/.test(recovery.baseHash)) throw new WorkspaceConflict("Invalid recovery base hash.");
    restored.baseHash = Promise.resolve(recovery.baseHash);
    if (!Number.isSafeInteger(state.revision) || state.revision < 0 || state.manifestRevision > state.revision || state.baseRevision > state.revision) throw new WorkspaceConflict("Invalid recovery revision.");
    restored.publish({ baseRevision: state.baseRevision, revision: state.revision, manifestRevision: state.manifestRevision,
      savedRevision: state.savedRevision, dirty: state.dirty, metadata: safeWorkspaceMetadata(state.metadata ?? {}), validationRevision: null, packageRevision: null, packageHash: null });
    return restored;
  }
  async preparePackage(name: string): Promise<{ file: File; snapshot: WorkspaceCapture; packageHash: string }> {
    const initial = await this.capture(); this.assertRevision(initial.revision);
    if (initial.files.some(file => !file.content_hash || (file.text != null && unsafeWorkspaceText(file.text)))) throw new Error("Every included file needs available, safe bytes before packaging.");
    const source = this.files.get("manifest.json");
    if (!source?.text) throw new Error("A readable root manifest.json is required for packaging.");
    let manifest: Record<string, unknown>;
    try { manifest = JSON.parse(source.text); } catch { throw new Error("Fix manifest JSON before packaging."); }
    if (!manifest || Array.isArray(manifest) || typeof manifest !== "object") throw new Error("Manifest must be a JSON object.");
    const signing = manifest.signing as Record<string, unknown> | undefined;
    if (signing?.signature) throw new Error("This manifest carries a signature. Prepare and review an unsigned revision before rebuilding its package.");
    const hashes = Object.fromEntries(initial.files.filter(file => file.path !== "manifest.json").sort((a, b) => a.path < b.path ? -1 : 1).map(file => [file.path, file.content_hash!]));
    const checksumText = JSON.stringify({ algorithm: "sha256", files: hashes }, null, 2) + "\n";
    if (manifest.schema_version === "1.1") {
      const checksums = { files: { ...hashes, "checksums.json": await browserHash(new TextEncoder().encode(checksumText)) } };
      this.assertRevision(initial.revision);
      if (JSON.stringify(manifest.checksums) !== JSON.stringify(checksums)) this.updateText("manifest.json", JSON.stringify({ ...manifest, checksums }, null, 2) + "\n", initial.revision);
    }
    const snapshot = await this.capture(); this.assertRevision(snapshot.revision);
    const entries = [...this.files.values()];
    const zip = new JSZip();
    const options = { date: new Date("1980-01-01T00:00:00.000Z"), createFolders: false, unixPermissions: 0o100644 };
    for (const file of entries.sort((a, b) => a.path < b.path ? -1 : 1)) zip.file(file.path, file.bytes!, options);
    zip.file("checksums.json", checksumText, options);
    const bytes = await zip.generateAsync({ type: "uint8array", platform: "UNIX", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const packageHash = await browserHash(bytes);
    this.assertRevision(snapshot.revision);
    this.publish({ packageRevision: snapshot.revision, packageHash });
    return { file: new File([Uint8Array.from(bytes).buffer], `${name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100) || "addon"}.elysia-addon`, { type: "application/vnd.elysia-addon+zip" }), snapshot, packageHash };
  }
}
