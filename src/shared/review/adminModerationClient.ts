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
  original_filename: string;
  file_size_bytes: number | null;
  sha256: string | null;
  scan_status: string | null;
  scan_summary: string | null;
};

export type AddonSubmissionReview = {
  id: string;
  addon_draft_id: string;
  submitted_by: string;
  status: string;
  review_summary: string | null;
  reviewer_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  draft?: {
    addon_name?: string;
    addon_slug?: string;
    version?: string;
    manifest_json?: Record<string, unknown>;
    validation_status?: string;
    permission_summary?: string | null;
  } | null;
  packages?: AddonPackageMetadata[];
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
    const [{ data: drafts }, { data: packages }] = await Promise.all([
      supabase.from("addon_drafts").select("id,addon_name,addon_slug,version,manifest_json,validation_status,permission_summary").in("id", draftIds),
      supabase.from("addon_packages").select("id,addon_draft_id,original_filename,file_size_bytes,sha256,scan_status,scan_summary").in("addon_draft_id", draftIds)
    ]);
    const draftById = new Map((drafts ?? []).map((draft: { id: string }) => [draft.id, draft]));
    const packagesByDraft = new Map<string, AddonPackageMetadata[]>();
    for (const row of packages ?? []) {
      const packageRow = row as { addon_draft_id: string };
      packagesByDraft.set(packageRow.addon_draft_id, [...(packagesByDraft.get(packageRow.addon_draft_id) ?? []), row as AddonPackageMetadata]);
    }
    rows.forEach((row) => {
      row.draft = draftById.get(row.addon_draft_id) as AddonSubmissionReview["draft"];
      row.packages = packagesByDraft.get(row.addon_draft_id) ?? [];
    });
  }
  return { rows, warnings: [] };
}

export async function updateAddonSubmission(id: string, status: string, note: string) {
  if (!hasSupabaseConfig || !supabase) return supabaseNotConfiguredMessage;
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("addon_submissions").update({ status, reviewer_note: note || null, reviewed_by: auth.user?.id ?? null, reviewed_at: ["approved", "rejected", "security_hold", "published"].includes(status) ? new Date().toISOString() : null }).eq("id", id);
  if (error) return sanitize(error) ?? "Add-on submission update failed.";
  await writeAudit(`addon_submission_${status}`, "addon_submissions", id, { private_note_present: Boolean(note) });
  return "Add-on submission updated.";
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
