import {
  hasSupabaseConfig,
  supabase,
  supabaseNotConfiguredMessage
} from "../../pages/The-Elysia-Marketplace/lib/supabase";

export type BadgeDefinitionAdmin = {
  badge_key: string;
  name: string;
  description: string;
  category: string | null;
  award_mode: string | null;
  is_manual_only: boolean;
};

export type BadgeRuleAdmin = {
  badge_slug: string;
  rule_type: string;
  required_credit_type: string | null;
  required_count: number | null;
  required_credit_sum: number | null;
  requires_major: boolean;
  distinct_subject_min: number | null;
  description: string | null;
};

export type BadgeAwardAdmin = {
  id: string;
  user_id: string;
  badge_key: string;
  awarded_at: string;
  award_source: string | null;
  visibility: string;
  revoked_at: string | null;
};

export type BadgeTimelineAward = BadgeAwardAdmin & {
  awarded_by: string | null;
  award_reason: string | null;
  evidence_type: string | null;
  evidence_id: string | null;
  revoked_by: string | null;
  revoked_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type BadgeTimelineCredit = {
  id: string;
  credit_type: string;
  credit_amount: number;
  contribution_type: string;
  contribution_id: string;
  review_item_id: string | null;
  awarded_by: string | null;
  awarded_at: string;
  is_major: boolean;
  distinct_subject_key: string | null;
  notes: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoked_reason: string | null;
};

export type BadgeTimelineSuppression = {
  id: string;
  badge_key: string;
  suppressed_by: string;
  suppressed_at: string;
  reason: string | null;
  lifted_by: string | null;
  lifted_at: string | null;
  lift_reason: string | null;
};

export type BadgeTimelineAuditEvent = {
  id: string;
  actor_user_id: string | null;
  action: string;
  badge_slug: string | null;
  credit_event_id: string | null;
  evidence_type: string | null;
  evidence_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type BadgeAdministrationTimeline = {
  targetUserId: string;
  badgeKey: string | null;
  awards: BadgeTimelineAward[];
  credits: BadgeTimelineCredit[];
  suppressions: BadgeTimelineSuppression[];
  auditEvents: BadgeTimelineAuditEvent[];
};

export type ReviewedBadgeCreditInput = {
  targetUserId: string;
  creditType: string;
  creditAmount: 1 | 2;
  contributionType: string;
  contributionId: string;
  reviewItemId?: string;
  isMajor: boolean;
  distinctSubjectKey?: string;
  notes: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BADGE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,79}$/;

function badgeWarning(message: string) {
  if (import.meta.env.DEV) console.warn("[badge-admin]", message);
  if (/badge_award_suppressed_restore_required/i.test(message)) return "This recognition is suppressed. Use the audited restore workflow before granting it again.";
  if (/active_badge_award_already_exists/i.test(message)) return "That account already has an active award for this badge.";
  if (/badge_credit_review_evidence_invalid/i.test(message)) return "The review item is not an approved, matching record for that account, evidence type, and evidence UUID.";
  if (/badge_credit_(?:type_authority|review_domain)_denied/i.test(message)) return "Your reviewer role does not authorize this badge-credit type or evidence domain.";
  if (/badge_credit_approved_review_item_required/i.test(message)) return "A non-administrator reviewer must bind the credit to an approved review item.";
  if (/permission denied|row-level security|RLS/i.test(message)) return "Administrator authority is required for badge management.";
  if (/does not exist|schema cache|Could not find/i.test(message)) return "The governed badge backend is not active in this environment.";
  return "Badge administration is temporarily unavailable.";
}

export async function loadBadgeAdministration(): Promise<{
  definitions: BadgeDefinitionAdmin[];
  rules: BadgeRuleAdmin[];
  awards: BadgeAwardAdmin[];
  warnings: string[];
}> {
  if (!hasSupabaseConfig || !supabase) return { definitions: [], rules: [], awards: [], warnings: [supabaseNotConfiguredMessage] };
  const [definitionsResult, rulesResult, awardsResult] = await Promise.all([
    supabase.from("badge_definitions")
      .select("badge_key,name,description,category,award_mode,is_manual_only")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("badge_rules")
      .select("badge_slug,rule_type,required_credit_type,required_count,required_credit_sum,requires_major,distinct_subject_min,description")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase.from("user_badges")
      .select("id,user_id,badge_key,awarded_at,award_source,visibility,revoked_at")
      .order("awarded_at", { ascending: false })
      .limit(300)
  ]);
  const warnings = [definitionsResult.error, rulesResult.error, awardsResult.error]
    .filter((error): error is NonNullable<typeof error> => Boolean(error))
    .map((error) => badgeWarning(error.message));
  return {
    definitions: (definitionsResult.data ?? []) as BadgeDefinitionAdmin[],
    rules: (rulesResult.data ?? []) as BadgeRuleAdmin[],
    awards: (awardsResult.data ?? []) as BadgeAwardAdmin[],
    warnings
  };
}

export async function loadCurrentAdministratorId() {
  if (!hasSupabaseConfig || !supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  return auth.user?.id ?? null;
}

export async function grantBadgeToUser(targetUserId: string, badgeKey: string, reason: string): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  if (!UUID_PATTERN.test(targetUserId)) return { ok: false, warning: "Enter the target account's complete auth UUID." };
  if (!BADGE_KEY_PATTERN.test(badgeKey)) return { ok: false, warning: "Choose a valid badge definition." };
  if (!reason.trim()) return { ok: false, warning: "Record a reason for the audited badge grant." };
  if (reason.trim().length > 2000) return { ok: false, warning: "Keep the audited grant reason to 2,000 characters or fewer." };
  const administratorId = await loadCurrentAdministratorId();
  if (!administratorId) return { ok: false, warning: "Sign in as administrator first." };
  const { error } = await supabase.rpc("grant_user_badge", {
    p_target_user_id: targetUserId,
    p_badge_key: badgeKey,
    p_award_reason: reason.trim(),
    p_evidence_type: "manual_admin_review",
    p_evidence_id: null
  });
  return { ok: !error, warning: error ? badgeWarning(error.message) : undefined };
}

export async function revokeBadgeFromUser(targetUserId: string, badgeKey: string, reason: string): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  if (!UUID_PATTERN.test(targetUserId) || !BADGE_KEY_PATTERN.test(badgeKey)) return { ok: false, warning: "The badge award target is invalid." };
  if (!reason.trim()) return { ok: false, warning: "Record a reason for the audited badge revocation." };
  if (reason.trim().length > 2000) return { ok: false, warning: "Keep the audited revocation reason to 2,000 characters or fewer." };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, warning: "Sign in as administrator first." };
  const { error } = await supabase.rpc("revoke_user_badge", {
    p_target_user_id: targetUserId,
    p_badge_key: badgeKey,
    p_revoked_reason: reason.trim()
  });
  return { ok: !error, warning: error ? badgeWarning(error.message) : undefined };
}

