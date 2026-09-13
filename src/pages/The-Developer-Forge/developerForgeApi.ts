
import { accountBoundSupabase, hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";
import { checkCompatibility, defaultPermissionCatalog, manifestLicenseSpdx, manifestPermissionKeys, staticSafetyScan, validateManifest, validationStatus } from "./developerForgeValidator";
import type { ForgeManifest, ForgeValidationResult, PermissionDefinition } from "./developerForgeValidator";
import { inspectArchiveFile, type BrowserArchiveInspectionResult } from "../../shared/addons/browserArchiveInspector";
import { ownershipSelectionSchema, type OwnershipSelection } from "../../shared/addons/publisherOwnership";

import { browserWorkspaceHash, type WorkspaceCapture } from "../../shared/codev/workspace";
import { browserWorkspaceId } from "../../shared/codev/workspaceRecovery";

export type DeveloperProfile = {
  id?: string;
  user_id?: string;
  developer_slug: string;
  display_name: string;
  bio?: string | null;
  website_url?: string | null;
  github_url?: string | null;
  support_url?: string | null;
  contact_email?: string | null;
  status?: "draft" | "requested" | "active" | "trusted" | "suspended" | "revoked";
  verified_at?: string | null;
  suspended_at?: string | null;
};

export type AddonDraft = {
  id: string;
  publisher_id?: string | null;
  creator_attribution?: string | null;
  owner_user_id?: string;
  browser_owner_key?: string;
  browser_base_metadata_hash?: string;
  developer_profile_id?: string | null;
  addon_slug: string;
  addon_name: string;
  short_summary: string;
  long_description?: string | null;
  version: string;
  license: string;
  homepage_url?: string | null;
  source_url?: string | null;
  support_url?: string | null;
  category?: string | null;
  tags?: string[] | null;
  manifest_json: ForgeManifest;
  compatibility_targets?: Record<string, unknown> | null;
  permission_summary?: string | null;
  risk_level?: string | null;
  validation_status?: string | null;
  package_status?: string | null;
  submission_status?: string | null;
  review_status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
  locked_at?: string | null;
  locked_reason?: string | null;
  source_submission_id?: string | null;
  revision_of_draft_id?: string | null;
};

export type DraftPermission = {
  id?: string;
  addon_draft_id?: string;
  permission_key: string;
  reason?: string | null;
  scope_json?: Record<string, unknown> | null;
  risk_acknowledged?: boolean;
};

export type AddonPackageRow = {
  id: string;
  addon_draft_id: string;
  version?: string | null;
  storage_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  sha256?: string | null;
  scan_status?: string | null;
  scan_summary?: string | null;
  archive_inspection_json?: BrowserArchiveInspectionResult | Record<string, unknown> | null;
  signature_status?: string | null;
  created_at?: string | null;
};

export type AddonSubmission = {
  id: string;
  addon_draft_id: string;
  submitted_by: string;
  status: string;
  submitted_at?: string;
  review_item_id?: string | null;
  review_summary?: string | null;
  reviewer_feedback?: string | null;
  snapshot?: AddonSubmissionSnapshot | null;
};

export type AddonSubmissionSnapshot = {
  id: string;
  submission_id: string;
  draft_id?: string | null;
  developer_user_id?: string | null;
  manifest_snapshot: ForgeManifest;
  permissions_snapshot: DraftPermission[];
  package_snapshot: Record<string, unknown>;
  validation_snapshot: ForgeValidationResult[];
  scan_snapshot: ForgeValidationResult[];
  marketplace_preview_snapshot: Record<string, unknown>;
  package_sha256?: string | null;
  package_storage_bucket?: string | null;
  package_storage_path?: string | null;
  package_file_name?: string | null;
  package_size_bytes?: number | null;
  signature_status?: string | null;
  created_at?: string | null;
};

export type ForgeState = {
  signedIn: boolean;
  userId: string | null;
  profile: DeveloperProfile | null;
  drafts: AddonDraft[];
  submissions: AddonSubmission[];
  permissionCatalog: PermissionDefinition[];
  warnings: string[];
};

const localDraftKey = "developerForge.localDrafts.v2";
const localProfileKey = "developerForge.localProfile.v2";
function localKey(base: string, userId: string | null) {
  return `${base}:${JSON.stringify([userId, browserWorkspaceId()])}`;
}

const lockedSubmissionStates = new Set(["submitted", "pending", "in_review", "approved", "published", "revoked", "security_hold"]);

export function isDraftLockedForEditing(draft: Pick<AddonDraft, "submission_status" | "review_status" | "locked_at">) {
  return Boolean(draft.locked_at)
    || lockedSubmissionStates.has(draft.submission_status ?? "")
    || lockedSubmissionStates.has(draft.review_status ?? "");
}

function blockingValidation(results: ForgeValidationResult[]) {
  return results.some((result) => result.severity === "blocked" || result.severity === "error");
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function logDetail(scope: string, error: unknown) {
  if (import.meta.env.DEV) console.warn(`[Developer Forge ${scope}]`, error);
}

function friendly(label: string, message: string) {
  logDetail(label, message);
  if (/Could not find|schema cache|does not exist|relation/i.test(message)) return `${label}: account-backed storage is not configured yet.`;
  if (/permission denied|row-level security|violates row-level security/i.test(message)) return `${label}: account storage is not available for this signed-in account yet.`;
  return `${label}: ${message}`;
}

function normalizeSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "draft-addon";
}

function localDraftFromManifest(manifest: ForgeManifest): AddonDraft {
  const now = new Date().toISOString();
  return {
    id: `local-${crypto.randomUUID()}`,
    addon_slug: normalizeSlug(manifest.addon_id?.split(".").pop() || manifest.name || "draft-addon"),
    addon_name: manifest.name || "Draft add-on",
    short_summary: manifest.description || "Local Developer Forge draft.",
    long_description: manifest.description || "",
    version: manifest.version || "0.1.0",
    license: manifestLicenseSpdx(manifest) || "MIT",
    category: manifest.runtime?.kind || "static",
    tags: [],
    manifest_json: manifest,
    risk_level: "unknown",
    validation_status: "not_validated",
    package_status: "not_uploaded",
    submission_status: "draft",
    review_status: "not_submitted",
    created_at: now,
    updated_at: now
  };
}

const draftMetadataFields = ["developer_profile_id", "publisher_id", "creator_attribution", "addon_slug", "addon_name", "short_summary", "long_description", "version", "license", "homepage_url", "source_url", "support_url", "category", "tags", "manifest_json", "compatibility_targets", "permission_summary"] as const;

function stableJson(value: unknown): string {
  const sort = (item: unknown): unknown => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, sort(child)])) : item;
  return JSON.stringify(sort(value));
}
async function draftMetadataHash(draft: AddonDraft): Promise<string> {
  const comparable = Object.fromEntries(draftMetadataFields.map(key => [key, draft[key] ?? (key === "tags" ? [] : null)]));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableJson(comparable)));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

