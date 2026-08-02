import { createReviewItem, loadCurrentRoleState, type AppRole } from "../../shared/review/reviewClient";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";
import { communeReportReasons, scanCommuneTextForSecrets } from "./communeSafety";

export type CodeDocumentVisibility = "draft" | "submitted" | "published" | "flagged" | "hidden" | "removed" | "archived";
export type CodeDocumentReviewStatus = "draft" | "open_for_review" | "changes_requested" | "resolved" | "archived" | "security_hold";
export type CodeAnnotationStatus = "open" | "addressed" | "resolved" | "archived";
export type CodeRevisionProposalStatus = "draft" | "submitted" | "needs_changes" | "accepted" | "rejected" | "withdrawn" | "hidden_by_moderation";

export type CodeReviewAccount = { signedIn: boolean; userId: string | null; isModerator: boolean; roles: AppRole[]; warnings: string[] };
export type CodeDocument = { id: string; owner_user_id: string; title: string; slug?: string | null; language: string; file_name?: string | null; current_text: string; summary?: string | null; visibility_state: CodeDocumentVisibility; review_status: CodeDocumentReviewStatus; linked_commune_post_id?: string | null; linked_sandbox_request_id?: string | null; created_at: string; updated_at: string; published_at?: string | null; archived_at?: string | null; hidden_at?: string | null; removed_at?: string | null; moderation_reason?: string | null };
export type CodeDocumentVersion = { id: string; document_id: string; created_by?: string | null; snapshot_text: string; change_summary?: string | null; version_number: number; created_at: string };
export type CodeAnnotation = { id: string; document_id: string; author_user_id: string; line_start: number; line_end: number; comment: string; visibility_state: "published" | "flagged" | "hidden" | "removed" | "archived"; annotation_status: CodeAnnotationStatus; created_at: string; updated_at?: string | null; hidden_at?: string | null; removed_at?: string | null; moderation_reason?: string | null };
export type CodeSession = { id: string; document_id: string; room_slug?: string | null; status: "open" | "locked" | "paused" | "closed" | "archived"; active_editor_user_id?: string | null; edit_lock_expires_at?: string | null; created_at: string; updated_at: string };
export type CodeReport = { id: string; document_id?: string | null; annotation_id?: string | null; reporter_user_id?: string | null; reason: string; detail?: string | null; report_status: string; created_at: string; reviewed_at?: string | null; reviewed_by?: string | null; reviewer_note?: string | null; document?: CodeDocument | null; annotation?: CodeAnnotation | null };
export type CodeRevisionProposal = {
  id: string;
  post_id: string;
  code_snippet_id: string;
  proposer_user_id: string;
  original_author_user_id: string;
  base_code_text: string;
  proposed_code_text: string;
  language?: string | null;
  file_name?: string | null;
  change_summary: string;
  explanation?: string | null;
  base_snapshot_label?: string | null;
  proposal_status: CodeRevisionProposalStatus;
  sandbox_summary?: Record<string, unknown> | null;
  accepted_version_number?: number | null;
  decision_by?: string | null;
  decision_note?: string | null;
  submitted_at?: string | null;
  decided_at?: string | null;
  withdrawn_at?: string | null;
  hidden_at?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export const codeReviewLanguages = ["text", "typescript", "javascript", "python", "json", "markdown", "css", "html", "sql", "bash", "yaml", "toml"] as const;
export const codeReviewReportReasons = [...communeReportReasons];

const maxCodeLength = 100000;

function isModeratorRole(roles: AppRole[], isAdmin: boolean) {
  return isAdmin || roles.some((role) => ["administrator", "moderator", "reviewer", "commune_moderator", "guardian_reviewer"].includes(role));
}

export function formatSafeCodeReviewError(error?: { message?: string } | null) {
  if (!error?.message) return "Code review action could not be completed.";
  if (import.meta.env.DEV) console.warn("[Commune code review]", error.message);
  if (/submit_commune_code_revision_proposal|decide_commune_code_revision_proposal|commune_code_revision_proposals/i.test(error.message)) return "Coding Cornucopia revision proposals are not active until the latest Supabase migration is applied.";
  if (/schema cache|Could not find|does not exist|relation/i.test(error.message)) return "Collaborative code review tables are not active until the latest Supabase migration is applied.";
  if (/permission denied|row-level security|violates row-level security|JWT/i.test(error.message)) return "Your current account cannot use that code review action yet.";
  if (/check constraint|code_documents/i.test(error.message)) return "Code review content was blocked by safety limits.";
  return "Code review action could not be completed.";
}

export function sanitizeCodeFileName(fileName: string) {
  const trimmed = fileName.trim().replace(/\\/g, "/").split("/").pop() ?? "";
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

export function detectSecretLikeCodeText(text: string) {
  return scanCommuneTextForSecrets(text).warnings;
}

export function validateCodeDocumentInput(input: { title: string; language: string; fileName?: string; text: string; summary?: string }) {
  const title = input.title.trim();
  const language = codeReviewLanguages.includes(input.language as typeof codeReviewLanguages[number]) ? input.language : "text";
  const fileName = sanitizeCodeFileName(input.fileName ?? "");
  const text = input.text.replace(/\r\n/g, "\n");
  const scan = scanCommuneTextForSecrets([title, fileName, input.summary ?? "", text].join("\n"));
  if (!title) return { ok: false, message: "Add a title before saving this code review document.", title, language, fileName, text, warnings: scan.warnings };
  if (text.length > maxCodeLength) return { ok: false, message: `Code review documents must be ${maxCodeLength.toLocaleString()} characters or fewer.`, title, language, fileName, text, warnings: scan.warnings };
  if (/\.\.|^\/|^[A-Z]:\\/i.test(input.fileName ?? "")) return { ok: false, message: "Filename blocked. Use a simple filename, not a path.", title, language, fileName, text, warnings: scan.warnings };
  if (scan.blocked) return { ok: false, message: `Remove private/secret material before saving: ${scan.warnings.join(", ")}.`, title, language, fileName, text, warnings: scan.warnings };
  return { ok: true, title, language, fileName, text, warnings: scan.warnings };
}

export function validateAnnotationInput(input: { lineStart: number; lineEnd: number; comment: string }) {
  const lineStart = Math.max(1, Math.floor(input.lineStart || 1));
  const lineEnd = Math.max(lineStart, Math.floor(input.lineEnd || lineStart));
  const comment = input.comment.trim();
  const scan = scanCommuneTextForSecrets(comment);
  if (!comment) return { ok: false, message: "Write an annotation comment first.", lineStart, lineEnd, comment, warnings: scan.warnings };
  if (comment.length > 2000) return { ok: false, message: "Annotations must be 2,000 characters or fewer.", lineStart, lineEnd, comment, warnings: scan.warnings };
  if (scan.blocked) return { ok: false, message: `Remove private/secret material before saving: ${scan.warnings.join(", ")}.`, lineStart, lineEnd, comment, warnings: scan.warnings };
  return { ok: true, lineStart, lineEnd, comment, warnings: scan.warnings };
}

export function splitCodeIntoLines(text: string) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

export function buildPatchOrDiffPreview(oldText: string, newText: string) {
  const oldLines = splitCodeIntoLines(oldText);
  const newLines = splitCodeIntoLines(newText);
  return { oldLineCount: oldLines.length, newLineCount: newLines.length, changed: oldText !== newText, sizeDelta: newText.length - oldText.length };
}

export async function listCodeRevisionProposals(input: { postId?: string; codeSnippetId?: string; proposalId?: string } = {}): Promise<{ proposals: CodeRevisionProposal[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { proposals: [], warnings: [supabaseNotConfiguredMessage] };
  let query = supabase.from("commune_code_revision_proposals").select("*").order("created_at", { ascending: false }).limit(80);
  if (input.proposalId) query = query.eq("id", input.proposalId);
  if (input.postId) query = query.eq("post_id", input.postId);
  if (input.codeSnippetId) query = query.eq("code_snippet_id", input.codeSnippetId);
  const { data, error } = await query;
  return { proposals: (data ?? []) as CodeRevisionProposal[], warnings: error ? [formatSafeCodeReviewError(error)] : [] };
}

export async function submitCodeRevisionProposal(input: { clientRequestId: string; postId: string; codeSnippetId: string; proposedCodeText: string; language?: string | null; fileName?: string | null; changeSummary: string; explanation?: string | null }): Promise<{ ok: boolean; message: string; proposalId?: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Coding Cornucopia revision proposals are not active yet." };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in before proposing a Coding Cornucopia revision." };
  const validation = validateCodeDocumentInput({ title: input.changeSummary, language: input.language ?? "text", fileName: input.fileName ?? "", text: input.proposedCodeText, summary: input.explanation ?? "" });
  if (!validation.ok) return { ok: false, message: validation.message ?? "Revision proposal blocked by Coding Cornucopia safety limits." };
  const { data, error } = await supabase.rpc("submit_commune_code_revision_proposal_v2", {
    p_client_request_id: input.clientRequestId,
    p_post_id: input.postId,
    p_code_snippet_id: input.codeSnippetId,
    p_proposed_code_text: validation.text,
    p_language: validation.language,
    p_file_name: validation.fileName || null,
    p_change_summary: validation.title,
    p_explanation: input.explanation?.trim() || null
  });
  if (error) return { ok: false, message: formatSafeCodeReviewError(error) };
  return { ok: true, message: "Revision proposal submitted. The attached code stays unchanged until the original post author accepts it.", proposalId: data as string };
}

export async function decideCodeRevisionProposal(proposalId: string, decision: Extract<CodeRevisionProposalStatus, "accepted" | "rejected" | "needs_changes" | "hidden_by_moderation">, decisionNote?: string): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Coding Cornucopia revision proposals are not active yet." };
  const { error } = await supabase.rpc("decide_commune_code_revision_proposal", {
    p_proposal_id: proposalId,
    p_decision: decision,
    p_decision_note: decisionNote?.trim() || null
  });
  if (error) return { ok: false, message: formatSafeCodeReviewError(error) };
  return {
    ok: true,
    message: decision === "accepted"
      ? "Revision accepted. The current attached code now uses the accepted revision, with version history preserved."
      : decision === "needs_changes"
        ? "Changes requested. The attached code remains unchanged."
        : decision === "hidden_by_moderation"
          ? "Proposal hidden by moderation. The attached code remains unchanged."
          : "Revision rejected. The attached code remains unchanged."
  };
}

export async function withdrawCodeRevisionProposal(proposalId: string): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Coding Cornucopia revision proposals are not active yet." };
  const { error } = await supabase.rpc("withdraw_commune_code_revision_proposal", { p_proposal_id: proposalId });
  return error ? { ok: false, message: formatSafeCodeReviewError(error) } : { ok: true, message: "Revision proposal withdrawn. The attached code remains unchanged." };
}