export async function createReviewedBadgeCredit(input: ReviewedBadgeCreditInput): Promise<{ ok: boolean; creditEventId?: string; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  if (!UUID_PATTERN.test(input.targetUserId) || !UUID_PATTERN.test(input.contributionId)) return { ok: false, warning: "Target and evidence must use complete UUIDs." };
  if (input.reviewItemId && !UUID_PATTERN.test(input.reviewItemId)) return { ok: false, warning: "The optional review-item UUID is invalid." };
  if (!BADGE_KEY_PATTERN.test(input.creditType) || !BADGE_KEY_PATTERN.test(input.contributionType)) return { ok: false, warning: "Credit and evidence types must use governed lowercase identifiers." };
  if (input.creditAmount !== 1 && input.creditAmount !== 2) return { ok: false, warning: "Badge credit amount must be 1 or 2." };
  if (!input.notes.trim() || input.notes.trim().length > 2000) return { ok: false, warning: "Record a review note of 2,000 characters or fewer." };
  if ((input.distinctSubjectKey?.trim().length ?? 0) > 200) return { ok: false, warning: "Keep the distinct subject key to 200 characters or fewer." };
  const administratorId = await loadCurrentAdministratorId();
  if (!administratorId) return { ok: false, warning: "Sign in as administrator first." };
  if (administratorId === input.targetUserId) return { ok: false, warning: "Administrators cannot create badge credits for themselves from this console." };
  const { data, error } = await supabase.rpc("create_badge_credit_event", {
    p_target_user_id: input.targetUserId,
    p_credit_type: input.creditType,
    p_credit_amount: input.creditAmount,
    p_contribution_type: input.contributionType,
    p_contribution_id: input.contributionId,
    p_review_item_id: input.reviewItemId?.trim() || null,
    p_is_major: input.isMajor,
    p_distinct_subject_key: input.distinctSubjectKey?.trim() || null,
    p_notes: input.notes.trim()
  });
  return { ok: !error, creditEventId: !error && typeof data === "string" ? data : undefined, warning: error ? badgeWarning(error.message) : undefined };
}

