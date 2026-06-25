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
export type CommuneModerationItem = { id: string; kind: "post" | "comment" | "upload" | "repo" | "sandbox" | "report"; title: string; status: string; created_at?: string | null; summary?: string | null };
export type CommuneAccountState = { signedIn: boolean; userId: string | null; username: string | null; roles: AppRole[]; isAdmin: boolean; isModerator: boolean; warnings: string[] };
export type LoadCommuneData = { rooms: CommuneRoom[]; posts: CommunePost[]; comments: CommuneComment[]; threads: CommuneThread[]; media: CommuneMediaAttachment[]; savedPostIds: string[]; followedThreadIds: string[]; account: CommuneAccountState; warnings: string[] };
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
  repositoryShowcases: "commune_repository_showcases",
  sandboxReviews: "commune_sandbox_review_requests",
  reports: "commune_reports",
  media: "commune_media",
  legacyUploads: "commune_uploads",
  legacyReports: "commune_abuse_reports"
} as const;

function fallback<T>(data: T, warning = supabaseNotConfiguredMessage) { return { data, warnings: [warning] }; }
function splitList(value: string) { return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean); }
function excerpt(value: string) { return value.replace(/\s+/g, " ").trim().slice(0, 220); }
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
  if (!hasSupabaseConfig || !supabase) return { rooms: [], posts: [], comments: [], threads: [], media: [], savedPostIds: [], followedThreadIds: [], account, warnings: [supabaseNotConfiguredMessage] };
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
  return { rooms: (rooms ?? []) as CommuneRoom[], posts: (posts ?? []) as CommunePost[], comments: (comments ?? []) as CommuneComment[], threads: (threads ?? []) as CommuneThread[], media, savedPostIds, followedThreadIds, account, warnings };
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
  const currentSelect = input.targetType === "post" ? "id,status,visibility,visibility_state,moderation_status" : "id,status,post_id,thread_id,visibility_state";
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

export async function submitRepositoryShowcase(input: { repositoryUrl: string; projectName: string; projectSummary: string; postId?: string; roomId?: string; body?: string; tags?: string; links?: string; branch?: string; commit?: string; license?: string; readmePreview?: string; fileTreePreview?: string; screenshotNotes?: string; manifestStatus?: string; compatibility?: string; warnings?: string[]; sandboxRequested?: boolean }): Promise<{ ok: boolean; message: string; id?: string; postId?: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to submit repository showcases." };
  if (!input.projectName.trim()) return { ok: false, message: "Add a repository showcase title before submitting." };
  const host = (() => { try { const url = new URL(input.repositoryUrl); return ["http:", "https:"].includes(url.protocol) && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(url.hostname) ? url.hostname : null; } catch { return null; } })();
  if (!host) return { ok: false, message: "Use a public HTTP(S) repository URL. Localhost/private repository URLs are not accepted for public Commune metadata." };
  let postId = input.postId || null;
  const now = new Date().toISOString();
  const adminDirectPublish = account.isAdmin;
  if (!postId) {
    postId = crypto.randomUUID();
    const body = input.body?.trim() || input.projectSummary.trim();
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
    input.branch ? `Branch: ${input.branch}` : "",
    input.commit ? `Commit: ${input.commit}` : "",
    input.license ? `License: ${input.license}` : "",
    input.manifestStatus ? `Manifest: ${input.manifestStatus}` : "",
    input.compatibility ? `Compatibility: ${input.compatibility}` : "",
    input.warnings?.length ? `Warnings: ${input.warnings.join(", ")}` : ""
  ].filter(Boolean).join("\n");
  const { data, error } = await supabase.from(canonicalCommuneTables.repositoryShowcases).insert({ user_id: account.userId, post_id: postId, repository_url: input.repositoryUrl, repository_host: host, project_name: input.projectName, project_summary: summary || input.projectSummary, sandbox_review_requested: Boolean(input.sandboxRequested), status: adminDirectPublish ? "approved" : "pending_review" }).select("id").single();
  if (error) return { ok: false, message: friendlyError(error.message, "Repository showcase review queue is not active yet.") };
  const id = (data as { id: string }).id;
  if (adminDirectPublish) {
    await createReviewHistoryItem({ domain: "commune", sourceTable: "commune_posts", sourceId: postId, submittedBy: account.userId, title: input.projectName, summary: "Admin-published repository showcase metadata only. The website did not clone, build, run, or execute code.", status: "approved", eventType: "admin_repository_showcase_direct_published", metadata: { repository_showcase_id: id, repository_url: input.repositoryUrl } });
  } else {
    await createReviewItem({ domain: "commune", sourceTable: "commune_posts", sourceId: postId, submittedBy: account.userId, title: input.projectName, summary: "Repository showcase post. Metadata only; no repository was cloned, built, run, or executed." });
    await createReviewItem({ domain: "commune", sourceTable: "commune_repository_showcases", sourceId: id, submittedBy: account.userId, title: input.projectName, summary: "Repository showcase metadata only. The website did not clone, build, run, or execute code." });
  }
  if (input.sandboxRequested) await submitSandboxReview({ requestTitle: `Sandbox review: ${input.projectName}`, repositoryUrl: input.repositoryUrl, repositoryShowcaseId: id, scope: "Metadata-only request for future bounded sandbox review.", riskNotes: "Website did not execute code.", permissions: [] });
  return { ok: true, message: adminDirectPublish ? "Repository showcase published as an admin-authored public post. No repository was fetched, cloned, built, or executed." : "Repository showcase submitted as a normal Commune post for moderation. No repository was fetched, cloned, built, or executed.", id, postId };
}