async function withDraftBaseline(draft: AddonDraft): Promise<AddonDraft> {
  return { ...draft, browser_base_metadata_hash: await draftMetadataHash(draft) };
}

function draftPayloadFromManifest(userId: string, manifest: ForgeManifest, profileId?: string | null) {
  return {
    owner_user_id: userId,
    developer_profile_id: profileId ?? null,
    addon_slug: normalizeSlug(manifest.addon_id?.split(".").pop() || manifest.name || "draft-addon"),
    addon_name: manifest.name || "Draft add-on",
    short_summary: manifest.description || "Developer Forge draft.",
    long_description: manifest.description || "",
    version: manifest.version || "0.1.0",
    license: manifestLicenseSpdx(manifest) || "MIT",
    homepage_url: (manifest.homepage_url as string | undefined) ?? null,
    source_url: (manifest.source_url as string | undefined) ?? null,
    support_url: (manifest.support_url as string | undefined) ?? null,
    category: manifest.runtime?.kind || "static",
    tags: [],
    manifest_json: manifest,
    compatibility_targets: manifest.compatibility ?? {},
    permission_summary: manifestPermissionKeys(manifest).join(", "),
    updated_at: new Date().toISOString()
  };
}

export async function currentUserId() {
  if (!hasSupabaseConfig || !supabase) return { userId: null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.auth.getUser();
  if (error) return { userId: null, warning: friendly("Website Account", error.message) };
  return { userId: data.user?.id ?? null, warning: data.user ? undefined : "Sign in to use account-backed Developer Forge drafts." };
}

async function draftLockWarning(draftId: string, userId: string, client = supabase) {
  if (!client || draftId.startsWith("local-")) return null;
  const { data, error } = await client.from("addon_drafts").select("submission_status,review_status,locked_at").eq("id", draftId).eq("owner_user_id", userId).maybeSingle();
  if (error) return friendly("Draft lock", error.message);
  if (!data) return "This draft is unavailable for the current account.";
  if (isDraftLockedForEditing(data as AddonDraft)) return "This submitted add-on draft is locked for review. Duplicate it or create a revision draft before changing files, permissions, packages, or validation data.";
  return null;
}

export async function loadForgeState({ allowLocalFallback = true }: { allowLocalFallback?: boolean } = {}): Promise<ForgeState> {
  const warnings: string[] = [];
  if (!hasSupabaseConfig || !supabase) {
    return { signedIn: false, userId: null, profile: (allowLocalFallback ? readLocal<DeveloperProfile | null>(localKey(localProfileKey, null), null) : null), drafts: (allowLocalFallback ? readLocal<AddonDraft[]>(localKey(localDraftKey, null), []) : []), submissions: [], permissionCatalog: defaultPermissionCatalog, warnings: [supabaseNotConfiguredMessage] };
  }
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) warnings.push(friendly("Website Account", authError.message));
  if (!auth.user) return { signedIn: false, userId: null, profile: null, drafts: (allowLocalFallback ? readLocal<AddonDraft[]>(localKey(localDraftKey, null), []) : []), submissions: [], permissionCatalog: defaultPermissionCatalog, warnings };
  const userId = auth.user.id;
  const [profileResult, draftResult, submissionResult, catalogResult] = await Promise.all([
    supabase.from("developer_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("addon_drafts").select("*").eq("owner_user_id", userId).is("archived_at", null).order("updated_at", { ascending: false }).limit(100),
    supabase.from("addon_submissions").select("*").eq("submitted_by", userId).order("submitted_at", { ascending: false }).limit(100),
    supabase.from("addon_permission_catalog").select("*").eq("is_active", true).order("risk_level", { ascending: true })
  ]);
  if (profileResult.error) warnings.push(friendly("Developer profile", profileResult.error.message));
  if (draftResult.error) warnings.push(friendly("Add-on drafts", draftResult.error.message));
  if (submissionResult.error) warnings.push(friendly("Add-on submissions", submissionResult.error.message));
  if (catalogResult.error) warnings.push(friendly("Permission catalog", catalogResult.error.message));
  const submissions = (submissionResult.data as AddonSubmission[] | null) ?? [];
  if (submissions.length) {
    const { data: snapshots, error: snapshotError } = await supabase
      .from("addon_submission_snapshots")
      .select("*")
      .in("submission_id", submissions.map((submission) => submission.id))
      .order("created_at", { ascending: false });
    if (snapshotError) warnings.push(friendly("Submission snapshots", snapshotError.message));
    const snapshotBySubmission = new Map<string, AddonSubmissionSnapshot>();
    for (const snapshot of (snapshots ?? []) as AddonSubmissionSnapshot[]) {
      if (!snapshotBySubmission.has(snapshot.submission_id)) snapshotBySubmission.set(snapshot.submission_id, snapshot);
    }
    submissions.forEach((submission) => { submission.snapshot = snapshotBySubmission.get(submission.id) ?? null; });
  }
  return {
    signedIn: true,
    userId,
    profile: (profileResult.data as DeveloperProfile | null) ?? (allowLocalFallback ? readLocal<DeveloperProfile | null>(localKey(localProfileKey, userId), null) : null),
    drafts: await Promise.all(((draftResult.data as AddonDraft[] | null) ?? (allowLocalFallback ? readLocal<AddonDraft[]>(localKey(localDraftKey, userId), []) : [])).map(withDraftBaseline)),
    submissions,
    permissionCatalog: (catalogResult.data as PermissionDefinition[] | null)?.length ? catalogResult.data as PermissionDefinition[] : defaultPermissionCatalog,
    warnings
  };
}

export async function saveDeveloperProfile(input: DeveloperProfile, expectedUserId?: string | null): Promise<{ profile: DeveloperProfile | null; warnings: string[] }> {
  const { userId, warning } = await currentUserId();
  if (expectedUserId !== undefined && userId !== expectedUserId) return { profile: null, warnings: ["The website account changed. Restart profile saving."] };
  const localProfile = { ...input, status: input.status ?? "requested" };
  if (!userId || !supabase) {
    writeLocal(localKey(localProfileKey, userId), localProfile);
    return { profile: localProfile, warnings: [warning ?? "Saved locally in this browser. Sign in to save a developer profile."] };
  }
  const client = await accountBoundSupabase(userId).catch(() => null);
  if (!client) return { profile: null, warnings: ["The website login changed. Restart profile saving."] };
  const payload = { ...localProfile, user_id: userId, status: localProfile.status === "draft" ? "draft" : "requested", updated_at: new Date().toISOString() };
  const { data, error } = await client.from("developer_profiles").upsert(payload, { onConflict: "user_id" }).select("*").single();
  if (error) {
    writeLocal(localKey(localProfileKey, userId), localProfile);
    return { profile: localProfile, warnings: [friendly("Developer profile", error.message)] };
  }
  return { profile: data as DeveloperProfile, warnings: [] };
}

export async function createDraftFromManifest(manifest: ForgeManifest, profileId?: string | null, ownership?: OwnershipSelection, revisionOf?: string, expectedUserId?: string | null): Promise<{ draft: AddonDraft | null; warnings: string[] }> {
  const { userId, warning } = await currentUserId();
  if (expectedUserId !== undefined && userId !== expectedUserId) return { draft: null, warnings: ["The website account changed. Restart draft creation."] };
  if (!userId || !supabase) {
    const draft = { ...localDraftFromManifest(manifest), creator_attribution: ownership?.creatorAttribution ?? "", publisher_id: null, revision_of_draft_id: revisionOf ?? null, browser_owner_key: localKey(localDraftKey, userId) };
    const drafts = [draft, ...readLocal<AddonDraft[]>(localKey(localDraftKey, userId), [])];
    writeLocal(localKey(localDraftKey, userId), drafts);
    return { draft, warnings: [warning ?? "Saved draft locally in this browser."] };
  }
  const client = await accountBoundSupabase(userId).catch(() => null);
  if (!client) return { draft: null, warnings: ["The website account changed. Restart draft creation."] };
  const selected = ownershipSelectionSchema.safeParse(ownership);
  if (!selected.success) return { draft: null, warnings: ["Enter Creator / Organization and select an authorized Publisher account before saving an account-backed draft."] };
  const { data, error } = await client.from("addon_drafts").insert({ ...draftPayloadFromManifest(userId, manifest, profileId), publisher_id: selected.data.publisherId, creator_attribution: selected.data.creatorAttribution, revision_of_draft_id: revisionOf && !revisionOf.startsWith("local-") ? revisionOf : null }).select("*").single();
  if (error) return { draft: null, warnings: [friendly("Add-on draft", error.message)] };
  await client.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_draft", target_id: (data as { id: string }).id, action: "addon_draft_created" });
  return { draft: await withDraftBaseline({ ...data as AddonDraft, owner_user_id: userId }), warnings: [] };
}

export async function saveDraftMetadata(draft: AddonDraft): Promise<{ draft: AddonDraft | null; warnings: string[] }> {
  const { userId, warning } = await currentUserId();
  if (draft.id.startsWith("local-")) {
    const key = localKey(localDraftKey, userId);
    if (draft.browser_owner_key !== key) return { draft: null, warnings: ["This local draft belongs to another account or browser scope. It was not saved."] };
    const saved = await withDraftBaseline({ ...draft, updated_at: new Date().toISOString() });
    const drafts = readLocal<AddonDraft[]>(key, []);
    const previous = drafts.find(item => item.id === draft.id);
    if (previous && draft.browser_base_metadata_hash && await draftMetadataHash(previous) !== draft.browser_base_metadata_hash) return { draft: null, warnings: ["Another tab changed this local draft. Browser files were preserved."] };
    if (!previous) return { draft: null, warnings: ["This scoped local draft is no longer available."] };
    writeLocal(key, drafts.map(item => item.id === draft.id ? saved : item));
    return { draft: saved, warnings: ["Draft metadata saved in this browser. No account upload occurred."] };
  }
  if (!userId || !supabase || (draft.owner_user_id && draft.owner_user_id !== userId)) return { draft: null, warnings: [warning ?? "The website account changed. Restart this save."] };
  const client = await accountBoundSupabase(userId).catch(() => null);
  if (!client) return { draft: null, warnings: ["The website login changed. Restart this save."] };
  const remoteResult = await client.from("addon_drafts").select("*").eq("id", draft.id).eq("owner_user_id", userId).maybeSingle();
  if (remoteResult.error || !remoteResult.data) return { draft: null, warnings: ["The remote draft could not be verified for this account."] };
  const remote = remoteResult.data as AddonDraft;
  if (isDraftLockedForEditing(remote)) return { draft: null, warnings: ["This submitted draft is locked. Create a revision before changing it."] };
  const sourceChanged = draft.browser_base_metadata_hash ? await draftMetadataHash(remote) !== draft.browser_base_metadata_hash
    : Boolean(draft.updated_at && draft.updated_at !== remote.updated_at);
  if (sourceChanged) return { draft: null, warnings: ["The remote draft metadata changed. Browser files are preserved; compare the remote draft or create a revision before saving again."] };
  const selected = ownershipSelectionSchema.safeParse({ publisherId: draft.publisher_id, creatorAttribution: draft.creator_attribution });
  if (!selected.success) return { draft: null, warnings: ["Enter Creator / Organization and select an authorized Publisher account before saving to the Marketplace."] };
  const payload = {
    developer_profile_id: draft.developer_profile_id ?? null,
    publisher_id: selected.data.publisherId,
    creator_attribution: selected.data.creatorAttribution,
    addon_slug: draft.addon_slug,
    addon_name: draft.addon_name,
    short_summary: draft.short_summary,
    long_description: draft.long_description,
    version: draft.version,
    license: draft.license,
    homepage_url: draft.homepage_url,
    source_url: draft.source_url,
    support_url: draft.support_url,
    category: draft.category,
    tags: draft.tags ?? [],
    manifest_json: draft.manifest_json,
    compatibility_targets: draft.manifest_json.compatibility ?? {},
    permission_summary: manifestPermissionKeys(draft.manifest_json).join(", "),
    updated_at: new Date().toISOString()
  };
  let query = client.from("addon_drafts").update(payload).eq("id", draft.id).eq("owner_user_id", userId);
  if (remote.updated_at) query = query.eq("updated_at", remote.updated_at);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) return { draft: null, warnings: [friendly("Add-on draft", error.message)] };
  if (!data) return { draft: null, warnings: ["The remote draft changed or is no longer editable. Your browser files are preserved; compare the remote draft or create a revision before saving again."] };
  const audit = await client.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_draft", target_id: draft.id, action: "addon_draft_updated" });
  return { draft: await withDraftBaseline({ ...data as AddonDraft, owner_user_id: userId }), warnings: audit.error ? ["Draft metadata was saved, but its audit record could not be confirmed."] : [] };
}

