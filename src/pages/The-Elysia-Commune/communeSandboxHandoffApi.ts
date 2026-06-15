import { createReviewItem, loadCurrentRoleState } from "../../shared/review/reviewClient";
import { buildLocalHandoffBundle as buildBundle, handoffFileName } from "../../shared/sandbox/sandboxHandoffBuilder";
import {
  detectSecretLikeSandboxText,
  sanitizeDeclaredDomains,
  sanitizeDeclaredFileScopes,
  sanitizeExpectedCommand,
  validateSandboxRequestInput
} from "../../shared/sandbox/sandboxRequestValidator";
import { type SandboxHandoffBundle, type SandboxRequestInput, type SandboxRequestRecord, type SandboxRequestStatus, type SandboxReviewStatus, type SandboxValidationResult } from "../../shared/sandbox/sandboxHandoffTypes";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";

const sandboxTable = "commune_sandbox_review_requests";
const eventTable = "sandbox_handoff_events";

export type SandboxRequestAction = "request_changes" | "approve_for_local_handoff" | "reject" | "security_hold" | "revoke_handoff" | "archive";
export type SandboxHandoffExport = { filename: string; checksum: string; json: string; bundle: SandboxHandoffBundle };

function warn(message: string) { if (import.meta.env.DEV) console.warn("[Sandbox handoff]", message); }

export function formatSafeSandboxError(error: unknown, fallback = "Sandbox request storage is not active yet.") {
  const message = typeof error === "string" ? error : error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message) : "";
  if (message) warn(message);
  if (/schema cache|Could not find|does not exist|relation/i.test(message)) return fallback;
  if (/permission denied|row-level security|violates row-level security/i.test(message)) return "Your current account cannot use this sandbox request action yet.";
  return message || fallback;
}

function splitList(value?: string[] | string | null) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value ?? "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function uuidOrNull(value?: string | null) {
  const text = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function normalize(row: Record<string, unknown>): SandboxRequestRecord {
  return {
    id: String(row.id),
    user_id: row.user_id as string | null | undefined,
    submitted_by: row.submitted_by as string | null | undefined,
    source_type: (row.source_type as SandboxRequestRecord["source_type"]) ?? "manual",
    source_id: row.source_id as string | null | undefined,
    title: String(row.title ?? row.request_title ?? "Sandbox review request"),
    request_title: row.request_title as string | null | undefined,
    summary: row.summary as string | null | undefined,
    language: row.language as string | null | undefined,
    code_text: row.code_text as string | null | undefined,
    package_id: row.package_id as string | null | undefined,
    addon_submission_id: row.addon_submission_id as string | null | undefined,
    code_document_id: row.code_document_id as string | null | undefined,
    expected_command: row.expected_command as string | null | undefined,
    declared_dependencies: splitList(row.declared_dependencies as string[] | null | undefined),
    declared_network_policy: (row.declared_network_policy as SandboxRequestRecord["declared_network_policy"]) ?? "disabled",
    declared_network_domains: splitList(row.declared_network_domains as string[] | null | undefined),
    declared_filesystem_policy: (row.declared_filesystem_policy as SandboxRequestRecord["declared_filesystem_policy"]) ?? "none",
    declared_file_scopes: splitList(row.declared_file_scopes as string[] | null | undefined),
    requested_cpu_limit: row.requested_cpu_limit as string | null | undefined,
    requested_memory_limit: row.requested_memory_limit as string | null | undefined,
    requested_timeout_seconds: row.requested_timeout_seconds ? Number(row.requested_timeout_seconds) : null,
    risk_notes: row.risk_notes as string | null | undefined,
    user_acknowledged_no_execution: Boolean(row.user_acknowledged_no_execution),
    user_acknowledged_no_secrets: Boolean(row.user_acknowledged_no_secrets),
    user_acknowledged_local_elysia_final_authority: Boolean(row.user_acknowledged_local_elysia_final_authority),
    request_status: (row.request_status as SandboxRequestStatus) ?? (row.status === "approved_for_local_sandbox" ? "approved_for_local_handoff" : row.status === "needs_information" ? "changes_requested" : row.status === "requested" ? "submitted" : "draft"),
    review_status: (row.review_status as SandboxReviewStatus) ?? (row.status === "approved_for_local_sandbox" ? "approved" : row.status === "rejected" ? "rejected" : row.status === "needs_information" ? "changes_requested" : "pending_review"),
    handoff_status: (row.handoff_status as SandboxRequestRecord["handoff_status"]) ?? "not_exported",
    handoff_bundle_json: row.handoff_bundle_json,
    handoff_exported_at: row.handoff_exported_at as string | null | undefined,
    reviewed_by: row.reviewed_by as string | null | undefined,
    reviewed_at: row.reviewed_at as string | null | undefined,
    reviewer_public_feedback: row.reviewer_public_feedback as string | null | undefined,
    reviewer_private_note: row.reviewer_private_note as string | null | undefined,
    security_hold_reason: row.security_hold_reason as string | null | undefined,
    created_at: row.created_at as string | null | undefined,
    updated_at: row.updated_at as string | null | undefined
  };
}

