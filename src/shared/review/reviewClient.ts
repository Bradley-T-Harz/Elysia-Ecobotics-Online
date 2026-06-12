import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../../pages/The-Elysia-Marketplace/lib/supabase";

export type AppRole = "administrator" | "moderator" | "reviewer" | "marketplace_reviewer" | "source_reviewer" | "commune_moderator" | "guardian_reviewer";
export type ReviewStatus = "draft" | "pending_review" | "in_review" | "needs_information" | "approved" | "rejected" | "withdrawn" | "archived";
export type ReviewDomain = "commune" | "work_with" | "stewardship" | "contribution" | "living_library_source" | "living_library_broken_link" | "marketplace";

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

export function canReviewDomain(roles: AppRole[], domain: ReviewDomain) {
  return domainRoles[domain].some((role) => roles.includes(role));
}

export async function loadCurrentRoleState(): Promise<CurrentRoleState> {
  if (!hasSupabaseConfig || !supabase) return { signedIn: false, userId: null, roles: [], isAdmin: false, warnings: [supabaseNotConfiguredMessage] };
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { signedIn: false, userId: null, roles: [], isAdmin: false, warnings: authError ? [authError.message] : [] };

  const warnings: string[] = [];
  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id).is("revoked_at", null);
  if (roleError) warnings.push(roleError.message);
  const roles = ((roleRows ?? []) as { role: AppRole }[]).map((row) => row.role);

  const { data: profile, error: profileError } = await supabase.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle();
  if (profileError) warnings.push(profileError.message);
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

export async function loadReviewItems(domain?: ReviewDomain): Promise<{ items: ReviewItem[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { items: [], warnings: [supabaseNotConfiguredMessage] };
  let query = supabase.from("review_items").select("*").order("submitted_at", { ascending: false });
  if (domain) query = query.eq("domain", domain);
  const { data, error } = await query;
  return { items: (data ?? []) as ReviewItem[], warnings: error ? [error.message] : [] };
}

export async function loadReviewEvents(reviewItemId?: string): Promise<{ events: ReviewEvent[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { events: [], warnings: [supabaseNotConfiguredMessage] };
  let query = supabase.from("review_events").select("*").order("created_at", { ascending: false }).limit(100);
  if (reviewItemId) query = query.eq("review_item_id", reviewItemId);
  const { data, error } = await query;
  return { events: (data ?? []) as ReviewEvent[], warnings: error ? [error.message] : [] };
}

function sourceStatusTable(sourceTable: string) {
  if (["work_with_requests", "stewardship_recognition_requests", "commune_post_requests", "living_library_source_suggestions", "broken_link_reports", "addon_submissions", "library_source_submissions", "work_role_submissions", "content_reports"].includes(sourceTable)) return sourceTable;
  return null;
}

export async function updateReviewStatus(item: ReviewItem, nextStatus: ReviewStatus, note: string): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, warning: "Sign in with a reviewer account first." };
  const reviewed = ["approved", "rejected", "archived"].includes(nextStatus);
  const { error: itemError } = await supabase.from("review_items").update({
    status: nextStatus,
    updated_at: new Date().toISOString(),
    reviewed_at: reviewed ? new Date().toISOString() : item.reviewed_at ?? null,
    reviewed_by: reviewed ? auth.user.id : item.reviewed_by ?? null
  }).eq("id", item.id);
  if (itemError) return { ok: false, warning: itemError.message };

  const table = sourceStatusTable(item.source_table);
  if (table) {
    const { error: sourceError } = await supabase.from(table).update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", item.source_id);
    if (sourceError) return { ok: false, warning: `Review item updated, but source status failed: ${sourceError.message}` };
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
  if (eventError) return { ok: false, warning: `Status changed, but audit event failed: ${eventError.message}` };
  return { ok: true };
}

export async function assignReviewItemToMe(item: ReviewItem): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, warning: "Sign in with a reviewer account first." };
  const { error } = await supabase.from("review_items").update({ assigned_to: auth.user.id, updated_at: new Date().toISOString() }).eq("id", item.id);
  if (error) return { ok: false, warning: error.message };
  await supabase.from("review_events").insert({ review_item_id: item.id, actor_id: auth.user.id, event_type: "assigned", metadata: { visibility: "internal" } });
  return { ok: true };
}

export async function loadUserRoles(): Promise<{ rows: { id: string; user_id: string; role: AppRole; granted_at: string; revoked_at: string | null; reason: string | null }[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { rows: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("user_roles").select("id,user_id,role,granted_at,revoked_at,reason").order("granted_at", { ascending: false }).limit(200);
  return { rows: (data ?? []) as { id: string; user_id: string; role: AppRole; granted_at: string; revoked_at: string | null; reason: string | null }[], warnings: error ? [error.message] : [] };
}

export async function grantRole(userId: string, role: AppRole, reason: string): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, warning: "Sign in as administrator first." };
  if (auth.user.id === userId) return { ok: false, warning: "Role self-assignment is not allowed from this UI." };
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role, granted_by: auth.user.id, reason: reason || null });
  return { ok: !error, warning: error?.message };
}

export async function revokeRole(roleRowId: string, reason: string): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, warning: "Sign in as administrator first." };
  const { error } = await supabase.from("user_roles").update({ revoked_at: new Date().toISOString(), revoked_by: auth.user.id, reason: reason || null }).eq("id", roleRowId);
  return { ok: !error, warning: error?.message };
}