export async function updateDraft(draft: AddonDraft): Promise<string[]> {
  return (await saveDraftMetadata(draft)).warnings;
}

export async function archiveDraft(draftId: string): Promise<string[]> {
  const { userId, warning } = await currentUserId();
  if (draftId.startsWith("local-")) {
    const key = localKey(localDraftKey, userId);
    writeLocal(key, readLocal<AddonDraft[]>(key, []).filter(draft => draft.id !== draftId));
    return ["Local draft removed from this account's browser scope."];
  }
  if (!userId || !supabase) return [warning ?? supabaseNotConfiguredMessage];
  const client = await accountBoundSupabase(userId).catch(() => null);
  if (!client) return ["The website account changed. Restart this operation."];
  const { error } = await client.from("addon_drafts").update({ archived_at: new Date().toISOString(), submission_status: "archived", updated_at: new Date().toISOString() }).eq("id", draftId).eq("owner_user_id", userId);
  return error ? [friendly("Archive draft", error.message)] : [];
}

export async function duplicateDraft(draft: AddonDraft): Promise<{ draft: AddonDraft | null; warnings: string[] }> {
  const { userId } = await currentUserId();
  if (draft.id.startsWith("local-") ? draft.browser_owner_key !== localKey(localDraftKey, userId) : draft.owner_user_id !== userId) return { draft: null, warnings: ["This draft belongs to a different account or browser scope."] };
  // A revision retains the add-on identity and publisher. It is not a new
  // product, a transfer, a publication, or an automatic version bump.
  return createDraftFromManifest({ ...draft.manifest_json }, draft.developer_profile_id ?? null,
    { creatorAttribution: draft.creator_attribution ?? "", publisherId: draft.publisher_id ?? null }, draft.id, userId);
}

