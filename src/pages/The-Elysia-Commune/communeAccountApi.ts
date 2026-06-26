import { createReviewHistoryItem, createReviewItem, loadCurrentRoleState, type AppRole } from "../../shared/review/reviewClient";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";
import type { SandboxRunResult } from "./codeDiagnosticTypes";
import { communeFallbackCategories, communeReportReasons, parseCommuneTags, scanCommuneTextForSecrets, validateCommuneMediaFile } from "./communeSafety";

export type CommunePostType = "media_garden" | "troubleshooting" | "code_sharing" | "repository_showcase" | "community_network" | "job_post" | "official_update" | "research_note" | "elysia_iteration_showcase";
export type CommunePostStatus = "draft" | "pending_review" | "in_review" | "needs_information" | "approved" | "published" | "rejected" | "hidden" | "archived" | "deleted_by_user" | "removed_by_moderator";
export type CommuneRoom = { id: string; slug: string; name: string; description?: string | null; room_type: string; requires_moderation: boolean };
export type CommunePost = { id: string; user_id?: string; author_username?: string | null; post_type: CommunePostType; title: string; body: string; excerpt?: string | null; tags?: string[] | null; links?: string[] | null; repository_url?: string | null; status: CommunePostStatus; visibility: string; published_at?: string | null; last_activity_at?: string | null; created_at?: string | null };
export type CommuneThread = { id: string; post_id?: string | null; room_id?: string | null; title: string; status: string; visibility: string; last_reply_at?: string | null };
export type CommuneComment = { id: string; thread_id: string; post_id?: string | null; parent_comment_id?: string | null; user_id?: string; author_username?: string | null; body: string; status: string; created_at?: string | null; published_at?: string | null };
export type CommuneMediaAttachment = { id: string; post_id: string; file_name: string; mime_type?: string | null; file_size?: number | null; media_kind: "image" | "document" | "code_text" | "archive" | "other"; visibility_state: string; storage_bucket?: string | null; storage_path?: string | null; signed_url?: string | null; created_at?: string | null };
export type OfficialUpdateType = "release_note" | "roadmap_update" | "governance_update" | "security_notice" | "maintenance_notice" | "incident_update" | "community_notice" | "developer_notice" | "marketplace_notice" | "policy_update" | "migration_notice" | "official_statement";
export type OfficialUpdateStatus = "draft" | "published" | "updated" | "corrected" | "retracted" | "archived" | "resolved" | "monitoring";
export type OfficialUpdateSeverity = "info" | "notice" | "important" | "urgent" | "critical";
export type OfficialCorrectionStatus = "none" | "corrected" | "retracted" | "superseded";
export type TroubleshootingIssueType = "bug" | "install_issue" | "account_auth" | "deployment" | "supabase_rls" | "cloudflare" | "frontend_ui" | "backend_api" | "sandbox_runner" | "marketplace" | "commune" | "profile" | "documentation" | "other";
export type TroubleshootingStatus = "open" | "needs_information" | "in_progress" | "workaround_found" | "fix_proposed" | "resolved" | "closed" | "archived";
export type TroubleshootingResolutionKind = "comment" | "proposal" | "workaround" | "admin_resolution" | "manual_note";
export type TroubleshootingMetadata = {
  id: string;
  post_id: string;
  thread_id?: string | null;
  author_user_id?: string | null;
  issue_type: TroubleshootingIssueType;
  affected_area?: string | null;
  environment_os?: string | null;
  environment_browser?: string | null;
  app_version?: string | null;
  environment_notes?: string | null;
  steps_to_reproduce?: string | null;
  expected_result?: string | null;
  actual_result?: string | null;
  error_message?: string | null;
  redacted_logs?: string | null;
  workaround?: string | null;
  troubleshooting_status: TroubleshootingStatus;
  accepted_comment_id?: string | null;
  accepted_proposal_id?: string | null;
  accepted_resolution_kind?: TroubleshootingResolutionKind | null;
  accepted_summary?: string | null;
  accepted_by?: string | null;
  accepted_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type OfficialUpdateMetadata = {
  id: string;
  post_id: string;
  admin_user_id?: string | null;
  brand_author_name: string;
  update_type: OfficialUpdateType;
  official_status: OfficialUpdateStatus;
  severity: OfficialUpdateSeverity;
  audience?: string | null;
  summary?: string | null;
  effective_date?: string | null;
  release_version?: string | null;
  affected_systems?: string[] | null;
  related_room_slug?: string | null;
  related_repo_url?: string | null;
  related_migration?: string | null;
  related_links?: Array<{ label?: string; url: string }> | null;
  known_limitations?: string | null;
  migration_required?: boolean | null;
  user_action_required?: string | null;
  pinned?: boolean | null;
  important?: boolean | null;
  comments_enabled?: boolean | null;
  correction_note?: string | null;
  correction_status?: OfficialCorrectionStatus | null;
  supersedes_update_id?: string | null;
  superseded_by_update_id?: string | null;
  published_at?: string | null;
  corrected_at?: string | null;
  retracted_at?: string | null;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type OfficialUpdateCodeSnippet = {
  id: string;
  official_update_id: string;
  post_id: string;
  admin_user_id?: string | null;
  language: string;
  file_name?: string | null;
  code_text: string;
  context_note?: string | null;
  correction_note?: string | null;
  sort_order?: number | null;
  public_visible?: boolean | null;
  edited_by?: string | null;
  edited_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type RepositoryShowcaseMetadata = {
  id: string;
  user_id?: string | null;
  post_id?: string | null;
  repository_url: string;
  repository_host?: string | null;
  project_name?: string | null;
  project_summary?: string | null;
  provider?: string | null;
  default_branch?: string | null;
  commit_sha?: string | null;
  license?: string | null;
  manifest_status?: string | null;
  elysia_compatibility?: string | null;
  short_description?: string | null;
  readme_preview?: string | null;
  file_tree_preview?: string | null;
  screenshot_notes_or_urls?: string | null;
  risk_flags?: string[] | null;
  sandbox_review_requested?: boolean | null;
  sandbox_review_status?: string | null;
  sandbox_review_request_id?: string | null;
  status?: string | null;
  import_source?: string | null;
  imported_metadata?: Record<string, unknown> | null;
  imported_at?: string | null;
  redaction_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type ElysiaIterationShowcaseMetadata = {
  id: string;
  post_id?: string | null;
  author_user_id?: string | null;
  iteration_type?: string | null;
  version_build_label?: string | null;
  what_changed?: string | null;
  why_it_matters?: string | null;
  known_limitations?: string | null;
  next_step?: string | null;
  related_repo_url?: string | null;
  provider?: string | null;
  branch?: string | null;
  commit_sha?: string | null;
  release_tag?: string | null;
  pull_request_url?: string | null;
  developer_forge_link?: string | null;
  marketplace_link?: string | null;
  testing_status?: string | null;
  compatibility_note?: string | null;
  sandbox_review_requested?: boolean | null;
  sandbox_review_status?: string | null;
  sandbox_review_request_id?: string | null;
  risk_flags?: string[] | null;
  import_source?: string | null;
  imported_metadata?: Record<string, unknown> | null;
  imported_at?: string | null;
  redaction_notes?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type CommuneModerationItem = { id: string; kind: "post" | "comment" | "upload" | "repo" | "iteration" | "sandbox" | "report"; title: string; status: string; created_at?: string | null; summary?: string | null };
export type CommuneAccountState = { signedIn: boolean; userId: string | null; username: string | null; roles: AppRole[]; isAdmin: boolean; isModerator: boolean; warnings: string[] };
export type LoadCommuneData = { rooms: CommuneRoom[]; posts: CommunePost[]; comments: CommuneComment[]; threads: CommuneThread[]; media: CommuneMediaAttachment[]; troubleshootingPosts: TroubleshootingMetadata[]; repositoryShowcases: RepositoryShowcaseMetadata[]; iterationShowcases: ElysiaIterationShowcaseMetadata[]; officialUpdates: OfficialUpdateMetadata[]; officialCodeSnippets: OfficialUpdateCodeSnippet[]; savedPostIds: string[]; followedThreadIds: string[]; account: CommuneAccountState; warnings: string[] };
export type CommuneCategory = { id: string; slug: string; title: string; description?: string | null; sort_order?: number | null; is_active?: boolean | null };
export type CommuneCodeSnippet = {
  id: string;
  post_id: string;
  author_user_id: string;
  language?: string | null;
  file_name?: string | null;
  code_text: string;
  secret_scan_status?: string | null;
  sandbox_warning_acknowledged?: boolean | null;
  accepted_revision_id?: string | null;
  accepted_version_number?: number | null;
  accepted_revision_proposer_user_id?: string | null;
  accepted_revision_summary?: string | null;
  accepted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type CommuneReactionTargetType = "post" | "comment";
export type CommuneReaction = "helpful" | "caution";
export type CommuneReactionSummary = { helpful: number; caution: number; viewerReaction: CommuneReaction | null };
export type CommuneReactionTarget = { targetType: CommuneReactionTargetType; targetId: string };
export type SubmitCommentStatus = "published" | "pending_review" | "failed" | "missing_thread" | "backend_unavailable";
export type SubmitCommentResult = { ok: boolean; status: SubmitCommentStatus; message: string; commentId?: string };

export const postTypeOptions: { value: CommunePostType; label: string }[] = [
  { value: "media_garden", label: "Media Garden" },
  { value: "troubleshooting", label: "Troubleshooting Grove" },
  { value: "code_sharing", label: "Coding Cornucopia" },
  { value: "repository_showcase", label: "Repository Showcase" },
  { value: "community_network", label: "Community Network" },
  { value: "job_post", label: "Job Post" },
  { value: "official_update", label: "Official Update" },
  { value: "research_note", label: "Research Note" },
  { value: "elysia_iteration_showcase", label: "Elysia Iteration Showcase" }
];

export const reportTypes = [...communeReportReasons];

const canonicalCommuneTables = {
  posts: "commune_posts",
  comments: "commune_comments",
  threads: "commune_threads",
  rooms: "commune_rooms",
  savedPosts: "user_saved_commune_posts",
  followedThreads: "user_followed_commune_threads",
  troubleshootingPosts: "commune_troubleshooting_posts",
  repositoryShowcases: "commune_repository_showcases",
  iterationShowcases: "commune_iteration_showcases",
  officialUpdates: "commune_official_updates",
  officialCodeSnippets: "commune_official_update_code_snippets",
  officialEvents: "commune_official_update_events",
  sandboxReviews: "commune_sandbox_review_requests",
  reports: "commune_reports",
  media: "commune_media",
  legacyUploads: "commune_uploads",
  legacyReports: "commune_abuse_reports"
} as const;

function fallback<T>(data: T, warning = supabaseNotConfiguredMessage) { return { data, warnings: [warning] }; }
function splitList(value: string) { return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean); }
function excerpt(value: string) { return value.replace(/\s+/g, " ").trim().slice(0, 220); }
function publicHttpUrlOrNull(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    const privateHost = host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|0\.0\.0\.0$|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
    return ["http:", "https:"].includes(url.protocol) && !privateHost ? url.href : null;
  } catch {
    return null;
  }
}
function isModerator(roles: AppRole[], isAdmin: boolean) { return isAdmin || roles.some((role) => ["administrator", "moderator", "commune_moderator", "guardian_reviewer"].includes(role)); }
function roomSlugCandidates(roomSlug?: string) {
  if (!roomSlug) return [];
  if (roomSlug === "coding-cornucopia" || roomSlug === "code-sharing") return ["coding-cornucopia", "code-sharing"];
  return [roomSlug];
}

async function accountState(): Promise<CommuneAccountState> {
  const roleState = await loadCurrentRoleState();
  if (!hasSupabaseConfig || !supabase || !roleState.signedIn || !roleState.userId) return { signedIn: roleState.signedIn, userId: roleState.userId, username: null, roles: roleState.roles, isAdmin: roleState.isAdmin, isModerator: isModerator(roleState.roles, roleState.isAdmin), warnings: roleState.warnings };
  const { data, error } = await supabase.from("profiles").select("username").eq("id", roleState.userId).maybeSingle();
  return { signedIn: true, userId: roleState.userId, username: (data as { username?: string } | null)?.username ?? null, roles: roleState.roles, isAdmin: roleState.isAdmin, isModerator: isModerator(roleState.roles, roleState.isAdmin), warnings: error ? [...roleState.warnings, error.message] : roleState.warnings };
}

function friendlyError(message: string, fallbackMessage: string) {
  if (import.meta.env.DEV) console.warn("[Commune backend]", message);
  if (/commune_content_reactions|commune_content_reaction_counts/i.test(message)) return "Commune community signals are not active yet. Apply `2026_06_21_commune_content_reactions.sql` in Supabase, then try again.";
  if (/record_commune_sandbox_run_result|commune_sandbox_runs|commune_code_diagnostics/i.test(message)) return "Coding Cornucopia sandbox result recording is not active until the latest Supabase migration is applied.";
  if (/commune_troubleshooting_posts/i.test(message)) return "Troubleshooting Grove structured metadata is not active until `2026_06_26_troubleshooting_grove_structured_workflow.sql` is applied in Supabase.";
  if (/commune_official_updates|commune_official_update_code_snippets|commune_official_update_events/i.test(message)) return "Official Update structured metadata is not active until `2026_06_26_official_update_structured_workflow.sql` is applied in Supabase.";
  if (/commune_thread_participant_approvals/i.test(message)) return "Commune thread participation approvals are not active yet. Apply `2026_06_21_commune_thread_participant_approvals.sql` in Supabase, then try again.";
  if (/commune_comments/i.test(message) && /author_username|published_at|updated_at|hidden_at|hidden_by|moderation_reason|schema cache|Could not find|does not exist|relation/i.test(message)) return "Comment could not be saved because the live comments table is missing a required column. Apply `2026_06_22_commune_comments_schema_drift_repair.sql` in Supabase, then refresh and try again.";
  if (/user_notifications|user_followed_commune_threads|notify_commune_published_comment|commune_notify_published_comment|muted/i.test(message)) return "Comment could not be saved because the published-comment notification dependency is missing or drifted. Apply `2026_06_22_commune_comment_notification_dependency_repair.sql` in Supabase, then refresh and try again.";
  if (/parent_comment_id/i.test(message)) return "Commune replies are not active yet because the live comments table is missing `parent_comment_id`. Apply the Commune comments/replies migration in Supabase.";
  if (/schema cache|Could not find|does not exist|relation/i.test(message)) return fallbackMessage;
  if (/permission denied|row-level security|violates row-level security/i.test(message)) {
    if (/room post|attachment|upload|media|storage/i.test(fallbackMessage)) return fallbackMessage;
    return "This Commune action is blocked by the current database policy. If you are signed in, apply the latest Commune comment/reply RLS migration or ask an administrator to review the thread.";
  }
  return message;
}

export function communeReactionKey(targetType: CommuneReactionTargetType, targetId: string) {
  return `${targetType}:${targetId}`;
}

async function hasThreadParticipationApproval(input: { threadId: string; postId: string; userId: string; isModerator: boolean }) {
  if (!supabase) return false;
  if (input.isModerator) return true;
  const { data: post } = await supabase.from(canonicalCommuneTables.posts).select("user_id,status,visibility").eq("id", input.postId).maybeSingle();
  if ((post as { user_id?: string; status?: string; visibility?: string } | null)?.user_id === input.userId && (post as { status?: string; visibility?: string } | null)?.status === "published" && (post as { visibility?: string } | null)?.visibility === "public") {
    await grantPostAuthorParticipationApproval({ threadId: input.threadId, postId: input.postId, userId: input.userId });
    return true;
  }
  const { data, error } = await supabase.from("commune_thread_participant_approvals").select("id").eq("thread_id", input.threadId).eq("user_id", input.userId).eq("status", "approved").is("revoked_at", null).maybeSingle();
  if (error && import.meta.env.DEV) console.warn("[Commune participant approval]", error.message);
  return Boolean(data);
}

async function grantPostAuthorParticipationApproval(input: { threadId?: string | null; postId?: string | null; userId?: string | null }) {
  if (!supabase || !input.threadId || !input.postId || !input.userId) return;
  const { error } = await supabase.from("commune_thread_participant_approvals").insert({
    thread_id: input.threadId,
    post_id: input.postId,
    user_id: input.userId,
    approved_by: input.userId,
    approval_source: "approved_post_author",
    status: "approved",
    reason: "Post author may participate in their approved public thread."
  });
  if (error && !/duplicate key|23505/i.test(`${error.code ?? ""} ${error.message}`) && import.meta.env.DEV) console.warn("[Commune post author approval repair]", error.message);
}

async function grantThreadParticipationApproval(input: { threadId?: string | null; postId?: string | null; userId?: string | null; approvedBy: string; firstCommentId?: string | null; source: string }) {
  if (!supabase || !input.threadId || !input.userId) return;
  const { error } = await supabase.from("commune_thread_participant_approvals").upsert({
    thread_id: input.threadId,
    post_id: input.postId ?? null,
    user_id: input.userId,
    approved_by: input.approvedBy,
    first_comment_id: input.firstCommentId ?? null,
    approval_source: input.source,
    status: "approved",
    revoked_at: null,
    updated_at: new Date().toISOString()
  }, { onConflict: "thread_id,user_id" });
  if (error && import.meta.env.DEV) console.warn("[Commune participant approval grant]", error.message);
}

async function recordCommuneGovernanceEvent(input: { actorId: string; targetType: string; targetId: string; action: string; fromStatus?: string | null; toStatus?: string | null; metadata?: Record<string, unknown> }) {
  if (!supabase) return;
  const { error } = await supabase.from("commune_moderation_events").insert({
    actor_id: input.actorId,
    target_type: input.targetType,
    target_id: input.targetId,
    action: input.action,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    metadata: { source: "admin_direct_publish", ...(input.metadata ?? {}) }
  });
  if (error && import.meta.env.DEV) console.warn("[Commune governance event]", error.message);
}

async function publishPostAttachments(postId: string) {
  if (!supabase) return;
  const { error } = await supabase
    .from(canonicalCommuneTables.media)
    .update({ visibility_state: "published", updated_at: new Date().toISOString() })
    .eq("post_id", postId)
    .in("visibility_state", ["submitted", "flagged"]);
  if (error && import.meta.env.DEV) console.warn("[Commune media publish]", error.message);
  await supabase
    .from(canonicalCommuneTables.legacyUploads)
    .update({ status: "published" })
    .eq("post_id", postId)
    .in("status", ["pending_review", "approved"]);
}

const repositoryShowcaseSelect = "id,user_id,post_id,repository_url,repository_host,project_name,project_summary,provider,default_branch,commit_sha,license,manifest_status,elysia_compatibility,short_description,readme_preview,file_tree_preview,screenshot_notes_or_urls,risk_flags,sandbox_review_requested,sandbox_review_status,sandbox_review_request_id,status,import_source,imported_metadata,imported_at,redaction_notes,created_at,updated_at";
const repositoryShowcaseFallbackSelect = "id,user_id,post_id,repository_url,repository_host,project_name,project_summary,license,sandbox_review_requested,status,created_at,updated_at";
const troubleshootingSelect = "id,post_id,thread_id,author_user_id,issue_type,affected_area,environment_os,environment_browser,app_version,environment_notes,steps_to_reproduce,expected_result,actual_result,error_message,redacted_logs,workaround,troubleshooting_status,accepted_comment_id,accepted_proposal_id,accepted_resolution_kind,accepted_summary,accepted_by,accepted_at,resolved_at,closed_at,archived_at,created_at,updated_at";
const iterationShowcaseSelect = "id,post_id,author_user_id,iteration_type,version_build_label,what_changed,why_it_matters,known_limitations,next_step,related_repo_url,provider,branch,commit_sha,release_tag,pull_request_url,developer_forge_link,marketplace_link,testing_status,compatibility_note,sandbox_review_requested,sandbox_review_status,sandbox_review_request_id,risk_flags,import_source,imported_metadata,imported_at,redaction_notes,status,created_at,updated_at";
const iterationShowcaseFallbackSelect = "id,post_id,author_user_id,iteration_type,version_build_label,what_changed,why_it_matters,known_limitations,next_step,sandbox_review_requested,status,created_at,updated_at";
const officialUpdateSelect = "id,post_id,admin_user_id,brand_author_name,update_type,official_status,severity,audience,summary,effective_date,release_version,affected_systems,related_room_slug,related_repo_url,related_migration,related_links,known_limitations,migration_required,user_action_required,pinned,important,comments_enabled,correction_note,correction_status,supersedes_update_id,superseded_by_update_id,published_at,corrected_at,retracted_at,archived_at,created_at,updated_at";
const officialCodeSelect = "id,official_update_id,post_id,admin_user_id,language,file_name,code_text,context_note,correction_note,sort_order,public_visible,edited_by,edited_at,created_at,updated_at";

const troubleshootingIssueTypes: TroubleshootingIssueType[] = ["bug", "install_issue", "account_auth", "deployment", "supabase_rls", "cloudflare", "frontend_ui", "backend_api", "sandbox_runner", "marketplace", "commune", "profile", "documentation", "other"];
const troubleshootingStatuses: TroubleshootingStatus[] = ["open", "needs_information", "in_progress", "workaround_found", "fix_proposed", "resolved", "closed", "archived"];
const troubleshootingResolutionKinds: TroubleshootingResolutionKind[] = ["comment", "proposal", "workaround", "admin_resolution", "manual_note"];

function normalizeTroubleshootingIssueType(value?: string | null): TroubleshootingIssueType {
  const normalized = String(value ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  return troubleshootingIssueTypes.includes(normalized as TroubleshootingIssueType) ? normalized as TroubleshootingIssueType : "other";
}

function normalizeTroubleshootingStatus(value?: string | null): TroubleshootingStatus {
  const normalized = String(value ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "known_issue") return "in_progress";
  if (normalized === "needs_info") return "needs_information";
  return troubleshootingStatuses.includes(normalized as TroubleshootingStatus) ? normalized as TroubleshootingStatus : "open";
}

function normalizeTroubleshootingResolutionKind(value?: string | null): TroubleshootingResolutionKind | null {
  const normalized = String(value ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  return troubleshootingResolutionKinds.includes(normalized as TroubleshootingResolutionKind) ? normalized as TroubleshootingResolutionKind : null;
}

function normalizeTroubleshooting(row: Partial<TroubleshootingMetadata>): TroubleshootingMetadata {
  return {
    id: String(row.id ?? ""),
    post_id: String(row.post_id ?? ""),
    thread_id: row.thread_id ?? null,
    author_user_id: row.author_user_id ?? null,
    issue_type: normalizeTroubleshootingIssueType(row.issue_type),
    affected_area: row.affected_area ?? null,
    environment_os: row.environment_os ?? null,
    environment_browser: row.environment_browser ?? null,
    app_version: row.app_version ?? null,
    environment_notes: row.environment_notes ?? null,
    steps_to_reproduce: row.steps_to_reproduce ?? null,
    expected_result: row.expected_result ?? null,
    actual_result: row.actual_result ?? null,
    error_message: row.error_message ?? null,
    redacted_logs: row.redacted_logs ?? null,
    workaround: row.workaround ?? null,
    troubleshooting_status: normalizeTroubleshootingStatus(row.troubleshooting_status),
    accepted_comment_id: row.accepted_comment_id ?? null,
    accepted_proposal_id: row.accepted_proposal_id ?? null,
    accepted_resolution_kind: normalizeTroubleshootingResolutionKind(row.accepted_resolution_kind),
    accepted_summary: row.accepted_summary ?? null,
    accepted_by: row.accepted_by ?? null,
    accepted_at: row.accepted_at ?? null,
    resolved_at: row.resolved_at ?? null,
    closed_at: row.closed_at ?? null,
    archived_at: row.archived_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null
  };
}

async function loadTroubleshootingForPosts(postIds: string[]): Promise<TroubleshootingMetadata[]> {
  if (!supabase || !postIds.length) return [];
  const { data, error } = await supabase.from(canonicalCommuneTables.troubleshootingPosts).select(troubleshootingSelect).in("post_id", postIds);
  if (error) {
    if (import.meta.env.DEV) console.warn("[Troubleshooting Grove structured load]", error.message);
    return [];
  }
  return ((data ?? []) as Partial<TroubleshootingMetadata>[]).map(normalizeTroubleshooting).filter((row) => row.id && row.post_id);
}

export async function loadTroubleshootingForPost(postId: string): Promise<{ troubleshooting: TroubleshootingMetadata | null; warnings: string[] }> {
  if (!supabase) return { troubleshooting: null, warnings: [supabaseNotConfiguredMessage] };
  const rows = await loadTroubleshootingForPosts([postId]);
  return { troubleshooting: rows[0] ?? null, warnings: [] };
}

function normalizeRepositoryShowcase(row: Partial<RepositoryShowcaseMetadata>): RepositoryShowcaseMetadata {
  return {
    id: String(row.id ?? ""),
    user_id: row.user_id ?? null,
    post_id: row.post_id ?? null,
    repository_url: String(row.repository_url ?? ""),
    repository_host: row.repository_host ?? null,
    project_name: row.project_name ?? null,
    project_summary: row.project_summary ?? null,
    provider: row.provider ?? row.repository_host ?? null,
    default_branch: row.default_branch ?? null,
    commit_sha: row.commit_sha ?? null,
    license: row.license ?? null,
    manifest_status: row.manifest_status ?? null,
    elysia_compatibility: row.elysia_compatibility ?? null,
    short_description: row.short_description ?? row.project_summary ?? null,
    readme_preview: row.readme_preview ?? null,
    file_tree_preview: row.file_tree_preview ?? null,
    screenshot_notes_or_urls: row.screenshot_notes_or_urls ?? null,
    risk_flags: Array.isArray(row.risk_flags) ? row.risk_flags : [],
    sandbox_review_requested: Boolean(row.sandbox_review_requested),
    sandbox_review_status: row.sandbox_review_status ?? (row.sandbox_review_requested ? "requested" : "not_requested"),
    sandbox_review_request_id: row.sandbox_review_request_id ?? null,
    status: row.status ?? null,
    import_source: row.import_source ?? "manual",
    imported_metadata: row.imported_metadata ?? null,
    imported_at: row.imported_at ?? null,
    redaction_notes: row.redaction_notes ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null
  };
}

async function loadRepositoryShowcasesForPosts(postIds: string[]): Promise<RepositoryShowcaseMetadata[]> {
  if (!supabase || !postIds.length) return [];
  const { data, error } = await supabase.from(canonicalCommuneTables.repositoryShowcases).select(repositoryShowcaseSelect).in("post_id", postIds);
  if (!error) return ((data ?? []) as Partial<RepositoryShowcaseMetadata>[]).map(normalizeRepositoryShowcase).filter((row) => row.id);
  if (import.meta.env.DEV) console.warn("[Repository Showcase structured load]", error.message);
  const fallback = await supabase.from(canonicalCommuneTables.repositoryShowcases).select(repositoryShowcaseFallbackSelect).in("post_id", postIds);
  if (fallback.error) {
    if (import.meta.env.DEV) console.warn("[Repository Showcase fallback load]", fallback.error.message);
    return [];
  }
  return ((fallback.data ?? []) as Partial<RepositoryShowcaseMetadata>[]).map(normalizeRepositoryShowcase).filter((row) => row.id);
}

export async function loadRepositoryShowcaseForContext(input: { postId?: string | null; showcaseId?: string | null }): Promise<{ showcase: RepositoryShowcaseMetadata | null; warnings: string[] }> {
  if (!supabase) return { showcase: null, warnings: [supabaseNotConfiguredMessage] };
  if (!input.postId && !input.showcaseId) return { showcase: null, warnings: [] };
  const query = supabase.from(canonicalCommuneTables.repositoryShowcases).select(repositoryShowcaseSelect).limit(1);
  const result = input.showcaseId ? await query.eq("id", input.showcaseId).maybeSingle() : await query.eq("post_id", input.postId).maybeSingle();
  if (!result.error) return { showcase: result.data ? normalizeRepositoryShowcase(result.data as Partial<RepositoryShowcaseMetadata>) : null, warnings: [] };
  const fallbackQuery = supabase.from(canonicalCommuneTables.repositoryShowcases).select(repositoryShowcaseFallbackSelect).limit(1);
  const fallback = input.showcaseId ? await fallbackQuery.eq("id", input.showcaseId).maybeSingle() : await fallbackQuery.eq("post_id", input.postId).maybeSingle();
  return { showcase: fallback.data ? normalizeRepositoryShowcase(fallback.data as Partial<RepositoryShowcaseMetadata>) : null, warnings: fallback.error ? [friendlyError(fallback.error.message, "Repository Showcase metadata is not active yet.")] : [friendlyError(result.error.message, "Repository Showcase structured metadata is not active yet.")] };
}

function normalizeIterationShowcase(row: Partial<ElysiaIterationShowcaseMetadata>): ElysiaIterationShowcaseMetadata {
  return {
    id: String(row.id ?? ""),
    post_id: row.post_id ?? null,
    author_user_id: row.author_user_id ?? null,
    iteration_type: row.iteration_type ?? null,
    version_build_label: row.version_build_label ?? null,
    what_changed: row.what_changed ?? null,
    why_it_matters: row.why_it_matters ?? null,
    known_limitations: row.known_limitations ?? null,
    next_step: row.next_step ?? null,
    related_repo_url: row.related_repo_url ?? null,
    provider: row.provider ?? null,
    branch: row.branch ?? null,
    commit_sha: row.commit_sha ?? null,
    release_tag: row.release_tag ?? null,
    pull_request_url: row.pull_request_url ?? null,
    developer_forge_link: row.developer_forge_link ?? null,
    marketplace_link: row.marketplace_link ?? null,
    testing_status: row.testing_status ?? null,
    compatibility_note: row.compatibility_note ?? null,
    sandbox_review_requested: Boolean(row.sandbox_review_requested),
    sandbox_review_status: row.sandbox_review_status ?? (row.sandbox_review_requested ? "requested" : "not_requested"),
    sandbox_review_request_id: row.sandbox_review_request_id ?? null,
    risk_flags: Array.isArray(row.risk_flags) ? row.risk_flags : [],
    import_source: row.import_source ?? "manual",
    imported_metadata: row.imported_metadata ?? null,
    imported_at: row.imported_at ?? null,
    redaction_notes: row.redaction_notes ?? null,
    status: row.status ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null
  };
}

async function loadIterationShowcasesForPosts(postIds: string[]): Promise<ElysiaIterationShowcaseMetadata[]> {
  if (!supabase || !postIds.length) return [];
  const { data, error } = await supabase.from(canonicalCommuneTables.iterationShowcases).select(iterationShowcaseSelect).in("post_id", postIds);
  if (!error) return ((data ?? []) as Partial<ElysiaIterationShowcaseMetadata>[]).map(normalizeIterationShowcase).filter((row) => row.id);
  if (import.meta.env.DEV) console.warn("[Elysia Iteration Showcase structured load]", error.message);
  const fallback = await supabase.from(canonicalCommuneTables.iterationShowcases).select(iterationShowcaseFallbackSelect).in("post_id", postIds);
  if (fallback.error) {
    if (import.meta.env.DEV) console.warn("[Elysia Iteration Showcase fallback load]", fallback.error.message);
    return [];
  }
  return ((fallback.data ?? []) as Partial<ElysiaIterationShowcaseMetadata>[]).map(normalizeIterationShowcase).filter((row) => row.id);
}

export async function loadIterationShowcaseForContext(input: { postId?: string | null; iterationId?: string | null }): Promise<{ iteration: ElysiaIterationShowcaseMetadata | null; warnings: string[] }> {
  if (!supabase) return { iteration: null, warnings: [supabaseNotConfiguredMessage] };
  if (!input.postId && !input.iterationId) return { iteration: null, warnings: [] };
  const query = supabase.from(canonicalCommuneTables.iterationShowcases).select(iterationShowcaseSelect).limit(1);
  const result = input.iterationId ? await query.eq("id", input.iterationId).maybeSingle() : await query.eq("post_id", input.postId).maybeSingle();
  if (!result.error) return { iteration: result.data ? normalizeIterationShowcase(result.data as Partial<ElysiaIterationShowcaseMetadata>) : null, warnings: [] };
  const fallbackQuery = supabase.from(canonicalCommuneTables.iterationShowcases).select(iterationShowcaseFallbackSelect).limit(1);
  const fallback = input.iterationId ? await fallbackQuery.eq("id", input.iterationId).maybeSingle() : await fallbackQuery.eq("post_id", input.postId).maybeSingle();
  return { iteration: fallback.data ? normalizeIterationShowcase(fallback.data as Partial<ElysiaIterationShowcaseMetadata>) : null, warnings: fallback.error ? [friendlyError(fallback.error.message, "Elysia Iteration Showcase metadata is not active yet.")] : [friendlyError(result.error.message, "Elysia Iteration Showcase structured metadata is not active yet.")] };
}

function normalizeOfficialUpdate(row: Partial<OfficialUpdateMetadata>): OfficialUpdateMetadata {
  return {
    id: String(row.id ?? ""),
    post_id: String(row.post_id ?? ""),
    admin_user_id: row.admin_user_id ?? null,
    brand_author_name: row.brand_author_name || "Elysia Ecobotics Official",
    update_type: row.update_type ?? "official_statement",
    official_status: row.official_status ?? "published",
    severity: row.severity ?? "info",
    audience: row.audience ?? "public",
    summary: row.summary ?? null,
    effective_date: row.effective_date ?? null,
    release_version: row.release_version ?? null,
    affected_systems: Array.isArray(row.affected_systems) ? row.affected_systems : [],
    related_room_slug: row.related_room_slug ?? null,
    related_repo_url: row.related_repo_url ?? null,
    related_migration: row.related_migration ?? null,
    related_links: Array.isArray(row.related_links) ? row.related_links : [],
    known_limitations: row.known_limitations ?? null,
    migration_required: Boolean(row.migration_required),
    user_action_required: row.user_action_required ?? null,
    pinned: Boolean(row.pinned),
    important: Boolean(row.important),
    comments_enabled: row.comments_enabled !== false,
    correction_note: row.correction_note ?? null,
    correction_status: row.correction_status ?? "none",
    supersedes_update_id: row.supersedes_update_id ?? null,
    superseded_by_update_id: row.superseded_by_update_id ?? null,
    published_at: row.published_at ?? null,
    corrected_at: row.corrected_at ?? null,
    retracted_at: row.retracted_at ?? null,
    archived_at: row.archived_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null
  };
}

async function loadOfficialUpdatesForPosts(postIds: string[]): Promise<OfficialUpdateMetadata[]> {
  if (!supabase || !postIds.length) return [];
  const { data, error } = await supabase.from(canonicalCommuneTables.officialUpdates).select(officialUpdateSelect).in("post_id", postIds);
  if (error) {
    if (import.meta.env.DEV) console.warn("[Official Update structured load]", error.message);
    return [];
  }
  return ((data ?? []) as Partial<OfficialUpdateMetadata>[]).map(normalizeOfficialUpdate).filter((row) => row.id && row.post_id);
}

async function loadOfficialCodeSnippetsForPosts(postIds: string[]): Promise<OfficialUpdateCodeSnippet[]> {
  if (!supabase || !postIds.length) return [];
  const { data, error } = await supabase.from(canonicalCommuneTables.officialCodeSnippets).select(officialCodeSelect).in("post_id", postIds).eq("public_visible", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) {
    if (import.meta.env.DEV) console.warn("[Official Update code load]", error.message);
    return [];
  }
  return (data ?? []) as OfficialUpdateCodeSnippet[];
}

export async function loadOfficialUpdateForPost(postId: string): Promise<{ officialUpdate: OfficialUpdateMetadata | null; codeSnippets: OfficialUpdateCodeSnippet[]; warnings: string[] }> {
  if (!supabase) return { officialUpdate: null, codeSnippets: [], warnings: [supabaseNotConfiguredMessage] };
  const [officialUpdates, codeSnippets] = await Promise.all([loadOfficialUpdatesForPosts([postId]), loadOfficialCodeSnippetsForPosts([postId])]);
  return { officialUpdate: officialUpdates[0] ?? null, codeSnippets, warnings: [] };
}

async function loadPublishedMediaForPosts(postIds: string[]): Promise<CommuneMediaAttachment[]> {
  if (!supabase || !postIds.length) return [];
  const client = supabase;
  const { data, error } = await client
    .from(canonicalCommuneTables.media)
    .select("id,post_id,storage_bucket,storage_path,file_name,mime_type,file_size,media_kind,visibility_state,created_at")
    .in("post_id", postIds)
    .eq("visibility_state", "published")
    .in("media_kind", ["image", "document", "code_text"])
    .order("created_at", { ascending: true });
  if (error) {
    if (import.meta.env.DEV) console.warn("[Commune media load]", error.message);
    return [];
  }
  const rows = (data ?? []) as CommuneMediaAttachment[];
  const resolved = await Promise.all(rows.map(async (row) => {
    if (!row.storage_bucket || !row.storage_path) return { ...row, signed_url: null };
    const { data: signed, error: signedError } = await client.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60 * 30);
    if (signedError && import.meta.env.DEV) console.warn("[Commune media signed URL]", signedError.message);
    return { ...row, signed_url: signed?.signedUrl ?? null };
  }));
  return resolved;
}

export async function loadCategories(): Promise<{ categories: CommuneCategory[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { categories: communeFallbackCategories.map((item, index) => ({ ...item, id: item.slug, sort_order: index, is_active: true })), warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("commune_categories").select("id,slug,title,description,sort_order,is_active").eq("is_active", true).order("sort_order");
  if (error) return { categories: communeFallbackCategories.map((item, index) => ({ ...item, id: item.slug, sort_order: index, is_active: true })), warnings: [friendlyError(error.message, "Commune categories are using the safe built-in fallback until the latest migration is applied.")] };
  return { categories: (data ?? []) as CommuneCategory[], warnings: [] };
}

export async function loadCommuneData(roomSlug?: string, postId?: string): Promise<LoadCommuneData> {
  const account = await accountState();
  if (!hasSupabaseConfig || !supabase) return { rooms: [], posts: [], comments: [], threads: [], media: [], troubleshootingPosts: [], repositoryShowcases: [], iterationShowcases: [], officialUpdates: [], officialCodeSnippets: [], savedPostIds: [], followedThreadIds: [], account, warnings: [supabaseNotConfiguredMessage] };
  const warnings = [...account.warnings];
  const roomsQuery = supabase.from(canonicalCommuneTables.rooms).select("id, slug, name, description, room_type, requires_moderation").order("name");
  const { data: rooms, error: roomError } = await roomsQuery;
  if (roomError) warnings.push(roomError.message);
  const candidateRoomSlugs = roomSlugCandidates(roomSlug);
  const selectedRoom = candidateRoomSlugs.length ? (rooms ?? []).find((room) => candidateRoomSlugs.includes(room.slug)) as CommuneRoom | undefined : undefined;
  let postQuery = supabase.from(canonicalCommuneTables.posts).select("id,user_id,author_username,post_type,title,body,excerpt,tags,links,repository_url,status,visibility,published_at,last_activity_at,created_at").eq("status", "published").eq("visibility", "public").order("last_activity_at", { ascending: false }).limit(50);
  if (postId) postQuery = postQuery.eq("id", postId);
  if (selectedRoom) {
    const { data: roomThreads } = await supabase.from(canonicalCommuneTables.threads).select("post_id").eq("room_id", selectedRoom.id).eq("visibility", "public");
    const ids = (roomThreads ?? []).map((row) => row.post_id).filter(Boolean) as string[];
    postQuery = ids.length ? postQuery.in("id", ids) : postQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  const { data: posts, error: postError } = await postQuery;
  if (postError) warnings.push(postError.message);
  const postIds = (posts ?? []).map((post) => post.id);
  let threadQuery = supabase.from(canonicalCommuneTables.threads).select("id,post_id,room_id,title,status,visibility,last_reply_at").eq("visibility", "public").order("last_reply_at", { ascending: false });
  if (postIds.length) threadQuery = threadQuery.in("post_id", postIds);
  const { data: threads, error: threadError } = await threadQuery;
  if (threadError) warnings.push(threadError.message);
  const threadIds = (threads ?? []).map((thread) => thread.id);
  let commentQuery = supabase.from(canonicalCommuneTables.comments).select("id,thread_id,post_id,parent_comment_id,user_id,author_username,body,status,created_at,published_at").eq("status", "published").order("created_at");
  if (threadIds.length) commentQuery = commentQuery.in("thread_id", threadIds); else commentQuery = commentQuery.eq("thread_id", "00000000-0000-0000-0000-000000000000");
  const { data: comments, error: commentError } = await commentQuery;
  if (commentError) warnings.push(commentError.message);
  const media = await loadPublishedMediaForPosts(postIds);
  const troubleshootingPosts = await loadTroubleshootingForPosts(postIds);
  const repositoryShowcases = await loadRepositoryShowcasesForPosts(postIds);
  const iterationShowcases = await loadIterationShowcasesForPosts(postIds);
  const officialUpdates = await loadOfficialUpdatesForPosts(postIds);
  const officialCodeSnippets = await loadOfficialCodeSnippetsForPosts(postIds);
  let savedPostIds: string[] = [];
  let followedThreadIds: string[] = [];
  if (account.userId) {
    const [{ data: saves }, { data: follows }] = await Promise.all([
      supabase.from(canonicalCommuneTables.savedPosts).select("post_id").eq("user_id", account.userId),
      supabase.from(canonicalCommuneTables.followedThreads).select("thread_id").eq("user_id", account.userId)
    ]);
    savedPostIds = (saves ?? []).map((row) => row.post_id).filter(Boolean) as string[];
    followedThreadIds = (follows ?? []).map((row) => row.thread_id).filter(Boolean) as string[];
  }
  return { rooms: (rooms ?? []) as CommuneRoom[], posts: (posts ?? []) as CommunePost[], comments: (comments ?? []) as CommuneComment[], threads: (threads ?? []) as CommuneThread[], media, troubleshootingPosts, repositoryShowcases, iterationShowcases, officialUpdates, officialCodeSnippets, savedPostIds, followedThreadIds, account, warnings };
}

export async function ensureCommuneThreadForPost(post: CommunePost): Promise<{ ok: boolean; thread?: CommuneThread; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to join this post discussion." };
  if (!post.id) return { ok: false, message: "Comment could not be submitted because this post id is missing." };
  if (post.status !== "published" || post.visibility !== "public") return { ok: false, message: "Comment could not be submitted because this post is not public yet." };

  const { data: existing, error: existingError } = await supabase
    .from(canonicalCommuneTables.threads)
    .select("id,post_id,room_id,title,status,visibility,last_reply_at")
    .eq("post_id", post.id)
    .eq("visibility", "public")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) return { ok: false, message: friendlyError(existingError.message, "Comment could not check this post discussion thread yet.") };
  if (existing) return { ok: true, thread: existing as CommuneThread, message: "Discussion thread ready." };

  const { data: created, error: createError } = await supabase
    .from(canonicalCommuneTables.threads)
    .insert({ post_id: post.id, title: post.title, created_by: account.userId, visibility: "public", status: "open" })
    .select("id,post_id,room_id,title,status,visibility,last_reply_at")
    .single();
  if (createError) return { ok: false, message: friendlyError(createError.message, "Comment could not be submitted because this post has no discussion thread yet. Ask an administrator to repair the Commune thread row.") };
  return { ok: true, thread: created as CommuneThread, message: "Discussion thread repaired for this published post." };
}

function parseOfficialRelatedLinks(value?: string | null) {
  return splitList(value ?? "").flatMap((line) => {
    const [maybeLabel, maybeUrl] = line.includes("|") ? line.split("|").map((part) => part.trim()) : ["", line.trim()];
    const url = publicHttpUrlOrNull(maybeUrl);
    return url ? [{ label: maybeLabel || undefined, url }] : [];
  });
}

function safeOfficialCodeFileName(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/[\\/]|\.\.|^[a-z]:/i.test(text)) return null;
  return text.slice(0, 160);
}

async function createOfficialUpdateEvent(input: { officialUpdateId?: string | null; postId?: string | null; actorId?: string | null; action: string; reason?: string | null; publicNote?: string | null; metadata?: Record<string, unknown> }) {
  if (!supabase || !input.officialUpdateId) return;
  const { error } = await supabase.from(canonicalCommuneTables.officialEvents).insert({
    official_update_id: input.officialUpdateId,
    post_id: input.postId || null,
    actor_id: input.actorId || null,
    action: input.action,
    reason: input.reason || null,
    public_note: input.publicNote || null,
    metadata: input.metadata ?? {}
  });
  if (error && import.meta.env.DEV) console.warn("[Official Update event]", error.message);
}

async function notifyOfficialUpdateSelf(input: { userId?: string | null; title: string; body: string; postId?: string | null; sourceId?: string | null; type: string }) {
  if (!supabase || !input.userId) return;
  const { error } = await supabase.from("user_notifications").insert({
    user_id: input.userId,
    notification_type: input.type,
    source_type: canonicalCommuneTables.officialUpdates,
    source_id: input.sourceId || input.postId || null,
    title: input.title,
    body: input.body,
    action_url: input.postId ? "/commune/posts/" + input.postId : "/commune/official-updates"
  });
  if (error && import.meta.env.DEV) console.warn("[Official Update notification]", error.message);
}

export async function submitOfficialUpdate(input: {
  title: string;
  summary: string;
  body: string;
  tags: string;
  links: string;
  roomId?: string;
  upload?: File | null;
  acknowledgement: boolean;
  updateType: OfficialUpdateType;
  officialStatus?: OfficialUpdateStatus;
  severity: OfficialUpdateSeverity;
  audience?: string;
  effectiveDate?: string;
  releaseVersion?: string;
  affectedSystems?: string;
  relatedRoomSlug?: string;
  relatedRepoUrl?: string;
  relatedMigration?: string;
  relatedLinks?: string;
  knownLimitations?: string;
  migrationRequired?: boolean;
  userActionRequired?: string;
  pinned?: boolean;
  important?: boolean;
  commentsEnabled?: boolean;
  correctionNote?: string;
  codeSnippets?: Array<{ language: string; fileName?: string; codeText: string; contextNote?: string; correctionNote?: string }>;
}): Promise<{ ok: boolean; message: string; id?: string; postId?: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId || !account.isAdmin) return { ok: false, message: "Official Updates are restricted to authorized administrators. Community users cannot self-assign official publishing authority." };
  if (!input.acknowledgement) return { ok: false, message: "Confirm the Official Update safety acknowledgements before publishing." };
  const relatedRepoUrl = publicHttpUrlOrNull(input.relatedRepoUrl);
  if (input.relatedRepoUrl?.trim() && !relatedRepoUrl) return { ok: false, message: "Use a public HTTP(S) related repository/reference URL or leave it blank. Private, localhost, and local paths are not allowed in Official Updates." };
  if (input.upload) {
    const media = validateCommuneMediaFile(input.upload);
    if (!media.ok) return { ok: false, message: media.message };
  }
  const codeSnippets = (input.codeSnippets ?? []).filter((snippet) => snippet.codeText.trim());
  const invalidFile = codeSnippets.find((snippet) => snippet.fileName && !safeOfficialCodeFileName(snippet.fileName));
  if (invalidFile) return { ok: false, message: "Official code filenames must be plain filenames without slashes, drive letters, or path traversal." };
  const oversizedCode = codeSnippets.find((snippet) => snippet.codeText.length > 100000);
  if (oversizedCode) return { ok: false, message: "Official code snippets must be 100,000 characters or smaller." };
  const relatedLinks = parseOfficialRelatedLinks(input.relatedLinks);
  const affectedSystems = splitList(input.affectedSystems ?? "");
  const links = Array.from(new Set([...splitList(input.links), ...relatedLinks.map((link) => link.url), relatedRepoUrl].filter(Boolean) as string[]));
  const scan = scanCommuneTextForSecrets([
    input.title, input.summary, input.body, input.tags, links.join("\n"), input.updateType, input.officialStatus ?? "published", input.severity,
    input.audience ?? "", input.effectiveDate ?? "", input.releaseVersion ?? "", affectedSystems.join("\n"), input.relatedRoomSlug ?? "", relatedRepoUrl ?? "",
    input.relatedMigration ?? "", input.knownLimitations ?? "", input.userActionRequired ?? "", input.correctionNote ?? "",
    ...codeSnippets.flatMap((snippet) => [snippet.language, snippet.fileName ?? "", snippet.contextNote ?? "", snippet.codeText, snippet.correctionNote ?? ""])
  ].join("\n"));
  if (scan.blocked) return { ok: false, message: "Official Update blocked because it appears to contain private or secret material: " + scan.warnings.join(", ") + ". Remove it before publishing." };
  const now = new Date().toISOString();
  const postId = crypto.randomUUID();
  const { error: postError } = await supabase.from(canonicalCommuneTables.posts).insert({
    id: postId,
    user_id: account.userId,
    author_username: account.username,
    post_type: "official_update",
    title: input.title.trim(),
    body: input.body.trim(),
    excerpt: excerpt(input.summary || input.body),
    tags: parseCommuneTags(input.tags),
    links,
    repository_url: relatedRepoUrl,
    status: "published",
    moderation_status: "approved",
    published_at: now,
    safety_acknowledgements: { public_boundary: true, no_secrets: true, official_authority: true, admin_only: true, no_public_code_execution: true }
  });
  if (postError) return { ok: false, message: friendlyError(postError.message, "Official Update publishing is blocked by the current admin-only database policy.") };
  const { data: thread } = await supabase.from(canonicalCommuneTables.threads).insert({
    post_id: postId,
    room_id: input.roomId || null,
    title: input.title.trim(),
    created_by: account.userId,
    visibility: "public",
    status: input.commentsEnabled === false ? "locked" : "open",
    locked_at: input.commentsEnabled === false ? now : null,
    locked_by: input.commentsEnabled === false ? account.userId : null,
    lock_reason: input.commentsEnabled === false ? "Official Update comments disabled by administrator." : null
  }).select("id").single();
  const threadId = (thread as { id?: string } | null)?.id ?? null;
  await grantThreadParticipationApproval({ threadId, postId, userId: account.userId, approvedBy: account.userId, source: "admin_direct_official_update" });
  const { data, error: officialError } = await supabase.from(canonicalCommuneTables.officialUpdates).insert({
    post_id: postId,
    admin_user_id: account.userId,
    brand_author_name: "Elysia Ecobotics Official",
    update_type: input.updateType,
    official_status: input.officialStatus || "published",
    severity: input.severity,
    audience: input.audience || "public",
    summary: input.summary || null,
    effective_date: input.effectiveDate || null,
    release_version: input.releaseVersion || null,
    affected_systems: affectedSystems,
    related_room_slug: input.relatedRoomSlug || null,
    related_repo_url: relatedRepoUrl,
    related_migration: input.relatedMigration || null,
    related_links: relatedLinks,
    known_limitations: input.knownLimitations || null,
    migration_required: Boolean(input.migrationRequired),
    user_action_required: input.userActionRequired || null,
    pinned: Boolean(input.pinned),
    important: Boolean(input.important),
    comments_enabled: input.commentsEnabled !== false,
    correction_note: input.correctionNote || null,
    correction_status: input.correctionNote ? "corrected" : "none",
    published_at: now
  }).select("id").single();
  if (officialError || !data) return { ok: false, postId, message: friendlyError(officialError?.message ?? "Official metadata insert did not return a row.", "Official Update post published, but structured metadata could not be saved. Apply the Official Update migration, then repair this post.") };
  const officialUpdateId = (data as { id: string }).id;
  if (codeSnippets.length) {
    const rows = codeSnippets.map((snippet, index) => ({
      official_update_id: officialUpdateId,
      post_id: postId,
      admin_user_id: account.userId,
      language: snippet.language || "text",
      file_name: safeOfficialCodeFileName(snippet.fileName) || null,
      code_text: snippet.codeText,
      context_note: snippet.contextNote || null,
      correction_note: snippet.correctionNote || null,
      sort_order: index,
      public_visible: true
    }));
    const { error: codeError } = await supabase.from(canonicalCommuneTables.officialCodeSnippets).insert(rows);
    if (codeError) return { ok: false, id: officialUpdateId, postId, message: friendlyError(codeError.message, "Official Update published, but read-only official code snippets could not be saved.") };
  }
  if (input.upload) {
    const upload = await uploadCommuneAttachment(input.upload, { postId, role: "official_update_attachment", publishImmediately: true });
    if (!upload.ok) return { ok: false, id: officialUpdateId, postId, message: `Official Update published, but upload failed: ${upload.message}` };
    await publishPostAttachments(postId);
  }
  await recordCommuneGovernanceEvent({ actorId: account.userId, targetType: "post", targetId: postId, action: "admin_official_update_published", fromStatus: "draft", toStatus: "published", metadata: { official_update_id: officialUpdateId, update_type: input.updateType, severity: input.severity, comments_enabled: input.commentsEnabled !== false } });
  await createOfficialUpdateEvent({ officialUpdateId, postId, actorId: account.userId, action: "official_update_published", publicNote: input.summary, metadata: { update_type: input.updateType, severity: input.severity, pinned: Boolean(input.pinned), important: Boolean(input.important) } });
  await createReviewHistoryItem({ domain: "commune", sourceTable: canonicalCommuneTables.officialUpdates, sourceId: officialUpdateId, submittedBy: account.userId, title: input.title, summary: "Admin-published Official Update. Brand-authoritative public notice; community users cannot self-assign official authority.", status: "approved", eventType: "admin_official_update_direct_published", metadata: { post_id: postId, update_type: input.updateType, severity: input.severity } });
  await notifyOfficialUpdateSelf({ userId: account.userId, title: "Official Update published", body: "Your Official Update is public as Elysia Ecobotics Official. Corrections, retractions, code edits, and comment locks remain audit-aware.", postId, sourceId: officialUpdateId, type: input.updateType === "security_notice" ? "official_security_notice_published" : "official_update_published" });
  return { ok: true, message: "Official Update published as Elysia Ecobotics Official with structured metadata, audit event, and read-only official code boundaries.", id: officialUpdateId, postId };
}

export async function updateOfficialUpdateMetadata(input: { officialUpdateId: string; postId: string; officialStatus?: OfficialUpdateStatus; severity?: OfficialUpdateSeverity; correctionNote?: string; commentsEnabled?: boolean; pinned?: boolean; important?: boolean; action: string }): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId || !account.isAdmin) return { ok: false, message: "Only administrators can update Official Update lifecycle metadata." };
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (input.officialStatus) patch.official_status = input.officialStatus;
  if (input.severity) patch.severity = input.severity;
  if (typeof input.pinned === "boolean") patch.pinned = input.pinned;
  if (typeof input.important === "boolean") patch.important = input.important;
  if (typeof input.commentsEnabled === "boolean") patch.comments_enabled = input.commentsEnabled;
  if (typeof input.correctionNote === "string") {
    patch.correction_note = input.correctionNote || null;
    patch.correction_status = input.action === "retracted" ? "retracted" : input.correctionNote ? "corrected" : "none";
    if (input.correctionNote) patch.corrected_at = now;
  }
  if (input.action === "retracted") { patch.official_status = "retracted"; patch.correction_status = "retracted"; patch.retracted_at = now; }
  if (input.action === "archived") { patch.official_status = "archived"; patch.archived_at = now; }
  if (input.action === "corrected") { patch.official_status = "corrected"; patch.correction_status = "corrected"; patch.corrected_at = now; }
  const { error } = await supabase.from(canonicalCommuneTables.officialUpdates).update(patch).eq("id", input.officialUpdateId);
  if (error) return { ok: false, message: friendlyError(error.message, "Official Update metadata could not be updated yet.") };
  if (typeof input.commentsEnabled === "boolean") {
    const threadPatch = input.commentsEnabled
      ? { status: "open", locked_at: null, locked_by: null, lock_reason: null, updated_at: now }
      : { status: "locked", locked_at: now, locked_by: account.userId, lock_reason: "Official Update comments disabled by administrator.", updated_at: now };
    await supabase.from(canonicalCommuneTables.threads).update(threadPatch).eq("post_id", input.postId);
  }
  await createOfficialUpdateEvent({ officialUpdateId: input.officialUpdateId, postId: input.postId, actorId: account.userId, action: input.action, publicNote: input.correctionNote, metadata: patch });
  await notifyOfficialUpdateSelf({ userId: account.userId, title: "Official Update lifecycle changed", body: `Official Update action recorded: ${input.action.replace(/_/g, " ")}.`, postId: input.postId, sourceId: input.officialUpdateId, type: "official_update_lifecycle" });
  return { ok: true, message: "Official Update metadata updated and an audit event was recorded." };
}

export async function createOfficialCodeSnippet(input: { officialUpdateId: string; postId: string; language: string; fileName?: string; codeText: string; contextNote?: string; correctionNote?: string }): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId || !account.isAdmin) return { ok: false, message: "Only administrators can add Official Update code snippets." };
  if (!input.codeText.trim()) return { ok: false, message: "Add official code text before saving." };
  if (input.codeText.length > 100000) return { ok: false, message: "Official code snippets must be 100,000 characters or smaller." };
  const fileName = safeOfficialCodeFileName(input.fileName);
  if (input.fileName?.trim() && !fileName) return { ok: false, message: "Official code filenames must be plain filenames without paths." };
  const scan = scanCommuneTextForSecrets([input.language, fileName ?? "", input.contextNote ?? "", input.codeText, input.correctionNote ?? ""].join("\n"));
  if (scan.blocked) return { ok: false, message: "Official code blocked because it appears to contain private or secret material: " + scan.warnings.join(", ") + "." };
  const { error } = await supabase.from(canonicalCommuneTables.officialCodeSnippets).insert({ official_update_id: input.officialUpdateId, post_id: input.postId, admin_user_id: account.userId, language: input.language || "text", file_name: fileName, code_text: input.codeText, context_note: input.contextNote || null, correction_note: input.correctionNote || null, public_visible: true });
  if (error) return { ok: false, message: friendlyError(error.message, "Official code snippet could not be saved yet.") };
  await createOfficialUpdateEvent({ officialUpdateId: input.officialUpdateId, postId: input.postId, actorId: account.userId, action: "official_code_added", publicNote: input.correctionNote || input.contextNote, metadata: { file_name: fileName, language: input.language } });
  return { ok: true, message: "Official code snippet saved as read-only public text. No workbench, sandbox, or proposal flow was enabled." };
}

export async function updateOfficialCodeSnippet(input: { id: string; officialUpdateId: string; postId: string; language: string; fileName?: string | null; codeText: string; contextNote?: string | null; correctionNote?: string | null; publicVisible?: boolean }): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId || !account.isAdmin) return { ok: false, message: "Only administrators can edit Official Update code snippets." };
  if (!input.codeText.trim()) return { ok: false, message: "Official code cannot be empty." };
  if (input.codeText.length > 100000) return { ok: false, message: "Official code snippets must be 100,000 characters or smaller." };
  const fileName = safeOfficialCodeFileName(input.fileName);
  if (input.fileName?.trim() && !fileName) return { ok: false, message: "Official code filenames must be plain filenames without paths." };
  const scan = scanCommuneTextForSecrets([input.language, fileName ?? "", input.contextNote ?? "", input.codeText, input.correctionNote ?? ""].join("\n"));
  if (scan.blocked) return { ok: false, message: "Official code update blocked because it appears to contain private or secret material: " + scan.warnings.join(", ") + "." };
  const now = new Date().toISOString();
  const { error } = await supabase.from(canonicalCommuneTables.officialCodeSnippets).update({ language: input.language || "text", file_name: fileName, code_text: input.codeText, context_note: input.contextNote || null, correction_note: input.correctionNote || null, public_visible: input.publicVisible !== false, edited_by: account.userId, edited_at: now, updated_at: now }).eq("id", input.id);
  if (error) return { ok: false, message: friendlyError(error.message, "Official code snippet correction could not be saved yet.") };
  await createOfficialUpdateEvent({ officialUpdateId: input.officialUpdateId, postId: input.postId, actorId: account.userId, action: input.publicVisible === false ? "official_code_removed" : "official_code_updated", publicNote: input.correctionNote, metadata: { code_snippet_id: input.id, file_name: fileName, language: input.language } });
  await updateOfficialUpdateMetadata({ officialUpdateId: input.officialUpdateId, postId: input.postId, correctionNote: input.correctionNote || "Official code snippet updated.", action: "official_update_corrected" });
  return { ok: true, message: "Official code correction saved and audit history updated. Public users still only get read/copy access." };
}

