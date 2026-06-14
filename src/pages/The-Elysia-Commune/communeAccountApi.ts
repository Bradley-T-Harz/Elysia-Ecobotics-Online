import { createReviewItem, loadCurrentRoleState, type AppRole } from "../../shared/review/reviewClient";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";
import { communeFallbackCategories, communeReportReasons, scanCommuneTextForSecrets, validateCommuneMediaFile } from "./communeSafety";

export type CommunePostType = "media_garden" | "troubleshooting" | "code_sharing" | "repository_showcase" | "community_network" | "job_post" | "official_update" | "research_note" | "elysia_iteration_showcase";
export type CommunePostStatus = "draft" | "pending_review" | "in_review" | "needs_information" | "approved" | "published" | "rejected" | "hidden" | "archived" | "deleted_by_user" | "removed_by_moderator";
export type CommuneRoom = { id: string; slug: string; name: string; description?: string | null; room_type: string; requires_moderation: boolean };
export type CommunePost = { id: string; user_id?: string; author_username?: string | null; post_type: CommunePostType; title: string; body: string; excerpt?: string | null; tags?: string[] | null; links?: string[] | null; repository_url?: string | null; status: CommunePostStatus; visibility: string; published_at?: string | null; last_activity_at?: string | null; created_at?: string | null };
export type CommuneThread = { id: string; post_id?: string | null; room_id?: string | null; title: string; status: string; visibility: string; last_reply_at?: string | null };
export type CommuneComment = { id: string; thread_id: string; post_id?: string | null; parent_comment_id?: string | null; user_id?: string; author_username?: string | null; body: string; status: string; created_at?: string | null; published_at?: string | null };
export type CommuneModerationItem = { id: string; kind: "post" | "comment" | "upload" | "repo" | "sandbox" | "report"; title: string; status: string; created_at?: string | null; summary?: string | null };
export type CommuneAccountState = { signedIn: boolean; userId: string | null; username: string | null; roles: AppRole[]; isModerator: boolean; warnings: string[] };
export type LoadCommuneData = { rooms: CommuneRoom[]; posts: CommunePost[]; comments: CommuneComment[]; threads: CommuneThread[]; savedPostIds: string[]; followedThreadIds: string[]; account: CommuneAccountState; warnings: string[] };
export type CommuneCategory = { id: string; slug: string; title: string; description?: string | null; sort_order?: number | null; is_active?: boolean | null };
export type CommuneCodeSnippet = { id: string; post_id: string; author_user_id: string; language?: string | null; file_name?: string | null; code_text: string; secret_scan_status?: string | null; sandbox_warning_acknowledged?: boolean | null; created_at?: string | null };