export async function saveValidationResults(draftId: string, results: ForgeValidationResult[], expectedUserId?: string): Promise<string[]> {
  if (draftId.startsWith("local-")) return [];
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase) return [warning ?? supabaseNotConfiguredMessage];
  if (expectedUserId && expectedUserId !== userId) return ["The website account changed. Restart this operation."];
  const client = await accountBoundSupabase(userId).catch(() => null);
  if (!client) return ["The website session changed. Restart this operation."];
  const locked = await draftLockWarning(draftId, userId, client);
  if (locked) return [locked];
  const status = validationStatus(results);
  const removal = await client.from("addon_validation_results").delete().eq("addon_draft_id", draftId);
  if (removal.error) return [friendly("Replace draft records", removal.error.message)];
  if (results.length) {
    const { error } = await client.from("addon_validation_results").insert(results.map((result) => ({ addon_draft_id: draftId, ...result })));
    if (error) return [friendly("Validation results", error.message)];
  }
  const { error: draftError } = await client.from("addon_drafts").update({ validation_status: status, submission_status: ["blocked", "errors"].includes(status) ? "draft" : "ready_to_submit", updated_at: new Date().toISOString() }).eq("id", draftId).eq("owner_user_id", userId);
  if (draftError) return [friendly("Validation status", draftError.message)];
  await client.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_draft", target_id: draftId, action: "manifest_validated", metadata: { status } });
  return [];
}

