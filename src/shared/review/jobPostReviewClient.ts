import { supabase, supabaseNotConfiguredMessage } from "../../pages/The-Elysia-Marketplace/lib/supabase";

export type JobPostReviewAction = "approve" | "reject" | "hide" | "archive" | "needs_information" | "escalate";
export type JobPostReviewResult = {
  jobPostId: string;
  postId: string;
  action: JobPostReviewAction;
  contentApproved: boolean;
  contentStatus: "approved" | "rejected" | "archived" | "needs_information" | "in_review";
  economicStatus: "not_assessed" | "not_required" | "payment_required" | "payment_pending" | "satisfied" | "waived" | "subsidized" | "refunded" | "disputed";
  publicationStatus: "approved" | "published" | "removed_by_moderator" | "hidden" | "archived" | "needs_information" | "in_review";
  published: boolean;
  feeEnforcement: boolean;
};

type UnknownRecord = Record<string, unknown>;
type ReviewCallResult = { ok: true; result: JobPostReviewResult } | { ok: false; message: string };
type JobPostIdResult = { ok: true; jobPostId: string } | { ok: false; message: string };
type BackendError = { message?: string | null; code?: string | null; details?: string | null; hint?: string | null };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions = new Set<JobPostReviewAction>(["approve", "reject", "hide", "archive", "needs_information", "escalate"]);
const contentStatuses = new Set<JobPostReviewResult["contentStatus"]>(["approved", "rejected", "archived", "needs_information", "in_review"]);
const economicStatuses = new Set<JobPostReviewResult["economicStatus"]>(["not_assessed", "not_required", "payment_required", "payment_pending", "satisfied", "waived", "subsidized", "refunded", "disputed"]);
const publicationStatuses = new Set<JobPostReviewResult["publicationStatus"]>(["approved", "published", "removed_by_moderator", "hidden", "archived", "needs_information", "in_review"]);

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function uuid(value: unknown) {
  return typeof value === "string" && uuidPattern.test(value) ? value.toLowerCase() : null;
}

function friendlyJobPostReviewError(error: BackendError | null | undefined) {
  const raw = [error?.code, error?.message, error?.details, error?.hint].filter(Boolean).join(" ");
  if (/PGRST202|schema cache|review_commune_job_post.*(?:not find|does not exist)|function.*review_commune_job_post/i.test(raw)) {
    return "The governed Job Post review boundary is not active yet. No review or publication change was made.";
  }
  if (/42501|job_post_reviewer_required|permission denied|row-level security/i.test(raw)) {
    return "This Job Post action requires an assigned Commune reviewer or administrator. No review or publication change was made.";
  }
  if (/job_post_review_reason_required/i.test(raw)) {
    return "Give a reason of 3 to 1,000 characters for this Job Post review action.";
  }
  if (/job_post_review_action_invalid/i.test(raw)) {
    return "That Job Post review action is not supported by the governed review boundary.";
  }
  if (/P0002|job_post_not_found/i.test(raw)) {
    return "This Job Post could not be found. It may already have been removed.";
  }
  if (/job_post_link_invalid|23503/i.test(raw)) {
    return "This Job Post has an inconsistent post-to-listing link. No review or publication change was made.";
  }
  return "The governed Job Post review could not be completed safely. No publication result should be assumed.";
}

function parseJobPostReviewResult(value: unknown, expectedAction: JobPostReviewAction): JobPostReviewResult | null {
  const row = record(value);
  if (!row) return null;
  const jobPostId = uuid(row.jobPostId);
  const postId = uuid(row.postId);
  const action = actions.has(row.action as JobPostReviewAction) ? row.action as JobPostReviewAction : null;
  const contentStatus = contentStatuses.has(row.contentStatus as JobPostReviewResult["contentStatus"]) ? row.contentStatus as JobPostReviewResult["contentStatus"] : null;
  const economicStatus = economicStatuses.has(row.economicStatus as JobPostReviewResult["economicStatus"]) ? row.economicStatus as JobPostReviewResult["economicStatus"] : null;
  const publicationStatus = publicationStatuses.has(row.publicationStatus as JobPostReviewResult["publicationStatus"]) ? row.publicationStatus as JobPostReviewResult["publicationStatus"] : null;
  if (!jobPostId || !postId || action !== expectedAction || !contentStatus || !economicStatus || !publicationStatus
    || typeof row.contentApproved !== "boolean" || typeof row.published !== "boolean" || typeof row.feeEnforcement !== "boolean"
    || row.contentApproved !== (expectedAction === "approve") || (row.published && publicationStatus !== "published")
    || (expectedAction !== "approve" && row.published)) return null;
  return {
    jobPostId,
    postId,
    action,
    contentApproved: row.contentApproved,
    contentStatus,
    economicStatus,
    publicationStatus,
    published: row.published,
    feeEnforcement: row.feeEnforcement
  };
}

export async function resolveCommuneJobPostId(postId: string): Promise<JobPostIdResult> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  if (!uuid(postId)) return { ok: false, message: "This Job Post has an invalid linked-post reference. No review change was made." };
  const { data, error } = await supabase.from("commune_job_posts").select("id").eq("post_id", postId).maybeSingle();
  if (error) return { ok: false, message: friendlyJobPostReviewError(error) };
  const jobPostId = uuid((data as { id?: unknown } | null)?.id);
  return jobPostId
    ? { ok: true, jobPostId }
    : { ok: false, message: "The structured Job Post record could not be found. No review or publication change was made." };
}

export async function reviewCommuneJobPost(jobPostId: string, action: JobPostReviewAction, reason: string): Promise<ReviewCallResult> {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  if (!uuid(jobPostId) || !actions.has(action)) return { ok: false, message: "That Job Post review target or action is invalid. No review change was made." };
  const trimmedReason = reason.trim();
  if (trimmedReason.length > 1_000 || (action !== "approve" && trimmedReason.length < 3)) {
    return { ok: false, message: "Give a reason of 3 to 1,000 characters for this Job Post review action." };
  }
  const { data, error } = await supabase.rpc("review_commune_job_post", {
    p_job_post_id: jobPostId,
    p_action: action,
    p_reason: trimmedReason
  });
  if (error) return { ok: false, message: friendlyJobPostReviewError(error) };
  const result = parseJobPostReviewResult(data, action);
  return result
    ? { ok: true, result }
    : { ok: false, message: "The governed Job Post review returned an invalid result. Refresh before taking another action; no publication result should be assumed." };
}

export function jobPostReviewResultMessage(result: JobPostReviewResult) {
  if (result.action === "approve" && result.published) {
    return result.feeEnforcement
      ? "Job Post content was approved and published after the independent service condition was satisfied. Payment did not grant content approval."
      : "Job Post content was approved and published. Fee enforcement is off, preserving the existing free publication behavior.";
  }
  if (result.action === "approve") {
    return "Job Post content was approved, but it remains non-public until its independent service condition is satisfied. Payment cannot grant content approval.";
  }
  return `Job Post review action ${result.action.replace(/_/g, " ")} was recorded. The listing remains non-public.`;
}
