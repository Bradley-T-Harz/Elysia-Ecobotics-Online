
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";
import { checkCompatibility, defaultPermissionCatalog, staticSafetyScan, validateManifest, validationStatus } from "./developerForgeValidator";
import type { ForgeManifest, ForgeValidationResult, PermissionDefinition } from "./developerForgeValidator";
import { inspectArchiveFile, type BrowserArchiveInspectionResult } from "../../shared/addons/browserArchiveInspector";

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
  owner_user_id?: string;
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

const localDraftKey = "developerForge.localDrafts.v1";
const localProfileKey = "developerForge.localProfile.v1";
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
    id: `local-${Date.now()}`,
    addon_slug: normalizeSlug(manifest.addon_id?.split(".").pop() || manifest.name || "draft-addon"),
    addon_name: manifest.name || "Draft add-on",
    short_summary: manifest.description || "Local Developer Forge draft.",
    long_description: manifest.description || "",
    version: manifest.version || "0.1.0",
    license: manifest.license || "MIT",
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

function draftPayloadFromManifest(userId: string, manifest: ForgeManifest, profileId?: string | null) {
  return {
    owner_user_id: userId,
    developer_profile_id: profileId ?? null,
    addon_slug: normalizeSlug(manifest.addon_id?.split(".").pop() || manifest.name || "draft-addon"),
    addon_name: manifest.name || "Draft add-on",
    short_summary: manifest.description || "Developer Forge draft.",
    long_description: manifest.description || "",
    version: manifest.version || "0.1.0",
    license: manifest.license || "MIT",
    homepage_url: (manifest.homepage_url as string | undefined) ?? null,
    source_url: (manifest.source_url as string | undefined) ?? null,
    support_url: (manifest.support_url as string | undefined) ?? null,
    category: manifest.runtime?.kind || "static",
    tags: [],
    manifest_json: manifest,
    compatibility_targets: manifest.compatibility ?? {},
    permission_summary: (manifest.permissions ?? []).join(", "),
    updated_at: new Date().toISOString()
  };
}

export async function currentUserId() {
  if (!hasSupabaseConfig || !supabase) return { userId: null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.auth.getUser();
  if (error) return { userId: null, warning: friendly("Website Account", error.message) };
  return { userId: data.user?.id ?? null, warning: data.user ? undefined : "Sign in to use account-backed Developer Forge drafts." };
}

async function draftLockWarning(draftId: string, userId: string) {
  if (!supabase || draftId.startsWith("local-")) return null;
  const { data, error } = await supabase.from("addon_drafts").select("submission_status,review_status,locked_at").eq("id", draftId).eq("owner_user_id", userId).maybeSingle();
  if (error) return friendly("Draft lock", error.message);
  if (data && isDraftLockedForEditing(data as AddonDraft)) return "This submitted add-on draft is locked for review. Duplicate it or create a revision draft before changing files, permissions, packages, or validation data.";
  return null;
}

export async function loadForgeState(): Promise<ForgeState> {
  const warnings: string[] = [];
  if (!hasSupabaseConfig || !supabase) {
    return { signedIn: false, userId: null, profile: readLocal<DeveloperProfile | null>(localProfileKey, null), drafts: readLocal<AddonDraft[]>(localDraftKey, []), submissions: [], permissionCatalog: defaultPermissionCatalog, warnings: [supabaseNotConfiguredMessage] };
  }
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) warnings.push(friendly("Website Account", authError.message));
  if (!auth.user) return { signedIn: false, userId: null, profile: null, drafts: readLocal<AddonDraft[]>(localDraftKey, []), submissions: [], permissionCatalog: defaultPermissionCatalog, warnings };
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
    profile: (profileResult.data as DeveloperProfile | null) ?? readLocal<DeveloperProfile | null>(localProfileKey, null),
    drafts: ((draftResult.data as AddonDraft[] | null) ?? readLocal<AddonDraft[]>(localDraftKey, [])),
    submissions,
    permissionCatalog: (catalogResult.data as PermissionDefinition[] | null)?.length ? catalogResult.data as PermissionDefinition[] : defaultPermissionCatalog,
    warnings
  };
}

