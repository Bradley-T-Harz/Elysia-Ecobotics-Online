
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";
import { checkCompatibility, defaultPermissionCatalog, staticSafetyScan, validateManifest, validationStatus } from "./developerForgeValidator";
import type { ForgeManifest, ForgeValidationResult, PermissionDefinition } from "./developerForgeValidator";

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
  return {
    signedIn: true,
    userId,
    profile: (profileResult.data as DeveloperProfile | null) ?? readLocal<DeveloperProfile | null>(localProfileKey, null),
    drafts: ((draftResult.data as AddonDraft[] | null) ?? readLocal<AddonDraft[]>(localDraftKey, [])),
    submissions: (submissionResult.data as AddonSubmission[] | null) ?? [],
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
  const status = validationStatus(results);
  await supabase.from("addon_validation_results").delete().eq("addon_draft_id", draftId);
  if (results.length) {
    const { error } = await supabase.from("addon_validation_results").insert(results.map((result) => ({ addon_draft_id: draftId, ...result })));
    if (error) return [friendly("Validation results", error.message)];
  }
  const { error: draftError } = await supabase.from("addon_drafts").update({ validation_status: status, submission_status: status === "errors" ? "draft" : "ready_to_submit", updated_at: new Date().toISOString() }).eq("id", draftId).eq("owner_user_id", userId);
  if (draftError) return [friendly("Validation status", draftError.message)];
  await supabase.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_draft", target_id: draftId, action: "manifest_validated", metadata: { status } });
  return [];
}

export async function saveDraftPermissions(draftId: string, permissions: DraftPermission[]): Promise<string[]> {
  if (draftId.startsWith("local-")) return [];
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase) return [warning ?? supabaseNotConfiguredMessage];
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
  const sha256 = await calculateBrowserSha256(file);
  const scan = staticSafetyScan({ fileName: file.name, fileSize: file.size, manifestText: JSON.stringify(draft.manifest_json) });
  const scanStatus = scan.some((item) => item.severity === "error") ? "blocked" : scan.some((item) => item.severity === "warning") ? "warning" : "passed";
  if (draft.id.startsWith("local-")) return { packageRow: null, scan, warnings: ["Package scan ran locally. Sign in and save an account-backed draft before uploading private package metadata."] };
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase) return { packageRow: null, scan, warnings: [warning ?? supabaseNotConfiguredMessage] };
  const storagePath = `${userId}/${draft.id}/${Date.now()}-${safeFileName(file.name)}`;
  let storedPath: string | null = null;
  const upload = await supabase.storage.from("addon-packages").upload(storagePath, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (upload.error) logDetail("Package private upload", upload.error.message); else storedPath = storagePath;
  const { data, error } = await supabase.from("addon_packages").insert({ addon_draft_id: draft.id, version: draft.version, storage_path: storedPath, file_name: file.name, file_size: file.size, sha256, scan_status: scanStatus, signature_status: "unsigned" }).select("*").single();
  if (error) return { packageRow: null, scan, warnings: [friendly("Package metadata", error.message)] };
  await supabase.from("addon_drafts").update({ package_status: storedPath ? "uploaded" : "metadata_only", updated_at: new Date().toISOString() }).eq("id", draft.id).eq("owner_user_id", userId);
  await supabase.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_draft", target_id: draft.id, action: "package_scanned", metadata: { scanStatus, privateUploadStored: Boolean(storedPath) } });
  return { packageRow: data as AddonPackageRow, scan, warnings: storedPath ? [] : ["Package metadata was saved, but private package storage is not active yet. No public URL was created."] };
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

export async function submitDraftForReview(draft: AddonDraft, termsAccepted: boolean, catalog: PermissionDefinition[]): Promise<string[]> {
  if (!termsAccepted) return ["Accept the Developer Forge submission terms before submitting."];
  const { manifest, results } = validateManifest(draft.manifest_json, catalog);
  if (!manifest || results.some((result) => result.severity === "error")) return ["Fix blocking manifest errors before submitting for Marketplace review."];
  if (!draft.license || !draft.version || !draft.short_summary) return ["Draft needs version, license, and summary before submission."];
  if (draft.id.startsWith("local-")) return ["Create an account-backed draft before submitting for Marketplace review."];
  const { userId, warning } = await currentUserId();
  if (!userId || !supabase) return [warning ?? supabaseNotConfiguredMessage];
  const { data: submission, error: submissionError } = await supabase.from("addon_submissions").insert({ addon_draft_id: draft.id, submitted_by: userId, status: "pending", review_summary: draft.short_summary }).select("*").single();
  if (submissionError) return [friendly("Add-on submission", submissionError.message)];
  const submissionId = (submission as AddonSubmission).id;
  const { data: reviewItem, error: reviewError } = await supabase.from("review_items").insert({ domain: "marketplace", source_table: "addon_submissions", source_id: submissionId, submitted_by: userId, title: draft.addon_name, summary: draft.short_summary, status: "pending_review" }).select("id").single();
  if (!reviewError && reviewItem) {
    const reviewItemId = (reviewItem as { id: string }).id;
    await supabase.from("addon_submissions").update({ review_item_id: reviewItemId }).eq("id", submissionId).eq("submitted_by", userId);
    await supabase.from("review_events").insert({ review_item_id: reviewItemId, actor_id: userId, event_type: "submitted", to_status: "pending_review", metadata: { visibility: "submitter_visible", source: "developer_forge" } });
  } else if (reviewError) {
    logDetail("Review item", reviewError.message);
  }
  await supabase.from("addon_drafts").update({ submission_status: "submitted", review_status: "pending", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", draft.id).eq("owner_user_id", userId);
  await supabase.from("addon_audit_log").insert({ actor_user_id: userId, target_type: "addon_submission", target_id: submissionId, action: "submitted_for_review" });
  return reviewError ? ["Submitted to the private Developer Forge submission queue. Marketplace review item creation is not active yet."] : [];
}