async function notifyTroubleshootingAuthor(input: { userId?: string | null; actorId?: string | null; postId: string; sourceId?: string | null; title: string; body: string; type: string }) {
  if (!supabase || !input.userId || input.userId === input.actorId) return;
  const { error } = await supabase.from("user_notifications").insert({
    user_id: input.userId,
    notification_type: input.type,
    source_type: canonicalCommuneTables.troubleshootingPosts,
    source_id: input.sourceId || input.postId,
    title: input.title,
    body: input.body,
    action_url: "/commune/posts/" + input.postId
  });
  if (error && import.meta.env.DEV) console.warn("[Troubleshooting Grove notification]", error.message);
}

export async function submitTroubleshootingPost(input: {
  title: string;
  summary: string;
  body: string;
  tags: string;
  links: string;
  roomId?: string;
  upload?: File | null;
  acknowledgement: boolean;
  issueType: string;
  affectedArea?: string;
  environmentOs?: string;
  environmentBrowser?: string;
  appVersion?: string;
  environmentNotes?: string;
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  errorMessage?: string;
  redactedLogs?: string;
  workaround?: string;
  troubleshootingStatus?: string;
  codeText?: string;
  codeLanguage?: string;
  codeFileName?: string;
  codeAcknowledged?: boolean;
}): Promise<{ ok: boolean; message: string; id?: string; postId?: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to submit a Troubleshooting Grove post." };
  if (!input.acknowledgement) return { ok: false, message: "Confirm the Troubleshooting Grove safety acknowledgements before submitting." };
  if (input.codeText?.trim() && !input.codeAcknowledged) return { ok: false, message: "Acknowledge that troubleshooting code is inert redacted text and not execution permission before submitting." };
  if (input.upload) {
    const media = validateCommuneMediaFile(input.upload);
    if (!media.ok) return { ok: false, message: media.message };
  }
  const secretScan = scanCommuneTextForSecrets([
    input.title,
    input.summary,
    input.body,
    input.tags,
    input.links,
    input.issueType,
    input.affectedArea ?? "",
    input.environmentOs ?? "",
    input.environmentBrowser ?? "",
    input.appVersion ?? "",
    input.environmentNotes ?? "",
    input.stepsToReproduce ?? "",
    input.expectedResult ?? "",
    input.actualResult ?? "",
    input.errorMessage ?? "",
    input.redactedLogs ?? "",
    input.workaround ?? "",
    input.codeFileName ?? "",
    input.codeText ?? ""
  ].join("\n"));
  if (secretScan.blocked) return { ok: false, message: "Troubleshooting post blocked because it appears to contain private or secret material: " + secretScan.warnings.join(", ") + ". Redact it before submitting." };
  const postId = crypto.randomUUID();
  const now = new Date().toISOString();
  const tags = parseCommuneTags(input.tags);
  const links = splitList(input.links);
  const adminDirectPublish = account.isAdmin;
  const { error: postError } = await supabase.from(canonicalCommuneTables.posts).insert({
    id: postId,
    user_id: account.userId,
    author_username: account.username,
    post_type: "troubleshooting",
    title: input.title.trim(),
    body: input.body.trim(),
    excerpt: excerpt(input.summary || input.body),
    tags,
    links,
    status: adminDirectPublish ? "published" : "pending_review",
    moderation_status: adminDirectPublish ? "approved" : "pending_review",
    published_at: adminDirectPublish ? now : null,
    safety_acknowledgements: { public_boundary: true, no_secrets: true, no_execution: true, redacted_logs: true, troubleshooting: true }
  });
  if (postError) return { ok: false, message: friendlyError(postError.message, "Troubleshooting Grove post creation is blocked by the current Commune post policy.") };
  const { data: thread } = await supabase.from(canonicalCommuneTables.threads).insert({
    post_id: postId,
    room_id: input.roomId || null,
    title: input.title.trim(),
    created_by: account.userId,
    visibility: "public",
    status: "open"
  }).select("id").single();
  const threadId = (thread as { id?: string } | null)?.id ?? null;
  const structuredPayload = {
    post_id: postId,
    thread_id: threadId,
    author_user_id: account.userId,
    issue_type: normalizeTroubleshootingIssueType(input.issueType),
    affected_area: input.affectedArea || null,
    environment_os: input.environmentOs || null,
    environment_browser: input.environmentBrowser || null,
    app_version: input.appVersion || null,
    environment_notes: input.environmentNotes || null,
    steps_to_reproduce: input.stepsToReproduce || null,
    expected_result: input.expectedResult || null,
    actual_result: input.actualResult || null,
    error_message: input.errorMessage || null,
    redacted_logs: input.redactedLogs || null,
    workaround: input.workaround || null,
    troubleshooting_status: normalizeTroubleshootingStatus(input.troubleshootingStatus),
    updated_at: now
  };
  const { data, error: troubleshootingError } = await supabase.from(canonicalCommuneTables.troubleshootingPosts).insert(structuredPayload).select("id").single();
  if (troubleshootingError || !data) return { ok: false, postId, message: friendlyError(troubleshootingError?.message ?? "Troubleshooting metadata insert did not return a row.", "Troubleshooting Grove post saved, but structured metadata could not be saved. Apply the Troubleshooting Grove migration, then repair this post.") };
  const troubleshootingId = (data as { id: string }).id;
  if (input.codeText?.trim()) {
    const snippet = await createCodeSnippet({ postId, language: input.codeLanguage ?? "text", fileName: input.codeFileName ?? "", codeText: input.codeText, sandboxAcknowledged: Boolean(input.codeAcknowledged) });
    if (!snippet.ok) return { ok: false, id: troubleshootingId, postId, message: `Troubleshooting metadata saved, but reproduction snippet failed: ${snippet.message}` };
  }
  if (input.upload) {
    const upload = await uploadCommuneAttachment(input.upload, { postId, role: "troubleshooting_attachment", publishImmediately: adminDirectPublish });
    if (!upload.ok) return { ok: false, id: troubleshootingId, postId, message: `Troubleshooting post saved, but upload failed: ${upload.message}` };
  }
  if (adminDirectPublish) {
    await grantThreadParticipationApproval({ threadId, postId, userId: account.userId, approvedBy: account.userId, source: "admin_direct_troubleshooting_post" });
    await publishPostAttachments(postId);
    await recordCommuneGovernanceEvent({ actorId: account.userId, targetType: "post", targetId: postId, action: "admin_troubleshooting_post_published", fromStatus: "draft", toStatus: "published", metadata: { post_type: "troubleshooting", troubleshooting_id: troubleshootingId, review_item_created: false } });
    await createReviewHistoryItem({ domain: "commune", sourceTable: canonicalCommuneTables.troubleshootingPosts, sourceId: troubleshootingId, submittedBy: account.userId, title: input.title, summary: "Admin-published Troubleshooting Grove issue. Redacted diagnostic/support context only.", status: "approved", eventType: "admin_troubleshooting_direct_published", metadata: { post_id: postId, thread_id: threadId, issue_type: structuredPayload.issue_type } });
    return { ok: true, id: troubleshootingId, postId, message: "Troubleshooting Grove post published with structured issue metadata, public thread, and support-safe diagnostic boundaries." };
  }
  await createReviewItem({ domain: "commune", sourceTable: canonicalCommuneTables.posts, sourceId: postId, submittedBy: account.userId, title: input.title.trim(), summary: excerpt(input.summary || input.body) });
  return { ok: true, id: troubleshootingId, postId, message: "Troubleshooting Grove post submitted for moderation with structured issue metadata. It is not public until approved." };
}