async function accountState(): Promise<CodeReviewAccount> {
  const state = await loadCurrentRoleState();
  return { signedIn: state.signedIn, userId: state.userId, roles: state.roles, isModerator: isModeratorRole(state.roles, state.isAdmin), warnings: state.warnings };
}

async function writeEvent(input: { documentId?: string | null; annotationId?: string | null; action: string; reason?: string | null; metadata?: Record<string, unknown> }) {
  if (!supabase) return;
  const account = await accountState();
  if (!account.userId) return;
  const { error } = await supabase.from("commune_code_moderation_events").insert({ document_id: input.documentId || null, annotation_id: input.annotationId || null, actor_user_id: account.userId, action: input.action, reason: input.reason || null, metadata: input.metadata ?? {} });
  if (error && import.meta.env.DEV) console.warn("[Commune code event]", error.message);
}

export async function loadCodeReviewAccount() { return accountState(); }

export async function listPublishedCodeDocuments(): Promise<{ documents: CodeDocument[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { documents: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("commune_code_documents").select("*").eq("visibility_state", "published").order("updated_at", { ascending: false }).limit(30);
  return { documents: (data ?? []) as CodeDocument[], warnings: error ? [formatSafeCodeReviewError(error)] : [] };
}

export async function listMyCodeDocuments(): Promise<{ documents: CodeDocument[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { documents: [], warnings: [supabaseNotConfiguredMessage] };
  const account = await accountState();
  if (!account.userId) return { documents: [], warnings: [] };
  const { data, error } = await supabase.from("commune_code_documents").select("*").eq("owner_user_id", account.userId).order("updated_at", { ascending: false }).limit(30);
  return { documents: (data ?? []) as CodeDocument[], warnings: error ? [formatSafeCodeReviewError(error)] : [] };
}

export async function getCodeDocument(idOrSlug: string): Promise<{ document: CodeDocument | null; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { document: null, warnings: [supabaseNotConfiguredMessage] };
  const uuidLike = /^[0-9a-f-]{32,}$/i.test(idOrSlug);
  const query = supabase.from("commune_code_documents").select("*").limit(1);
  const { data, error } = uuidLike ? await query.eq("id", idOrSlug).maybeSingle() : await query.eq("slug", idOrSlug).maybeSingle();
  return { document: (data as CodeDocument | null) ?? null, warnings: error ? [formatSafeCodeReviewError(error)] : [] };
}

export async function createCodeDocument(input: { title: string; language: string; fileName?: string; text: string; summary?: string }): Promise<{ ok: boolean; message: string; document?: CodeDocument }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Collaborative code review backend is not active yet." };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to create code review documents." };
  const validation = validateCodeDocumentInput(input);
  if (!validation.ok) return { ok: false, message: validation.message ?? "Code review document blocked." };
  const slug = `${validation.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "code-review"}-${Date.now().toString(36)}`;
  const { data, error } = await supabase.from("commune_code_documents").insert({ owner_user_id: account.userId, title: validation.title, slug, language: validation.language, file_name: validation.fileName || null, current_text: validation.text, summary: input.summary?.trim() || null, visibility_state: "draft", review_status: "draft" }).select("*").single();
  if (error) return { ok: false, message: formatSafeCodeReviewError(error) };
  const document = data as CodeDocument;
  await writeEvent({ documentId: document.id, action: "document_created", metadata: { source: "commune_code_review_ui" } });
  await createDocumentVersion(document.id, validation.text, "Initial manual snapshot");
  return { ok: true, message: "Code review document saved as a private draft. It was not executed.", document };
}

export async function updateCodeDocument(documentId: string, input: { title: string; language: string; fileName?: string; text: string; summary?: string }): Promise<{ ok: boolean; message: string; document?: CodeDocument }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Collaborative code review backend is not active yet." };
  const validation = validateCodeDocumentInput(input);
  if (!validation.ok) return { ok: false, message: validation.message ?? "Code review document blocked." };
  const { data, error } = await supabase.from("commune_code_documents").update({ title: validation.title, language: validation.language, file_name: validation.fileName || null, current_text: validation.text, summary: input.summary?.trim() || null, updated_at: new Date().toISOString() }).eq("id", documentId).select("*").single();
  if (error) return { ok: false, message: formatSafeCodeReviewError(error) };
  await writeEvent({ documentId, action: "document_updated", metadata: { diff: buildPatchOrDiffPreview("", validation.text) } });
  return { ok: true, message: "Code review document saved. The website did not execute it.", document: data as CodeDocument };
}

