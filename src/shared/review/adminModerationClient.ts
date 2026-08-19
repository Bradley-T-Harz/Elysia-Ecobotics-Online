import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../../pages/The-Elysia-Marketplace/lib/supabase";

export const visibilityStates = ["draft", "submitted", "published", "flagged", "hidden", "removed", "archived", "revoked"] as const;
export type VisibilityState = typeof visibilityStates[number];
export type ReportStatus = "submitted" | "under_review" | "action_taken" | "dismissed" | "archived";
export type DeveloperStatus = "draft" | "requested" | "active" | "trusted" | "suspended" | "revoked";

export type ContentReport = {
  id: string;
  reporter_user_id: string | null;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  reviewer_note: string | null;
  created_at: string;
  updated_at: string;
};

export type DeveloperProfileReview = {
  id: string;
  user_id: string;
  developer_slug: string;
  display_name: string;
  bio: string | null;
  website_url: string | null;
  github_url: string | null;
  support_url: string | null;
  contact_email: string | null;
  status: DeveloperStatus;
  private_review_note: string | null;
  created_at: string;
  updated_at: string;
};

export type AddonPackageMetadata = {
  id: string;
  addon_draft_id: string;
  version: string | null;
  storage_path: string | null;
  file_name: string | null;
  original_filename?: string | null;
  file_size: number | null;
  file_size_bytes: number | null;
  sha256: string | null;
  scan_status: string | null;
  scan_summary: string | null;
  archive_inspection_json?: {
    status?: string;
    risk_level?: string;
    summary?: string;
    file_inventory?: Array<{ path: string; kind?: string; size?: number; scanned_as_text?: boolean }>;
    errors?: Array<{ code?: string; message?: string; path?: string }>;
    warnings?: Array<{ code?: string; message?: string; path?: string }>;
    manifest_summary?: { addon_id?: string; name?: string; version?: string; runtime_kind?: string; permissions?: string[] } | null;
  } | Record<string, unknown> | null;
  signature_status: string | null;
  created_at?: string | null;
};

export type AddonDraftPermissionReview = {
  id: string;
  addon_draft_id: string;
  permission_key: string;
  reason: string | null;
  scope_json: Record<string, unknown> | null;
  risk_acknowledged: boolean;
};

export type AddonValidationResultReview = {
  id: string;
  addon_draft_id: string;
  severity: "blocked" | "error" | "warning" | "needs_reviewer" | "info";
  code: string;
  message: string;
  field_path: string | null;
};

export type AddonSubmissionSnapshotReview = {
  id: string;
  submission_id: string;
  draft_id: string | null;
  developer_user_id: string | null;
  manifest_snapshot: Record<string, unknown>;
  permissions_snapshot: AddonDraftPermissionReview[] | Record<string, unknown>[];
  package_snapshot: AddonPackageMetadata | Record<string, unknown>;
  validation_snapshot: Array<{ severity?: string; code?: string; message?: string; field_path?: string | null }>;
  scan_snapshot: Array<{ severity?: string; code?: string; message?: string; field_path?: string | null }>;
  marketplace_preview_snapshot: Record<string, unknown>;
  package_sha256: string | null;
  package_storage_bucket: string | null;
  package_storage_path: string | null;
  package_file_name: string | null;
  package_size_bytes: number | null;
  signature_status: string | null;
  created_at: string;
};

export type AddonCompatibilityResultReview = {
  id: string;
  addon_draft_id: string;
  addon_package_id: string | null;
  elysia_version: string | null;
  addon_api_version: string | null;
  os: string | null;
  status: "compatible" | "warning" | "incompatible" | "unknown";
  warnings: string[];
  errors: string[];
};