export async function updateTroubleshootingStatus(input: { postId: string; status: TroubleshootingStatus; summary?: string }): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to update troubleshooting status." };
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { troubleshooting_status: normalizeTroubleshootingStatus(input.status), updated_at: now };
  if (input.status === "resolved") patch.resolved_at = now;
  if (input.status === "closed") patch.closed_at = now;
  if (input.status === "archived") patch.archived_at = now;
  if (typeof input.summary === "string" && input.summary.trim()) {
    patch.accepted_summary = input.summary.trim();
    patch.accepted_resolution_kind = input.status === "workaround_found" ? "workaround" : "manual_note";
    patch.accepted_by = account.userId;
    patch.accepted_at = now;
  }
  const { data: existing } = await supabase.from(canonicalCommuneTables.troubleshootingPosts).select("id,author_user_id").eq("post_id", input.postId).maybeSingle();
  const { error } = await supabase.from(canonicalCommuneTables.troubleshootingPosts).update(patch).eq("post_id", input.postId);
  if (error) return { ok: false, message: friendlyError(error.message, "Troubleshooting Grove status could not be updated yet.") };
  const row = existing as { id?: string; author_user_id?: string | null } | null;
  await notifyTroubleshootingAuthor({ userId: row?.author_user_id ?? null, actorId: account.userId, postId: input.postId, sourceId: row?.id ?? null, title: "Troubleshooting status updated", body: `Your Troubleshooting Grove issue was marked ${input.status.replace(/_/g, " ")}.`, type: "troubleshooting_status_changed" });
  return { ok: true, message: "Troubleshooting status updated." };
}