export async function saveDeveloperProfile(input: DeveloperProfile): Promise<{ profile: DeveloperProfile | null; warnings: string[] }> {
  const { userId, warning } = await currentUserId();
  const localProfile = { ...input, status: input.status ?? "requested" };
  if (!userId || !supabase) {
    writeLocal(localProfileKey, localProfile);
    return { profile: localProfile, warnings: [warning ?? "Saved locally in this browser. Sign in to save a developer profile."] };
  }
  const payload = { ...localProfile, user_id: userId, status: localProfile.status === "draft" ? "draft" : "requested", updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("developer_profiles").upsert(payload, { onConflict: "user_id" }).select("*").single();
  if (error) {
    writeLocal(localProfileKey, localProfile);
    return { profile: localProfile, warnings: [friendly("Developer profile", error.message)] };
  }
  return { profile: data as DeveloperProfile, warnings: [] };
}

export async function createDraftFromManifest(manifest: ForgeManifest, profileId?: string | null): Promise<{ draft: AddonDraft | null; warnings: string[] }> {
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase) {
    const draft = localDraftFromManifest(manifest);
    const drafts = [draft, ...readLocal<AddonDraft[]>(localDraftKey, [])];
    writeLocal(localDraftKey, drafts);
    return { draft, warnings: [warning ?? "Saved draft locally in this browser."] };
  }
  const { data, error } = await supabase.from("addon_drafts").insert(draftPayloadFromManifest(userId, manifest, profileId)).select("*").single();
  if (error) return { draft: null, warnings: [friendly("Add-on draft", error.message)] };
  await supabase.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_draft", target_id: (data as { id: string }).id, action: "addon_draft_created" });
  return { draft: data as AddonDraft, warnings: [] };
}

export async function updateDraft(draft: AddonDraft): Promise<string[]> {
  if (draft.id.startsWith("local-")) {
    const drafts = readLocal<AddonDraft[]>(localDraftKey, []).map((item) => item.id === draft.id ? { ...draft, updated_at: new Date().toISOString() } : item);
    writeLocal(localDraftKey, drafts);
    return ["Saved locally in this browser. Account sync is unavailable until Developer Forge tables/policies are active."];
  }
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase) return [warning ?? supabaseNotConfiguredMessage];
  const locked = await draftLockWarning(draft.id, userId);
  if (locked) return [locked];
  const payload = {
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
    permission_summary: (draft.manifest_json.permissions ?? []).join(", "),
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from("addon_drafts").update(payload).eq("id", draft.id).eq("owner_user_id", userId);
  if (error) return [friendly("Add-on draft", error.message)];
  await supabase.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_draft", target_id: draft.id, action: "addon_draft_updated" });
  return [];
}

export async function archiveDraft(draftId: string): Promise<string[]> {
  if (draftId.startsWith("local-")) {
    writeLocal(localDraftKey, readLocal<AddonDraft[]>(localDraftKey, []).filter((draft) => draft.id !== draftId));
    return ["Local draft removed from this browser."];
  }
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase) return [warning ?? supabaseNotConfiguredMessage];
  const { error } = await supabase.from("addon_drafts").update({ archived_at: new Date().toISOString(), submission_status: "archived", updated_at: new Date().toISOString() }).eq("id", draftId).eq("owner_user_id", userId);
  return error ? [friendly("Archive draft", error.message)] : [];
}

export async function duplicateDraft(draft: AddonDraft): Promise<{ draft: AddonDraft | null; warnings: string[] }> {
  const copy = { ...draft.manifest_json, addon_id: `${draft.manifest_json.addon_id || "developer.copy"}-copy`, name: `${draft.addon_name || "Draft"} Copy` };
  return createDraftFromManifest(copy, draft.developer_profile_id ?? null);
}