export async function submitCodeDocumentForReview(documentId: string): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Collaborative code review backend is not active yet." };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in before submitting code review documents." };
  const { data, error } = await supabase.from("commune_code_documents").update({ visibility_state: "submitted", review_status: "open_for_review", updated_at: new Date().toISOString() }).eq("id", documentId).select("id,title,summary").single();
  if (error) return { ok: false, message: formatSafeCodeReviewError(error) };
  await writeEvent({ documentId, action: "document_submitted", metadata: { source: "commune_code_review_ui" } });
  await createReviewItem({ domain: "commune", sourceTable: "commune_code_documents", sourceId: documentId, submittedBy: account.userId, title: (data as { title?: string }).title ?? "Code review document", summary: (data as { summary?: string | null }).summary ?? "Code review document submitted for moderation. No code execution." });
  return { ok: true, message: "Code review document submitted for moderation. It is not public until approved." };
}

export async function publishCodeDocument(documentId: string, reason = "Published by Commune moderator.") { return updateDocumentVisibility(documentId, "published", "document_published", reason); }
export async function archiveCodeDocument(documentId: string, reason = "Archived by owner or moderator.") { return updateDocumentVisibility(documentId, "archived", "document_archived", reason); }
export async function hideCodeDocument(documentId: string, reason: string) { return updateDocumentVisibility(documentId, "hidden", "document_hidden", reason); }
export async function removeCodeDocument(documentId: string, reason: string) { return updateDocumentVisibility(documentId, "removed", "document_removed", reason); }