export async function markTroubleshootingResolved(input: { postId: string; resolutionKind: TroubleshootingResolutionKind; summary: string; commentId?: string | null; proposalId?: string | null; status?: TroubleshootingStatus }): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to mark a troubleshooting resolution." };
  if (!input.summary.trim()) return { ok: false, message: "Add a short accepted fix/workaround summary before marking a resolution." };
  const now = new Date().toISOString();
  const status = normalizeTroubleshootingStatus(input.status ?? (input.resolutionKind === "workaround" ? "workaround_found" : "resolved"));
  const { data: existing } = await supabase.from(canonicalCommuneTables.troubleshootingPosts).select("id,author_user_id").eq("post_id", input.postId).maybeSingle();
  const { error } = await supabase.from(canonicalCommuneTables.troubleshootingPosts).update({
    troubleshooting_status: status,
    accepted_comment_id: input.commentId || null,
    accepted_proposal_id: input.proposalId || null,
    accepted_resolution_kind: input.resolutionKind,
    accepted_summary: input.summary.trim(),
    accepted_by: account.userId,
    accepted_at: now,
    resolved_at: status === "resolved" ? now : null,
    updated_at: now
  }).eq("post_id", input.postId);
  if (error) return { ok: false, message: friendlyError(error.message, "Troubleshooting resolution could not be saved yet.") };
  const row = existing as { id?: string; author_user_id?: string | null } | null;
  await notifyTroubleshootingAuthor({ userId: row?.author_user_id ?? null, actorId: account.userId, postId: input.postId, sourceId: row?.id ?? null, title: "Troubleshooting resolution recorded", body: `A ${input.resolutionKind.replace(/_/g, " ")} was recorded for your Troubleshooting Grove issue.`, type: "troubleshooting_resolution_recorded" });
  return { ok: true, message: "Accepted troubleshooting fix/workaround recorded." };
}