function toDb(input: SandboxRequestInput) {
  const title = input.title.trim();
  return {
    submitted_by: input.submitted_by ?? input.user_id ?? null,
    source_type: input.source_type,
    source_id: uuidOrNull(input.source_id ?? input.code_document_id ?? input.addon_submission_id),
    title,
    request_title: title,
    summary: input.summary?.trim() || null,
    language: input.language?.trim() || null,
    code_text: input.code_text?.trim() || null,
    package_id: input.package_id ?? null,
    addon_submission_id: input.addon_submission_id ?? null,
    code_document_id: input.code_document_id ?? null,
    expected_command: sanitizeExpectedCommand(input.expected_command),
    declared_dependencies: splitList(input.declared_dependencies),
    declared_network_policy: input.declared_network_policy,
    declared_network_domains: sanitizeDeclaredDomains(input.declared_network_domains ?? []),
    declared_filesystem_policy: input.declared_filesystem_policy,
    declared_file_scopes: sanitizeDeclaredFileScopes(input.declared_file_scopes ?? []),
    requested_cpu_limit: input.requested_cpu_limit?.trim() || null,
    requested_memory_limit: input.requested_memory_limit?.trim() || null,
    requested_timeout_seconds: input.requested_timeout_seconds || null,
    risk_notes: input.risk_notes?.trim() || null,
    user_acknowledged_no_execution: input.user_acknowledged_no_execution,
    user_acknowledged_no_secrets: input.user_acknowledged_no_secrets,
    user_acknowledged_local_elysia_final_authority: input.user_acknowledged_local_elysia_final_authority
  };
}

async function currentUserId() {
  const role = await loadCurrentRoleState();
  return role.userId;
}

async function logEvent(requestId: string, action: string, reason?: string, metadata: Record<string, unknown> = {}) {
  if (!hasSupabaseConfig || !supabase) return;
  const actor = await currentUserId();
  const { error } = await supabase.from(eventTable).insert({ sandbox_request_id: requestId, actor_user_id: actor, action, reason: reason || null, metadata });
  if (error) warn(error.message);
}

export { detectSecretLikeSandboxText, sanitizeDeclaredDomains, sanitizeDeclaredFileScopes, sanitizeExpectedCommand, validateSandboxRequestInput };

export async function createSandboxRequestDraft(input: SandboxRequestInput): Promise<{ ok: boolean; message: string; request?: SandboxRequestRecord; validation: SandboxValidationResult }> {
  const validation = validateSandboxRequestInput({ ...input, user_acknowledged_no_execution: true, user_acknowledged_no_secrets: true, user_acknowledged_local_elysia_final_authority: true });
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: supabaseNotConfiguredMessage, validation };
  const role = await loadCurrentRoleState();
  if (!role.userId) return { ok: false, message: "Sign in to save sandbox request drafts.", validation };
  const { data, error } = await supabase.from(sandboxTable).insert({ ...toDb(input), user_id: role.userId, submitted_by: role.userId, request_status: "draft", review_status: "not_submitted", handoff_status: "not_exported", status: "requested" }).select("*").single();
  if (error) return { ok: false, message: formatSafeSandboxError(error), validation };
  const request = normalize(data as Record<string, unknown>);
  await logEvent(request.id, "draft_created", "Sandbox request draft created.");
  return { ok: true, message: "Sandbox request draft saved. The website did not execute anything.", request, validation };
}

