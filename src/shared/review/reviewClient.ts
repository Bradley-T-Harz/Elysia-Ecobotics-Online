import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../../pages/The-Elysia-Marketplace/lib/supabase";
import { jobPostReviewResultMessage, resolveCommuneJobPostId, reviewCommuneJobPost, type JobPostReviewAction, type JobPostReviewResult } from "./jobPostReviewClient";
import {
  JOB_OPPORTUNITY_MODEL_VERSION,
  formatJobCompensation,
  jobApplicationRouteLabel,
  jobCompensationStatusLabel,
  jobDurationTypeLabel,
  jobOpportunityReviewerFlags,
  jobOpportunityTypeLabel,
  jobPosterTypeLabel,
  jobTimeBasisLabel,
  jobWorkArrangementLabel,
  type JobOpportunityMetadataFields,
  type JobReviewerFlag
} from "../../pages/The-Elysia-Commune/jobOpportunityModel";

export type AppRole = "administrator" | "moderator" | "reviewer" | "marketplace_reviewer" | "source_reviewer" | "commune_moderator" | "guardian_reviewer";
export type ReviewStatus = "draft" | "pending_review" | "in_review" | "needs_information" | "approved" | "rejected" | "withdrawn" | "archived";
export type ReviewDomain = "commune" | "work_with" | "stewardship" | "contribution" | "living_library_source" | "living_library_broken_link" | "marketplace";
export type ReviewQueueFilter = "active" | "history" | "moderated" | "all" | "approved" | "rejected" | "archived";
export type RejectedCommuneRecoveryAction = "reopen_review" | "approve_and_restore";

export type CurrentRoleState = {
  signedIn: boolean;
  userId: string | null;
  roles: AppRole[];
  isAdmin: boolean;
  warnings: string[];
};

export type ReviewItem = {
  id: string;
  domain: ReviewDomain;
  source_table: string;
  source_id: string;
  submitted_by: string | null;
  status: ReviewStatus;
  assigned_to?: string | null;
  priority?: string | null;
  title?: string | null;
  summary?: string | null;
  submitted_at?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  moderation_state?: string | null;
  public_visibility?: "public" | "not_public" | "unknown";
  content_status?: string | null;
  content_visibility?: string | null;
  content_preview?: string | null;
  content_links?: string[] | null;
  moderation_reason?: string | null;
  content_updated_at?: string | null;
  related_review_item_ids?: string[];
  internal_comments?: ReviewComment[];
  job_post_case?: JobPostReviewCase | null;
};

export type ReviewComment = { id: string; review_item_id: string; actor_id: string; body: string; visibility: "internal" | "submitter_visible"; created_at: string };
export type JobPostReviewCase = {
  jobPostId: string;
  postId: string;
  modelVersion: number;
  title: string;
  organization: string;
  opportunityType: string;
  posterType: string;
  compensation: string;
  compensationStatus: string;
  workArrangement: string;
  timeStructure: string;
  location: string;
  applicationRoute: string;
  applicationDestination: string;
  organizationWebsite: string;
  roleSummary: string;
  requirements: string;
  safetyNotes: string;
  legacyAmbiguity: boolean;
  flags: JobReviewerFlag[];
};

export type ReviewEvent = {
  id: string;
  review_item_id: string;
  actor_id: string | null;
  event_type: string;
  from_status: ReviewStatus | null;
  to_status: ReviewStatus | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export const activeReviewStatuses: ReviewStatus[] = ["pending_review", "in_review", "needs_information"];
export const historyReviewStatuses: ReviewStatus[] = ["approved", "rejected", "withdrawn", "archived"];
const moderatedContentStates = ["flagged", "flagged_for_removal", "hidden", "hidden_from_public", "removed", "removed_by_moderator", "soft_deleted_by_moderator", "deleted_by_admin"];

export const domainLabels: Record<ReviewDomain, string> = {
  commune: "Commune",
  work_with: "Work With",
  stewardship: "Stewardship",
  contribution: "Contribution",
  living_library_source: "Living Library sources",
  living_library_broken_link: "Broken links",
  marketplace: "Marketplace"
};

const domainRoles: Record<ReviewDomain, AppRole[]> = {
  work_with: ["administrator", "reviewer", "guardian_reviewer"],
  stewardship: ["administrator", "reviewer", "guardian_reviewer"],
  contribution: ["administrator", "reviewer", "guardian_reviewer"],
  commune: ["administrator", "moderator", "commune_moderator", "guardian_reviewer"],
  living_library_source: ["administrator", "source_reviewer", "guardian_reviewer"],
  living_library_broken_link: ["administrator", "source_reviewer", "marketplace_reviewer", "moderator", "guardian_reviewer"],
  marketplace: ["administrator", "marketplace_reviewer", "guardian_reviewer"]
};

function friendlyReviewWarning(message: string) {
  if (import.meta.env.DEV) console.warn("[review]", message);
  if (/schema cache|Could not find the table|does not exist/i.test(message)) return "Backend table/policy not active yet.";
  if (/permission denied|row-level security|RLS|violates row-level security/i.test(message)) return "Your account does not have access to this private review area.";
  return "This private review area is temporarily unavailable.";
}

export function canReviewDomain(roles: AppRole[], domain: ReviewDomain) {
  return domainRoles[domain].some((role) => roles.includes(role));
}

export async function loadCurrentRoleState(): Promise<CurrentRoleState> {
  if (!hasSupabaseConfig || !supabase) return { signedIn: false, userId: null, roles: [], isAdmin: false, warnings: [supabaseNotConfiguredMessage] };
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { signedIn: false, userId: null, roles: [], isAdmin: false, warnings: authError ? [authError.message] : [] };

  const warnings: string[] = [];
  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id).is("revoked_at", null);
  if (roleError) warnings.push(friendlyReviewWarning(roleError.message));
  const roles = ((roleRows ?? []) as { role: AppRole }[]).map((row) => row.role);

  const { data: profile, error: profileError } = await supabase.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle();
  if (profileError) warnings.push(friendlyReviewWarning(profileError.message));
  const isAdmin = roles.includes("administrator") || Boolean((profile as { is_admin?: boolean } | null)?.is_admin);
  return { signedIn: true, userId: auth.user.id, roles: isAdmin && !roles.includes("administrator") ? ["administrator", ...roles] : roles, isAdmin, warnings };
}