export async function submitCommunePost(input: { postType: CommunePostType; roomId?: string; title: string; body: string; tags: string; links: string; repositoryUrl?: string; acknowledgement: boolean; upload?: File | null; sandboxRequested?: boolean }): Promise<{ ok: boolean; message: string; postId?: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to submit a Commune post for moderation." };
  if (!input.acknowledgement) return { ok: false, message: "Confirm the safety acknowledgements before submitting." };
  const secretScan = scanCommuneTextForSecrets([input.title, input.body, input.tags, input.links, input.repositoryUrl ?? ""].join("\n"));
  if (secretScan.blocked) return { ok: false, message: `Submission blocked because it appears to contain private or secret material: ${secretScan.warnings.join(", ")}. Remove it before submitting.` };
  if (input.upload) {
    const media = validateCommuneMediaFile(input.upload);
    if (!media.ok) return { ok: false, message: media.message };
  }
  if (input.postType === "official_update" && !account.isAdmin) return { ok: false, message: "Official Updates are restricted to authorized administrators. Community users cannot self-assign official publishing authority." };
  const tags = parseCommuneTags(input.tags);
  const links = splitList(input.links);
  const postId = crypto.randomUUID();
  const adminDirectPublish = account.isAdmin;
  const now = new Date().toISOString();
  const { error: postError } = await supabase.from(canonicalCommuneTables.posts).insert({ id: postId, user_id: account.userId, author_username: account.username, post_type: input.postType, title: input.title.trim(), body: input.body.trim(), excerpt: excerpt(input.body), tags, links, repository_url: input.repositoryUrl?.trim() || null, status: adminDirectPublish ? "published" : "pending_review", moderation_status: adminDirectPublish ? "approved" : "pending_review", published_at: adminDirectPublish ? now : null, safety_acknowledgements: { public_boundary: true, no_secrets: true, no_execution: true } });
  if (postError) return { ok: false, message: friendlyError(postError.message, "This room post is blocked by the current database policy. If you are signed in, the Commune room post/admin publishing policy may need to be applied.") };
  let threadId: string | null = null;
  const { data: thread, error: threadError } = await supabase.from(canonicalCommuneTables.threads).insert({ post_id: postId, room_id: input.roomId || null, title: input.title.trim(), created_by: account.userId, visibility: "public" }).select("id").single();
  if (!threadError) threadId = (thread as { id: string }).id;
  if (adminDirectPublish) {
    await grantThreadParticipationApproval({ threadId, postId, userId: account.userId, approvedBy: account.userId, source: "admin_direct_post" });
    await recordCommuneGovernanceEvent({ actorId: account.userId, targetType: "post", targetId: postId, action: "admin_post_published", fromStatus: "draft", toStatus: "published", metadata: { post_type: input.postType, review_item_created: false } });
  }
  if (input.upload) {
    const upload = await uploadCommuneAttachment(input.upload, { postId, role: "post_attachment", publishImmediately: adminDirectPublish });
    if (!upload.ok) return { ok: false, message: `${adminDirectPublish ? "Post published directly" : "Post saved for review"}, but upload failed: ${upload.message}` };
  }
  if (adminDirectPublish) await publishPostAttachments(postId);
  if (input.postType === "repository_showcase" && input.repositoryUrl) {
    const repo = await submitRepositoryShowcase({ repositoryUrl: input.repositoryUrl, projectName: input.title, projectSummary: excerpt(input.body), postId, sandboxRequested: Boolean(input.sandboxRequested) });
    if (!repo.ok) return { ok: false, message: `Post saved, but repository showcase failed: ${repo.message}` };
  }
  if (adminDirectPublish) {
    const history = await createReviewHistoryItem({ domain: "commune", sourceTable: "commune_posts", sourceId: postId, submittedBy: account.userId, title: input.title.trim(), summary: excerpt(input.body), status: "approved", eventType: "admin_post_direct_published", metadata: { post_type: input.postType, thread_id: threadId, review_item_created: false } });
    const historyWarning = history.ok ? "" : ` History record needs attention: ${history.warning ?? "review history unavailable"}.`;
    return { ok: true, postId, message: `Admin post published directly${threadId ? " with a public thread" : ""}. It remains auditable in Commune governance history.${historyWarning}` };
  }
  const review = await createReviewItem({ domain: "commune", sourceTable: "commune_posts", sourceId: postId, submittedBy: account.userId, title: input.title.trim(), summary: excerpt(input.body) });
  return { ok: true, postId, message: review.ok ? `Commune post submitted for moderation${threadId ? " with a pending thread" : ""}. It is not public until approved.` : `Post saved, but review routing needs attention: ${review.warning}` };
}

export async function submitComment(input: { postId: string; threadId: string; body: string; parentCommentId?: string | null }): Promise<SubmitCommentResult> {
  if (!supabase) return { ok: false, status: "backend_unavailable", message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, status: "failed", message: "Sign in to submit a comment for moderation." };
  if (!input.postId) return { ok: false, status: "failed", message: "Comment could not be submitted because this post id is missing." };
  if (!input.threadId) return { ok: false, status: "missing_thread", message: "Comment could not be submitted because this post has no discussion thread yet." };
  if (!input.body.trim()) return { ok: false, status: "failed", message: input.parentCommentId ? "Write a reply before submitting." : "Write a comment before submitting." };
  const secretScan = scanCommuneTextForSecrets(input.body);
  if (secretScan.blocked) return { ok: false, status: "failed", message: `Comment blocked because it appears to contain private or secret material: ${secretScan.warnings.join(", ")}.` };
  if (!account.isModerator) {
    const { officialUpdate } = await loadOfficialUpdateForPost(input.postId);
    if (officialUpdate && officialUpdate.comments_enabled === false) return { ok: false, status: "failed", message: "Comments are locked for this Official Update. Public discussion is disabled by an administrator for this notice." };
  }
  const id = crypto.randomUUID();
  const approvedParticipant = await hasThreadParticipationApproval({ threadId: input.threadId, postId: input.postId, userId: account.userId, isModerator: account.isModerator });
  const directPublish = approvedParticipant;
  const publishedAt = directPublish ? new Date().toISOString() : null;
  const { error } = await supabase.from(canonicalCommuneTables.comments).insert({ id, thread_id: input.threadId, post_id: input.postId, parent_comment_id: input.parentCommentId || null, user_id: account.userId, author_username: account.username, body: input.body.trim(), status: directPublish ? "published" : "pending_review", published_at: publishedAt });
  if (error) return { ok: false, status: "failed", message: friendlyError(error.message, "Comment moderation backend is not active yet.") };
  if (!directPublish) {
    const review = await createReviewItem({ domain: "commune", sourceTable: "commune_comments", sourceId: id, submittedBy: account.userId, title: input.parentCommentId ? "Commune reply" : "Commune comment", summary: excerpt(input.body) });
    if (!review.ok) {
      await supabase.from(canonicalCommuneTables.comments).update({ status: "deleted_by_user", updated_at: new Date().toISOString(), moderation_reason: "Review routing failed after pending comment insert." }).eq("id", id).eq("user_id", account.userId);
      return { ok: false, status: "failed", commentId: id, message: `Comment could not enter Admin review yet: ${review.warning ?? "review routing unavailable"}. It was kept out of public view; please ask an administrator to check Commune review routing before resubmitting.` };
    }
    return { ok: true, status: "pending_review", commentId: id, message: "First contribution to this post/thread submitted for moderation. Once approved here, you can continue in this thread." };
  }
  const history = await createReviewHistoryItem({
    domain: "commune",
    sourceTable: "commune_comments",
    sourceId: id,
    submittedBy: account.userId,
    title: input.parentCommentId ? "Direct-published Commune reply" : "Direct-published Commune comment",
    summary: excerpt(input.body),
    status: "approved",
    eventType: account.isAdmin ? "admin_comment_direct_published" : account.isModerator ? "moderator_comment_direct_published" : "approved_participant_comment_direct_published",
    metadata: { post_id: input.postId, thread_id: input.threadId, parent_comment_id: input.parentCommentId ?? null }
  });
  const historyWarning = history.ok ? "" : ` History record needs attention: ${history.warning ?? "review history unavailable"}.`;
  if (account.isAdmin || account.isModerator) await recordCommuneGovernanceEvent({ actorId: account.userId, targetType: input.parentCommentId ? "reply" : "comment", targetId: id, action: account.isAdmin ? "admin_comment_published" : "moderator_comment_published", fromStatus: "draft", toStatus: "published", metadata: { post_id: input.postId, thread_id: input.threadId, parent_comment_id: input.parentCommentId ?? null, review_item_created: false } });
  return { ok: true, status: "published", commentId: id, message: `${input.parentCommentId ? "Reply published in this thread." : "Comment published in this thread."}${historyWarning}` };
}

export async function savePost(postId: string): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to save Commune posts." };
  const { error } = await supabase.from(canonicalCommuneTables.savedPosts).upsert({ user_id: account.userId, post_id: postId }, { onConflict: "user_id,post_id" });
  return { ok: !error, message: error ? friendlyError(error.message, "Saved posts are not active yet.") : "Post saved to your Commons Circle." };
}

export async function followThread(threadId: string): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to follow Commune threads." };
  const { error } = await supabase.from(canonicalCommuneTables.followedThreads).upsert({ user_id: account.userId, thread_id: threadId }, { onConflict: "user_id,thread_id" });
  return { ok: !error, message: error ? friendlyError(error.message, "Followed threads are not active yet.") : "Thread followed. Commons Circle can now show it." };
}

export async function markThreadRead(threadId: string): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in first." };
  const { error } = await supabase.from(canonicalCommuneTables.followedThreads).update({ last_read_at: new Date().toISOString() }).eq("user_id", account.userId).eq("thread_id", threadId);
  return { ok: !error, message: error ? friendlyError(error.message, "Followed-thread read state is not active yet.") : "Thread marked read." };
}

export async function loadCommuneReactionSummary(targets: CommuneReactionTarget[]): Promise<{ summaries: Record<string, CommuneReactionSummary>; warnings: string[] }> {
  const summaries: Record<string, CommuneReactionSummary> = {};
  for (const target of targets) summaries[communeReactionKey(target.targetType, target.targetId)] = { helpful: 0, caution: 0, viewerReaction: null };
  if (!targets.length) return { summaries, warnings: [] };
  if (!supabase) return { summaries, warnings: [supabaseNotConfiguredMessage] };
  const warnings: string[] = [];
  const targetIds = Array.from(new Set(targets.map((target) => target.targetId)));
  const { data: counts, error: countError } = await supabase.from("commune_content_reaction_counts").select("target_type,target_id,helpful_count,caution_count").in("target_id", targetIds);
  if (countError) warnings.push(friendlyError(countError.message, "Commune community signals are not active until the reaction-count migration is applied."));
  for (const row of (counts ?? []) as Array<{ target_type: CommuneReactionTargetType; target_id: string; helpful_count?: number | null; caution_count?: number | null }>) {
    const key = communeReactionKey(row.target_type, row.target_id);
    if (!summaries[key]) continue;
    summaries[key] = { ...summaries[key], helpful: row.helpful_count ?? 0, caution: row.caution_count ?? 0 };
  }
  const account = await accountState();
  if (account.userId) {
    const { data: reactions, error: reactionError } = await supabase.from("commune_content_reactions").select("target_type,target_id,reaction").eq("user_id", account.userId).in("target_id", targetIds);
    if (reactionError) warnings.push(friendlyError(reactionError.message, "Your Commune community signal state could not be loaded yet."));
    for (const row of (reactions ?? []) as Array<{ target_type: CommuneReactionTargetType; target_id: string; reaction: CommuneReaction }>) {
      const key = communeReactionKey(row.target_type, row.target_id);
      if (!summaries[key]) continue;
      summaries[key] = { ...summaries[key], viewerReaction: row.reaction };
    }
  }
  return { summaries, warnings };
}