export async function submitSandboxReview(input: { requestTitle: string; repositoryUrl?: string; packageUrl?: string; repositoryShowcaseId?: string; postId?: string; scope: string; riskNotes: string; permissions: string[] }): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to request sandbox review." };
  const scan = scanCommuneTextForSecrets([input.requestTitle, input.repositoryUrl ?? "", input.packageUrl ?? "", input.scope, input.riskNotes, ...input.permissions].join("\n"));
  if (scan.blocked) return { ok: false, message: `Sandbox request blocked because it appears to contain private or secret material: ${scan.warnings.join(", ")}.` };
  const { data, error } = await supabase.from(canonicalCommuneTables.sandboxReviews).insert({ user_id: account.userId, post_id: input.postId || null, repository_showcase_id: input.repositoryShowcaseId || null, request_title: input.requestTitle, repository_url: input.repositoryUrl || null, package_url: input.packageUrl || null, requested_review_scope: input.scope, risk_notes: input.riskNotes, declared_permissions: input.permissions, status: "requested" }).select("id").single();
  if (error) return { ok: false, message: friendlyError(error.message, "Sandbox review queue is not active yet.") };
  await createReviewItem({ domain: "commune", sourceTable: "commune_sandbox_review_requests", sourceId: (data as { id: string }).id, submittedBy: account.userId, title: input.requestTitle, summary: "Sandbox review request only. The website does not execute submitted code." });
  return { ok: true, message: "Sandbox review request saved for moderators. This is not execution permission." };
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
  sourceType: "commune_post_snippet" | "commune_code_document" | "commune_code_version";
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
  return { ok: true, message: "Sandbox run result recorded privately for Coding Cornucopia review history.", runId: typeof data === "string" ? data : undefined };
}