export async function createReviewItem(input: {
  domain: ReviewDomain;
  sourceTable: string;
  sourceId: string;
  submittedBy: string;
  title: string;
  summary?: string;
}): Promise<{ ok: boolean; reviewItemId?: string; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.from("review_items").insert({
    domain: input.domain,
    source_table: input.sourceTable,
    source_id: input.sourceId,
    submitted_by: input.submittedBy,
    title: input.title,
    summary: input.summary ?? null,
    status: "pending_review"
  }).select("id").single();
  if (error) return { ok: false, warning: error.message };
  const reviewItemId = (data as { id: string }).id;
  await supabase.from("review_events").insert({
    review_item_id: reviewItemId,
    actor_id: input.submittedBy,
    event_type: "submitted",
    to_status: "pending_review",
    metadata: { visibility: "submitter_visible" }
  });
  return { ok: true, reviewItemId };
}

export async function createReviewHistoryItem(input: {
  domain: ReviewDomain;
  sourceTable: string;
  sourceId: string;
  submittedBy: string;
  title: string;
  summary?: string;
  status: Extract<ReviewStatus, "approved" | "archived" | "rejected">;
  eventType: string;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; reviewItemId?: string; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("review_items").insert({
    domain: input.domain,
    source_table: input.sourceTable,
    source_id: input.sourceId,
    submitted_by: input.submittedBy,
    reviewed_by: input.submittedBy,
    reviewed_at: now,
    title: input.title,
    summary: input.summary ?? null,
    status: input.status
  }).select("id").single();
  if (error) return { ok: false, warning: error.message };
  const reviewItemId = (data as { id: string }).id;
  const { error: eventError } = await supabase.from("review_events").insert({
    review_item_id: reviewItemId,
    actor_id: input.submittedBy,
    event_type: input.eventType,
    to_status: input.status,
    metadata: { visibility: "internal", history_only: true, active_queue: false, ...(input.metadata ?? {}) }
  });
  if (eventError) return { ok: false, reviewItemId, warning: eventError.message };
  return { ok: true, reviewItemId };
}

type CommuneCommentModerationRow = {
  id: string;
  user_id?: string | null;
  thread_id?: string | null;
  post_id?: string | null;
  body?: string | null;
  status?: string | null;
  visibility_state?: string | null;
  hidden_at?: string | null;
  removed_at?: string | null;
  archived_at?: string | null;
  moderation_reason?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
};

type CommunePostModerationRow = {
  id: string;
  user_id?: string | null;
  post_type?: string | null;
  title?: string | null;
  body?: string | null;
  excerpt?: string | null;
  links?: string[] | null;
  status?: string | null;
  visibility?: string | null;
  visibility_state?: string | null;
  moderation_status?: string | null;
  hidden_at?: string | null;
  removed_at?: string | null;
  archived_at?: string | null;
  moderation_reason?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
};

function summarizeText(value?: string | null) {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 177)}...` : clean;
}

function deriveCommentModerationState(row: CommuneCommentModerationRow) {
  const explicit = row.visibility_state && row.visibility_state !== "published" ? row.visibility_state : null;
  if (explicit) return explicit;
  if (row.status && moderatedContentStates.includes(row.status)) return row.status;
  if (row.hidden_at) return "hidden";
  if (row.removed_at) return "removed";
  if (row.archived_at) return "archived";
  return row.status ?? row.visibility_state ?? "unknown";
}

function derivePostModerationState(row: CommunePostModerationRow) {
  if (row.moderation_status && row.moderation_status !== "approved" && row.moderation_status !== "not_submitted") return row.moderation_status;
  if (row.visibility_state && row.visibility_state !== "published" && row.visibility_state !== "draft") return row.visibility_state;
  if (row.status && moderatedContentStates.includes(row.status)) return row.status;
  if (row.visibility && row.visibility !== "public") return row.visibility;
  if (row.hidden_at) return "hidden";
  if (row.removed_at) return "removed";
  if (row.archived_at) return "archived";
  return row.status ?? row.visibility ?? "unknown";
}

function isModeratedReviewItem(item: ReviewItem) {
  const state = item.moderation_state ?? "";
  return item.domain === "commune" && moderatedContentStates.includes(state);
}

async function enrichCommuneReviewItems(items: ReviewItem[], warnings: string[]): Promise<ReviewItem[]> {
  if (!supabase || items.length === 0) return items;
  const communeItems = items.filter((item) => item.domain === "commune" && ["commune_posts", "commune_comments"].includes(item.source_table));
  if (communeItems.length === 0) return items;
  const commentIds = [...new Set(communeItems.filter((item) => item.source_table === "commune_comments").map((item) => item.source_id))];
  const postIds = [...new Set(communeItems.filter((item) => item.source_table === "commune_posts").map((item) => item.source_id))];
  const commentMap = new Map<string, CommuneCommentModerationRow>();
  const postMap = new Map<string, CommunePostModerationRow>();

  if (commentIds.length) {
    const { data, error } = await supabase.from("commune_comments").select("id,body,status,visibility_state,hidden_at,removed_at,archived_at,moderation_reason,published_at,updated_at").in("id", commentIds);
    if (error) warnings.push(`Commune comment moderation state could not be loaded: ${friendlyReviewWarning(error.message)}`);
    for (const row of (data ?? []) as CommuneCommentModerationRow[]) commentMap.set(row.id, row);
  }

  if (postIds.length) {
    const { data, error } = await supabase.from("commune_posts").select("id,title,body,excerpt,links,status,visibility,visibility_state,moderation_status,hidden_at,removed_at,archived_at,moderation_reason,published_at,updated_at").in("id", postIds);
    if (error) warnings.push(`Commune post moderation state could not be loaded: ${friendlyReviewWarning(error.message)}`);
    for (const row of (data ?? []) as CommunePostModerationRow[]) postMap.set(row.id, row);
  }

  return items.map((item) => {
    if (item.domain !== "commune") return item;
    if (item.source_table === "commune_comments") {
      const row = commentMap.get(item.source_id);
      if (!row) return item;
      const moderationState = deriveCommentModerationState(row);
      const isPublic = row.status === "published" && (!row.visibility_state || row.visibility_state === "published") && !row.hidden_at && !row.removed_at;
      return {
        ...item,
        moderation_state: moderationState,
        public_visibility: isPublic ? "public" : "not_public",
        content_status: row.status ?? null,
        content_visibility: row.visibility_state ?? null,
        content_preview: summarizeText(row.body),
        moderation_reason: row.moderation_reason ?? null,
        content_updated_at: row.updated_at ?? row.published_at ?? null
      };
    }
    if (item.source_table === "commune_posts") {
      const row = postMap.get(item.source_id);
      if (!row) return item;
      const moderationState = derivePostModerationState(row);
      const isPublic = row.status === "published" && row.visibility === "public" && !row.hidden_at && !row.removed_at;
      return {
        ...item,
        moderation_state: moderationState,
        public_visibility: isPublic ? "public" : "not_public",
        content_status: row.status ?? null,
        content_visibility: row.visibility ?? row.visibility_state ?? null,
        content_preview: summarizeText(row.excerpt ?? row.body),
        content_links: row.links ?? [],
        moderation_reason: row.moderation_reason ?? null,
        content_updated_at: row.updated_at ?? row.published_at ?? null
      };
    }
    return item;
  });
}

type JobReviewRow = JobOpportunityMetadataFields & {
  id: string;
  post_id: string;
  role_title?: string | null;
  organization_project?: string | null;
  role_type?: string | null;
  paid_volunteer_status?: string | null;
  location_mode?: string | null;
  location_text?: string | null;
  time_commitment?: string | null;
  compensation_clarity?: string | null;
  contact_path?: string | null;
  requirements_skills?: string | null;
  safety_notes?: string | null;
  role_summary?: string | null;
};

const jobReviewLegacySelect = "id,post_id,role_title,organization_project,role_type,paid_volunteer_status,location_mode,location_text,time_commitment,compensation_clarity,contact_path,requirements_skills,safety_notes,role_summary";
const jobReviewV2Select = `${jobReviewLegacySelect},model_version,opportunity_type,opportunity_details,compensation_status,compensation_models,compensation_currency,compensation_min_amount,compensation_max_amount,compensation_period,compensation_details,benefits_summary,work_arrangement,time_basis,duration_type,poster_type,organization_website,experience_level,application_route_type,application_destination,application_instructions,testing_privacy_note,future_interest_acknowledged`;

async function loadJobReviewRows(column: "id" | "post_id", ids: string[], warnings: string[]) {
  if (!supabase || ids.length === 0) return [] as JobReviewRow[];
  const primary = await supabase.from("commune_job_posts").select(jobReviewV2Select).in(column, ids);
  if (!primary.error) return (primary.data ?? []) as JobReviewRow[];
  if (!/column .* does not exist|42703|PGRST204/i.test(`${primary.error.code ?? ""} ${primary.error.message}`)) {
    warnings.push(`Opportunity review details could not be loaded: ${friendlyReviewWarning(primary.error.message)}`);
    return [];
  }
  const fallback = await supabase.from("commune_job_posts").select(jobReviewLegacySelect).in(column, ids);
  if (fallback.error) warnings.push(`Legacy Job Post review details could not be loaded: ${friendlyReviewWarning(fallback.error.message)}`);
  return (fallback.data ?? []) as JobReviewRow[];
}

function reviewCaseFromRow(row: JobReviewRow, title?: string | null): JobPostReviewCase {
  const modelVersion = Number(row.model_version ?? 1);
  const v2 = modelVersion === JOB_OPPORTUNITY_MODEL_VERSION;
  const legacyLabel = (value?: string | null, fallback = "Needs clarification") => value ? value.replace(/_/g, " ") : fallback;
  return {
    jobPostId: row.id,
    postId: row.post_id,
    modelVersion,
    title: row.role_title || title || "Untitled opportunity",
    organization: row.organization_project || "Not supplied",
    opportunityType: v2 ? jobOpportunityTypeLabel(row.opportunity_type) : legacyLabel(row.role_type, "Legacy type needs clarification"),
    posterType: v2 ? jobPosterTypeLabel(row.poster_type) : "Legacy poster type not recorded",
    compensation: v2 ? formatJobCompensation(row) : row.compensation_clarity || legacyLabel(row.paid_volunteer_status, "Legacy compensation needs clarification"),
    compensationStatus: v2 ? jobCompensationStatusLabel(row.compensation_status) : legacyLabel(row.paid_volunteer_status, "Needs clarification"),
    workArrangement: v2 ? jobWorkArrangementLabel(row.work_arrangement) : legacyLabel(row.location_mode, "Needs clarification"),
    timeStructure: v2 ? `${jobTimeBasisLabel(row.time_basis)} · ${jobDurationTypeLabel(row.duration_type)}` : row.time_commitment || "Legacy time structure not recorded",
    location: row.location_text || "Not supplied",
    applicationRoute: v2 ? jobApplicationRouteLabel(row.application_route_type) : "Legacy contact path",
    applicationDestination: (v2 ? row.application_destination || row.application_instructions : row.contact_path) || "Not supplied",
    organizationWebsite: row.organization_website || "Not supplied",
    roleSummary: row.role_summary || "Not supplied",
    requirements: row.requirements_skills || "Not supplied",
    safetyNotes: row.safety_notes || "Not supplied",
    legacyAmbiguity: !v2,
    flags: jobOpportunityReviewerFlags(row)
  };
}

async function enrichJobCasesAndInternalComments(items: ReviewItem[], warnings: string[]): Promise<ReviewItem[]> {
  if (!supabase || items.length === 0) return items;
  const jobIds = [...new Set(items.filter((item) => item.domain === "commune" && item.source_table === "commune_job_posts").map((item) => item.source_id))];
  const postIds = [...new Set(items.filter((item) => item.domain === "commune" && item.source_table === "commune_posts").map((item) => item.source_id))];
  const [byIdRows, byPostRows, commentResult] = await Promise.all([
    loadJobReviewRows("id", jobIds, warnings),
    loadJobReviewRows("post_id", postIds, warnings),
    supabase.from("review_comments").select("id,review_item_id,actor_id,body,visibility,created_at").in("review_item_id", items.map((item) => item.id)).eq("visibility", "internal").order("created_at", { ascending: true })
  ]);
  if (commentResult.error) warnings.push(`Protected reviewer notes could not be loaded: ${friendlyReviewWarning(commentResult.error.message)}`);
  const commentsByItem = new Map<string, ReviewComment[]>();
  for (const comment of (commentResult.data ?? []) as ReviewComment[]) commentsByItem.set(comment.review_item_id, [...(commentsByItem.get(comment.review_item_id) ?? []), comment]);
  const rows = [...byIdRows, ...byPostRows].filter((row, index, all) => all.findIndex((candidate) => candidate.id === row.id) === index);
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const rowByPostId = new Map(rows.map((row) => [row.post_id, row]));
  const linkedPostIds = [...new Set(rows.map((row) => row.post_id))];
  const postResult = linkedPostIds.length ? await supabase.from("commune_posts").select("id,title,body,excerpt,links,status,visibility,visibility_state,moderation_status,hidden_at,removed_at,archived_at,moderation_reason,published_at,updated_at").in("id", linkedPostIds) : { data: [], error: null };
  if (postResult.error) warnings.push(`Opportunity parent posts could not be loaded: ${friendlyReviewWarning(postResult.error.message)}`);
  const postMap = new Map(((postResult.data ?? []) as CommunePostModerationRow[]).map((row) => [row.id, row]));
  const enriched = items.map((item) => {
    const row = item.source_table === "commune_job_posts" ? rowById.get(item.source_id) : item.source_table === "commune_posts" ? rowByPostId.get(item.source_id) : undefined;
    const comments = commentsByItem.get(item.id) ?? [];
    if (!row) return { ...item, internal_comments: comments };
    const post = postMap.get(row.post_id);
    const moderationState = post ? derivePostModerationState(post) : item.moderation_state;
    const isPublic = post?.status === "published" && post.visibility === "public" && !post.hidden_at && !post.removed_at;
    return {
      ...item,
      title: post?.title || item.title,
      content_preview: summarizeText(post?.excerpt ?? post?.body ?? row.role_summary),
      content_links: post?.links ?? item.content_links ?? [],
      content_status: post?.status ?? item.content_status,
      content_visibility: post?.visibility ?? post?.visibility_state ?? item.content_visibility,
      moderation_state: moderationState,
      public_visibility: post ? isPublic ? "public" as const : "not_public" as const : item.public_visibility,
      content_updated_at: post?.updated_at ?? item.content_updated_at,
      internal_comments: comments,
      job_post_case: reviewCaseFromRow(row, post?.title)
    };
  });

  const output: ReviewItem[] = [];
  const jobCaseIndex = new Map<string, number>();
  for (const item of enriched) {
    if (!item.job_post_case) { output.push(item); continue; }
    const key = item.job_post_case.postId;
    const existingIndex = jobCaseIndex.get(key);
    if (existingIndex === undefined) { jobCaseIndex.set(key, output.length); output.push(item); continue; }
    const existing = output[existingIndex];
    const preferred = existing.source_table === "commune_posts" ? existing : item.source_table === "commune_posts" ? item : existing;
    const other = preferred.id === existing.id ? item : existing;
    output[existingIndex] = {
      ...preferred,
      related_review_item_ids: Array.from(new Set([preferred.id, other.id, ...(preferred.related_review_item_ids ?? []), ...(other.related_review_item_ids ?? [])])),
      internal_comments: [...(existing.internal_comments ?? []), ...(item.internal_comments ?? [])].sort((left, right) => left.created_at.localeCompare(right.created_at))
    };
  }
  return output;
}

export async function loadReviewItems(domain?: ReviewDomain, filter: ReviewQueueFilter = "active"): Promise<{ items: ReviewItem[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { items: [], warnings: [supabaseNotConfiguredMessage] };
  let query = supabase.from("review_items").select("*").order("submitted_at", { ascending: false });
  if (domain) query = query.eq("domain", domain);
  if (filter === "active") query = query.in("status", activeReviewStatuses);
  else if (filter === "history" || filter === "moderated") query = query.in("status", historyReviewStatuses);
  else if (["approved", "rejected", "archived"].includes(filter)) query = query.eq("status", filter);
  const { data, error } = await query;
  const warnings = error ? [friendlyReviewWarning(error.message)] : [];
  const communeEnriched = await enrichCommuneReviewItems((data ?? []) as ReviewItem[], warnings);
  const enrichedItems = await enrichJobCasesAndInternalComments(communeEnriched, warnings);
  return { items: filter === "moderated" ? enrichedItems.filter(isModeratedReviewItem) : enrichedItems, warnings };
}

export async function addInternalReviewComment(reviewItemId: string, body: string): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  const text = body.trim();
  if (!text) return { ok: true };
  const role = await loadCurrentRoleState();
  if (!role.userId) return { ok: false, warning: "Sign in with reviewer authority before saving a private note." };
  const { error } = await supabase.from("review_comments").insert({ review_item_id: reviewItemId, actor_id: role.userId, body: text, visibility: "internal" });
  return error ? { ok: false, warning: friendlyReviewWarning(error.message) } : { ok: true };
}

export async function loadReviewEvents(reviewItemId?: string): Promise<{ events: ReviewEvent[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { events: [], warnings: [supabaseNotConfiguredMessage] };
  let query = supabase.from("review_events").select("*").order("created_at", { ascending: false }).limit(100);
  if (reviewItemId) query = query.eq("review_item_id", reviewItemId);
  const { data, error } = await query;
  return { events: (data ?? []) as ReviewEvent[], warnings: error ? [friendlyReviewWarning(error.message)] : [] };
}

function sourceStatusTable(sourceTable: string) {
  if (["work_with_requests", "stewardship_recognition_requests", "commune_post_requests", "commune_job_posts", "living_library_source_suggestions", "broken_link_reports", "addon_submissions", "library_source_submissions", "work_role_submissions", "content_reports"].includes(sourceTable)) return sourceTable;
  return null;
}

async function grantCommuneThreadApproval(input: { threadId?: string | null; postId?: string | null; userId?: string | null; approvedBy: string; firstCommentId?: string | null; source: string }) {
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
  if (error && import.meta.env.DEV) console.warn("[review] thread participant approval", error.message);
}

async function publishCommunePostMedia(postId: string) {
  if (!supabase) return;
  const { error } = await supabase
    .from("commune_media")
    .update({ visibility_state: "published", updated_at: new Date().toISOString() })
    .eq("post_id", postId)
    .in("visibility_state", ["submitted", "flagged"]);
  if (error && import.meta.env.DEV) console.warn("[review] Commune post media publish", error.message);
  await supabase
    .from("commune_uploads")
    .update({ status: "published" })
    .eq("post_id", postId)
    .in("status", ["pending_review", "approved"]);
}

const jobPostReviewActionByStatus: Partial<Record<ReviewStatus, JobPostReviewAction>> = {
  in_review: "escalate",
  needs_information: "needs_information",
  approved: "approve",
  rejected: "reject",
  archived: "archive"
};

type JobPostReviewTarget =
  | { kind: "not_job_post" }
  | { kind: "job_post"; jobPostId: string }
  | { kind: "error"; message: string };

async function resolveReviewItemJobPostTarget(item: ReviewItem): Promise<JobPostReviewTarget> {
  if (!supabase || item.domain !== "commune") return { kind: "not_job_post" };
  if (item.source_table === "commune_job_posts") return { kind: "job_post", jobPostId: item.source_id };
  if (item.source_table !== "commune_posts") return { kind: "not_job_post" };
  const { data, error } = await supabase.from("commune_posts").select("id,post_type").eq("id", item.source_id).maybeSingle();
  if (error) return { kind: "error", message: "The Commune post type could not be verified. No review or publication change was made." };
  if (!data) return { kind: "error", message: "The Commune post could not be found. No review or publication change was made." };
  if ((data as { post_type?: string | null }).post_type !== "job_post") return { kind: "not_job_post" };
  const resolved = await resolveCommuneJobPostId(item.source_id);
  return resolved.ok ? { kind: "job_post", jobPostId: resolved.jobPostId } : { kind: "error", message: resolved.message };
}

async function finalizeGovernedJobPostReviewPublication(result: JobPostReviewResult, actorId: string) {
  if (!supabase || !result.published) return;
  const { data: postRow } = await supabase.from("commune_posts").select("id,user_id,title").eq("id", result.postId).maybeSingle();
  const post = postRow as { user_id?: string | null; title?: string | null } | null;
  const { data: threadRow } = await supabase.from("commune_threads").select("id").eq("post_id", result.postId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  let threadId = (threadRow as { id?: string } | null)?.id ?? null;
  if (!threadId) {
    const { data: createdThread } = await supabase.from("commune_threads").insert({
      post_id: result.postId,
      title: post?.title ?? "Job Post discussion",
      created_by: actorId,
      visibility: "public",
      status: "open"
    }).select("id").single();
    threadId = (createdThread as { id?: string } | null)?.id ?? null;
  }
  await grantCommuneThreadApproval({ threadId, postId: result.postId, userId: post?.user_id ?? null, approvedBy: actorId, source: "job_post_governed_approval" });
  await publishCommunePostMedia(result.postId);
}

async function reviewJobPostFromReviewItem(item: ReviewItem, nextStatus: ReviewStatus, note: string, actorId: string): Promise<{ handled: boolean; ok: boolean; warning?: string; message?: string }> {
  const target = await resolveReviewItemJobPostTarget(item);
  if (target.kind === "not_job_post") return { handled: false, ok: true };
  if (target.kind === "error") return { handled: true, ok: false, warning: target.message };
  const action = jobPostReviewActionByStatus[nextStatus];
  if (!action) return { handled: true, ok: false, warning: "That review state is not supported by the governed Job Post review boundary." };
  const reviewed = await reviewCommuneJobPost(target.jobPostId, action, note);
  if (!reviewed.ok) return { handled: true, ok: false, warning: reviewed.message };
  await finalizeGovernedJobPostReviewPublication(reviewed.result, actorId);
  return { handled: true, ok: true, message: jobPostReviewResultMessage(reviewed.result) };
}

async function syncCommuneReviewSubject(item: ReviewItem, nextStatus: ReviewStatus, note: string, actorId: string): Promise<{ ok: boolean; warning?: string }> {
  if (!supabase || item.domain !== "commune") return { ok: true };
  const now = new Date().toISOString();
  if (item.source_table === "commune_posts") {
    const update: Record<string, unknown> = {
      updated_at: now,
      last_activity_at: now,
      moderation_status: nextStatus,
      moderation_reason: note || null
    };
    if (nextStatus === "approved") {
      Object.assign(update, { status: "published", visibility: "public", published_at: now, hidden_at: null, hidden_by: null, moderation_reason: null });
    } else if (nextStatus === "in_review") {
      Object.assign(update, { status: "in_review", visibility: "private_draft" });
    } else if (nextStatus === "needs_information") {
      Object.assign(update, { status: "needs_information", visibility: "private_draft" });
    } else if (nextStatus === "archived") {
      Object.assign(update, { status: "archived", visibility: "private_draft" });
    } else if (nextStatus === "rejected") {
      Object.assign(update, { status: "removed_by_moderator", visibility: "private_draft", hidden_at: now, hidden_by: actorId });
    } else {
      return { ok: true };
    }
    const { error } = await supabase.from("commune_posts").update(update).eq("id", item.source_id);
    if (error) return { ok: false, warning: `Commune post was not updated: ${friendlyReviewWarning(error.message)}` };
    if (nextStatus === "approved") {
      const { data: postRow } = await supabase.from("commune_posts").select("id,user_id,title").eq("id", item.source_id).maybeSingle();
      const { data: threadRow } = await supabase.from("commune_threads").select("id").eq("post_id", item.source_id).order("created_at", { ascending: true }).limit(1).maybeSingle();
      let threadId = (threadRow as { id?: string } | null)?.id ?? null;
      if (!threadId) {
        const { data: createdThread, error: threadError } = await supabase.from("commune_threads").insert({
          post_id: item.source_id,
          title: (postRow as { title?: string } | null)?.title ?? item.title ?? "Commune discussion",
          created_by: actorId,
          visibility: "public",
          status: "open"
        }).select("id").single();
        if (threadError && import.meta.env.DEV) console.warn("[review] approved Commune post thread repair", threadError.message);
        threadId = (createdThread as { id?: string } | null)?.id ?? null;
      }
      await grantCommuneThreadApproval({ threadId, postId: item.source_id, userId: (postRow as { user_id?: string } | null)?.user_id ?? null, approvedBy: actorId, source: "post_approval" });
      await publishCommunePostMedia(item.source_id);
    }
    return { ok: true };
  }
  if (item.source_table === "commune_comments") {
    const { data: commentRow } = await supabase.from("commune_comments").select("id,user_id,thread_id,post_id").eq("id", item.source_id).maybeSingle();
    const update: Record<string, unknown> = {
      updated_at: now,
      moderation_reason: note || null
    };
    if (nextStatus === "approved") Object.assign(update, { status: "published", published_at: now, hidden_at: null, hidden_by: null });
    if (nextStatus === "approved") Object.assign(update, { visibility_state: "published", removed_at: null, archived_at: null, moderation_reason: null });
    else if (nextStatus === "archived") Object.assign(update, { status: "archived", visibility_state: "archived", archived_at: now });
    else if (nextStatus === "rejected") Object.assign(update, { status: "removed_by_moderator", visibility_state: "removed", hidden_at: now, hidden_by: actorId, removed_at: now });
    else Object.assign(update, { status: "pending_review" });
    const { error } = await supabase.from("commune_comments").update(update).eq("id", item.source_id);
    if (error) return { ok: false, warning: `Commune comment was not updated: ${friendlyReviewWarning(error.message)}` };
    if (nextStatus === "approved") {
      const row = commentRow as { id?: string; user_id?: string | null; thread_id?: string | null; post_id?: string | null } | null;
      await grantCommuneThreadApproval({ threadId: row?.thread_id ?? null, postId: row?.post_id ?? null, userId: row?.user_id ?? null, approvedBy: actorId, firstCommentId: item.source_id, source: "first_comment_approval" });
    }
  }
  return { ok: true };
}

export async function restoreCommuneReviewSubject(item: ReviewItem, note: string): Promise<{ ok: boolean; warning?: string; message?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  if (item.domain !== "commune" || !["commune_posts", "commune_comments"].includes(item.source_table)) return { ok: false, warning: "Only Commune posts and comments can be restored from this recovery action." };
  if (item.status !== "approved") return { ok: false, warning: "Only approved Commune content can be restored to public visibility from this action. Rejected and archived records stay in admin history unless reviewed separately." };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, warning: "Sign in with a reviewer account first." };
  const now = new Date().toISOString();
  const targetType = item.source_table === "commune_posts" ? "post" : "comment";

  if (item.source_table === "commune_comments") {
    const { data: current, error: currentError } = await supabase.from("commune_comments").select("status,visibility_state,hidden_at,removed_at,archived_at,published_at").eq("id", item.source_id).maybeSingle();
    if (currentError) return { ok: false, warning: `Commune comment could not be loaded: ${friendlyReviewWarning(currentError.message)}` };
    const currentRow = current as CommuneCommentModerationRow | null;
    if (!currentRow) return { ok: false, warning: "Commune comment was not found." };
    if (["rejected", "deleted_by_user"].includes(currentRow.status ?? "")) return { ok: false, warning: "Rejected or user-deleted comments are not restored by the visibility recovery action." };
    const previousState = deriveCommentModerationState(currentRow);
    const { error } = await supabase.from("commune_comments").update({
      status: "published",
      visibility_state: "published",
      hidden_at: null,
      hidden_by: null,
      removed_at: null,
      moderation_reason: null,
      published_at: currentRow.published_at ?? now,
      updated_at: now
    }).eq("id", item.source_id);
    if (error) return { ok: false, warning: `Commune comment was not restored: ${friendlyReviewWarning(error.message)}` };
    await recordCommuneRestoreEvent({ item, actorId: auth.user.id, targetType, previousState, note, now });
    return { ok: true };
  }

  const { data: current, error: currentError } = await supabase.from("commune_posts").select("id,user_id,title,post_type,status,visibility,visibility_state,moderation_status,hidden_at,removed_at,archived_at,published_at").eq("id", item.source_id).maybeSingle();
  if (currentError) return { ok: false, warning: `Commune post could not be loaded: ${friendlyReviewWarning(currentError.message)}` };
  const currentRow = current as CommunePostModerationRow | null;
  if (!currentRow) return { ok: false, warning: "Commune post was not found." };
  if (["rejected", "deleted_by_user"].includes(currentRow.status ?? "")) return { ok: false, warning: "Rejected or user-deleted posts are not restored by the visibility recovery action." };
  if (currentRow.post_type === "job_post") {
    const target = await resolveCommuneJobPostId(item.source_id);
    if (!target.ok) return { ok: false, warning: target.message };
    const reviewed = await reviewCommuneJobPost(target.jobPostId, "approve", note);
    if (!reviewed.ok) return { ok: false, warning: reviewed.message };
    await finalizeGovernedJobPostReviewPublication(reviewed.result, auth.user.id);
    return { ok: true, message: jobPostReviewResultMessage(reviewed.result) };
  }
  const previousState = derivePostModerationState(currentRow);
  const { error } = await supabase.from("commune_posts").update({
    status: "published",
    visibility: "public",
    visibility_state: "published",
    moderation_status: "approved",
    hidden_at: null,
    hidden_by: null,
    removed_at: null,
    moderation_reason: null,
    published_at: currentRow.published_at ?? now,
    updated_at: now,
    last_activity_at: now
  }).eq("id", item.source_id);
  if (error) return { ok: false, warning: `Commune post was not restored: ${friendlyReviewWarning(error.message)}` };
  await publishCommunePostMedia(item.source_id);
  await recordCommuneRestoreEvent({ item, actorId: auth.user.id, targetType, previousState, note, now });
  return { ok: true };
}

async function recordCommuneRestoreEvent(input: { item: ReviewItem; actorId: string; targetType: "post" | "comment"; previousState: string; note: string; now: string }) {
  if (!supabase) return;
  await supabase.from("commune_moderation_events").insert({
    actor_id: input.actorId,
    target_type: input.targetType,
    target_id: input.item.source_id,
    action: "restore_to_public",
    from_status: input.previousState,
    to_status: "published",
    reason: input.note || null,
    metadata: { source: "admin_review_recovery", review_item_id: input.item.id, review_status: input.item.status, review_status_preserved: true, archive_is_separate_from_history: true }
  });
  await supabase.from("review_events").insert({
    review_item_id: input.item.id,
    actor_id: input.actorId,
    event_type: "commune_restore_to_public",
    from_status: input.item.status,
    to_status: input.item.status,
    note: input.note || null,
    metadata: { visibility: "internal", moderation_state_from: input.previousState, moderation_state_to: "published", review_status_preserved: true, history_only: true, active_queue: false }
  });
}

function isRecoverableRejectedCommuneItem(item: ReviewItem) {
  return item.domain === "commune" && item.status === "rejected" && ["commune_posts", "commune_comments"].includes(item.source_table);
}

async function recordCommuneRejectedRecoveryEvent(input: {
  item: ReviewItem;
  actorId: string;
  targetType: "post" | "comment";
  action: "reopen_rejected_review" | "approve_and_restore_rejected";
  fromStatus: string;
  toStatus: string;
  reviewToStatus: ReviewStatus;
  note: string;
}) {
  if (!supabase) return;
  await supabase.from("commune_moderation_events").insert({
    actor_id: input.actorId,
    target_type: input.targetType,
    target_id: input.item.source_id,
    action: input.action,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    reason: input.note || null,
    metadata: {
      source: "admin_rejected_recovery",
      review_item_id: input.item.id,
      original_review_status: input.item.status,
      review_status_to: input.reviewToStatus,
      original_rejection_preserved: true,
      archive_is_separate_from_history: true
    }
  });
  await supabase.from("review_events").insert({
    review_item_id: input.item.id,
    actor_id: input.actorId,
    event_type: input.action === "reopen_rejected_review" ? "commune_rejection_reopened" : "commune_rejected_approved_and_restored",
    from_status: input.item.status,
    to_status: input.reviewToStatus,
    note: input.note || null,
    metadata: {
      visibility: "internal",
      rejected_recovery: true,
      original_rejection_preserved: true,
      source_public: input.reviewToStatus === "approved",
      active_queue: input.reviewToStatus === "pending_review",
      archive_is_separate_from_history: true
    }
  });
}

export async function recoverRejectedCommuneReviewSubject(item: ReviewItem, action: RejectedCommuneRecoveryAction, note: string): Promise<{ ok: boolean; warning?: string; message?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  if (!isRecoverableRejectedCommuneItem(item)) return { ok: false, warning: "Only rejected Commune posts and comments can use rejected recovery actions." };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, warning: "Sign in with a reviewer account first." };

  const now = new Date().toISOString();
  const targetType = item.source_table === "commune_posts" ? "post" : "comment";
  const reviewToStatus: ReviewStatus = action === "reopen_review" ? "pending_review" : "approved";
  const recoveryNote = note || (action === "reopen_review" ? "Rejected Commune item reopened for review." : "Rejected Commune item approved and restored.");

  if (item.source_table === "commune_comments") {
    const { data: current, error: currentError } = await supabase.from("commune_comments").select("id,user_id,thread_id,post_id,status,visibility_state,hidden_at,removed_at,archived_at,published_at").eq("id", item.source_id).maybeSingle();
    if (currentError) return { ok: false, warning: `Commune comment could not be loaded: ${friendlyReviewWarning(currentError.message)}` };
    const currentRow = current as CommuneCommentModerationRow | null;
    if (!currentRow) return { ok: false, warning: "Source content not found; this rejected record is history only." };
    if (currentRow.status === "deleted_by_user") return { ok: false, warning: "User-deleted comments cannot be restored from rejected recovery." };
    const previousState = deriveCommentModerationState(currentRow);
    const update = action === "reopen_review"
      ? {
        status: "pending_review",
        visibility_state: "hidden",
        moderation_reason: recoveryNote,
        updated_at: now
      }
      : {
        status: "published",
        visibility_state: "published",
        hidden_at: null,
        hidden_by: null,
        removed_at: null,
        archived_at: null,
        moderation_reason: null,
        published_at: currentRow.published_at ?? now,
        updated_at: now
      };
    const { error } = await supabase.from("commune_comments").update(update).eq("id", item.source_id);
    if (error) return { ok: false, warning: `Commune comment recovery failed: ${friendlyReviewWarning(error.message)}` };
    if (action === "approve_and_restore") await grantCommuneThreadApproval({ threadId: currentRow.thread_id ?? null, postId: currentRow.post_id ?? null, userId: currentRow.user_id ?? null, approvedBy: auth.user.id, firstCommentId: item.source_id, source: "rejected_comment_approved_and_restored" });
    const { error: itemError } = await supabase.from("review_items").update({
      status: reviewToStatus,
      updated_at: now,
      reviewed_at: action === "approve_and_restore" ? now : null,
      reviewed_by: action === "approve_and_restore" ? auth.user.id : null
    }).eq("id", item.id);
    if (itemError) return { ok: false, warning: `Source was updated, but review status recovery failed: ${friendlyReviewWarning(itemError.message)}` };
    await recordCommuneRejectedRecoveryEvent({ item, actorId: auth.user.id, targetType, action: action === "reopen_review" ? "reopen_rejected_review" : "approve_and_restore_rejected", fromStatus: previousState, toStatus: action === "reopen_review" ? "pending_review" : "published", reviewToStatus, note: recoveryNote });
    return { ok: true };
  }

  const { data: current, error: currentError } = await supabase.from("commune_posts").select("id,user_id,title,post_type,status,visibility,visibility_state,moderation_status,hidden_at,removed_at,archived_at,published_at").eq("id", item.source_id).maybeSingle();
  if (currentError) return { ok: false, warning: `Commune post could not be loaded: ${friendlyReviewWarning(currentError.message)}` };
  const currentRow = current as CommunePostModerationRow | null;
  if (!currentRow) return { ok: false, warning: "Source content not found; this rejected record is history only." };
  if (currentRow.status === "deleted_by_user") return { ok: false, warning: "User-deleted posts cannot be restored from rejected recovery." };
  if (currentRow.post_type === "job_post") {
    const target = await resolveCommuneJobPostId(item.source_id);
    if (!target.ok) return { ok: false, warning: target.message };
    const reviewed = await reviewCommuneJobPost(target.jobPostId, action === "approve_and_restore" ? "approve" : "needs_information", recoveryNote);
    if (!reviewed.ok) return { ok: false, warning: reviewed.message };
    await finalizeGovernedJobPostReviewPublication(reviewed.result, auth.user.id);
    return { ok: true, message: action === "reopen_review"
      ? "Rejected Job Post reopened in the active needs-information state. It remains non-public."
      : jobPostReviewResultMessage(reviewed.result) };
  }
  const previousState = derivePostModerationState(currentRow);
  const update = action === "reopen_review"
    ? {
      status: "pending_review",
      visibility: "private_draft",
      moderation_status: "pending_review",
      moderation_reason: recoveryNote,
      updated_at: now,
      last_activity_at: now
    }
    : {
      status: "published",
      visibility: "public",
      visibility_state: "published",
      moderation_status: "approved",
      hidden_at: null,
      hidden_by: null,
      removed_at: null,
      archived_at: null,
      moderation_reason: null,
      published_at: currentRow.published_at ?? now,
      updated_at: now,
      last_activity_at: now
    };
  const { error } = await supabase.from("commune_posts").update(update).eq("id", item.source_id);
  if (error) return { ok: false, warning: `Commune post recovery failed: ${friendlyReviewWarning(error.message)}` };
  if (action === "approve_and_restore") {
    const { data: threadRow } = await supabase.from("commune_threads").select("id").eq("post_id", item.source_id).order("created_at", { ascending: true }).limit(1).maybeSingle();
    let threadId = (threadRow as { id?: string } | null)?.id ?? null;
    if (!threadId) {
      const { data: createdThread, error: threadError } = await supabase.from("commune_threads").insert({
        post_id: item.source_id,
        title: currentRow.title ?? item.title ?? "Commune discussion",
        created_by: auth.user.id,
        visibility: "public",
        status: "open"
      }).select("id").single();
      if (threadError && import.meta.env.DEV) console.warn("[review] rejected Commune post restored thread repair", threadError.message);
      threadId = (createdThread as { id?: string } | null)?.id ?? null;
    }
    await grantCommuneThreadApproval({ threadId, postId: item.source_id, userId: currentRow.user_id ?? null, approvedBy: auth.user.id, source: "rejected_post_approved_and_restored" });
    await publishCommunePostMedia(item.source_id);
  }
  const { error: itemError } = await supabase.from("review_items").update({
    status: reviewToStatus,
    updated_at: now,
    reviewed_at: action === "approve_and_restore" ? now : null,
    reviewed_by: action === "approve_and_restore" ? auth.user.id : null
  }).eq("id", item.id);
  if (itemError) return { ok: false, warning: `Source was updated, but review status recovery failed: ${friendlyReviewWarning(itemError.message)}` };
  await recordCommuneRejectedRecoveryEvent({ item, actorId: auth.user.id, targetType, action: action === "reopen_review" ? "reopen_rejected_review" : "approve_and_restore_rejected", fromStatus: previousState, toStatus: action === "reopen_review" ? "pending_review" : "published", reviewToStatus, note: recoveryNote });
  return { ok: true };
}

export async function updateReviewStatus(item: ReviewItem, nextStatus: ReviewStatus, note: string): Promise<{ ok: boolean; warning?: string; message?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, warning: "Sign in with a reviewer account first." };
  const governedJobPostReview = await reviewJobPostFromReviewItem(item, nextStatus, note, auth.user.id);
  if (governedJobPostReview.handled) return { ok: governedJobPostReview.ok, warning: governedJobPostReview.warning, message: governedJobPostReview.message };
  const reviewed = ["approved", "rejected", "archived"].includes(nextStatus);
  const subjectSync = await syncCommuneReviewSubject(item, nextStatus, note, auth.user.id);
  if (!subjectSync.ok) return subjectSync;
  const { error: itemError } = await supabase.from("review_items").update({
    status: nextStatus,
    updated_at: new Date().toISOString(),
    reviewed_at: reviewed ? new Date().toISOString() : item.reviewed_at ?? null,
    reviewed_by: reviewed ? auth.user.id : item.reviewed_by ?? null
  }).eq("id", item.id);
  if (itemError) return { ok: false, warning: friendlyReviewWarning(itemError.message) };

  const table = sourceStatusTable(item.source_table);
  if (table) {
    const { error: sourceError } = await supabase.from(table).update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", item.source_id);
    if (sourceError) return { ok: false, warning: `Review item updated, but source status failed: ${friendlyReviewWarning(sourceError.message)}` };
  }

  const { error: eventError } = await supabase.from("review_events").insert({
    review_item_id: item.id,
    actor_id: auth.user.id,
    event_type: "status_changed",
    from_status: item.status,
    to_status: nextStatus,
    note: note || null,
    metadata: { visibility: "internal" }
  });
  if (eventError) return { ok: false, warning: `Status changed, but audit event failed: ${friendlyReviewWarning(eventError.message)}` };
  return { ok: true };
}

export async function assignReviewItemToMe(item: ReviewItem): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, warning: "Sign in with a reviewer account first." };
  const { error } = await supabase.from("review_items").update({ assigned_to: auth.user.id, updated_at: new Date().toISOString() }).eq("id", item.id);
  if (error) return { ok: false, warning: friendlyReviewWarning(error.message) };
  await supabase.from("review_events").insert({ review_item_id: item.id, actor_id: auth.user.id, event_type: "assigned", metadata: { visibility: "internal" } });
  return { ok: true };
}

export async function loadUserRoles(): Promise<{ rows: { id: string; user_id: string; role: AppRole; granted_at: string; revoked_at: string | null; reason: string | null }[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { rows: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("user_roles").select("id,user_id,role,granted_at,revoked_at,reason").order("granted_at", { ascending: false }).limit(200);
  return { rows: (data ?? []) as { id: string; user_id: string; role: AppRole; granted_at: string; revoked_at: string | null; reason: string | null }[], warnings: error ? [friendlyReviewWarning(error.message)] : [] };
}

export async function grantRole(userId: string, role: AppRole, reason: string): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, warning: "Sign in as administrator first." };
  if (auth.user.id === userId) return { ok: false, warning: "Role self-assignment is not allowed from this UI." };
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role, granted_by: auth.user.id, reason: reason || null });
  return { ok: !error, warning: error ? friendlyReviewWarning(error.message) : undefined };
}

export async function revokeRole(roleRowId: string, reason: string): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, warning: "Sign in as administrator first." };
  const { error } = await supabase.from("user_roles").update({ revoked_at: new Date().toISOString(), revoked_by: auth.user.id, reason: reason || null }).eq("id", roleRowId);
  return { ok: !error, warning: error ? friendlyReviewWarning(error.message) : undefined };
}