export async function saveDraftPermissions(draftId: string, permissions: DraftPermission[], expectedUserId?: string): Promise<string[]> {
  if (draftId.startsWith("local-")) return [];
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase) return [warning ?? supabaseNotConfiguredMessage];
  if (expectedUserId && expectedUserId !== userId) return ["The website account changed. Restart this operation."];
  const client = await accountBoundSupabase(userId).catch(() => null);
  if (!client) return ["The website session changed. Restart this operation."];
  const locked = await draftLockWarning(draftId, userId, client);
  if (locked) return [locked];
  const removal = await client.from("addon_draft_permissions").delete().eq("addon_draft_id", draftId);
  if (removal.error) return [friendly("Replace draft records", removal.error.message)];
  if (!permissions.length) return [];
  const { error } = await client.from("addon_draft_permissions").insert(permissions.map((permission) => ({ addon_draft_id: draftId, ...permission })));
  if (error) return [friendly("Draft permissions", error.message)];
  await client.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_draft", target_id: draftId, action: "permissions_updated" });
  return [];
}

export async function calculateBrowserSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeFileName(name: string) {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "addon.elysia-addon";
}

export type WorkspacePackageProof = { snapshot: WorkspaceCapture; packageHash: string; packageId?: string };

async function matchingWorkspaceManifest(draft: AddonDraft, proof: WorkspacePackageProof): Promise<boolean> {
  try {
    const manifestText = proof.snapshot.files.find(entry => entry.path === "manifest.json")?.text;
    return Boolean(manifestText && stableJson(JSON.parse(manifestText)) === stableJson(draft.manifest_json)
      && await browserWorkspaceHash(proof.snapshot.files) === proof.snapshot.contentHash);
  } catch { return false; }
}