export async function updateSandboxRequestDraft(id: string, input: SandboxRequestInput): Promise<{ ok: boolean; message: string; request?: SandboxRequestRecord; validation: SandboxValidationResult }> {
  const validation = validateSandboxRequestInput({ ...input, user_acknowledged_no_execution: true, user_acknowledged_no_secrets: true, user_acknowledged_local_elysia_final_authority: true });
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: supabaseNotConfiguredMessage, validation };
  const { data, error } = await supabase.from(sandboxTable).update({ ...toDb(input), request_status: "draft", review_status: "not_submitted", updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) return { ok: false, message: formatSafeSandboxError(error), validation };
  const request = normalize(data as Record<string, unknown>);
  await logEvent(request.id, "draft_created", "Sandbox request draft updated.");
  return { ok: true, message: "Sandbox request draft updated. No local handoff was exported.", request, validation };
}

export async function submitSandboxRequest(id: string): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const current = await getSandboxRequest(id);
  if (!current.request) return { ok: false, message: current.message ?? "Sandbox request not found." };
  const validation = validateSandboxRequestInput(current.request);
  if (!validation.ok) return { ok: false, message: `Fix validation errors before submitting: ${validation.errors.map((item) => item.message).join(" ")}` };
  const { error } = await supabase.from(sandboxTable).update({ request_status: "submitted", review_status: "pending_review", status: "requested", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, message: formatSafeSandboxError(error) };
  await logEvent(id, "request_submitted", "Submitted for reviewer handoff decision.", { risk_level: validation.risk_level });
  const submittedBy = current.request.user_id ?? current.request.submitted_by;
  if (submittedBy) await createReviewItem({ domain: "commune", sourceTable: sandboxTable, sourceId: id, submittedBy, title: current.request.title, summary: "Sandbox local handoff request. Website metadata only; no execution." });
  return { ok: true, message: "Sandbox request submitted for review. It is not execution permission." };
}