export async function saveValidationResults(draftId: string, results: ForgeValidationResult[]): Promise<string[]> {
  if (draftId.startsWith("local-")) return [];
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase) return [warning ?? supabaseNotConfiguredMessage];
  const locked = await draftLockWarning(draftId, userId);
  if (locked) return [locked];
  const status = validationStatus(results);
  await supabase.from("addon_validation_results").delete().eq("addon_draft_id", draftId);
  if (results.length) {
    const { error } = await supabase.from("addon_validation_results").insert(results.map((result) => ({ addon_draft_id: draftId, ...result })));
    if (error) return [friendly("Validation results", error.message)];
  }
  const { error: draftError } = await supabase.from("addon_drafts").update({ validation_status: status, submission_status: ["blocked", "errors"].includes(status) ? "draft" : "ready_to_submit", updated_at: new Date().toISOString() }).eq("id", draftId).eq("owner_user_id", userId);
  if (draftError) return [friendly("Validation status", draftError.message)];
  await supabase.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_draft", target_id: draftId, action: "manifest_validated", metadata: { status } });
  return [];
}

export async function saveDraftPermissions(draftId: string, permissions: DraftPermission[]): Promise<string[]> {
  if (draftId.startsWith("local-")) return [];
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase) return [warning ?? supabaseNotConfiguredMessage];
  const locked = await draftLockWarning(draftId, userId);
  if (locked) return [locked];
  await supabase.from("addon_draft_permissions").delete().eq("addon_draft_id", draftId);
  if (!permissions.length) return [];
  const { error } = await supabase.from("addon_draft_permissions").insert(permissions.map((permission) => ({ addon_draft_id: draftId, ...permission })));
  if (error) return [friendly("Draft permissions", error.message)];
  await supabase.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_draft", target_id: draftId, action: "permissions_updated" });
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

export async function uploadPackageMetadata(draft: AddonDraft, file: File): Promise<{ packageRow: AddonPackageRow | null; scan: ForgeValidationResult[]; warnings: string[] }> {
  if (!/\.(elysia-addon|zip)$/i.test(file.name)) {
    return { packageRow: null, scan: [{ severity: "blocked", code: "unsupported_package_type", message: "Private package transfer accepts only .elysia-addon or ZIP-compatible source bundles." }], warnings: ["Package was not transferred."] };
  }
  const sha256 = await calculateBrowserSha256(file);
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
      scan.push({ severity: "warning", code: "archive_inspection_unavailable", message: "Archive inspection could not complete in this browser. Reviewers should inspect with the local CLI." });
    }
  }
  const scanStatus = scan.some((item) => item.severity === "blocked" || item.severity === "error") ? "blocked" : scan.some((item) => item.severity === "warning" || item.severity === "needs_reviewer") ? "warning" : "passed";
  if (scanStatus === "blocked") return { packageRow: null, scan, warnings: ["Blocking static/archive findings prevented private package transfer."] };
  if (draft.id.startsWith("local-")) return { packageRow: null, scan, warnings: ["Package scan ran locally. Sign in and save an account-backed draft before uploading private package metadata."] };
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase) return { packageRow: null, scan, warnings: [warning ?? supabaseNotConfiguredMessage] };
  const locked = await draftLockWarning(draft.id, userId);
  if (locked) return { packageRow: null, scan, warnings: [locked] };
  const storagePath = `${userId}/${draft.id}/${Date.now()}-${safeFileName(file.name)}`;
  let storedPath: string | null = null;
  const upload = await supabase.storage.from("addon-packages").upload(storagePath, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (upload.error) logDetail("Package private upload", upload.error.message); else storedPath = storagePath;
  const scanSummary = archiveInspection ? `${archiveInspection.summary} Risk: ${archiveInspection.risk_level}. Files inspected: ${archiveInspection.file_inventory.length}.` : scan.map((item) => `${item.severity}: ${item.code}`).join("; ").slice(0, 500);
  const { data, error } = await supabase.from("addon_packages").insert({ addon_draft_id: draft.id, version: draft.version, storage_path: storedPath, file_name: file.name, file_size: file.size, sha256, scan_status: scanStatus, scan_summary: scanSummary || null, archive_inspection_json: archiveInspection ?? {}, signature_status: "unsigned" }).select("*").single();
  if (error) return { packageRow: null, scan, warnings: [friendly("Package metadata", error.message)] };
  await supabase.from("addon_drafts").update({ package_status: storedPath ? "uploaded" : "metadata_only", updated_at: new Date().toISOString() }).eq("id", draft.id).eq("owner_user_id", userId);
  await supabase.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_draft", target_id: draft.id, action: "package_scanned", metadata: { scanStatus, privateUploadStored: Boolean(storedPath) } });
  return { packageRow: data as AddonPackageRow, scan, warnings: storedPath ? [] : ["Private package storage was unavailable. Package metadata was saved, but no package was transferred and no public URL was created."] };
}