export type MarketplacePublicationEvent = {
  id: string;
  listing_id: string | null;
  addon_version_id: string | null;
  actor_user_id: string | null;
  action: string;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type MarketplaceVersionReview = {
  id: string;
  listing_id: string;
  version: string;
  package_sha256: string | null;
  package_size: number | null;
  signature_status: string;
  compatibility_status: string | null;
  review_status: string | null;
  published_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
};

export type MarketplaceListingReview = {
  id: string;
  addon_id: string;
  source_submission_id: string | null;
  name: string;
  slug: string;
  listing_status: string;
  current_version: string | null;
  risk_level: string | null;
  permission_summary: string | null;
  compatibility_summary: string | null;
  published_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
};

export type AddonSubmissionReview = {
  id: string;
  addon_draft_id: string;
  submitted_by: string;
  status: string;
  review_item_id?: string | null;
  review_summary: string | null;
  reviewer_note: string | null;
  reviewer_feedback?: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  published_at?: string | null;
  draft?: {
    id?: string;
    owner_user_id?: string;
    developer_profile_id?: string | null;
    addon_name?: string;
    addon_slug?: string;
    short_summary?: string | null;
    long_description?: string | null;
    version?: string;
    license?: string | null;
    homepage_url?: string | null;
    source_url?: string | null;
    support_url?: string | null;
    category?: string | null;
    tags?: string[] | null;
    icon_path?: string | null;
    manifest_json?: Record<string, unknown>;
    validation_status?: string;
    permission_summary?: string | null;
    risk_level?: string | null;
    package_status?: string | null;
    review_status?: string | null;
  } | null;
  developer?: DeveloperProfileReview | null;
  packages?: AddonPackageMetadata[];
  permissions?: AddonDraftPermissionReview[];
  validationResults?: AddonValidationResultReview[];
  compatibilityResults?: AddonCompatibilityResultReview[];
  snapshot?: AddonSubmissionSnapshotReview | null;
  listing?: MarketplaceListingReview | null;
  versions?: MarketplaceVersionReview[];
  publicationEvents?: MarketplacePublicationEvent[];
};

export type LibrarySourceSubmission = {
  id: string;
  submitted_by: string | null;
  title: string;
  official_url: string | null;
  category: string | null;
  notes: string | null;
  license_notes: string | null;
  privacy_notes: string | null;
  status: VisibilityState;
  reviewer_note: string | null;
  created_at: string;
};

export type WorkRoleSubmission = {
  id: string;
  submitted_by: string | null;
  role_type: string;
  display_name: string | null;
  contact_email: string | null;
  summary: string | null;
  status: VisibilityState;
  reviewer_note: string | null;
  created_at: string;
};

export type AdminAuditRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

function sanitize(error?: { message?: string } | null) {
  if (!error?.message) return undefined;
  if (import.meta.env.DEV) console.warn("[admin moderation]", error.message);
  if (/schema cache|Could not find the table|does not exist/i.test(error.message)) return "This admin queue is not active until the latest Supabase migration is applied.";
  if (/permission denied|row-level security|RLS/i.test(error.message)) return "Your current account cannot access this admin queue.";
  return "This admin queue is temporarily unavailable.";
}

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function writeAudit(action: string, targetType: string, targetId: string | null, metadata: Record<string, unknown> = {}) {
  if (!hasSupabaseConfig || !supabase) return;
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase.from("admin_audit_log").insert({ actor_user_id: userId, action, target_type: targetType, target_id: targetId, metadata });
  if (error && import.meta.env.DEV) console.warn("[admin audit]", error.message);
}

async function writeReviewEvent(reviewItemId: string | null | undefined, eventType: string, fromStatus: string | null, toStatus: string | null, note: string | null, metadata: Record<string, unknown> = {}) {
  if (!hasSupabaseConfig || !supabase || !reviewItemId) return;
  const userId = await currentUserId();
  const { error } = await supabase.from("review_events").insert({
    review_item_id: reviewItemId,
    actor_id: userId,
    event_type: eventType,
    from_status: fromStatus,
    to_status: toStatus,
    note,
    metadata: { visibility: "internal", ...metadata }
  });
  if (error && import.meta.env.DEV) console.warn("[review event]", error.message);
}

async function writePublicationEvent(input: { listingId?: string | null; versionId?: string | null; action: string; note?: string | null; metadata?: Record<string, unknown> }) {
  if (!hasSupabaseConfig || !supabase) return;
  const userId = await currentUserId();
  const { error } = await supabase.from("marketplace_publication_events").insert({
    listing_id: input.listingId ?? null,
    addon_version_id: input.versionId ?? null,
    actor_user_id: userId,
    action: input.action,
    note: input.note ?? null,
    metadata: input.metadata ?? {}
  });
  if (error && import.meta.env.DEV) console.warn("[marketplace publication event]", error.message);
}

function manifestValue(manifest: Record<string, unknown> | undefined | null, key: string) {
  const value = manifest?.[key];
  return typeof value === "string" ? value : undefined;
}

function marketplaceVersionFromDraft(draft: AddonSubmissionReview["draft"]) {
  return draft?.version || manifestValue(draft?.manifest_json, "version") || "0.1.0";
}

function packageFileName(pkg: AddonPackageMetadata) {
  return pkg.file_name || pkg.original_filename || "unnamed package";
}

function packageSize(pkg: AddonPackageMetadata) {
  return pkg.file_size ?? pkg.file_size_bytes ?? null;
}

function publicationActionForSubmissionStatus(status: string) {
  if (["approved", "published", "rejected", "security_hold"].includes(status)) return status;
  if (status === "changes_requested") return "changes_requested";
  return null;
}

function reviewItemStatusForAddonSubmission(status: string) {
  if (status === "pending") return "pending_review";
  if (status === "changes_requested") return "needs_information";
  if (status === "security_hold") return "in_review";
  if (status === "published") return "approved";
  return status;
}

function addonDraftStatusForSubmission(status: string) {
  return status === "pending" ? { submission_status: "submitted", review_status: "pending" } : { submission_status: status, review_status: status };
}

export async function loadAdminSummary(): Promise<{ counts: Record<string, number>; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { counts: {}, warnings: [supabaseNotConfiguredMessage] };
  const counts: Record<string, number> = {};
  const warnings: string[] = [];
  const probes = [
    ["openReports", supabase.from("content_reports").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"])],
    ["addonReviews", supabase.from("addon_submissions").select("id", { count: "exact", head: true }).in("status", ["pending", "changes_requested", "security_hold"])],
    ["developerRequests", supabase.from("developer_profiles").select("id", { count: "exact", head: true }).eq("status", "requested")],
    ["librarySources", supabase.from("library_source_submissions").select("id", { count: "exact", head: true }).eq("status", "submitted")],
    ["workSubmissions", supabase.from("work_role_submissions").select("id", { count: "exact", head: true }).eq("status", "submitted")],
    ["reviewItems", supabase.from("review_items").select("id", { count: "exact", head: true }).in("status", ["pending_review", "in_review", "needs_information"])]
  ] as const;
  for (const [key, query] of probes) {
    const { count, error } = await query;
    if (error) warnings.push(sanitize(error) ?? "Summary unavailable.");
    else counts[key] = count ?? 0;
  }
  return { counts, warnings: [...new Set(warnings)] };
}

export async function loadContentReports(): Promise<{ rows: ContentReport[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { rows: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("content_reports").select("*").order("created_at", { ascending: false }).limit(200);
  return { rows: (data ?? []) as ContentReport[], warnings: error ? [sanitize(error) ?? "Reports unavailable."] : [] };
}

export async function updateContentReport(id: string, status: ReportStatus, reviewerNote: string) {
  if (!hasSupabaseConfig || !supabase) return supabaseNotConfiguredMessage;
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("content_reports").update({ status, reviewer_note: reviewerNote || null, reviewed_by: auth.user?.id ?? null, resolved_at: ["action_taken", "dismissed", "archived"].includes(status) ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return sanitize(error) ?? "Report update failed.";
  await writeAudit(`content_report_${status}`, "content_reports", id);
  return "Report updated.";
}

export async function loadDeveloperProfiles(): Promise<{ rows: DeveloperProfileReview[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { rows: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("developer_profiles").select("*").order("updated_at", { ascending: false }).limit(200);
  return { rows: (data ?? []) as DeveloperProfileReview[], warnings: error ? [sanitize(error) ?? "Developer profiles unavailable."] : [] };
}

export async function updateDeveloperProfileStatus(id: string, status: DeveloperStatus, note: string) {
  if (!hasSupabaseConfig || !supabase) return supabaseNotConfiguredMessage;
  const { error } = await supabase.from("developer_profiles").update({ status, private_review_note: note || null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return sanitize(error) ?? "Developer profile update failed.";
  await writeAudit(`developer_profile_${status}`, "developer_profiles", id, { private_note_present: Boolean(note) });
  return "Developer profile updated.";
}

export async function loadAddonSubmissions(): Promise<{ rows: AddonSubmissionReview[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { rows: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("addon_submissions").select("*").order("submitted_at", { ascending: false }).limit(100);
  if (error) return { rows: [], warnings: [sanitize(error) ?? "Add-on submissions unavailable."] };
  const rows = (data ?? []) as AddonSubmissionReview[];
  const draftIds = rows.map((row) => row.addon_draft_id).filter(Boolean);
  if (draftIds.length) {
    const warnings: string[] = [];
    const [{ data: drafts, error: draftError }, { data: packages, error: packageError }, { data: permissions, error: permissionError }, { data: validation, error: validationError }, { data: compatibility, error: compatibilityError }, { data: snapshots, error: snapshotError }] = await Promise.all([
      supabase.from("addon_drafts").select("id,owner_user_id,developer_profile_id,addon_name,addon_slug,short_summary,long_description,version,license,homepage_url,source_url,support_url,category,tags,icon_path,manifest_json,validation_status,permission_summary,risk_level,package_status,review_status").in("id", draftIds),
      supabase.from("addon_packages").select("id,addon_draft_id,version,storage_path,file_name,file_size,sha256,scan_status,scan_summary,archive_inspection_json,signature_status,created_at").in("addon_draft_id", draftIds).order("created_at", { ascending: false }),
      supabase.from("addon_draft_permissions").select("id,addon_draft_id,permission_key,reason,scope_json,risk_acknowledged").in("addon_draft_id", draftIds),
      supabase.from("addon_validation_results").select("id,addon_draft_id,severity,code,message,field_path").in("addon_draft_id", draftIds).order("created_at", { ascending: false }),
      supabase.from("addon_compatibility_results").select("id,addon_draft_id,addon_package_id,elysia_version,addon_api_version,os,status,warnings,errors").in("addon_draft_id", draftIds).order("created_at", { ascending: false }),
      supabase.from("addon_submission_snapshots").select("*").in("submission_id", rows.map((row) => row.id)).order("created_at", { ascending: false })
    ]);
    [draftError, packageError, permissionError, validationError, compatibilityError, snapshotError].forEach((loadError) => {
      const message = sanitize(loadError);
      if (message) warnings.push(message);
    });
    const draftById = new Map((drafts ?? []).map((draft: { id: string }) => [draft.id, draft]));
    const profileIds = [...new Set((drafts ?? []).map((draft) => (draft as { developer_profile_id?: string | null }).developer_profile_id).filter(Boolean))] as string[];
    const { data: developers, error: developerError } = profileIds.length
      ? await supabase.from("developer_profiles").select("*").in("id", profileIds)
      : { data: [], error: null };
    const developerMessage = sanitize(developerError);
    if (developerMessage) warnings.push(developerMessage);
    const developerById = new Map((developers ?? []).map((profile: { id: string }) => [profile.id, profile]));

    const packagesByDraft = new Map<string, AddonPackageMetadata[]>();
    for (const row of packages ?? []) {
      const packageRow = row as { addon_draft_id: string };
      packagesByDraft.set(packageRow.addon_draft_id, [...(packagesByDraft.get(packageRow.addon_draft_id) ?? []), row as AddonPackageMetadata]);
    }
    const permissionsByDraft = new Map<string, AddonDraftPermissionReview[]>();
    for (const row of permissions ?? []) {
      const permissionRow = row as AddonDraftPermissionReview;
      permissionsByDraft.set(permissionRow.addon_draft_id, [...(permissionsByDraft.get(permissionRow.addon_draft_id) ?? []), permissionRow]);
    }
    const validationByDraft = new Map<string, AddonValidationResultReview[]>();
    for (const row of validation ?? []) {
      const validationRow = row as AddonValidationResultReview;
      validationByDraft.set(validationRow.addon_draft_id, [...(validationByDraft.get(validationRow.addon_draft_id) ?? []), validationRow]);
    }
    const compatibilityByDraft = new Map<string, AddonCompatibilityResultReview[]>();
    for (const row of compatibility ?? []) {
      const compatibilityRow = row as AddonCompatibilityResultReview;
      compatibilityByDraft.set(compatibilityRow.addon_draft_id, [...(compatibilityByDraft.get(compatibilityRow.addon_draft_id) ?? []), compatibilityRow]);
    }
    const snapshotBySubmission = new Map<string, AddonSubmissionSnapshotReview>();
    for (const row of snapshots ?? []) {
      const snapshotRow = row as AddonSubmissionSnapshotReview;
      if (!snapshotBySubmission.has(snapshotRow.submission_id)) snapshotBySubmission.set(snapshotRow.submission_id, snapshotRow);
    }

    const { data: listings, error: listingError } = await supabase
      .from("marketplace_listings")
      .select("id,addon_id,source_submission_id,name,slug,listing_status,current_version,risk_level,permission_summary,compatibility_summary,published_at,revoked_at,revocation_reason")
      .in("source_submission_id", rows.map((row) => row.id));
    const listingMessage = sanitize(listingError);
    if (listingMessage) warnings.push(listingMessage);
    const listingBySubmission = new Map((listings ?? []).map((listing: { source_submission_id: string }) => [listing.source_submission_id, listing]));
    const listingIds = (listings ?? []).map((listing) => (listing as { id: string }).id);
    const [{ data: versions, error: versionError }, { data: events, error: eventError }] = listingIds.length
      ? await Promise.all([
        supabase.from("marketplace_addon_versions").select("id,listing_id,version,package_sha256,package_size,signature_status,compatibility_status,review_status,published_at,revoked_at,revocation_reason").in("listing_id", listingIds).order("created_at", { ascending: false }),
        supabase.from("marketplace_publication_events").select("*").in("listing_id", listingIds).order("created_at", { ascending: false }).limit(200)
      ])
      : [{ data: [], error: null }, { data: [], error: null }];
    [versionError, eventError].forEach((loadError) => {
      const message = sanitize(loadError);
      if (message) warnings.push(message);
    });
    const versionsByListing = new Map<string, MarketplaceVersionReview[]>();
    for (const row of versions ?? []) {
      const versionRow = row as MarketplaceVersionReview;
      versionsByListing.set(versionRow.listing_id, [...(versionsByListing.get(versionRow.listing_id) ?? []), versionRow]);
    }
    const eventsByListing = new Map<string, MarketplacePublicationEvent[]>();
    for (const row of events ?? []) {
      const eventRow = row as MarketplacePublicationEvent;
      if (!eventRow.listing_id) continue;
      eventsByListing.set(eventRow.listing_id, [...(eventsByListing.get(eventRow.listing_id) ?? []), eventRow]);
    }

    rows.forEach((row) => {
      row.draft = draftById.get(row.addon_draft_id) as AddonSubmissionReview["draft"];
      row.developer = row.draft?.developer_profile_id ? developerById.get(row.draft.developer_profile_id) as DeveloperProfileReview | undefined ?? null : null;
      row.packages = packagesByDraft.get(row.addon_draft_id) ?? [];
      row.permissions = permissionsByDraft.get(row.addon_draft_id) ?? [];
      row.validationResults = validationByDraft.get(row.addon_draft_id) ?? [];
      row.compatibilityResults = compatibilityByDraft.get(row.addon_draft_id) ?? [];
      row.snapshot = snapshotBySubmission.get(row.id) ?? null;
      row.listing = listingBySubmission.get(row.id) as MarketplaceListingReview | undefined ?? null;
      row.versions = row.listing ? versionsByListing.get(row.listing.id) ?? [] : [];
      row.publicationEvents = row.listing ? eventsByListing.get(row.listing.id) ?? [] : [];
    });
    return { rows, warnings: [...new Set(warnings)] };
  }
  return { rows, warnings: [] };
}

export async function updateAddonSubmission(id: string, status: string, developerFeedback: string, privateNote = "") {
  if (!hasSupabaseConfig || !supabase) return supabaseNotConfiguredMessage;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "Sign in with a reviewer account first.";
  const { data: existing, error: existingError } = await supabase.from("addon_submissions").select("addon_draft_id,submitted_by,status,review_item_id").eq("id", id).maybeSingle();
  if (existingError) return sanitize(existingError) ?? "Add-on submission lookup failed.";
  if ((existing as { submitted_by?: string } | null)?.submitted_by === auth.user.id) return "Reviewers cannot review, approve, reject, or hold their own add-on submissions.";
  const now = new Date().toISOString();
  const reviewedAt = ["approved", "rejected", "withdrawn", "published"].includes(status) ? now : null;
  const { error } = await supabase.from("addon_submissions").update({ status, reviewer_feedback: developerFeedback || null, updated_at: now }).eq("id", id);
  if (error) return sanitize(error) ?? "Add-on submission update failed.";
  const source = existing as { addon_draft_id?: string; status?: string; review_item_id?: string | null } | null;
  if (source?.review_item_id) {
    const { error: reviewItemError } = await supabase.from("review_items").update({
      status: reviewItemStatusForAddonSubmission(status),
      reviewed_by: auth.user.id,
      reviewed_at: reviewedAt,
      updated_at: now
    }).eq("id", source.review_item_id).eq("domain", "marketplace");
    if (reviewItemError) return sanitize(reviewItemError) ?? "Marketplace review queue update failed.";
  }
  const draftId = source?.addon_draft_id;
  if (draftId) {
    const draftState = addonDraftStatusForSubmission(status);
    const { error: draftError } = await supabase.from("addon_drafts").update({ ...draftState, updated_at: now, ...(status === "published" ? { published_at: now } : {}) }).eq("id", draftId);
    if (draftError) return sanitize(draftError) ?? "Developer Forge draft review state update failed.";
  }
  await writeReviewEvent(source?.review_item_id, "status_changed", source?.status ?? null, status, privateNote || null, { developer_feedback_present: Boolean(developerFeedback) });
  const publicationAction = publicationActionForSubmissionStatus(status);
  if (publicationAction) await writePublicationEvent({ action: publicationAction, note: privateNote || null, metadata: { addon_submission_id: id, developer_feedback_present: Boolean(developerFeedback) } });
  await writeAudit(`addon_submission_${status}`, "addon_submissions", id, { private_note_present: Boolean(privateNote), developer_feedback_present: Boolean(developerFeedback) });
  return "Add-on submission updated.";
}

export async function publishAddonSubmission(id: string, privateNote = "") {
  if (!hasSupabaseConfig || !supabase) return supabaseNotConfiguredMessage;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "Sign in with a reviewer account first.";
  const { data: submission, error: submissionError } = await supabase.from("addon_submissions").select("*").eq("id", id).maybeSingle();
  if (submissionError || !submission) return sanitize(submissionError) ?? "Add-on submission lookup failed.";
  const submissionRow = submission as AddonSubmissionReview;
  if (submissionRow.submitted_by === auth.user.id) return "Reviewers cannot publish their own add-on submissions.";
  if (!['approved', 'published'].includes(submissionRow.status)) return "Approve this submission before publishing it to Marketplace.";

  const { data: draft, error: draftError } = await supabase.from("addon_drafts").select("*").eq("id", submissionRow.addon_draft_id).maybeSingle();
  if (draftError || !draft) return sanitize(draftError) ?? "Add-on draft lookup failed.";
  const draftRow = draft as NonNullable<AddonSubmissionReview["draft"]>;
  const { data: snapshot, error: snapshotError } = await supabase.from("addon_submission_snapshots").select("*").eq("submission_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (snapshotError) return sanitize(snapshotError) ?? "Submission snapshot unavailable.";
  const snapshotRow = snapshot as AddonSubmissionSnapshotReview | null;
  const { data: validationRows, error: validationError } = await supabase.from("addon_validation_results").select("severity,code,message").eq("addon_draft_id", submissionRow.addon_draft_id);
  if (validationError) return sanitize(validationError) ?? "Validation results unavailable.";
  const validationSource = snapshotRow?.validation_snapshot?.length ? snapshotRow.validation_snapshot : validationRows ?? [];
  if (validationSource.some((row) => ["blocked", "error"].includes((row as { severity?: string }).severity ?? "")) || ["blocked", "errors"].includes(draftRow.validation_status ?? "")) return "Resolve blocking validation errors before publication.";
  const { data: packages, error: packageError } = await supabase.from("addon_packages").select("*").eq("addon_draft_id", submissionRow.addon_draft_id).order("created_at", { ascending: false }).limit(1);
  if (packageError) return sanitize(packageError) ?? "Package metadata unavailable.";
  const latestPackage = Array.isArray(packages) ? packages[0] as AddonPackageMetadata | undefined : undefined;
  const packageSnapshot = snapshotRow?.package_snapshot as AddonPackageMetadata | null | undefined;
  if (latestPackage?.scan_status === "blocked" || packageSnapshot?.scan_status === "blocked" || snapshotRow?.scan_snapshot?.some((row) => ["blocked", "error"].includes(row.severity ?? ""))) return "Blocked package scans cannot be published.";

  const manifest = snapshotRow?.manifest_snapshot ?? draftRow.manifest_json ?? {};
  const slug = draftRow.addon_slug || manifestValue(manifest, "addon_id") || manifestValue(manifest, "id");
  if (!slug) return "Marketplace publication requires a stable add-on slug or manifest id.";
  const version = snapshotRow ? (manifestValue(snapshotRow.manifest_snapshot, "version") || marketplaceVersionFromDraft(draftRow)) : marketplaceVersionFromDraft(draftRow);
  const now = new Date().toISOString();
  const { data: listing, error: listingError } = await supabase.from("marketplace_listings").upsert({
    addon_id: slug,
    developer_profile_id: draftRow.developer_profile_id ?? null,
    source_submission_id: id,
    name: draftRow.addon_name || manifestValue(manifest, "name") || slug,
    slug,
    summary: (snapshotRow?.marketplace_preview_snapshot?.summary as string | undefined) ?? draftRow.short_summary ?? manifestValue(manifest, "summary") ?? null,
    description: (snapshotRow?.marketplace_preview_snapshot?.description as string | undefined) ?? draftRow.long_description ?? manifestValue(manifest, "description") ?? null,
    category: draftRow.category ?? null,
    tags: draftRow.tags ?? [],
    icon_url: draftRow.icon_path ?? null,
    current_version: version,
    listing_status: "published",
    risk_level: draftRow.risk_level ?? "unknown",
    permission_summary: draftRow.permission_summary ?? null,
    compatibility_summary: "Compatibility is advisory. Local Elysia remains final authority.",
    published_at: now,
    revoked_at: null,
    revocation_reason: null,
    updated_at: now
  }, { onConflict: "addon_id" }).select("id").single();
  if (listingError || !listing) return sanitize(listingError) ?? "Marketplace listing publication failed.";
  const listingId = (listing as { id: string }).id;
  const packageSizeValue = snapshotRow?.package_size_bytes ?? (latestPackage ? packageSize(latestPackage) : null);
  const reviewedPackageId = packageSnapshot?.id ?? latestPackage?.id ?? null;
  const { data: versionRow, error: versionError } = await supabase.from("marketplace_addon_versions").upsert({
    listing_id: listingId,
    version,
    manifest_json: manifest,
    package_id: reviewedPackageId,
    package_sha256: snapshotRow?.package_sha256 ?? latestPackage?.sha256 ?? null,
    package_size: packageSizeValue,
    signature_status: snapshotRow?.signature_status ?? latestPackage?.signature_status ?? "unsigned",
    compatibility_status: "unknown",
    review_status: "published",
    published_at: now,
    revoked_at: null,
    revocation_reason: null,
    updated_at: now
  }, { onConflict: "listing_id,version" }).select("id").single();
  if (versionError || !versionRow) return sanitize(versionError) ?? "Marketplace version publication failed.";
  const versionId = (versionRow as { id: string }).id;
  await supabase.from("addon_submissions").update({ status: "published", updated_at: now }).eq("id", id);
  if (submissionRow.review_item_id) await supabase.from("review_items").update({ status: "approved", reviewed_by: auth.user.id, reviewed_at: now, updated_at: now }).eq("id", submissionRow.review_item_id).eq("domain", "marketplace");
  await supabase.from("addon_drafts").update({ submission_status: "published", review_status: "published", published_at: now, updated_at: now }).eq("id", submissionRow.addon_draft_id);
  await writeReviewEvent(submissionRow.review_item_id, "marketplace_published", submissionRow.status, "approved", privateNote || null, { listing_id: listingId, addon_version_id: versionId });
  await writePublicationEvent({ listingId, versionId, action: "published", note: privateNote || null, metadata: { addon_submission_id: id, snapshot_id: snapshotRow?.id ?? null, package_sha256: snapshotRow?.package_sha256 ?? latestPackage?.sha256 ?? null, signature_status: snapshotRow?.signature_status ?? latestPackage?.signature_status ?? "unsigned" } });
  await writeAudit("marketplace_listing_published", "marketplace_listings", listingId, { addon_submission_id: id, addon_version_id: versionId, snapshot_id: snapshotRow?.id ?? null, private_note_present: Boolean(privateNote) });
  return "Submission published to Marketplace. This does not install or enable anything locally.";
}

export async function revokeMarketplacePublication(input: { listingId: string; versionId?: string | null; reason: string; publicNotice: string; severity: string; privateNote?: string }) {
  if (!hasSupabaseConfig || !supabase) return supabaseNotConfiguredMessage;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "Sign in with a reviewer account first.";
  if (!input.reason.trim() || !input.publicNotice.trim()) return "Revocation requires a reason and public notice.";
  const { data: listing, error: listingError } = await supabase.from("marketplace_listings").select("id,source_submission_id,slug,current_version").eq("id", input.listingId).maybeSingle();
  if (listingError || !listing) return sanitize(listingError) ?? "Marketplace listing lookup failed.";
  const listingRow = listing as MarketplaceListingReview;
  if (listingRow.source_submission_id) {
    const { data: submission } = await supabase.from("addon_submissions").select("submitted_by").eq("id", listingRow.source_submission_id).maybeSingle();
    if ((submission as { submitted_by?: string } | null)?.submitted_by === auth.user.id) return "Reviewers cannot revoke their own Marketplace submissions.";
  }
  const now = new Date().toISOString();
  if (input.versionId) {
    const { error } = await supabase.from("marketplace_addon_versions").update({ revoked_at: now, revocation_reason: input.reason, review_status: "revoked", updated_at: now }).eq("id", input.versionId).eq("listing_id", input.listingId);
    if (error) return sanitize(error) ?? "Marketplace version revocation failed.";
  } else {
    const { error } = await supabase.from("marketplace_listings").update({ listing_status: "revoked", revoked_at: now, revocation_reason: input.reason, updated_at: now }).eq("id", input.listingId);
    if (error) return sanitize(error) ?? "Marketplace listing revocation failed.";
  }
  const { error: revocationError } = await supabase.from("marketplace_revocations").insert({
    listing_id: input.listingId,
    marketplace_addon_version_id: input.versionId ?? null,
    revoked_by_user: auth.user.id,
    reason: input.reason,
    public_notice: input.publicNotice,
    severity: input.severity || "warning",
    is_active: true,
    revoked_at: now,
    created_at: now
  });
  if (revocationError) return sanitize(revocationError) ?? "Revocation was applied, but the public revocation notice failed.";
  await writePublicationEvent({ listingId: input.listingId, versionId: input.versionId ?? null, action: "revoked", note: input.privateNote || null, metadata: { reason: input.reason, public_notice_present: true, severity: input.severity } });
  await writeAudit("marketplace_listing_revoked", "marketplace_listings", input.listingId, { addon_version_id: input.versionId ?? null, reason: input.reason, private_note_present: Boolean(input.privateNote) });
  return input.versionId ? "Marketplace version revoked. Install intents are blocked for the revoked version." : "Marketplace listing revoked. Install intents are blocked for the listing.";
}

export async function loadLibrarySourceSubmissions(): Promise<{ rows: LibrarySourceSubmission[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { rows: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("library_source_submissions").select("*").order("created_at", { ascending: false }).limit(200);
  return { rows: (data ?? []) as LibrarySourceSubmission[], warnings: error ? [sanitize(error) ?? "Library source submissions unavailable."] : [] };
}

export async function updateLibrarySourceSubmission(id: string, status: VisibilityState, note: string) {
  if (!hasSupabaseConfig || !supabase) return supabaseNotConfiguredMessage;
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("library_source_submissions").update({ status, reviewer_note: note || null, reviewed_by: auth.user?.id ?? null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return sanitize(error) ?? "Library source update failed.";
  await writeAudit(`library_source_${status}`, "library_source_submissions", id);
  return "Library source submission updated.";
}

export async function loadWorkRoleSubmissions(): Promise<{ rows: WorkRoleSubmission[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { rows: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("work_role_submissions").select("*").order("created_at", { ascending: false }).limit(200);
  return { rows: (data ?? []) as WorkRoleSubmission[], warnings: error ? [sanitize(error) ?? "Work/role submissions unavailable."] : [] };
}

export async function updateWorkRoleSubmission(id: string, status: VisibilityState, note: string) {
  if (!hasSupabaseConfig || !supabase) return supabaseNotConfiguredMessage;
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("work_role_submissions").update({ status, reviewer_note: note || null, reviewed_by: auth.user?.id ?? null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return sanitize(error) ?? "Work/role submission update failed.";
  await writeAudit(`work_role_${status}`, "work_role_submissions", id, { private_note_present: Boolean(note) });
  return "Work/role submission updated.";
}

export async function loadAdminAuditLog(): Promise<{ rows: AdminAuditRow[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { rows: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(200);
  return { rows: (data ?? []) as AdminAuditRow[], warnings: error ? [sanitize(error) ?? "Admin audit log unavailable."] : [] };
}