export async function listMySandboxRequests(): Promise<{ requests: SandboxRequestRecord[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { requests: [], warnings: [supabaseNotConfiguredMessage] };
  const role = await loadCurrentRoleState();
  if (!role.userId) return { requests: [], warnings: [] };
  const { data, error } = await supabase.from(sandboxTable).select("*").or(`user_id.eq.${role.userId},submitted_by.eq.${role.userId}`).order("created_at", { ascending: false }).limit(25);
  if (error) return { requests: [], warnings: [formatSafeSandboxError(error)] };
  return { requests: (data ?? []).map((row) => normalize(row as Record<string, unknown>)), warnings: [] };
}

export async function getSandboxRequest(id: string): Promise<{ request?: SandboxRequestRecord; message?: string }> {
  if (!hasSupabaseConfig || !supabase) return { message: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.from(sandboxTable).select("*").eq("id", id).maybeSingle();
  if (error) return { message: formatSafeSandboxError(error) };
  return data ? { request: normalize(data as Record<string, unknown>) } : { message: "Sandbox request not found." };
}

export async function listSandboxRequestsForReview(): Promise<{ requests: SandboxRequestRecord[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { requests: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from(sandboxTable).select("*").in("request_status", ["submitted", "changes_requested", "approved_for_local_handoff", "security_hold"]).order("created_at", { ascending: false }).limit(50);
  if (error) return { requests: [], warnings: [formatSafeSandboxError(error, "Sandbox handoff review table/policy is not active yet.")] };
  return { requests: (data ?? []).map((row) => normalize(row as Record<string, unknown>)), warnings: [] };
}

export async function reviewSandboxRequest(id: string, action: SandboxRequestAction, feedback: string, privateNote?: string): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const state = await loadCurrentRoleState();
  if (!state.isAdmin && !state.roles.some((role) => ["administrator", "moderator", "reviewer", "commune_moderator", "guardian_reviewer"].includes(role))) return { ok: false, message: "Sandbox handoff review requires an assigned reviewer/moderator role." };
  const now = new Date().toISOString();
  const mapping: Record<SandboxRequestAction, { request_status: SandboxRequestStatus; review_status: SandboxReviewStatus; handoff_status?: SandboxRequestRecord["handoff_status"]; status: string; event: string }> = {
    request_changes: { request_status: "changes_requested", review_status: "changes_requested", status: "needs_information", event: "changes_requested" },
    approve_for_local_handoff: { request_status: "approved_for_local_handoff", review_status: "approved", handoff_status: "export_ready", status: "approved_for_local_sandbox", event: "approved_for_local_handoff" },
    reject: { request_status: "rejected", review_status: "rejected", status: "rejected", event: "rejected" },
    security_hold: { request_status: "security_hold", review_status: "security_hold", status: "in_review", event: "security_hold" },
    revoke_handoff: { request_status: "revoked", review_status: "rejected", handoff_status: "revoked", status: "rejected", event: "handoff_revoked" },
    archive: { request_status: "archived", review_status: "rejected", handoff_status: "expired", status: "archived", event: "archived" }
  };
  const next = mapping[action];
  const update = { ...next, event: undefined, reviewed_by: state.userId, reviewed_at: now, reviewer_public_feedback: feedback || null, reviewer_private_note: privateNote || null, security_hold_reason: action === "security_hold" ? feedback || privateNote || "Security hold" : null, updated_at: now };
  const { error } = await supabase.from(sandboxTable).update(update).eq("id", id);
  if (error) return { ok: false, message: formatSafeSandboxError(error, "Sandbox handoff review action is not active yet.") };
  await logEvent(id, next.event, feedback || privateNote || undefined, { action, private_note_recorded: Boolean(privateNote) });
  return { ok: true, message: action === "approve_for_local_handoff" ? "Approved for Local Elysia handoff export. This is still not execution approval." : `Sandbox request marked ${next.request_status.replace(/_/g, " ")}.` };
}

export function approveSandboxRequestForLocalHandoff(id: string, feedback: string) { return reviewSandboxRequest(id, "approve_for_local_handoff", feedback); }
export function rejectSandboxRequest(id: string, feedback: string, privateNote?: string) { return reviewSandboxRequest(id, "reject", feedback, privateNote); }
export function placeSandboxRequestOnSecurityHold(id: string, reason: string, privateNote?: string) { return reviewSandboxRequest(id, "security_hold", reason, privateNote); }
export function revokeLocalHandoff(id: string, reason: string) { return reviewSandboxRequest(id, "revoke_handoff", reason); }

export async function buildLocalHandoffBundle(request: SandboxRequestRecord) { return buildBundle(request); }

export async function exportLocalHandoffBundle(request: SandboxRequestRecord): Promise<{ ok: boolean; message: string; export?: SandboxHandoffExport }> {
  const built = await buildBundle(request);
  if (!built.ok) return { ok: false, message: built.message };
  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from(sandboxTable).update({ handoff_status: "exported", handoff_bundle_json: built.bundle, handoff_exported_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", request.id);
    if (error) return { ok: false, message: formatSafeSandboxError(error, "Handoff export logging is not active yet.") };
    await logEvent(request.id, "handoff_exported", "User exported Local Elysia handoff metadata.", { bundle_sha256: built.checksum });
  }
  return { ok: true, message: "Local Elysia handoff bundle prepared. It is metadata only and must be revalidated locally before any execution.", export: { ...built, filename: handoffFileName(request) } };
}

export async function listSandboxHandoffEvents(id: string): Promise<{ events: { id: string; action: string; reason?: string | null; created_at?: string | null }[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { events: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from(eventTable).select("id,action,reason,created_at").eq("sandbox_request_id", id).order("created_at", { ascending: false }).limit(25);
  if (error) return { events: [], warnings: [formatSafeSandboxError(error, "Sandbox handoff event log is not active yet.")] };
  return { events: data ?? [], warnings: [] };
}