export async function loadCommuneModerationQueue(): Promise<{ items: CommuneModerationItem[]; warnings: string[] }> {
  if (!supabase) return { items: [], warnings: [supabaseNotConfiguredMessage] };
  const account = await accountState();
  if (!account.isModerator) return { items: [], warnings: ["Commune moderation requires administrator, moderator, commune_moderator, or guardian_reviewer role."] };
  const warnings: string[] = [];
  const [posts, comments, uploads, repos, sandboxes, reports] = await Promise.all([
    supabase.from("commune_posts").select("id,title,status,created_at,excerpt").in("status", ["pending_review", "in_review", "needs_information", "hidden"]).order("created_at", { ascending: false }).limit(30),
    supabase.from("commune_comments").select("id,body,status,created_at").in("status", ["pending_review", "hidden"]).order("created_at", { ascending: false }).limit(30),
    supabase.from(canonicalCommuneTables.media).select("id,file_name,visibility_state,created_at").in("visibility_state", ["submitted", "flagged", "hidden"]).order("created_at", { ascending: false }).limit(30),
    supabase.from(canonicalCommuneTables.repositoryShowcases).select("id,project_name,status,created_at,project_summary").in("status", ["pending_review", "in_review", "needs_information"]).order("created_at", { ascending: false }).limit(30),
    supabase.from(canonicalCommuneTables.sandboxReviews).select("id,request_title,status,created_at,risk_notes").in("status", ["requested", "in_review", "needs_information"]).order("created_at", { ascending: false }).limit(30),
    supabase.from(canonicalCommuneTables.legacyReports).select("id,report_type,status,created_at,report_reason").in("status", ["pending_review", "in_review", "escalated"]).order("created_at", { ascending: false }).limit(30)
  ]);
  for (const result of [posts, comments, uploads, repos, sandboxes, reports]) if (result.error) warnings.push(result.error.message);
  const items: CommuneModerationItem[] = [
    ...((posts.data ?? []) as Array<{ id: string; title: string; status: string; created_at?: string; excerpt?: string }>).map((row) => ({ id: row.id, kind: "post" as const, title: row.title, status: row.status, created_at: row.created_at, summary: row.excerpt })),
    ...((comments.data ?? []) as Array<{ id: string; body: string; status: string; created_at?: string }>).map((row) => ({ id: row.id, kind: "comment" as const, title: "Comment", status: row.status, created_at: row.created_at, summary: excerpt(row.body) })),
    ...((uploads.data ?? []) as Array<{ id: string; file_name: string; visibility_state: string; created_at?: string }>).map((row) => ({ id: row.id, kind: "upload" as const, title: row.file_name, status: row.visibility_state, created_at: row.created_at })),
    ...((repos.data ?? []) as Array<{ id: string; project_name: string; status: string; created_at?: string; project_summary?: string }>).map((row) => ({ id: row.id, kind: "repo" as const, title: row.project_name, status: row.status, created_at: row.created_at, summary: row.project_summary })),
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
  const table = item.kind === "post" ? canonicalCommuneTables.posts : item.kind === "comment" ? canonicalCommuneTables.comments : item.kind === "upload" ? canonicalCommuneTables.media : item.kind === "repo" ? canonicalCommuneTables.repositoryShowcases : item.kind === "sandbox" ? canonicalCommuneTables.sandboxReviews : canonicalCommuneTables.legacyReports;
  const ownerSelect = item.kind === "post" ? "user_id,title" : item.kind === "comment" ? "user_id,body,post_id,thread_id" : item.kind === "repo" ? "user_id,project_name" : item.kind === "sandbox" ? "user_id,request_title" : item.kind === "upload" ? "owner_user_id,file_name,post_id" : "reporter_user_id,report_type";
  const ownerResult = await supabase.from(table).select(ownerSelect).eq("id", item.id).maybeSingle();
  const ownerRow = (ownerResult.data ?? {}) as Record<string, unknown>;
  const targetUserId = String(ownerRow.user_id ?? ownerRow.owner_user_id ?? ownerRow.reporter_user_id ?? "");
  const notificationTitle = String(ownerRow.title ?? ownerRow.project_name ?? ownerRow.request_title ?? ownerRow.file_name ?? ownerRow.report_type ?? item.title);
  const postId = String(ownerRow.post_id ?? (item.kind === "post" ? item.id : ""));
  const update: Record<string, unknown> = {};
  if (item.kind === "post") {
    update.updated_at = now;
    update.status = action === "approve" ? "published" : action === "reject" ? "removed_by_moderator" : action === "hide" ? "hidden" : action === "archive" ? "archived" : "needs_information";
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
    update.status = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "archive" ? "archived" : "needs_information";
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