async function updateDocumentVisibility(documentId: string, visibility: CodeDocumentVisibility, action: string, reason: string): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Collaborative code review backend is not active yet." };
  const timestampColumn = visibility === "published" ? "published_at" : visibility === "archived" ? "archived_at" : visibility === "hidden" ? "hidden_at" : visibility === "removed" ? "removed_at" : "updated_at";
  const update: Record<string, unknown> = { visibility_state: visibility, updated_at: new Date().toISOString(), moderation_reason: reason || null };
  update[timestampColumn] = new Date().toISOString();
  if (visibility === "published") update.review_status = "resolved";
  if (visibility === "archived") update.review_status = "archived";
  const { error } = await supabase.from("commune_code_documents").update(update).eq("id", documentId);
  if (error) return { ok: false, message: formatSafeCodeReviewError(error) };
  await writeEvent({ documentId, action, reason, metadata: { visibility_state: visibility } });
  return { ok: true, message: `Code review document marked ${visibility}.` };
}

export async function listDocumentVersions(documentId: string): Promise<{ versions: CodeDocumentVersion[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { versions: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("commune_code_document_versions").select("*").eq("document_id", documentId).order("version_number", { ascending: false });
  return { versions: (data ?? []) as CodeDocumentVersion[], warnings: error ? [formatSafeCodeReviewError(error)] : [] };
}

export async function createDocumentVersion(documentId: string, snapshotText: string, changeSummary: string): Promise<{ ok: boolean; message: string; version?: CodeDocumentVersion }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Version storage is not active yet." };
  const account = await accountState();
  const { data: existing } = await supabase.from("commune_code_document_versions").select("version_number").eq("document_id", documentId).order("version_number", { ascending: false }).limit(1);
  const next = ((existing?.[0] as { version_number?: number } | undefined)?.version_number ?? 0) + 1;
  const { data, error } = await supabase.from("commune_code_document_versions").insert({ document_id: documentId, created_by: account.userId, snapshot_text: snapshotText, change_summary: changeSummary.trim() || null, version_number: next }).select("*").single();
  if (error) return { ok: false, message: formatSafeCodeReviewError(error) };
  await writeEvent({ documentId, action: "version_created", metadata: { version_number: next } });
  return { ok: true, message: `Manual snapshot v${next} saved.`, version: data as CodeDocumentVersion };
}

export async function listAnnotations(documentId: string): Promise<{ annotations: CodeAnnotation[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { annotations: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("commune_code_annotations").select("*").eq("document_id", documentId).order("line_start").order("created_at");
  return { annotations: (data ?? []) as CodeAnnotation[], warnings: error ? [formatSafeCodeReviewError(error)] : [] };
}

export async function createAnnotation(documentId: string, lineStart: number, lineEnd: number, comment: string): Promise<{ ok: boolean; message: string; annotation?: CodeAnnotation }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Annotation backend is not active yet." };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to annotate code review documents." };
  const validation = validateAnnotationInput({ lineStart, lineEnd, comment });
  if (!validation.ok) return { ok: false, message: validation.message ?? "Annotation blocked." };
  const { data, error } = await supabase.from("commune_code_annotations").insert({ document_id: documentId, author_user_id: account.userId, line_start: validation.lineStart, line_end: validation.lineEnd, comment: validation.comment, visibility_state: "published", annotation_status: "open" }).select("*").single();
  if (error) return { ok: false, message: formatSafeCodeReviewError(error) };
  await writeEvent({ documentId, annotationId: (data as CodeAnnotation).id, action: "annotation_created", metadata: { line_start: validation.lineStart, line_end: validation.lineEnd } });
  return { ok: true, message: "Annotation saved for code review discussion.", annotation: data as CodeAnnotation };
}

export async function resolveAnnotation(annotationId: string) { return updateAnnotation(annotationId, { annotation_status: "resolved" }, "annotation_resolved", "Annotation resolved."); }
export async function hideAnnotation(annotationId: string, reason: string) { return updateAnnotation(annotationId, { visibility_state: "hidden", hidden_at: new Date().toISOString(), moderation_reason: reason }, "annotation_reported", reason); }
export async function removeAnnotation(annotationId: string, reason: string) { return updateAnnotation(annotationId, { visibility_state: "removed", removed_at: new Date().toISOString(), moderation_reason: reason }, "annotation_reported", reason); }

async function updateAnnotation(annotationId: string, update: Record<string, unknown>, action: string, reason: string) {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Annotation backend is not active yet." };
  const { data: existing } = await supabase.from("commune_code_annotations").select("document_id").eq("id", annotationId).maybeSingle();
  const { error } = await supabase.from("commune_code_annotations").update({ ...update, updated_at: new Date().toISOString() }).eq("id", annotationId);
  if (error) return { ok: false, message: formatSafeCodeReviewError(error) };
  await writeEvent({ documentId: (existing as { document_id?: string } | null)?.document_id ?? null, annotationId, action, reason });
  return { ok: true, message: "Annotation updated." };
}

export async function getCodeSession(documentId: string): Promise<{ session: CodeSession | null; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { session: null, warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("commune_code_sessions").select("*").eq("document_id", documentId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { session: (data as CodeSession | null) ?? null, warnings: error ? [formatSafeCodeReviewError(error)] : [] };
}

export async function acquireEditLock(documentId: string): Promise<{ ok: boolean; message: string; session?: CodeSession }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Edit-lock backend is not active yet." };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to acquire an edit lock." };
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { data: existing } = await supabase.from("commune_code_sessions").select("*").eq("document_id", documentId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const current = existing as CodeSession | null;
  if (current?.active_editor_user_id && current.active_editor_user_id !== account.userId && current.edit_lock_expires_at && new Date(current.edit_lock_expires_at).getTime() > Date.now()) return { ok: false, message: "Another reviewer currently holds the edit lock. Try again after it expires." };
  const payload = { document_id: documentId, status: "locked", active_editor_user_id: account.userId, edit_lock_expires_at: expires, updated_at: new Date().toISOString() };
  const result = current ? await supabase.from("commune_code_sessions").update(payload).eq("id", current.id).select("*").single() : await supabase.from("commune_code_sessions").insert(payload).select("*").single();
  if (result.error) return { ok: false, message: formatSafeCodeReviewError(result.error) };
  await writeEvent({ documentId, action: "edit_lock_acquired", metadata: { expires } });
  return { ok: true, message: "Edit lock acquired. This is a simple lock foundation, not full CRDT multiplayer.", session: result.data as CodeSession };
}

export async function releaseEditLock(documentId: string): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Edit-lock backend is not active yet." };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to release an edit lock." };
  const { error } = await supabase.from("commune_code_sessions").update({ status: "open", active_editor_user_id: null, edit_lock_expires_at: null, updated_at: new Date().toISOString() }).eq("document_id", documentId).eq("active_editor_user_id", account.userId);
  if (error) return { ok: false, message: formatSafeCodeReviewError(error) };
  await writeEvent({ documentId, action: "edit_lock_released" });
  return { ok: true, message: "Edit lock released." };
}

