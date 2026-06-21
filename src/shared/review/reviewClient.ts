import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../../pages/The-Elysia-Marketplace/lib/supabase";

export type AppRole = "administrator" | "moderator" | "reviewer" | "marketplace_reviewer" | "source_reviewer" | "commune_moderator" | "guardian_reviewer";
export type ReviewStatus = "draft" | "pending_review" | "in_review" | "needs_information" | "approved" | "rejected" | "withdrawn" | "archived";
export type ReviewDomain = "commune" | "work_with" | "stewardship" | "contribution" | "living_library_source" | "living_library_broken_link" | "marketplace";
export type ReviewQueueFilter = "active" | "history" | "all" | "approved" | "rejected" | "archived";

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

export async function loadReviewItems(domain?: ReviewDomain, filter: ReviewQueueFilter = "active"): Promise<{ items: ReviewItem[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { items: [], warnings: [supabaseNotConfiguredMessage] };
  let query = supabase.from("review_items").select("*").order("submitted_at", { ascending: false });
  if (domain) query = query.eq("domain", domain);
  if (filter === "active") query = query.in("status", activeReviewStatuses);
  else if (filter === "history") query = query.in("status", historyReviewStatuses);
  else if (["approved", "rejected", "archived"].includes(filter)) query = query.eq("status", filter);
  const { data, error } = await query;
  return { items: (data ?? []) as ReviewItem[], warnings: error ? [friendlyReviewWarning(error.message)] : [] };
}

export async function loadReviewEvents(reviewItemId?: string): Promise<{ events: ReviewEvent[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { events: [], warnings: [supabaseNotConfiguredMessage] };
  let query = supabase.from("review_events").select("*").order("created_at", { ascending: false }).limit(100);
  if (reviewItemId) query = query.eq("review_item_id", reviewItemId);
  const { data, error } = await query;
  return { events: (data ?? []) as ReviewEvent[], warnings: error ? [friendlyReviewWarning(error.message)] : [] };
}

function sourceStatusTable(sourceTable: string) {
  if (["work_with_requests", "stewardship_recognition_requests", "commune_post_requests", "living_library_source_suggestions", "broken_link_reports", "addon_submissions", "library_source_submissions", "work_role_submissions", "content_reports"].includes(sourceTable)) return sourceTable;
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
      const { data: postRow } = await supabase.from("commune_posts").select("id,user_id").eq("id", item.source_id).maybeSingle();
      const { data: threadRow } = await supabase.from("commune_threads").select("id").eq("post_id", item.source_id).maybeSingle();
      await grantCommuneThreadApproval({ threadId: (threadRow as { id?: string } | null)?.id ?? null, postId: item.source_id, userId: (postRow as { user_id?: string } | null)?.user_id ?? null, approvedBy: actorId, source: "post_approval" });
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
    else if (nextStatus === "archived") Object.assign(update, { status: "archived" });
    else if (nextStatus === "rejected") Object.assign(update, { status: "removed_by_moderator", hidden_at: now, hidden_by: actorId });
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

export async function updateReviewStatus(item: ReviewItem, nextStatus: ReviewStatus, note: string): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, warning: "Sign in with a reviewer account first." };
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