export async function setCommuneReaction(targetType: CommuneReactionTargetType, targetId: string, reaction: CommuneReaction): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to add a Commune community signal." };
  const { error } = await supabase.from("commune_content_reactions").upsert({ user_id: account.userId, target_type: targetType, target_id: targetId, reaction, updated_at: new Date().toISOString() }, { onConflict: "user_id,target_type,target_id" });
  return { ok: !error, message: error ? friendlyError(error.message, "Commune community signals are not active until the reaction migration is applied.") : "Community signal saved. It does not replace reporting or moderation." };
}

export async function clearCommuneReaction(targetType: CommuneReactionTargetType, targetId: string): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to change Commune community signals." };
  const { error } = await supabase.from("commune_content_reactions").delete().eq("user_id", account.userId).eq("target_type", targetType).eq("target_id", targetId);
  return { ok: !error, message: error ? friendlyError(error.message, "Commune community signals are not active yet.") : "Community signal removed." };
}

export async function moderateCommuneContentTarget(input: { targetType: CommuneReactionTargetType; targetId: string; action: "flag" | "hide" | "delete"; reason?: string }): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId || !account.isModerator) return { ok: false, message: "Commune moderation controls require an assigned moderator/admin role." };
  const table = input.targetType === "post" ? canonicalCommuneTables.posts : canonicalCommuneTables.comments;
  const currentSelect = input.targetType === "post" ? "id,status,post_type,visibility,visibility_state,moderation_status" : "id,status,post_id,thread_id,visibility_state";
  const { data: current, error: currentError } = await supabase.from(table).select(currentSelect).eq("id", input.targetId).maybeSingle();
  if (currentError) return { ok: false, message: friendlyError(currentError.message, "This Commune item could not be loaded for moderation yet.") };
  if (!current) return { ok: false, message: "This Commune item could not be found for moderation." };
  const previousStatus = String((current as { status?: string } | null)?.status ?? "unknown");
  const now = new Date().toISOString();
  const actionStatus = input.action === "flag" ? "hidden" : input.action === "hide" ? "hidden" : "removed_by_moderator";
  const update: Record<string, unknown> = { status: actionStatus, updated_at: now, moderation_reason: input.reason || null };
  if (input.targetType === "post") {
    update.visibility = "private_draft";
    update.visibility_state = input.action === "flag" ? "flagged" : input.action === "hide" ? "hidden" : "removed";
    update.moderation_status = input.action === "flag" ? "flagged_for_removal" : input.action === "hide" ? "hidden_from_public" : "soft_deleted_by_moderator";
    update.hidden_at = now;
    update.hidden_by = account.userId;
    if (input.action === "flag") update.flagged_at = now;
    if (input.action === "delete") update.removed_at = now;
  } else {
    update.visibility_state = input.action === "delete" ? "removed" : "hidden";
    update.hidden_at = now;
    update.hidden_by = account.userId;
    if (input.action === "delete") update.removed_at = now;
  }
  const { error } = await supabase.from(table).update(update).eq("id", input.targetId);
  if (error) return { ok: false, message: friendlyError(error.message, "This Commune moderation action could not be saved yet.") };
  if (input.targetType === "post") {
    const mediaState = input.action === "delete" ? "removed" : "hidden";
    const { error: mediaError } = await supabase
      .from(canonicalCommuneTables.media)
      .update({ visibility_state: mediaState, updated_at: now })
      .eq("post_id", input.targetId)
      .in("visibility_state", ["published", "submitted", "flagged"]);
    if (mediaError && import.meta.env.DEV) console.warn("[Commune post media moderation]", mediaError.message);
    const postType = String((current as { post_type?: string } | null)?.post_type ?? "");
    const sidecarStatus = input.action === "delete" ? "rejected" : "needs_information";
    if (postType === "troubleshooting") await supabase.from(canonicalCommuneTables.troubleshootingPosts).update({ troubleshooting_status: input.action === "delete" ? "archived" : "needs_information", updated_at: now, archived_at: input.action === "delete" ? now : null }).eq("post_id", input.targetId);
    if (postType === "repository_showcase") await supabase.from(canonicalCommuneTables.repositoryShowcases).update({ status: sidecarStatus, updated_at: now }).eq("post_id", input.targetId);
    if (postType === "elysia_iteration_showcase") await supabase.from(canonicalCommuneTables.iterationShowcases).update({ status: sidecarStatus, updated_at: now }).eq("post_id", input.targetId);
    if (postType === "official_update") await supabase.from(canonicalCommuneTables.officialUpdates).update({ official_status: input.action === "delete" ? "archived" : "updated", correction_status: input.action === "delete" ? "retracted" : "none", archived_at: input.action === "delete" ? now : null, updated_at: now }).eq("post_id", input.targetId);
  }
  await supabase.from("commune_moderation_events").insert({
    actor_id: account.userId,
    target_type: input.targetType,
    target_id: input.targetId,
    action: input.action === "flag" ? "flag_for_removal" : input.action === "hide" ? "hide_from_public" : "soft_delete_from_public",
    from_status: previousStatus,
    to_status: actionStatus,
    reason: input.reason || null,
    metadata: { source: "post_detail_moderation_controls", public_content_removed: true, hard_delete: false }
  });
  return {
    ok: true,
    message: input.action === "delete"
      ? "Content removed from public views. Evidence remains in admin-only Commune history; hard delete is not performed from the public frontend."
      : input.action === "flag"
        ? "Content flagged for removal and hidden from public views."
        : "Content hidden from public views."
  };
}

export async function submitRepositoryShowcase(input: { repositoryUrl: string; projectName: string; projectSummary: string; postId?: string; roomId?: string; body?: string; tags?: string; links?: string; provider?: string; branch?: string; commit?: string; license?: string; readmePreview?: string; fileTreePreview?: string; screenshotNotes?: string; manifestStatus?: string; compatibility?: string; warnings?: string[]; sandboxRequested?: boolean; importSource?: string; importedMetadata?: Record<string, unknown>; importedAt?: string | null; redactionNotes?: string }): Promise<{ ok: boolean; message: string; id?: string; postId?: string; sandboxReviewRequestId?: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to submit repository showcases." };
  if (!input.projectName.trim()) return { ok: false, message: "Add a repository showcase title before submitting." };
  const host = (() => { try { const url = new URL(input.repositoryUrl); return ["http:", "https:"].includes(url.protocol) && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(url.hostname) ? url.hostname : null; } catch { return null; } })();
  if (!host) return { ok: false, message: "Use a public HTTP(S) repository URL. Localhost/private repository URLs are not accepted for public Commune metadata." };
  const riskFlags = Array.from(new Set((input.warnings ?? []).map((item) => item.trim()).filter(Boolean)));
  const secretScan = scanCommuneTextForSecrets([input.repositoryUrl, input.projectName, input.projectSummary, input.body ?? "", input.provider ?? "", input.branch ?? "", input.commit ?? "", input.license ?? "", input.readmePreview ?? "", input.fileTreePreview ?? "", input.screenshotNotes ?? "", input.manifestStatus ?? "", input.compatibility ?? "", riskFlags.join("\n"), input.redactionNotes ?? "", JSON.stringify(input.importedMetadata ?? {})].join("\n"));
  if (secretScan.blocked) return { ok: false, message: "Repository showcase blocked because it appears to contain private or secret material: " + secretScan.warnings.join(", ") + ". Remove it before submitting." };
  let postId = input.postId || null;
  const now = new Date().toISOString();
  const adminDirectPublish = account.isAdmin;
  const body = input.body?.trim() || input.projectSummary.trim();
  if (!postId) {
    postId = crypto.randomUUID();
    const { error: postError } = await supabase.from(canonicalCommuneTables.posts).insert({
      id: postId,
      user_id: account.userId,
      author_username: account.username,
      post_type: "repository_showcase",
      title: input.projectName.trim(),
      body,
      excerpt: excerpt(body),
      tags: parseCommuneTags(input.tags ?? "repository showcase"),
      links: splitList(input.links ?? input.repositoryUrl),
      repository_url: input.repositoryUrl,
      status: adminDirectPublish ? "published" : "pending_review",
      moderation_status: adminDirectPublish ? "approved" : "pending_review",
      published_at: adminDirectPublish ? now : null,
      safety_acknowledgements: { public_boundary: true, no_secrets: true, no_execution: true, repository_metadata_only: true }
    });
    if (postError) return { ok: false, message: friendlyError(postError.message, "This repository showcase post is blocked by the current database policy. If you are signed in, the Commune room post/admin publishing policy may need to be applied.") };
    const { data: thread } = await supabase.from(canonicalCommuneTables.threads).insert({ post_id: postId, room_id: input.roomId || null, title: input.projectName.trim(), created_by: account.userId, visibility: "public" }).select("id").single();
    const threadId = (thread as { id?: string } | null)?.id ?? null;
    if (adminDirectPublish) {
      await grantThreadParticipationApproval({ threadId, postId, userId: account.userId, approvedBy: account.userId, source: "admin_direct_repository_showcase" });
      await recordCommuneGovernanceEvent({ actorId: account.userId, targetType: "post", targetId: postId, action: "admin_post_published", fromStatus: "draft", toStatus: "published", metadata: { post_type: "repository_showcase", review_item_created: false } });
    }
  }
  const summary = [
    input.projectSummary,
    input.branch ? "Branch: " + input.branch : "",
    input.commit ? "Commit: " + input.commit : "",
    input.license ? "License: " + input.license : "",
    input.manifestStatus ? "Manifest: " + input.manifestStatus : "",
    input.compatibility ? "Compatibility: " + input.compatibility : "",
    riskFlags.length ? "Warnings: " + riskFlags.join(", ") : ""
  ].filter(Boolean).join("\n");
  const structuredPayload = {
    user_id: account.userId,
    post_id: postId,
    repository_url: input.repositoryUrl,
    repository_host: host,
    project_name: input.projectName,
    project_summary: summary || input.projectSummary,
    provider: input.provider || host,
    default_branch: input.branch || null,
    commit_sha: input.commit || null,
    license: input.license || null,
    manifest_status: input.manifestStatus || "No manifest checked",
    elysia_compatibility: input.compatibility || "Unknown",
    short_description: input.projectSummary || null,
    readme_preview: input.readmePreview || null,
    file_tree_preview: input.fileTreePreview || null,
    screenshot_notes_or_urls: input.screenshotNotes || null,
    risk_flags: riskFlags,
    sandbox_review_requested: Boolean(input.sandboxRequested),
    sandbox_review_status: input.sandboxRequested ? "requested" : "not_requested",
    status: adminDirectPublish ? "approved" : "pending_review",
    import_source: input.importSource || "manual",
    imported_metadata: input.importedMetadata ?? {},
    imported_at: input.importedAt || null,
    redaction_notes: input.redactionNotes || null
  };
  const insertAttempt = await supabase.from(canonicalCommuneTables.repositoryShowcases).insert(structuredPayload).select("id").single();
  let data = insertAttempt.data as { id: string } | null;
  if (insertAttempt.error) {
    if (!/schema cache|Could not find|does not exist|column/i.test(insertAttempt.error.message)) return { ok: false, message: friendlyError(insertAttempt.error.message, "Repository showcase review queue is not active yet.") };
    const fallback = await supabase.from(canonicalCommuneTables.repositoryShowcases).insert({ user_id: account.userId, post_id: postId, repository_url: input.repositoryUrl, repository_host: host, project_name: input.projectName, project_summary: summary || input.projectSummary, license: input.license || null, safety_notes: riskFlags.join(", ") || null, sandbox_review_requested: Boolean(input.sandboxRequested), status: adminDirectPublish ? "approved" : "pending_review" }).select("id").single();
    if (fallback.error) return { ok: false, message: friendlyError(fallback.error.message, "Repository showcase review queue is not active yet.") };
    data = fallback.data as { id: string };
  }
  if (!data) return { ok: false, message: "Repository showcase could not be saved because the database did not return a row id." };
  const id = data.id;
  let sandboxReviewRequestId: string | undefined;
  if (adminDirectPublish) {
    await createReviewHistoryItem({ domain: "commune", sourceTable: "commune_posts", sourceId: postId, submittedBy: account.userId, title: input.projectName, summary: "Admin-published repository showcase metadata only. The website did not clone, build, run, or execute code.", status: "approved", eventType: "admin_repository_showcase_direct_published", metadata: { repository_showcase_id: id, repository_url: input.repositoryUrl } });
  } else {
    await createReviewItem({ domain: "commune", sourceTable: "commune_posts", sourceId: postId, submittedBy: account.userId, title: input.projectName, summary: "Repository showcase post. Metadata only; no repository was cloned, built, run, or executed." });
    await createReviewItem({ domain: "commune", sourceTable: "commune_repository_showcases", sourceId: id, submittedBy: account.userId, title: input.projectName, summary: "Repository showcase metadata only. The website did not clone, build, run, or execute code." });
  }
  if (input.sandboxRequested) {
    const sandbox = await submitSandboxReview({ requestTitle: "Repository artifact review: " + input.projectName, repositoryUrl: input.repositoryUrl, repositoryShowcaseId: id, postId, scope: "Selected artifact/snippet review only. The whole repository is not cloned, built, installed, or executed.", riskNotes: "Repository Showcase requested bounded artifact review. Website did not execute the repository.", permissions: [] });
    if (sandbox.ok) {
      sandboxReviewRequestId = sandbox.id;
      await supabase.from(canonicalCommuneTables.repositoryShowcases).update({ sandbox_review_status: "requested", sandbox_review_request_id: sandbox.id ?? null, updated_at: new Date().toISOString() }).eq("id", id);
    }
  }
  return { ok: true, message: adminDirectPublish ? "Repository showcase published as an admin-authored public post. No repository was fetched, cloned, built, or executed." : "Repository showcase submitted as a normal Commune post for moderation. No repository was fetched, cloned, built, or executed.", id, postId, sandboxReviewRequestId };
}