function emptyTimeline(targetUserId: string, badgeKey: string | null): BadgeAdministrationTimeline {
  return { targetUserId, badgeKey, awards: [], credits: [], suppressions: [], auditEvents: [] };
}

export async function loadBadgeAdministrationTimeline(targetUserId: string, badgeKey?: string): Promise<{ timeline: BadgeAdministrationTimeline; warnings: string[] }> {
  const selectedBadge = badgeKey?.trim() || null;
  if (!UUID_PATTERN.test(targetUserId)) return { timeline: emptyTimeline(targetUserId, selectedBadge), warnings: ["Enter the target account's complete auth UUID."] };
  if (selectedBadge && !BADGE_KEY_PATTERN.test(selectedBadge)) return { timeline: emptyTimeline(targetUserId, selectedBadge), warnings: ["Choose a valid badge definition."] };
  if (!hasSupabaseConfig || !supabase) return { timeline: emptyTimeline(targetUserId, selectedBadge), warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.rpc("badge_administration_timeline", {
    p_target_user_id: targetUserId,
    p_badge_key: selectedBadge,
    p_limit: 100
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { timeline: emptyTimeline(targetUserId, selectedBadge), warnings: [badgeWarning(error?.message ?? "badge_timeline_invalid")] };
  }
  const value = data as Partial<BadgeAdministrationTimeline>;
  return {
    timeline: {
      targetUserId,
      badgeKey: selectedBadge,
      awards: Array.isArray(value.awards) ? value.awards : [],
      credits: Array.isArray(value.credits) ? value.credits : [],
      suppressions: Array.isArray(value.suppressions) ? value.suppressions : [],
      auditEvents: Array.isArray(value.auditEvents) ? value.auditEvents : []
    },
    warnings: []
  };
}

export async function revokeBadgeCredit(creditEventId: string, reason: string): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  if (!UUID_PATTERN.test(creditEventId)) return { ok: false, warning: "The badge-credit event UUID is invalid." };
  if (!reason.trim() || reason.trim().length > 2000) return { ok: false, warning: "Record a revocation reason of 2,000 characters or fewer." };
  const { error } = await supabase.rpc("revoke_badge_credit_event", {
    p_credit_event_id: creditEventId,
    p_revoked_reason: reason.trim()
  });
  return { ok: !error, warning: error ? badgeWarning(error.message) : undefined };
}

export async function restoreBadgeForUser(targetUserId: string, badgeKey: string, reason: string, manualOverride: boolean): Promise<{ ok: boolean; restored?: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  if (!UUID_PATTERN.test(targetUserId) || !BADGE_KEY_PATTERN.test(badgeKey)) return { ok: false, warning: "The badge restore target is invalid." };
  if (!reason.trim() || reason.trim().length > 2000) return { ok: false, warning: "Record a restore reason of 2,000 characters or fewer." };
  const administratorId = await loadCurrentAdministratorId();
  if (!administratorId) return { ok: false, warning: "Sign in as administrator first." };
  const { data, error } = await supabase.rpc("restore_user_badge", {
    p_target_user_id: targetUserId,
    p_badge_key: badgeKey,
    p_restore_reason: reason.trim(),
    p_manual_override: manualOverride
  });
  const restored = !error && data && typeof data === "object" && !Array.isArray(data)
    ? (data as { restored?: unknown }).restored === true
    : false;
  return { ok: !error, restored, warning: error ? badgeWarning(error.message) : undefined };
}