export async function validateAndSaveDraft(draft: AddonDraft, catalog: PermissionDefinition[]): Promise<{ results: ForgeValidationResult[]; warnings: string[] }> {
  const { results, manifest } = validateManifest(draft.manifest_json, catalog);
  const scan = staticSafetyScan({ manifestText: JSON.stringify(draft.manifest_json), declaredDomains: manifest?.security?.network_domains ?? [] }).filter((item) => item.code !== "static_scan_initial_pass");
  const allResults = [...results, ...scan];
  const warnings = await saveValidationResults(draft.id, allResults);
  const compatibility = checkCompatibility(manifest);
  if (supabase && !draft.id.startsWith("local-") && compatibility.status !== "unknown") {
    await supabase.from("addon_compatibility_results").insert({ addon_draft_id: draft.id, elysia_version: manifest?.compatibility?.elysia_min_version ?? null, addon_api_version: manifest?.compatibility?.addon_api_version ?? null, status: compatibility.status, warnings: compatibility.warnings, errors: compatibility.errors });
  }
  return { results: allResults, warnings };
}

async function createSubmissionSnapshot(input: { submissionId: string; draft: AddonDraft; userId: string; catalog: PermissionDefinition[] }) {
  if (!supabase) return ["Submission snapshot unavailable: Supabase is not configured."];
  const { draft, submissionId, userId, catalog } = input;
  const [{ data: permissions, error: permissionError }, { data: packages, error: packageError }, { data: validationRows, error: validationError }] = await Promise.all([
    supabase.from("addon_draft_permissions").select("permission_key,reason,scope_json,risk_acknowledged").eq("addon_draft_id", draft.id),
    supabase.from("addon_packages").select("*").eq("addon_draft_id", draft.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("addon_validation_results").select("severity,code,message,field_path,fix_suggestion").eq("addon_draft_id", draft.id).order("created_at", { ascending: false })
  ]);
  const warnings = [permissionError, packageError, validationError].map((error, index) => {
    if (!error) return null;
    return friendly(["Draft permissions", "Package metadata", "Validation results"][index], error.message);
  }).filter(Boolean) as string[];
  const latestPackage = Array.isArray(packages) ? packages[0] as AddonPackageRow | undefined : undefined;
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
  const { error } = await supabase.from("addon_submission_snapshots").insert(snapshot);
  if (error) warnings.push(friendly("Submission snapshot", error.message));
  else await supabase.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_submission", target_id: submissionId, action: "immutable_submission_snapshot_created", metadata: { package_sha256: latestPackage?.sha256 ?? null, signature_status: latestPackage?.signature_status ?? "unsigned" } });
  return warnings;
}

export async function submitDraftForReview(draft: AddonDraft, termsAccepted: boolean, catalog: PermissionDefinition[]): Promise<string[]> {
  if (!termsAccepted) return ["Accept the Developer Forge submission terms before submitting."];
  const { manifest, results } = validateManifest(draft.manifest_json, catalog);
  if (!manifest || blockingValidation(results)) return ["Fix blocking manifest errors before submitting for Marketplace review."];
  const compatibility = checkCompatibility(manifest);
  if (compatibility.status === "incompatible") return ["Resolve incompatible manifest/runtime settings before submitting for Marketplace review."];
  if (!draft.license || !draft.version || !draft.short_summary) return ["Draft needs version, license, and summary before submission."];
  if (draft.id.startsWith("local-")) return ["Create an account-backed draft before submitting for Marketplace review."];
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase) return [warning ?? supabaseNotConfiguredMessage];
  const locked = await draftLockWarning(draft.id, userId);
  if (locked) return [locked];
  const { data: profile, error: profileError } = await supabase.from("developer_profiles").select("id,status").eq("user_id", userId).maybeSingle();
  if (profileError) return [friendly("Developer profile", profileError.message)];
  const profileStatus = (profile as { status?: string } | null)?.status;
  if (!profileStatus) return ["Create or request a Developer Forge profile before submitting add-ons for review."];
  if (["suspended", "revoked"].includes(profileStatus)) return ["This developer profile cannot submit add-ons while suspended or revoked."];
  const requiredPermissions = manifest.permissions ?? [];
  if (requiredPermissions.length) {
    const { data: permissionRows, error: permissionError } = await supabase.from("addon_draft_permissions").select("permission_key,reason,risk_acknowledged").eq("addon_draft_id", draft.id);
    if (permissionError) return [friendly("Draft permissions", permissionError.message)];
    const permissionMap = new Map(((permissionRows ?? []) as DraftPermission[]).map((row) => [row.permission_key, row]));
    const missingReasons = requiredPermissions.filter((permission) => {
      const row = permissionMap.get(permission);
      return !row?.reason?.trim() || (catalog.find((item) => item.permission_key === permission)?.risk_level !== "low" && row.risk_acknowledged !== true);
    });
    if (missingReasons.length) return [`Save permission reasons and risk acknowledgements before submitting: ${missingReasons.join(", ")}.`];
  }
  if (["local_worker", "connector"].includes(manifest.runtime?.kind ?? "")) {
    const { data: packages, error: packageError } = await supabase.from("addon_packages").select("id,scan_status").eq("addon_draft_id", draft.id).order("created_at", { ascending: false }).limit(1);
    if (packageError) return [friendly("Package metadata", packageError.message)];
    if (!packages?.length) return ["Prepare package metadata/static scan before submitting local worker or connector add-ons."];
    if ((packages[0] as AddonPackageRow).scan_status === "blocked") return ["Package static scan is blocked. Remove the flagged material before submitting."];
  }
  const { data: submission, error: submissionError } = await supabase.from("addon_submissions").insert({ addon_draft_id: draft.id, submitted_by: userId, status: "pending", review_summary: draft.short_summary }).select("*").single();
  if (submissionError) return [friendly("Add-on submission", submissionError.message)];
  const submissionId = (submission as AddonSubmission).id;
  const snapshotWarnings = await createSubmissionSnapshot({ submissionId, draft: { ...draft, manifest_json: manifest }, userId, catalog });
  const { data: reviewItem, error: reviewError } = await supabase.from("review_items").insert({ domain: "marketplace", source_table: "addon_submissions", source_id: submissionId, submitted_by: userId, title: draft.addon_name, summary: draft.short_summary, status: "pending_review" }).select("id").single();
  if (!reviewError && reviewItem) {
    const reviewItemId = (reviewItem as { id: string }).id;
    await supabase.from("addon_submissions").update({ review_item_id: reviewItemId }).eq("id", submissionId).eq("submitted_by", userId);
    await supabase.from("review_events").insert({ review_item_id: reviewItemId, actor_id: userId, event_type: "submitted", to_status: "pending_review", metadata: { visibility: "submitter_visible", source: "developer_forge" } });
  } else if (reviewError) {
    logDetail("Review item", reviewError.message);
  }
  await supabase.from("addon_drafts").update({ submission_status: "submitted", review_status: "pending", source_submission_id: submissionId, locked_at: new Date().toISOString(), locked_reason: "submitted_for_marketplace_review", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", draft.id).eq("owner_user_id", userId);
  await supabase.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_submission", target_id: submissionId, action: "submitted_for_review" });
  return [...snapshotWarnings, ...(reviewError ? ["The private submission record was created, but the cross-domain review index was unavailable. The submission is not public-listed, and administrator review must use the add-on submissions queue."] : ["Submitted to the private Developer Forge review queue. An immutable review snapshot was created; edit a revision draft for changes."])];
}