export async function submitIterationShowcase(input: {
  title: string;
  summary: string;
  body: string;
  tags: string;
  links: string;
  roomId?: string;
  upload?: File | null;
  iterationType?: string;
  versionBuildLabel?: string;
  whatChanged?: string;
  whyItMatters?: string;
  knownLimitations?: string;
  nextStep?: string;
  relatedRepoUrl?: string;
  provider?: string;
  branch?: string;
  commitSha?: string;
  releaseTag?: string;
  pullRequestUrl?: string;
  developerForgeLink?: string;
  marketplaceLink?: string;
  testingStatus?: string;
  compatibilityNote?: string;
  riskFlags?: string[];
  sandboxRequested?: boolean;
  importSource?: string;
  importedMetadata?: Record<string, unknown>;
  importedAt?: string | null;
  redactionNotes?: string;
}): Promise<{ ok: boolean; message: string; id?: string; postId?: string; sandboxReviewRequestId?: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to submit Elysia Iteration Showcases." };
  if (!input.title.trim()) return { ok: false, message: "Add an iteration title before submitting." };
  const relatedRepoUrl = publicHttpUrlOrNull(input.relatedRepoUrl);
  if (input.relatedRepoUrl?.trim() && !relatedRepoUrl) return { ok: false, message: "Use a public HTTP(S) related source URL. Localhost, private network, and local repository URLs are not accepted for public iteration metadata." };
  const pullRequestUrl = publicHttpUrlOrNull(input.pullRequestUrl);
  if (input.pullRequestUrl?.trim() && !pullRequestUrl) return { ok: false, message: "Use a public HTTP(S) pull request URL or leave it blank." };
  const developerForgeLink = publicHttpUrlOrNull(input.developerForgeLink);
  if (input.developerForgeLink?.trim() && !developerForgeLink) return { ok: false, message: "Use a public HTTP(S) Developer Forge link or leave it blank." };
  const marketplaceLink = publicHttpUrlOrNull(input.marketplaceLink);
  if (input.marketplaceLink?.trim() && !marketplaceLink) return { ok: false, message: "Use a public HTTP(S) Marketplace link or leave it blank." };
  if (input.upload) {
    const media = validateCommuneMediaFile(input.upload);
    if (!media.ok) return { ok: false, message: media.message };
  }
  const riskFlags = Array.from(new Set((input.riskFlags ?? []).map((item) => item.trim()).filter(Boolean)));
  const secretScan = scanCommuneTextForSecrets([
    input.title,
    input.summary,
    input.body,
    input.tags,
    input.links,
    input.iterationType ?? "",
    input.versionBuildLabel ?? "",
    input.whatChanged ?? "",
    input.whyItMatters ?? "",
    input.knownLimitations ?? "",
    input.nextStep ?? "",
    relatedRepoUrl ?? "",
    input.provider ?? "",
    input.branch ?? "",
    input.commitSha ?? "",
    input.releaseTag ?? "",
    pullRequestUrl ?? "",
    developerForgeLink ?? "",
    marketplaceLink ?? "",
    input.testingStatus ?? "",
    input.compatibilityNote ?? "",
    riskFlags.join("\n"),
    input.redactionNotes ?? "",
    JSON.stringify(input.importedMetadata ?? {})
  ].join("\n"));
  if (secretScan.blocked) return { ok: false, message: "Elysia Iteration Showcase blocked because it appears to contain private or secret material: " + secretScan.warnings.join(", ") + ". Remove it before submitting." };

  const now = new Date().toISOString();
  const postId = crypto.randomUUID();
  const adminDirectPublish = account.isAdmin;
  const links = splitList(input.links);
  if (relatedRepoUrl && !links.includes(relatedRepoUrl)) links.push(relatedRepoUrl);
  const { error: postError } = await supabase.from(canonicalCommuneTables.posts).insert({
    id: postId,
    user_id: account.userId,
    author_username: account.username,
    post_type: "elysia_iteration_showcase",
    title: input.title.trim(),
    body: input.body.trim(),
    excerpt: excerpt(input.summary || input.body),
    tags: parseCommuneTags(input.tags),
    links,
    repository_url: relatedRepoUrl,
    status: adminDirectPublish ? "published" : "pending_review",
    moderation_status: adminDirectPublish ? "approved" : "pending_review",
    published_at: adminDirectPublish ? now : null,
    safety_acknowledgements: { public_boundary: true, no_secrets: true, no_execution: true, iteration_progress_only: true, not_official_update: true, marketplace_separate: true }
  });
  if (postError) return { ok: false, message: friendlyError(postError.message, "This Elysia Iteration Showcase post is blocked by the current database policy. If you are signed in, the Commune room post/admin publishing policy may need to be applied.") };
  const { data: thread } = await supabase.from(canonicalCommuneTables.threads).insert({ post_id: postId, room_id: input.roomId || null, title: input.title.trim(), created_by: account.userId, visibility: "public" }).select("id").single();
  const threadId = (thread as { id?: string } | null)?.id ?? null;
  if (adminDirectPublish) {
    await grantThreadParticipationApproval({ threadId, postId, userId: account.userId, approvedBy: account.userId, source: "admin_direct_iteration_showcase" });
    await recordCommuneGovernanceEvent({ actorId: account.userId, targetType: "post", targetId: postId, action: "admin_post_published", fromStatus: "draft", toStatus: "published", metadata: { post_type: "elysia_iteration_showcase", review_item_created: false } });
  }
  const structuredPayload = {
    post_id: postId,
    author_user_id: account.userId,
    iteration_type: input.iterationType || null,
    version_build_label: input.versionBuildLabel || null,
    what_changed: input.whatChanged || null,
    why_it_matters: input.whyItMatters || null,
    known_limitations: input.knownLimitations || null,
    next_step: input.nextStep || null,
    related_repo_url: relatedRepoUrl,
    provider: input.provider || (relatedRepoUrl ? new URL(relatedRepoUrl).hostname : null),
    branch: input.branch || null,
    commit_sha: input.commitSha || null,
    release_tag: input.releaseTag || null,
    pull_request_url: pullRequestUrl,
    developer_forge_link: developerForgeLink,
    marketplace_link: marketplaceLink,
    testing_status: input.testingStatus || "not_tested",
    compatibility_note: input.compatibilityNote || null,
    sandbox_review_requested: Boolean(input.sandboxRequested),
    sandbox_review_status: input.sandboxRequested ? "requested" : "not_requested",
    risk_flags: riskFlags,
    import_source: input.importSource || "manual",
    imported_metadata: input.importedMetadata ?? {},
    imported_at: input.importedAt || null,
    redaction_notes: input.redactionNotes || null,
    status: adminDirectPublish ? "approved" : "pending_review"
  };
  const { data, error: iterationError } = await supabase.from(canonicalCommuneTables.iterationShowcases).insert(structuredPayload).select("id").single();
  if (iterationError) return { ok: false, message: friendlyError(iterationError.message, "Post saved, but Elysia Iteration Showcase structured metadata is not active yet. Apply the structured metadata migration, then resubmit.") };
  const id = (data as { id: string }).id;
  if (input.upload) {
    const upload = await uploadCommuneAttachment(input.upload, { postId, role: "iteration_showcase_attachment", publishImmediately: adminDirectPublish });
    if (!upload.ok) return { ok: false, message: `${adminDirectPublish ? "Iteration showcase published directly" : "Iteration showcase saved for review"}, but upload failed: ${upload.message}` };
  }
  if (adminDirectPublish) await publishPostAttachments(postId);
  let sandboxReviewRequestId: string | undefined;
  if (adminDirectPublish) {
    await createReviewHistoryItem({ domain: "commune", sourceTable: "commune_posts", sourceId: postId, submittedBy: account.userId, title: input.title, summary: "Admin-published Elysia Iteration Showcase. Public progress/demo context only; not official release, Marketplace, Developer Forge, security, or compatibility approval.", status: "approved", eventType: "admin_iteration_showcase_direct_published", metadata: { iteration_showcase_id: id, related_repo_url: relatedRepoUrl } });
  } else {
    await createReviewItem({ domain: "commune", sourceTable: "commune_posts", sourceId: postId, submittedBy: account.userId, title: input.title, summary: "Elysia Iteration Showcase post. Public progress/demo context only; not official release or approval." });
    await createReviewItem({ domain: "commune", sourceTable: canonicalCommuneTables.iterationShowcases, sourceId: id, submittedBy: account.userId, title: input.title, summary: "Structured Elysia Iteration Showcase metadata awaiting review." });
  }
  if (input.sandboxRequested) {
    const sandbox = await submitSandboxReview({
      requestTitle: "Elysia iteration selected artifact review: " + input.title,
      repositoryUrl: relatedRepoUrl ?? undefined,
      postId,
      scope: "Selected artifact/snippet/config/manifest review only. The full repository is not cloned, installed, built, tested, trusted, certified, or executed.",
      riskNotes: [input.knownLimitations, "Iteration Showcase requested bounded artifact review. This is not Official Update, Developer Forge approval, Marketplace readiness, security certification, compatibility proof, or installability."].filter(Boolean).join("\n"),
      permissions: []
    });
    if (sandbox.ok) {
      sandboxReviewRequestId = sandbox.id;
      await supabase.from(canonicalCommuneTables.iterationShowcases).update({ sandbox_review_status: "requested", sandbox_review_request_id: sandbox.id ?? null, updated_at: new Date().toISOString() }).eq("id", id);
    }
  }
  await supabase.from("user_notifications").insert({
    user_id: account.userId,
    notification_type: adminDirectPublish ? "iteration_showcase_published" : "iteration_showcase_submitted",
    source_type: "commune_iteration_showcases",
    source_id: id,
    title: adminDirectPublish ? "Elysia Iteration Showcase published" : "Elysia Iteration Showcase submitted",
    body: adminDirectPublish ? "Your iteration is public progress context. It is not an official release, approval, trust, or Marketplace readiness signal." : "Your iteration showcase is pending review. It is not public until approved.",
    action_url: "/commune/posts/" + postId
  });
  return { ok: true, message: adminDirectPublish ? "Elysia Iteration Showcase published as an admin-authored public progress post. It is not an official release, approval, compatibility proof, or Marketplace readiness signal." : "Elysia Iteration Showcase submitted as a normal Commune post for moderation. It is not public until approved.", id, postId, sandboxReviewRequestId };
}

export async function submitSandboxReview(input: { requestTitle: string; repositoryUrl?: string; packageUrl?: string; repositoryShowcaseId?: string; postId?: string; scope: string; riskNotes: string; permissions: string[] }): Promise<{ ok: boolean; message: string; id?: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to request sandbox review." };
  const scan = scanCommuneTextForSecrets([input.requestTitle, input.repositoryUrl ?? "", input.packageUrl ?? "", input.scope, input.riskNotes, ...input.permissions].join("\n"));
  if (scan.blocked) return { ok: false, message: `Sandbox request blocked because it appears to contain private or secret material: ${scan.warnings.join(", ")}.` };
  const { data, error } = await supabase.from(canonicalCommuneTables.sandboxReviews).insert({ user_id: account.userId, post_id: input.postId || null, repository_showcase_id: input.repositoryShowcaseId || null, request_title: input.requestTitle, repository_url: input.repositoryUrl || null, package_url: input.packageUrl || null, requested_review_scope: input.scope, risk_notes: input.riskNotes, declared_permissions: input.permissions, status: "requested" }).select("id").single();
  if (error) return { ok: false, message: friendlyError(error.message, "Sandbox review queue is not active yet.") };
  const id = (data as { id: string }).id;
  await createReviewItem({ domain: "commune", sourceTable: "commune_sandbox_review_requests", sourceId: id, submittedBy: account.userId, title: input.requestTitle, summary: "Sandbox review request only. The website does not execute submitted code." });
  return { ok: true, message: "Sandbox review request saved for moderators. This is not execution permission.", id };
}

export async function requestIterationShowcaseSandboxReview(input: {
  iterationId?: string | null;
  postId?: string | null;
  title: string;
  relatedRepoUrl?: string | null;
  artifactFileName?: string | null;
  artifactNote?: string | null;
  knownLimitations?: string | null;
}): Promise<{ ok: boolean; message: string; id?: string }> {
  const result = await submitSandboxReview({
    requestTitle: "Elysia iteration selected artifact review: " + (input.title.trim() || input.artifactFileName || "selected artifact"),
    repositoryUrl: input.relatedRepoUrl || undefined,
    postId: input.postId || undefined,
    scope: "Selected artifact/snippet/config/manifest review only. No full repository clone, install, build, shell, dependency install, network behavior, production readiness, Developer Forge approval, or Marketplace readiness is requested.",
    riskNotes: [input.artifactNote, input.knownLimitations, "Artifact: " + (input.artifactFileName || "unnamed selected artifact"), "Elysia Iteration Showcase progress context only. This is not an Official Update, compatibility proof, installability claim, security certification, or trust label."].filter(Boolean).join("\n"),
    permissions: []
  });
  if (!result.ok || !supabase || !input.iterationId) return result;
  const { error } = await supabase.from(canonicalCommuneTables.iterationShowcases).update({
    sandbox_review_requested: true,
    sandbox_review_status: "requested",
    sandbox_review_request_id: result.id ?? null,
    updated_at: new Date().toISOString()
  }).eq("id", input.iterationId);
  if (error) return { ...result, message: `${result.message} The request was saved, but the Elysia Iteration Showcase metadata row could not be linked yet: ${friendlyError(error.message, "Apply the structured metadata migration, then reopen the request from the post.")}` };
  return { ...result, message: "Elysia Iteration Showcase selected-artifact sandbox review request saved. This does not run, trust, certify, approve, or publish the full iteration." };
}

export async function reportCommuneContent(input: { postId?: string; commentId?: string; reportType: string; reason: string; profileUsername?: string }): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  const targetId = input.postId || input.commentId;
  if (targetId) {
    const { data: unified, error: unifiedError } = await supabase.from(canonicalCommuneTables.reports).insert({ reporter_user_id: account.userId, target_type: input.postId ? "post" : "comment", target_id: targetId, reason: input.reportType, details: input.reason, status: "submitted" }).select("id").single();
    if (!unifiedError) {
      if (account.userId) await createReviewItem({ domain: "commune", sourceTable: "commune_reports", sourceId: (unified as { id: string }).id, submittedBy: account.userId, title: `Commune report: ${input.reportType}`, summary: excerpt(input.reason) });
      return { ok: true, message: "Report saved for moderator review. Reporting does not automatically remove content." };
    }
    if (import.meta.env.DEV) console.warn("[Commune report fallback]", unifiedError.message);
  }
  const { data, error } = await supabase.from(canonicalCommuneTables.legacyReports).insert({ reporter_user_id: account.userId, post_id: input.postId || null, comment_id: input.commentId || null, public_profile_username: input.profileUsername || null, report_type: input.reportType, report_reason: input.reason, status: "pending_review" }).select("id").single();
  if (error) return { ok: false, message: friendlyError(error.message, "Report routing is not active yet.") };
  if (account.userId) await createReviewItem({ domain: "commune", sourceTable: "commune_abuse_reports", sourceId: (data as { id: string }).id, submittedBy: account.userId, title: `Commune report: ${input.reportType}`, summary: excerpt(input.reason) });
  return { ok: true, message: "Report saved for moderator review. Reporting does not automatically remove content." };
}

export async function uploadCommuneAttachment(file: File, attach: { postId?: string; commentId?: string; repositoryShowcaseId?: string; role: string; publishImmediately?: boolean }): Promise<{ ok: boolean; message: string; id?: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in before uploading Commune attachments." };
  const media = validateCommuneMediaFile(file);
  if (!media.ok) return { ok: false, message: media.message };
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || `upload.${ext}`;
  const storagePath = `${account.userId}/${Date.now()}-${safeName}`;
  const bucket = "commune-media";
  const upload = await supabase.storage.from(bucket).upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
  if (upload.error) return { ok: false, message: friendlyError(upload.error.message, "This attachment upload is blocked by the current storage policy. The Commune room media bucket or upload policy may need to be applied.") };
  const visibilityState = attach.publishImmediately ? "published" : "submitted";
  const { data: mediaRow, error: mediaError } = await supabase.from(canonicalCommuneTables.media).insert({ owner_user_id: account.userId, post_id: attach.postId || null, comment_id: attach.commentId || null, storage_bucket: bucket, storage_path: storagePath, file_name: file.name, mime_type: file.type || null, file_size: file.size, media_kind: media.mediaKind, visibility_state: visibilityState, warning_acknowledged: true }).select("id").single();
  if (mediaError) {
    await supabase.storage.from(bucket).remove([storagePath]);
    return { ok: false, message: friendlyError(mediaError.message, "This attachment upload is blocked by the current media metadata policy. The Commune room media table policy may need to be applied; the private upload was cleaned up.") };
  }
  const { error } = await supabase.from(canonicalCommuneTables.legacyUploads).insert({ user_id: account.userId, post_id: attach.postId || null, comment_id: attach.commentId || null, repository_showcase_id: attach.repositoryShowcaseId || null, storage_path: storagePath, original_filename: file.name, mime_type: file.type || null, size_bytes: file.size, upload_role: attach.role, status: attach.publishImmediately ? "published" : "pending_review" }).select("id").single();
  if (error && import.meta.env.DEV) console.warn("[Commune legacy upload metadata]", error.message);
  return { ok: true, message: attach.publishImmediately ? "Attachment uploaded and linked to the published post." : "Attachment uploaded privately for moderation. No public URL was created.", id: (mediaRow as { id: string }).id };
}

export async function createCodeSnippet(input: { postId: string; language: string; fileName: string; codeText: string; sandboxAcknowledged: boolean }): Promise<{ ok: boolean; message: string; id?: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in before adding code snippets." };
  if (!input.sandboxAcknowledged) return { ok: false, message: "Acknowledge that code snippets are inert text and not execution permission." };
  const scan = scanCommuneTextForSecrets([input.fileName, input.codeText].join("\n"));
  if (scan.blocked) return { ok: false, message: `Code snippet blocked because it appears to contain private or secret material: ${scan.warnings.join(", ")}.` };
  const { data, error } = await supabase.from("commune_code_snippets").insert({ post_id: input.postId, author_user_id: account.userId, language: input.language || null, file_name: input.fileName || null, code_text: input.codeText, secret_scan_status: scan.warnings.length ? "warning" : "clear", sandbox_warning_acknowledged: true }).select("id").single();
  if (error) return { ok: false, message: friendlyError(error.message, "Code snippet backend is not active yet.") };
  return { ok: true, message: "Code snippet saved as inert text. It was not executed.", id: (data as { id: string }).id };
}

