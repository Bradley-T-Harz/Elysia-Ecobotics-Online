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

export type BadgeAwardAdmin = {
  id: string;
  user_id: string;
  badge_key: string;
  awarded_at: string;
  award_source: string | null;
  visibility: string;
  revoked_at: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BADGE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,79}$/;

function badgeWarning(message: string) {
  if (import.meta.env.DEV) console.warn("[badge-admin]", message);
  if (/permission denied|row-level security|RLS/i.test(message)) return "Administrator authority is required for badge management.";
  if (/does not exist|schema cache|Could not find/i.test(message)) return "The governed badge backend is not active in this environment.";
  return "Badge administration is temporarily unavailable.";
}

export async function loadBadgeAdministration(): Promise<{
  definitions: BadgeDefinitionAdmin[];
  awards: BadgeAwardAdmin[];
  warnings: string[];
}> {
  if (!hasSupabaseConfig || !supabase) return { definitions: [], awards: [], warnings: [supabaseNotConfiguredMessage] };
  const [definitionsResult, awardsResult] = await Promise.all([
    supabase.from("badge_definitions")
      .select("badge_key,name,description,category,award_mode,is_manual_only")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("user_badges")
      .select("id,user_id,badge_key,awarded_at,award_source,visibility,revoked_at")
      .order("awarded_at", { ascending: false })
      .limit(300)
  ]);
  const warnings = [definitionsResult.error, awardsResult.error]
    .filter((error): error is NonNullable<typeof error> => Boolean(error))
    .map((error) => badgeWarning(error.message));
  return {
    definitions: (definitionsResult.data ?? []) as BadgeDefinitionAdmin[],
    awards: (awardsResult.data ?? []) as BadgeAwardAdmin[],
    warnings
  };
}

export async function grantBadgeToUser(targetUserId: string, badgeKey: string, reason: string): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  if (!UUID_PATTERN.test(targetUserId)) return { ok: false, warning: "Enter the target account's complete auth UUID." };
  if (!BADGE_KEY_PATTERN.test(badgeKey)) return { ok: false, warning: "Choose a valid badge definition." };
  if (!reason.trim()) return { ok: false, warning: "Record a reason for the audited badge grant." };
  if (reason.trim().length > 2000) return { ok: false, warning: "Keep the audited grant reason to 2,000 characters or fewer." };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, warning: "Sign in as administrator first." };
  if (auth.user.id === targetUserId) return { ok: false, warning: "Administrators cannot grant badges to themselves from this console." };
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