export const postTypeOptions: { value: CommunePostType; label: string }[] = [
  { value: "media_garden", label: "Media Garden" },
  { value: "troubleshooting", label: "Troubleshooting Grove" },
  { value: "code_sharing", label: "Code Sharing" },
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

async function accountState(): Promise<CommuneAccountState> {
  const roleState = await loadCurrentRoleState();
  if (!hasSupabaseConfig || !supabase || !roleState.signedIn || !roleState.userId) return { signedIn: roleState.signedIn, userId: roleState.userId, username: null, roles: roleState.roles, isModerator: isModerator(roleState.roles, roleState.isAdmin), warnings: roleState.warnings };
  const { data, error } = await supabase.from("profiles").select("username").eq("id", roleState.userId).maybeSingle();
  return { signedIn: true, userId: roleState.userId, username: (data as { username?: string } | null)?.username ?? null, roles: roleState.roles, isModerator: isModerator(roleState.roles, roleState.isAdmin), warnings: error ? [...roleState.warnings, error.message] : roleState.warnings };
}

function friendlyError(message: string, fallbackMessage: string) {
  if (import.meta.env.DEV) console.warn("[Commune backend]", message);
  if (/schema cache|Could not find|does not exist|relation/i.test(message)) return fallbackMessage;
  if (/permission denied|row-level security|violates row-level security/i.test(message)) return "Your current account cannot use that Commune action yet.";
  return message;
}

export async function loadCategories(): Promise<{ categories: CommuneCategory[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { categories: communeFallbackCategories.map((item, index) => ({ ...item, id: item.slug, sort_order: index, is_active: true })), warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("commune_categories").select("id,slug,title,description,sort_order,is_active").eq("is_active", true).order("sort_order");
  if (error) return { categories: communeFallbackCategories.map((item, index) => ({ ...item, id: item.slug, sort_order: index, is_active: true })), warnings: [friendlyError(error.message, "Commune categories are using the safe built-in fallback until the latest migration is applied.")] };
  return { categories: (data ?? []) as CommuneCategory[], warnings: [] };
}

export async function loadCommuneData(roomSlug?: string, postId?: string): Promise<LoadCommuneData> {
  const account = await accountState();
  if (!hasSupabaseConfig || !supabase) return { rooms: [], posts: [], comments: [], threads: [], savedPostIds: [], followedThreadIds: [], account, warnings: [supabaseNotConfiguredMessage] };
  const warnings = [...account.warnings];
  const roomsQuery = supabase.from(canonicalCommuneTables.rooms).select("id, slug, name, description, room_type, requires_moderation").order("name");
  const { data: rooms, error: roomError } = await roomsQuery;
  if (roomError) warnings.push(roomError.message);
  const selectedRoom = roomSlug ? (rooms ?? []).find((room) => room.slug === roomSlug) as CommuneRoom | undefined : undefined;
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
  return { rooms: (rooms ?? []) as CommuneRoom[], posts: (posts ?? []) as CommunePost[], comments: (comments ?? []) as CommuneComment[], threads: (threads ?? []) as CommuneThread[], savedPostIds, followedThreadIds, account, warnings };
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
  if (input.postType === "official_update" && !account.isModerator) return { ok: false, message: "Official Updates are restricted to authorized administrators/moderators." };
  const tags = splitList(input.tags);
  const links = splitList(input.links);
  const postId = crypto.randomUUID();
  const { error: postError } = await supabase.from(canonicalCommuneTables.posts).insert({ id: postId, user_id: account.userId, author_username: account.username, post_type: input.postType, title: input.title.trim(), body: input.body.trim(), excerpt: excerpt(input.body), tags, links, repository_url: input.repositoryUrl?.trim() || null, status: "pending_review", moderation_status: "pending_review", safety_acknowledgements: { public_boundary: true, no_secrets: true, no_execution: true } });
  if (postError) return { ok: false, message: friendlyError(postError.message, "Community posting backend is not active yet.") };
  let threadId: string | null = null;
  const { data: thread, error: threadError } = await supabase.from(canonicalCommuneTables.threads).insert({ post_id: postId, room_id: input.roomId || null, title: input.title.trim(), created_by: account.userId, visibility: "public" }).select("id").single();
  if (!threadError) threadId = (thread as { id: string }).id;
  if (input.upload) {
    const upload = await uploadCommuneAttachment(input.upload, { postId, role: "post_attachment" });
    if (!upload.ok) return { ok: false, message: `Post saved for review, but upload failed: ${upload.message}` };
  }
  if (input.postType === "repository_showcase" && input.repositoryUrl) {
    const repo = await submitRepositoryShowcase({ repositoryUrl: input.repositoryUrl, projectName: input.title, projectSummary: excerpt(input.body), postId, sandboxRequested: Boolean(input.sandboxRequested) });
    if (!repo.ok) return { ok: false, message: `Post saved, but repository showcase failed: ${repo.message}` };
  }
  const review = await createReviewItem({ domain: "commune", sourceTable: "commune_posts", sourceId: postId, submittedBy: account.userId, title: input.title.trim(), summary: excerpt(input.body) });
  return { ok: true, postId, message: review.ok ? `Commune post submitted for moderation${threadId ? " with a pending thread" : ""}. It is not public until approved.` : `Post saved, but review routing needs attention: ${review.warning}` };
}

export async function submitComment(input: { postId: string; threadId: string; body: string; parentCommentId?: string | null }): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to submit a comment for moderation." };
  const secretScan = scanCommuneTextForSecrets(input.body);
  if (secretScan.blocked) return { ok: false, message: `Comment blocked because it appears to contain private or secret material: ${secretScan.warnings.join(", ")}.` };
  const id = crypto.randomUUID();
  const { error } = await supabase.from(canonicalCommuneTables.comments).insert({ id, thread_id: input.threadId, post_id: input.postId, parent_comment_id: input.parentCommentId || null, user_id: account.userId, author_username: account.username, body: input.body.trim(), status: "pending_review" });
  if (error) return { ok: false, message: friendlyError(error.message, "Comment moderation backend is not active yet.") };
  await createReviewItem({ domain: "commune", sourceTable: "commune_comments", sourceId: id, submittedBy: account.userId, title: "Commune comment", summary: excerpt(input.body) });
  return { ok: true, message: "Comment submitted for moderation. It is not public until approved." };
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

export async function submitRepositoryShowcase(input: { repositoryUrl: string; projectName: string; projectSummary: string; postId?: string; sandboxRequested?: boolean }): Promise<{ ok: boolean; message: string; id?: string }> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to submit repository showcases." };
  const host = (() => { try { const url = new URL(input.repositoryUrl); return ["http:", "https:"].includes(url.protocol) && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(url.hostname) ? url.hostname : null; } catch { return null; } })();
  if (!host) return { ok: false, message: "Use a public HTTP(S) repository URL. Localhost/private repository URLs are not accepted for public Commune metadata." };
  const { data, error } = await supabase.from(canonicalCommuneTables.repositoryShowcases).insert({ user_id: account.userId, post_id: input.postId || null, repository_url: input.repositoryUrl, repository_host: host, project_name: input.projectName, project_summary: input.projectSummary, sandbox_review_requested: Boolean(input.sandboxRequested), status: "pending_review" }).select("id").single();
  if (error) return { ok: false, message: friendlyError(error.message, "Repository showcase review queue is not active yet.") };
  const id = (data as { id: string }).id;
  await createReviewItem({ domain: "commune", sourceTable: "commune_repository_showcases", sourceId: id, submittedBy: account.userId, title: input.projectName, summary: "Repository showcase metadata only. The website did not clone, build, run, or execute code." });
  if (input.sandboxRequested) await submitSandboxReview({ requestTitle: `Sandbox review: ${input.projectName}`, repositoryUrl: input.repositoryUrl, repositoryShowcaseId: id, scope: "Metadata-only request for future bounded sandbox review.", riskNotes: "Website did not execute code.", permissions: [] });
  return { ok: true, message: "Repository showcase submitted for moderation. No repository was fetched, cloned, built, or executed.", id };
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

export async function uploadCommuneAttachment(file: File, attach: { postId?: string; commentId?: string; repositoryShowcaseId?: string; role: string }): Promise<{ ok: boolean; message: string; id?: string }> {
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
  if (upload.error) return { ok: false, message: friendlyError(upload.error.message, "Community media storage is not active yet.") };
  const { data: mediaRow, error: mediaError } = await supabase.from(canonicalCommuneTables.media).insert({ owner_user_id: account.userId, post_id: attach.postId || null, comment_id: attach.commentId || null, storage_bucket: bucket, storage_path: storagePath, file_name: file.name, mime_type: file.type || null, file_size: file.size, media_kind: media.mediaKind, visibility_state: "submitted", warning_acknowledged: true }).select("id").single();
  if (mediaError) {
    await supabase.storage.from(bucket).remove([storagePath]);
    return { ok: false, message: friendlyError(mediaError.message, "Community media metadata is not active yet; the private upload was cleaned up.") };
  }
  const { error } = await supabase.from(canonicalCommuneTables.legacyUploads).insert({ user_id: account.userId, post_id: attach.postId || null, comment_id: attach.commentId || null, repository_showcase_id: attach.repositoryShowcaseId || null, storage_path: storagePath, original_filename: file.name, mime_type: file.type || null, size_bytes: file.size, upload_role: attach.role, status: "pending_review" }).select("id").single();
  if (error && import.meta.env.DEV) console.warn("[Commune legacy upload metadata]", error.message);
  return { ok: true, message: "Attachment uploaded privately for moderation. No public URL was created.", id: (mediaRow as { id: string }).id };
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
  const ownerSelect = item.kind === "post" ? "user_id,title" : item.kind === "comment" ? "user_id,body,post_id" : item.kind === "repo" ? "user_id,project_name" : item.kind === "sandbox" ? "user_id,request_title" : item.kind === "upload" ? "owner_user_id,file_name,post_id" : "reporter_user_id,report_type";
  const ownerResult = await supabase.from(table).select(ownerSelect).eq("id", item.id).maybeSingle();
  const ownerRow = (ownerResult.data ?? {}) as Record<string, unknown>;
  const targetUserId = String(ownerRow.user_id ?? ownerRow.owner_user_id ?? ownerRow.reporter_user_id ?? "");
  const notificationTitle = String(ownerRow.title ?? ownerRow.project_name ?? ownerRow.request_title ?? ownerRow.file_name ?? ownerRow.report_type ?? item.title);
  const postId = String(ownerRow.post_id ?? (item.kind === "post" ? item.id : ""));
  const update: Record<string, unknown> = {};
  if (item.kind === "post") {
    update.updated_at = now;
    update.status = action === "approve" ? "published" : action === "reject" ? "rejected" : action === "hide" ? "hidden" : action === "archive" ? "archived" : "needs_information";
    if (action === "approve") update.published_at = now;
    if (["hide", "reject", "needs_information"].includes(action)) update.moderation_reason = reason;
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