export async function loadCodeSnippets(postId: string): Promise<{ snippets: CommuneCodeSnippet[]; warnings: string[] }> {
  if (!supabase) return { snippets: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("commune_code_snippets").select("*").eq("post_id", postId).order("created_at");
  return { snippets: (data ?? []) as CommuneCodeSnippet[], warnings: error ? [friendlyError(error.message, "Code snippets are not active yet.")] : [] };
}

export async function recordCodingSandboxRunResult(input: {
  snapshotId: string;
  sourceType: "commune_post_snippet" | "commune_code_document" | "commune_code_version" | "repository_showcase_artifact" | "iteration_showcase_artifact";
  sourceId?: string | null;
  postId?: string | null;
  codeDocumentId?: string | null;
  codeVersionId?: string | null;
  language: string;
  fileName?: string | null;
  requestPayload?: Record<string, unknown>;
  result: SandboxRunResult;
}): Promise<{ ok: boolean; message: string; runId?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to record Coding Cornucopia sandbox diagnostics." };
  const { data, error } = await supabase.rpc("record_commune_sandbox_run_result", {
    p_snapshot_id: input.result.snapshotId ?? input.snapshotId,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId ?? null,
    p_post_id: input.postId ?? null,
    p_code_document_id: input.codeDocumentId ?? null,
    p_code_version_id: input.codeVersionId ?? null,
    p_language: input.result.language ?? input.language,
    p_file_name: input.result.file ?? input.fileName ?? null,
    p_status: input.result.status,
    p_request_payload: input.requestPayload ?? {},
    p_result_summary: {
      ok: input.result.ok,
      status: input.result.status,
      runner_run_id: input.result.runId ?? null,
      message: input.result.message,
      diagnostics_count: input.result.diagnostics.length
    },
    p_stdout_preview: input.result.stdout ?? "",
    p_stderr_preview: input.result.stderr ?? "",
    p_exit_code: input.result.exitCode ?? null,
    p_duration_ms: input.result.durationMs ?? null,
    p_diagnostics: input.result.diagnostics
  });
  if (error) return { ok: false, message: friendlyError(error.message, "Coding Cornucopia sandbox result recording is not active until the latest Supabase migration is applied.") };
  return { ok: true, message: "Sandbox run result recorded privately for Commune sandbox review history.", runId: typeof data === "string" ? data : undefined };
}

export async function loadCommuneModerationQueue(): Promise<{ items: CommuneModerationItem[]; warnings: string[] }> {
  if (!supabase) return { items: [], warnings: [supabaseNotConfiguredMessage] };
  const account = await accountState();
  if (!account.isModerator) return { items: [], warnings: ["Commune moderation requires administrator, moderator, commune_moderator, or guardian_reviewer role."] };
  const warnings: string[] = [];
  const [posts, comments, uploads, repos, iterations, sandboxes, reports] = await Promise.all([
    supabase.from("commune_posts").select("id,title,status,created_at,excerpt").in("status", ["pending_review", "in_review", "needs_information", "hidden"]).order("created_at", { ascending: false }).limit(30),
    supabase.from("commune_comments").select("id,body,status,created_at").in("status", ["pending_review", "hidden"]).order("created_at", { ascending: false }).limit(30),
    supabase.from(canonicalCommuneTables.media).select("id,file_name,visibility_state,created_at").in("visibility_state", ["submitted", "flagged", "hidden"]).order("created_at", { ascending: false }).limit(30),
    supabase.from(canonicalCommuneTables.repositoryShowcases).select("id,project_name,status,created_at,project_summary").in("status", ["pending_review", "in_review", "needs_information"]).order("created_at", { ascending: false }).limit(30),
    supabase.from(canonicalCommuneTables.iterationShowcases).select("id,post_id,iteration_type,version_build_label,status,created_at,what_changed").in("status", ["pending_review", "in_review", "needs_information"]).order("created_at", { ascending: false }).limit(30),
    supabase.from(canonicalCommuneTables.sandboxReviews).select("id,request_title,status,created_at,risk_notes").in("status", ["requested", "in_review", "needs_information"]).order("created_at", { ascending: false }).limit(30),
    supabase.from(canonicalCommuneTables.legacyReports).select("id,report_type,status,created_at,report_reason").in("status", ["pending_review", "in_review", "escalated"]).order("created_at", { ascending: false }).limit(30)
  ]);
  for (const result of [posts, comments, uploads, repos, iterations, sandboxes, reports]) if (result.error) warnings.push(result.error.message);
  const items: CommuneModerationItem[] = [
    ...((posts.data ?? []) as Array<{ id: string; title: string; status: string; created_at?: string; excerpt?: string }>).map((row) => ({ id: row.id, kind: "post" as const, title: row.title, status: row.status, created_at: row.created_at, summary: row.excerpt })),
    ...((comments.data ?? []) as Array<{ id: string; body: string; status: string; created_at?: string }>).map((row) => ({ id: row.id, kind: "comment" as const, title: "Comment", status: row.status, created_at: row.created_at, summary: excerpt(row.body) })),
    ...((uploads.data ?? []) as Array<{ id: string; file_name: string; visibility_state: string; created_at?: string }>).map((row) => ({ id: row.id, kind: "upload" as const, title: row.file_name, status: row.visibility_state, created_at: row.created_at })),
    ...((repos.data ?? []) as Array<{ id: string; project_name: string; status: string; created_at?: string; project_summary?: string }>).map((row) => ({ id: row.id, kind: "repo" as const, title: row.project_name, status: row.status, created_at: row.created_at, summary: row.project_summary })),
    ...((iterations.data ?? []) as Array<{ id: string; post_id?: string; iteration_type?: string; version_build_label?: string; status: string; created_at?: string; what_changed?: string }>).map((row) => ({ id: row.id, kind: "iteration" as const, title: ["Elysia Iteration Showcase", row.iteration_type, row.version_build_label].filter(Boolean).join(" · "), status: row.status, created_at: row.created_at, summary: row.what_changed })),
    ...((sandboxes.data ?? []) as Array<{ id: string; request_title: string; status: string; created_at?: string; risk_notes?: string }>).map((row) => ({ id: row.id, kind: "sandbox" as const, title: row.request_title, status: row.status, created_at: row.created_at, summary: row.risk_notes })),
    ...((reports.data ?? []) as Array<{ id: string; report_type: string; status: string; created_at?: string; report_reason?: string }>).map((row) => ({ id: row.id, kind: "report" as const, title: row.report_type, status: row.status, created_at: row.created_at, summary: row.report_reason }))
  ];
  return { items, warnings };
}

export async function moderateCommuneItem(item: CommuneModerationItem, action: "approve" | "reject" | "hide" | "archive" | "needs_information" | "lock" | "escalate", reason: string): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId || !account.isModerator) return { ok: false, message: "Commune moderation requires an assigned moderator/admin role." };
  const now = new Date().toISOString();
  const table = item.kind === "post" ? canonicalCommuneTables.posts : item.kind === "comment" ? canonicalCommuneTables.comments : item.kind === "upload" ? canonicalCommuneTables.media : item.kind === "repo" ? canonicalCommuneTables.repositoryShowcases : item.kind === "iteration" ? canonicalCommuneTables.iterationShowcases : item.kind === "sandbox" ? canonicalCommuneTables.sandboxReviews : canonicalCommuneTables.legacyReports;
  const ownerSelect = item.kind === "post" ? "user_id,title,post_type" : item.kind === "comment" ? "user_id,body,post_id,thread_id" : item.kind === "repo" ? "user_id,project_name,post_id" : item.kind === "iteration" ? "author_user_id,iteration_type,version_build_label,post_id" : item.kind === "sandbox" ? "user_id,request_title" : item.kind === "upload" ? "owner_user_id,file_name,post_id" : "reporter_user_id,report_type";
  const ownerResult = await supabase.from(table).select(ownerSelect).eq("id", item.id).maybeSingle();
  const ownerRow = (ownerResult.data ?? {}) as Record<string, unknown>;
  const targetUserId = String(ownerRow.user_id ?? ownerRow.author_user_id ?? ownerRow.owner_user_id ?? ownerRow.reporter_user_id ?? "");
  const notificationTitle = String(ownerRow.title ?? ownerRow.project_name ?? ownerRow.iteration_type ?? ownerRow.request_title ?? ownerRow.file_name ?? ownerRow.report_type ?? item.title);
  const postId = String(ownerRow.post_id ?? (item.kind === "post" ? item.id : ""));
  const update: Record<string, unknown> = {};
  if (item.kind === "post") {
    update.updated_at = now;
    update.status = action === "approve" ? "published" : action === "reject" ? "removed_by_moderator" : action === "hide" ? "hidden" : action === "archive" ? "archived" : "needs_information";
    update.moderation_status = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "hide" ? "hidden" : action === "archive" ? "archived" : "needs_information";
    update.visibility = action === "approve" ? "public" : "private_draft";
    if (action === "approve") {
      update.published_at = now;
      update.moderation_reason = null;
    }
    if (["hide", "reject", "needs_information", "archive"].includes(action)) update.moderation_reason = reason;
  } else if (item.kind === "comment") {
    update.updated_at = now;
    update.status = action === "approve" ? "published" : action === "hide" ? "hidden" : action === "archive" ? "archived" : action === "reject" ? "removed_by_moderator" : "pending_review";
    if (action === "approve") update.published_at = now;
  } else if (item.kind === "upload") {
    update.visibility_state = action === "approve" ? "published" : action === "hide" ? "hidden" : action === "archive" ? "archived" : "removed";
  } else if (item.kind === "repo") {
    update.updated_at = now;
    update.status = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "hide" ? "rejected" : action === "archive" ? "archived" : action === "escalate" ? "in_review" : "needs_information";
  } else if (item.kind === "iteration") {
    update.updated_at = now;
    update.status = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "hide" ? "rejected" : action === "archive" ? "archived" : action === "escalate" ? "in_review" : "needs_information";
  } else if (item.kind === "sandbox") {
    update.updated_at = now;
    update.status = action === "approve" ? "approved_for_local_sandbox" : action === "reject" ? "rejected" : action === "archive" ? "archived" : action === "escalate" ? "in_review" : "needs_information";
  } else {
    update.status = action === "approve" ? "action_taken" : action === "archive" ? "resolved_no_action" : action === "escalate" ? "escalated" : "in_review";
    update.reviewed_at = now;
    update.reviewed_by = account.userId;
    update.resolution_note = reason || null;
  }
  const { error } = await supabase.from(table).update(update).eq("id", item.id);
  if (error) return { ok: false, message: error.message };
  if (item.kind === "post" && ownerRow.post_type === "repository_showcase") {
    const repoStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "hide" ? "rejected" : action === "archive" ? "archived" : action === "escalate" ? "in_review" : "needs_information";
    await supabase.from(canonicalCommuneTables.repositoryShowcases).update({ status: repoStatus, updated_at: now }).eq("post_id", item.id);
  }
  if (item.kind === "post" && ownerRow.post_type === "troubleshooting") {
    const troubleshootingStatus = action === "approve" ? "open" : action === "archive" ? "archived" : action === "reject" ? "archived" : action === "hide" ? "needs_information" : action === "escalate" ? "in_progress" : "needs_information";
    await supabase.from(canonicalCommuneTables.troubleshootingPosts).update({ troubleshooting_status: troubleshootingStatus, updated_at: now, archived_at: troubleshootingStatus === "archived" ? now : null }).eq("post_id", item.id);
  }
  if (item.kind === "post" && ownerRow.post_type === "elysia_iteration_showcase") {
    const iterationStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "hide" ? "rejected" : action === "archive" ? "archived" : action === "escalate" ? "in_review" : "needs_information";
    await supabase.from(canonicalCommuneTables.iterationShowcases).update({ status: iterationStatus, updated_at: now }).eq("post_id", item.id);
  }
  if ((item.kind === "repo" || item.kind === "iteration") && postId) {
    const linkedPostUpdate: Record<string, unknown> = { updated_at: now };
    linkedPostUpdate.status = action === "approve" ? "published" : action === "reject" ? "removed_by_moderator" : action === "hide" ? "hidden" : action === "archive" ? "archived" : "needs_information";
    linkedPostUpdate.moderation_status = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "hide" ? "hidden" : action === "archive" ? "archived" : "needs_information";
    linkedPostUpdate.visibility = action === "approve" ? "public" : "private_draft";
    if (action === "approve") {
      linkedPostUpdate.published_at = now;
      linkedPostUpdate.moderation_reason = null;
    } else {
      linkedPostUpdate.moderation_reason = reason || null;
    }
    await supabase.from(canonicalCommuneTables.posts).update(linkedPostUpdate).eq("id", postId).eq("post_type", item.kind === "repo" ? "repository_showcase" : "elysia_iteration_showcase");
    const linkedReview = await supabase.from("review_items").select("id,status").eq("domain", "commune").eq("source_table", canonicalCommuneTables.posts).eq("source_id", postId).maybeSingle();
    if (!linkedReview.error && linkedReview.data) {
      const linkedReviewStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "needs_information" ? "needs_information" : action === "archive" ? "archived" : "in_review";
      await supabase.from("review_items").update({ status: linkedReviewStatus, updated_at: now }).eq("id", (linkedReview.data as { id: string }).id);
    }
  }
  const toStatus = String(update.status ?? update.visibility_state);
  await supabase.from("commune_moderation_events").insert({ actor_id: account.userId, target_type: item.kind, target_id: item.id, action, from_status: item.status, to_status: toStatus, reason: reason || null, metadata: { source: "commune_moderation_ui" } });
  const reviewStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "needs_information" ? "needs_information" : action === "archive" ? "archived" : "in_review";
  const reviewItem = await supabase.from("review_items").select("id,status").eq("domain", "commune").eq("source_table", table).eq("source_id", item.id).maybeSingle();
  if (!reviewItem.error && reviewItem.data) {
    await supabase.from("review_items").update({ status: reviewStatus, updated_at: now }).eq("id", (reviewItem.data as { id: string }).id);
    await supabase.from("review_events").insert({ review_item_id: (reviewItem.data as { id: string }).id, actor_id: account.userId, event_type: `commune_${action}`, from_status: (reviewItem.data as { status?: string }).status ?? null, to_status: reviewStatus, note: reason || null, metadata: { source: "commune_moderation_ui", target_type: item.kind, content_status: toStatus } });
  }
  if (action === "approve") {
    if (item.kind === "post") {
      const { data: threadRow } = await supabase.from(canonicalCommuneTables.threads).select("id").eq("post_id", item.id).maybeSingle();
      await grantThreadParticipationApproval({ threadId: (threadRow as { id?: string } | null)?.id ?? null, postId: item.id, userId: targetUserId, approvedBy: account.userId, source: "post_approval" });
      await publishPostAttachments(item.id);
    }
    if ((item.kind === "repo" || item.kind === "iteration") && postId) {
      const { data: threadRow } = await supabase.from(canonicalCommuneTables.threads).select("id").eq("post_id", postId).maybeSingle();
      await grantThreadParticipationApproval({ threadId: (threadRow as { id?: string } | null)?.id ?? null, postId, userId: targetUserId, approvedBy: account.userId, source: item.kind === "repo" ? "repository_showcase_approval" : "iteration_showcase_approval" });
      await publishPostAttachments(postId);
    }
    if (item.kind === "comment") {
      const commentRow = ownerRow as { user_id?: string | null; post_id?: string | null; thread_id?: string | null };
      await grantThreadParticipationApproval({ threadId: commentRow.thread_id ?? null, postId: commentRow.post_id ?? postId, userId: targetUserId, approvedBy: account.userId, firstCommentId: item.id, source: "first_comment_approval" });
    }
  }
  if (targetUserId && targetUserId !== account.userId) {
    await supabase.from("user_notifications").insert({
      user_id: targetUserId,
      notification_type: "commune_moderation_update",
      source_type: item.kind,
      source_id: item.id,
      title: `Commune review update: ${notificationTitle}`,
      body: `Your Commune ${item.kind} was marked ${toStatus}. Public visibility still follows moderation and privacy rules.`,
      action_url: postId ? `/commune/posts/${postId}` : "/commune"
    });
  }
  return { ok: true, message: `Moderation action ${action} recorded.` };
}