export async function uploadPackageMetadata(draft: AddonDraft, file: File, proof?: WorkspacePackageProof): Promise<{ packageRow: AddonPackageRow | null; scan: ForgeValidationResult[]; warnings: string[] }> {
  if (!/\.(elysia-addon|zip)$/i.test(file.name)) {
    return { packageRow: null, scan: [{ severity: "blocked", code: "unsupported_package_type", message: "Private package transfer accepts only .elysia-addon or ZIP-compatible source bundles." }], warnings: ["Package was not transferred."] };
  }
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase || draft.id.startsWith("local-")) return { packageRow: null, scan: [], warnings: [warning ?? "Save an account-backed draft before private transfer."] };
  if (draft.owner_user_id !== userId || (proof && proof.snapshot.owner.accountId !== userId)) return { packageRow: null, scan: [], warnings: ["The package belongs to a different website account."] };
  const client = await accountBoundSupabase(userId).catch(() => null);
  if (!client) return { packageRow: null, scan: [], warnings: ["The website session changed. Restart private transfer."] };
  const sha256 = await calculateBrowserSha256(file);
  if (proof && proof.packageHash !== sha256) return { packageRow: null, scan: [], warnings: ["Package bytes no longer match the reviewed workspace revision."] };
  const scan = staticSafetyScan({ fileName: file.name, fileSize: file.size, manifestText: JSON.stringify(draft.manifest_json) });
  let archiveInspection: BrowserArchiveInspectionResult | null = null;
  if (/\.(elysia-addon|zip)$/i.test(file.name)) {
    try {
      archiveInspection = await inspectArchiveFile(file);
      scan.push(...archiveInspection.errors.map((item) => ({ severity: "blocked" as const, code: `archive_${item.code}`, message: item.message, field_path: item.path, fix_suggestion: item.suggestion })));
      scan.push(...archiveInspection.warnings.map((item) => ({ severity: "warning" as const, code: `archive_${item.code}`, message: item.message, field_path: item.path, fix_suggestion: item.suggestion })));
      scan.push({ severity: archiveInspection.status === "pass" ? "info" : archiveInspection.status === "warning" ? "warning" : "blocked", code: "archive_inspection_summary", message: archiveInspection.summary });
    } catch (error) {
      if (import.meta.env.DEV) console.warn("[developer forge archive inspection]", error);
      scan.push({ severity: "blocked", code: "archive_inspection_unavailable", message: "Archive inspection could not complete. No package was transferred." });
    }
  }
  if (proof) {
    const inventory = archiveInspection?.file_inventory.filter(entry => entry.kind === "file" && entry.path !== "checksums.json") ?? [];
    if (!await matchingWorkspaceManifest(draft, proof) || inventory.length !== proof.snapshot.files.length || proof.snapshot.files.some(expected => !inventory.some(actual => actual.path === expected.path && actual.sha256 === expected.content_hash && actual.size === expected.size_bytes))) {
      scan.push({ severity: "blocked", code: "workspace_package_mismatch", message: "The actual archive files, manifest, or hashes do not match the reviewed workspace revision." });
    }
  }
  const scanStatus = scan.some((item) => item.severity === "blocked" || item.severity === "error") ? "blocked" : scan.some((item) => item.severity === "warning" || item.severity === "needs_reviewer") ? "warning" : "passed";
  if (scanStatus === "blocked") return { packageRow: null, scan, warnings: ["Blocking static/archive findings prevented private package transfer."] };
  const locked = await draftLockWarning(draft.id, userId, client);
  if (locked) return { packageRow: null, scan, warnings: [locked] };
  const storagePath = `${userId}/${draft.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const upload = await client.storage.from("addon-packages").upload(storagePath, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (upload.error) return { packageRow: null, scan, warnings: [friendly("Private package transfer", upload.error.message), "No package transfer was confirmed."] };
  const storedPath = storagePath;
  const scanSummary = archiveInspection ? `${archiveInspection.summary} Risk: ${archiveInspection.risk_level}. Files inspected: ${archiveInspection.file_inventory.length}.` : scan.map((item) => `${item.severity}: ${item.code}`).join("; ").slice(0, 500);
  const { data, error } = await client.from("addon_packages").insert({ addon_draft_id: draft.id, version: draft.version, storage_path: storedPath, file_name: file.name, file_size: file.size, sha256, scan_status: scanStatus, scan_summary: scanSummary || null, archive_inspection_json: { ...archiveInspection, ...(proof ? { workspace_receipt: { workspace_id: proof.snapshot.workspaceId, revision: proof.snapshot.revision, content_hash: proof.snapshot.contentHash, manifest_hash: proof.snapshot.files.find(entry => entry.path === "manifest.json")?.content_hash, package_hash: sha256 } } : {}) }, signature_status: "unsigned" }).select("*").single();
  if (error) return { packageRow: null, scan, warnings: [friendly("Package metadata", error.message), "Bytes reached private storage, but the package record was not confirmed. Submission was not attempted."] };
  const statusResult = await client.from("addon_drafts").update({ package_status: storedPath ? "uploaded" : "metadata_only", updated_at: new Date().toISOString() }).eq("id", draft.id).eq("owner_user_id", userId);
  const auditResult = await client.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_draft", target_id: draft.id, action: "package_scanned", metadata: { scanStatus, privateUploadStored: Boolean(storedPath) } });
  return { packageRow: data as AddonPackageRow, scan, warnings: [...(statusResult.error ? ["The package was privately stored, but draft package status could not be confirmed."] : []), ...(auditResult.error ? ["The package was privately stored, but its audit record could not be confirmed."] : [])] };
}

export async function validateAndSaveDraft(draft: AddonDraft, catalog: PermissionDefinition[]): Promise<{ results: ForgeValidationResult[]; warnings: string[] }> {
  const { results, manifest } = validateManifest(draft.manifest_json, catalog);
  const scan = staticSafetyScan({ manifestText: JSON.stringify(draft.manifest_json), declaredDomains: manifest?.security?.network_domains ?? [] }).filter((item) => item.code !== "static_scan_initial_pass");
  const allResults = [...results, ...scan];
  const warnings = await saveValidationResults(draft.id, allResults, draft.owner_user_id);
  const compatibility = checkCompatibility(manifest);
  if (supabase && draft.owner_user_id && !warnings.length && !draft.id.startsWith("local-") && compatibility.status !== "unknown") {
    const client = await accountBoundSupabase(draft.owner_user_id);
    const saved = await client.from("addon_compatibility_results").insert({ addon_draft_id: draft.id, elysia_version: manifest?.compatibility?.elysia_min_version ?? null, addon_api_version: manifest?.compatibility?.addon_api_version ?? null, status: compatibility.status, warnings: compatibility.warnings, errors: compatibility.errors });
    if (saved.error) warnings.push(friendly("Compatibility results", saved.error.message));
  }
  return { results: allResults, warnings };
}

async function createSubmissionSnapshot(input: { submissionId: string; draft: AddonDraft; userId: string; catalog: PermissionDefinition[]; proof?: WorkspacePackageProof; client: NonNullable<typeof supabase> }) {
  if (!supabase) return ["Submission snapshot unavailable: Supabase is not configured."];
  const { draft, submissionId, userId, catalog, proof, client } = input;
  const [{ data: permissions, error: permissionError }, { data: packages, error: packageError }, { data: validationRows, error: validationError }] = await Promise.all([
    client.from("addon_draft_permissions").select("permission_key,reason,scope_json,risk_acknowledged").eq("addon_draft_id", draft.id),
    proof?.packageId ? client.from("addon_packages").select("*").eq("addon_draft_id", draft.id).eq("id", proof.packageId) : Promise.resolve({ data: [], error: null }),
    client.from("addon_validation_results").select("severity,code,message,field_path,fix_suggestion").eq("addon_draft_id", draft.id).order("created_at", { ascending: false })
  ]);
  const warnings = [permissionError, packageError, validationError].map((error, index) => {
    if (!error) return null;
    return friendly(["Draft permissions", "Package metadata", "Validation results"][index], error.message);
  }).filter(Boolean) as string[];
  const latestPackage = Array.isArray(packages) ? packages[0] as AddonPackageRow | undefined : undefined;
  if (warnings.length || (proof && (!latestPackage?.storage_path || latestPackage.sha256 !== proof.packageHash))) return [...warnings, "The exact reviewed package snapshot could not be confirmed."];
  const validationSnapshot = ((validationRows ?? []) as ForgeValidationResult[]).length
    ? (validationRows ?? []) as ForgeValidationResult[]
    : validateManifest(draft.manifest_json, catalog).results;
  const scanSnapshot = [
    ...validationSnapshot.filter((result) => /scan|secret|local_path|archive|script|filesystem|package|authority/i.test(result.code)),
    ...staticSafetyScan({ manifestText: JSON.stringify(draft.manifest_json) }).filter((result) => result.code !== "static_scan_initial_pass")
  ];
  const snapshot = {
    submission_id: submissionId,
    draft_id: draft.id,
    developer_user_id: userId,
    manifest_snapshot: draft.manifest_json,
    permissions_snapshot: permissions ?? [],
    package_snapshot: latestPackage ?? {},
    validation_snapshot: validationSnapshot,
    scan_snapshot: scanSnapshot,
    marketplace_preview_snapshot: {
      addon_name: draft.addon_name,
      addon_slug: draft.addon_slug,
      summary: draft.short_summary,
      description: draft.long_description,
      version: draft.version,
      license: draft.license,
      category: draft.category,
      tags: draft.tags ?? [],
      permissions: draft.manifest_json.permissions ?? [],
      risk_level: draft.risk_level ?? "unknown",
      compatibility: checkCompatibility(draft.manifest_json),
      local_elysia_final_authority: true,
      static_scan_is_evidence_not_proof: true
    },
    package_sha256: latestPackage?.sha256 ?? null,
    package_storage_bucket: latestPackage?.storage_path ? "addon-packages" : null,
    package_storage_path: latestPackage?.storage_path ?? null,
    package_file_name: latestPackage?.file_name ?? null,
    package_size_bytes: latestPackage?.file_size ?? null,
    signature_status: latestPackage?.signature_status ?? "unsigned"
  };
  const { error } = await client.from("addon_submission_snapshots").insert(snapshot);
  if (error) warnings.push(friendly("Submission snapshot", error.message));
  else await client.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_submission", target_id: submissionId, action: "immutable_submission_snapshot_created", metadata: { package_sha256: latestPackage?.sha256 ?? null, signature_status: latestPackage?.signature_status ?? "unsigned" } });
  return warnings;
}

export async function submitDraftForReview(draft: AddonDraft, termsAccepted: boolean, catalog: PermissionDefinition[], proof?: WorkspacePackageProof): Promise<string[]> {
  if (!termsAccepted) return ["Accept the Developer Forge submission terms before submitting."];
  const { manifest, results } = validateManifest(draft.manifest_json, catalog);
  if (!manifest || blockingValidation(results)) return ["Fix blocking manifest errors before submitting for Marketplace review."];
  const compatibility = checkCompatibility(manifest);
  if (compatibility.status === "incompatible") return ["Resolve incompatible manifest/runtime settings before submitting for Marketplace review."];
  if (!draft.license || !draft.version || !draft.short_summary) return ["Draft needs version, license, and summary before submission."];
  if (draft.id.startsWith("local-")) return ["Create an account-backed draft before submitting for Marketplace review."];
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase) return [warning ?? supabaseNotConfiguredMessage];
  if (draft.owner_user_id !== userId || (proof && proof.snapshot.owner.accountId !== userId)) return ["The draft belongs to a different website account."];
  const client = await accountBoundSupabase(userId).catch(() => null);
  if (!client) return ["The website session changed. Restart submission."];
  const locked = await draftLockWarning(draft.id, userId, client);
  if (locked) return [locked];
  const { data: profile, error: profileError } = await client.from("developer_profiles").select("id,status").eq("user_id", userId).maybeSingle();
  if (profileError) return [friendly("Developer profile", profileError.message)];
  const profileStatus = (profile as { status?: string } | null)?.status;
  if (!profileStatus) return ["Create or request a Developer Forge profile before submitting add-ons for review."];
  if (["suspended", "revoked"].includes(profileStatus)) return ["This developer profile cannot submit add-ons while suspended or revoked."];
  const requiredPermissions = manifestPermissionKeys(manifest);
  if (requiredPermissions.length) {
    const { data: permissionRows, error: permissionError } = await client.from("addon_draft_permissions").select("permission_key,reason,risk_acknowledged").eq("addon_draft_id", draft.id);
    if (permissionError) return [friendly("Draft permissions", permissionError.message)];
    const permissionMap = new Map(((permissionRows ?? []) as DraftPermission[]).map((row) => [row.permission_key, row]));
    const missingReasons = requiredPermissions.filter((permission) => {
      const row = permissionMap.get(permission);
      return !row?.reason?.trim() || (catalog.find((item) => item.permission_key === permission)?.risk_level !== "low" && row.risk_acknowledged !== true);
    });
    if (missingReasons.length) return [`Save permission reasons and risk acknowledgements before submitting: ${missingReasons.join(", ")}.`];
  }
  if (proof) {
    if (!await matchingWorkspaceManifest(draft, proof)) return ["The manifest no longer matches the transferred workspace revision."];
    if (!proof.packageId) return ["Transfer this exact workspace revision privately before submission."];
    const { data: row, error } = await client.from("addon_packages").select("*").eq("addon_draft_id", draft.id).eq("id", proof.packageId).maybeSingle();
    const receipt = (row?.archive_inspection_json as { workspace_receipt?: Record<string, unknown> } | undefined)?.workspace_receipt;
    if (error || !row?.storage_path || row.sha256 !== proof.packageHash || row.scan_status === "blocked" || receipt?.content_hash !== proof.snapshot.contentHash || receipt?.revision !== proof.snapshot.revision) return ["The private package receipt does not match this workspace revision. Review and transfer the current package first."];
  } else if (["local_worker", "connector"].includes(manifest.runtime?.kind ?? "")) {
    return ["Local-worker and connector review requires an exact, privately stored workspace package."];
  }
  // Persist the exact reviewed input before the database atomically locks the
  // draft and captures publisher provenance at submission creation.
  const saveWarnings = await updateDraft({ ...draft, developer_profile_id: (profile as { id: string }).id, manifest_json: manifest });
  if (saveWarnings.length) return saveWarnings;
  const { data: submission, error: submissionError } = await client.from("addon_submissions").insert({ addon_draft_id: draft.id, submitted_by: userId, status: "pending", review_summary: draft.short_summary }).select("*").single();
  if (submissionError) return [friendly("Add-on submission", submissionError.message)];
  const submissionId = (submission as AddonSubmission).id;
  const snapshotWarnings = await createSubmissionSnapshot({ submissionId, draft: { ...draft, manifest_json: manifest }, userId, catalog, proof, client });
  if (snapshotWarnings.length) return [...snapshotWarnings, "The private submission exists and its draft is locked, but the review snapshot was not confirmed. It cannot be published without an immutable snapshot. Keep this submission for review and prepare a revision if needed."];
  const { data: reviewItem, error: reviewError } = await client.from("review_items").insert({ domain: "marketplace", source_table: "addon_submissions", source_id: submissionId, submitted_by: userId, title: draft.addon_name, summary: draft.short_summary, status: "pending_review" }).select("id").single();
  const reviewWarnings: string[] = [];
  if (!reviewError && reviewItem) {
    const reviewItemId = (reviewItem as { id: string }).id;
    const linkResult = await client.rpc("link_own_addon_submission_review_item", {
      p_submission_id: submissionId,
      p_review_item_id: reviewItemId
    });
    if (linkResult.error || linkResult.data !== true) {
      logDetail("Submission review link", linkResult.error?.message ?? "governed link returned false");
      reviewWarnings.push("The private Marketplace review item was created, but its governed submission link could not be confirmed. Administrator review must use the cross-domain review queue.");
    }
    await client.from("review_events").insert({ review_item_id: reviewItemId, actor_id: userId, event_type: "submitted", to_status: "pending_review", metadata: { visibility: "submitter_visible", source: "developer_forge" } });
  } else if (reviewError) {
    logDetail("Review item", reviewError.message);
  }
  await client.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_submission", target_id: submissionId, action: "submitted_for_review" });
  return [...snapshotWarnings, ...reviewWarnings, ...(reviewError ? ["The private submission record was created, but the cross-domain review index was unavailable. The submission is not public-listed, and administrator review must use the add-on submissions queue."] : ["Submitted to the private Developer Forge review queue. An immutable review snapshot was created; edit a revision draft for changes."])];
}