export async function reportCodeDocument(documentId: string, reason: string, detail: string) { return createCodeReport({ document_id: documentId, reason, detail, action: "document_reported" }); }
export async function reportCodeAnnotation(annotationId: string, reason: string, detail: string) { return createCodeReport({ annotation_id: annotationId, reason, detail, action: "annotation_reported" }); }

async function createCodeReport(input: { document_id?: string; annotation_id?: string; reason: string; detail: string; action: string }): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Code report backend is not active yet." };
  const account = await accountState();
  if (!account.userId) return { ok: false, message: "Sign in to report code review content." };
  const { error } = await supabase.from("commune_code_reports").insert({ document_id: input.document_id ?? null, annotation_id: input.annotation_id ?? null, reporter_user_id: account.userId, reason: input.reason, detail: input.detail.trim() || null, report_status: "open" });
  if (error) return { ok: false, message: formatSafeCodeReviewError(error) };
  await writeEvent({ documentId: input.document_id ?? null, annotationId: input.annotation_id ?? null, action: input.action, reason: input.reason });
  return { ok: true, message: "Code review report sent privately to moderators." };
}

export async function listCodeReports(): Promise<{ reports: CodeReport[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { reports: [], warnings: [supabaseNotConfiguredMessage] };
  const warnings: string[] = [];
  const { data, error } = await supabase.from("commune_code_reports").select("id,document_id,annotation_id,reporter_user_id,reason,detail,report_status,created_at,reviewed_at,reviewed_by,reviewer_note").in("report_status", ["open", "under_review"]).order("created_at", { ascending: false }).limit(80);
  if (error) return { reports: [], warnings: [formatSafeCodeReviewError(error)] };
  const rows = (data ?? []) as CodeReport[];
  const documentIds = rows.map((row) => row.document_id).filter(Boolean) as string[];
  const annotationIds = rows.map((row) => row.annotation_id).filter(Boolean) as string[];
  let documents: CodeDocument[] = [];
  let annotations: CodeAnnotation[] = [];
  if (documentIds.length) {
    const result = await supabase.from("commune_code_documents").select("*").in("id", documentIds);
    if (result.error) warnings.push(formatSafeCodeReviewError(result.error)); else documents = (result.data ?? []) as CodeDocument[];
  }
  if (annotationIds.length) {
    const result = await supabase.from("commune_code_annotations").select("*").in("id", annotationIds);
    if (result.error) warnings.push(formatSafeCodeReviewError(result.error)); else annotations = (result.data ?? []) as CodeAnnotation[];
  }
  return { warnings, reports: rows.map((row) => ({ ...row, document: documents.find((document) => document.id === row.document_id) ?? null, annotation: annotations.find((annotation) => annotation.id === row.annotation_id) ?? null })) };
}

export async function updateCodeReportStatus(reportId: string, status: "under_review" | "action_taken" | "dismissed" | "archived", note: string): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Code report backend is not active yet." };
  const account = await accountState();
  if (!account.userId || !account.isModerator) return { ok: false, message: "Code review moderation requires an assigned moderator/admin role." };
  const { error } = await supabase.from("commune_code_reports").update({ report_status: status, reviewer_note: note.trim() || null, reviewed_by: account.userId, reviewed_at: new Date().toISOString() }).eq("id", reportId);
  if (error) return { ok: false, message: formatSafeCodeReviewError(error) };
  await writeEvent({ action: "report_reviewed", reason: note, metadata: { report_id: reportId, status } });
  return { ok: true, message: `Code review report marked ${status.replace(/_/g, " ")}.` };
}
