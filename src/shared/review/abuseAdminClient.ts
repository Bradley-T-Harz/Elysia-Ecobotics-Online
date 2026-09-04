import {
  hasSupabaseConfig,
  supabase,
  supabaseNotConfiguredMessage
} from "../../pages/The-Elysia-Marketplace/lib/supabase";

export const abuseDecisionReviewStates = ["acknowledged", "dismissed", "escalated"] as const;
export type AbuseDecisionReviewState = typeof abuseDecisionReviewStates[number];

export type OnlineAbuseDecision = {
  decision_id: string;
  actor_user_id: string | null;
  action: string;
  resource_domain: string;
  resource_type: string;
  policy_key: string;
  decision: "restricted";
  reason_class: "velocity_limit_reached";
  decided_at: string;
  expires_at: string;
  review_state: "unreviewed" | AbuseDecisionReviewState;
  reviewed_at: string | null;
  reviewed_by: string | null;
  private_review_note: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function abuseWarning(message: string) {
  if (import.meta.env.DEV) console.warn("[abuse-admin]", message);
  if (/online_abuse_admin_required|permission denied|row-level security|RLS/i.test(message)) {
    return "Administrator authority is required for abuse-decision review.";
  }
  if (/online_abuse_review_invalid/i.test(message)) {
    return "Choose a governed review state and keep the private note to 500 characters without control characters.";
  }
  if (/online_abuse_decision_not_found/i.test(message)) return "That restriction record no longer exists.";
  if (/does not exist|schema cache|Could not find/i.test(message)) {
    return "The governed abuse-decision backend is not active in this environment.";
  }
  return "Abuse-decision operations are temporarily unavailable.";
}

export async function loadOnlineAbuseDecisions(limit = 100): Promise<{
  rows: OnlineAbuseDecision[];
  warnings: string[];
}> {
  if (!hasSupabaseConfig || !supabase) {
    return { rows: [], warnings: [supabaseNotConfiguredMessage] };
  }
  const boundedLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 500) : 100;
  const { data, error } = await supabase.rpc("online_abuse_decision_summary", {
    p_limit: boundedLimit
  });
  if (error) return { rows: [], warnings: [abuseWarning(error.message)] };
  return { rows: Array.isArray(data) ? data as OnlineAbuseDecision[] : [], warnings: [] };
}

export async function reviewOnlineAbuseDecision(
  decisionId: string,
  reviewState: AbuseDecisionReviewState,
  privateReviewNote: string
): Promise<{ ok: boolean; warning?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, warning: supabaseNotConfiguredMessage };
  if (!UUID_PATTERN.test(decisionId)) return { ok: false, warning: "The restriction record UUID is invalid." };
  if (!abuseDecisionReviewStates.includes(reviewState)) return { ok: false, warning: "Choose a governed review state." };
  const note = privateReviewNote.trim();
  if (note.length > 500 || /[\u0000-\u001f\u007f]/.test(note)) {
    return { ok: false, warning: "Keep the private review note to 500 characters without control characters." };
  }
  const { error } = await supabase.rpc("review_online_abuse_decision", {
    p_decision_id: decisionId,
    p_review_state: reviewState,
    p_private_review_note: note || null
  });
  return { ok: !error, warning: error ? abuseWarning(error.message) : undefined };
}
