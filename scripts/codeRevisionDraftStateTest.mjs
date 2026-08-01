import assert from "node:assert/strict";
import {
  createPublishedSnapshot,
  currentSnapshotHeading,
  currentSnapshotRunLabel,
  isProposalDraftDirty,
  isSamePublishedSnapshotVersion,
  newerSnapshotDraftWarning,
  proposalArtifactChanges,
  proposalDraftSandboxInput,
  proposalSubmissionReadiness,
  publishedSnapshotSandboxInput,
  reconcileProposalDraft,
  publishedSnapshotToDraft,
  resetDraftConfirmation,
  resetDraftLabel,
  resetDraftToLatestLabel,
} from "../src/pages/The-Elysia-Commune/codeRevisionDraftState.ts";

const publishedSnapshot = Object.freeze(createPublishedSnapshot({
  id: "10000000-0000-4000-8000-000000000001",
  post_id: "20000000-0000-4000-8000-000000000001",
  accepted_version_number: 3,
  accepted_revision_id: "30000000-0000-4000-8000-000000000001",
  code_text: "console.log('published');\n",
  language: "javascript",
  file_name: "published.js",
  accepted_revision_summary: "Current published revision note",
  updated_at: "2026-08-01T10:00:00.000Z",
}, "published"));

const draft = publishedSnapshotToDraft(publishedSnapshot);

assert.notStrictEqual(draft, publishedSnapshot, "snapshot-to-draft conversion must create an independent object");
assert.equal(draft.sourceSnippetId, publishedSnapshot.snippetId);
assert.equal(draft.sourcePublishedVersion, publishedSnapshot.publishedVersion);
assert.equal(draft.sourceAcceptedRevisionId, publishedSnapshot.acceptedRevisionId);
assert.equal(draft.sourceUpdatedAt, publishedSnapshot.updatedAt);
assert.equal(draft.codeText, publishedSnapshot.codeText);
assert.equal(draft.language, publishedSnapshot.language);
assert.equal(draft.fileName, publishedSnapshot.fileName);
assert.equal(draft.changeSummary, "", "a new proposal must not inherit an accepted revision summary");
assert.equal(draft.explanation, "", "a new proposal must not inherit a private proposal explanation");

draft.codeText = "console.log('draft');\n";
draft.language = "typescript";
draft.fileName = "draft.ts";
draft.changeSummary = "Draft-only summary";
draft.explanation = "Draft-only explanation";

assert.equal(publishedSnapshot.codeText, "console.log('published');\n");
assert.equal(publishedSnapshot.language, "javascript");
assert.equal(publishedSnapshot.fileName, "published.js");
assert.equal(publishedSnapshot.acceptedRevisionSummary, "Current published revision note");
assert.equal(currentSnapshotHeading(publishedSnapshot), "Current published snapshot v3");
assert.equal(currentSnapshotRunLabel(publishedSnapshot), "Run current published snapshot in sandbox");
assert.equal(resetDraftLabel(publishedSnapshot), "Reset draft to published snapshot");
assert.equal(resetDraftConfirmation(publishedSnapshot), "Draft reset to the current published snapshot. Proposal summary and explanation were cleared.");

const attachedSnapshot = { ...publishedSnapshot, parentPublicationState: "attached" };
assert.equal(currentSnapshotHeading(attachedSnapshot), "Current attached snapshot v3");
assert.equal(currentSnapshotRunLabel(attachedSnapshot), "Run current attached snapshot in sandbox");
assert.equal(resetDraftLabel(attachedSnapshot), "Reset draft to attached snapshot");
assert.equal(resetDraftConfirmation(attachedSnapshot), "Draft reset to the current attached snapshot. Proposal summary and explanation were cleared.");

const publishedRunInput = publishedSnapshotSandboxInput(publishedSnapshot);
assert.deepEqual(publishedRunInput, {
  snapshotId: publishedSnapshot.acceptedRevisionId,
  sourceType: "commune_post_snippet",
  sourceId: publishedSnapshot.snippetId,
  postId: publishedSnapshot.postId,
  language: "javascript",
  fileName: "published.js",
  code: "console.log('published');\n",
}, "the left sandbox action must receive only current published snapshot artifact values");

const proposalRunInput = proposalDraftSandboxInput(publishedSnapshot, draft);
assert.equal(proposalRunInput.sourceType, "manual_snapshot");
assert.equal(proposalRunInput.sourceId, null);
assert.equal(proposalRunInput.postId, publishedSnapshot.postId);
assert.equal(proposalRunInput.language, draft.language);
assert.equal(proposalRunInput.fileName, draft.fileName);
assert.equal(proposalRunInput.code, draft.codeText);
assert.match(proposalRunInput.snapshotId, new RegExp(`^proposal-draft-${publishedSnapshot.snippetId}-[a-z0-9]+$`));
assert.equal("changeSummary" in proposalRunInput, false, "proposal-only summary must never become sandbox input");
assert.equal("explanation" in proposalRunInput, false, "private proposal explanation must never become sandbox input");
assert.equal(publishedRunInput.code, publishedSnapshot.codeText, "building draft sandbox input must not mutate the left input");
assert.equal(draft.codeText, "console.log('draft');\n", "building sandbox inputs must not mutate the draft");

const sanitizeFileName = (value) => value.trim().replace(/\\/g, "/").split("/").pop().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
const supportedLanguages = ["text", "javascript", "typescript", "python"];
const normalizeLanguage = (value) => value.trim().toLowerCase();
const readiness = (candidate, pending = false) => proposalSubmissionReadiness({
  baseline: publishedSnapshot,
  draft: candidate,
  supportedLanguages,
  normalizeLanguage,
  sanitizeFileName,
  pending,
});

const cleanDraft = publishedSnapshotToDraft(publishedSnapshot);
assert.equal(isProposalDraftDirty(publishedSnapshot, cleanDraft), false, "canonical reset must produce a clean draft");
assert.deepEqual(proposalArtifactChanges(publishedSnapshot, cleanDraft, normalizeLanguage), {
  codeChanged: false,
  languageChanged: false,
  fileNameChanged: false,
  changed: false,
});

for (const [field, value] of [
  ["codeText", "console.log('code-only');\n"],
  ["language", "typescript"],
  ["fileName", "published.ts"],
  ["changeSummary", "Summary-only draft"],
  ["explanation", "Explanation-only draft"],
]) {
  const candidate = { ...cleanDraft, [field]: value };
  assert.equal(isProposalDraftDirty(publishedSnapshot, candidate), true, `${field} must participate in draft-dirty protection`);
  assert.equal(publishedSnapshot.codeText, "console.log('published');\n", `${field} editing must not change left-side code`);
  assert.equal(publishedSnapshot.language, "javascript", `${field} editing must not change left-side language`);
  assert.equal(publishedSnapshot.fileName, "published.js", `${field} editing must not change left-side filename`);
}

for (const [field, value] of [
  ["codeText", "console.log('code-only');\n"],
  ["language", "typescript"],
  ["fileName", "published.ts"],
]) {
  const candidate = { ...cleanDraft, [field]: value, changeSummary: `${field} changed` };
  assert.equal(readiness(candidate).changed, true, `${field}-only artifact edits must count as meaningful revisions`);
  assert.equal(readiness(candidate).canSubmit, true, `${field}-only artifact edits with a valid summary must be submittable`);
}

assert.equal(readiness({ ...cleanDraft, changeSummary: "Summary only" }).changed, false, "summary-only edits must not count as a code revision");
assert.equal(readiness({ ...cleanDraft, changeSummary: "Summary only" }).canSubmit, false, "summary-only edits must not submit");
assert.equal(readiness({ ...cleanDraft, explanation: "Explanation only" }).changed, false, "explanation-only edits must not count as a code revision");
assert.equal(readiness({ ...cleanDraft, explanation: "Explanation only" }).canSubmit, false, "explanation-only edits must not submit");
assert.equal(readiness({ ...cleanDraft, codeText: "changed" }).canSubmit, false, "a meaningful revision still requires a summary");
assert.equal(readiness({ ...cleanDraft, codeText: "changed", changeSummary: "Ready", language: "unsupported" }).canSubmit, false, "unsupported languages must not submit");
assert.equal(readiness({ ...cleanDraft, codeText: "changed", changeSummary: "Ready", fileName: "../private.js" }).canSubmit, false, "unsafe filenames must not submit");
assert.equal(readiness({ ...cleanDraft, codeText: "changed", changeSummary: "Ready" }, true).canSubmit, false, "pending submissions must not submit twice");

const unchangedReconciliation = reconcileProposalDraft({ baseline: publishedSnapshot, draft: cleanDraft, latestSnapshot: publishedSnapshot });
assert.equal(unchangedReconciliation.action, "unchanged");
assert.strictEqual(unchangedReconciliation.draft, cleanDraft, "same snippet/version must preserve the exact draft object");
assert.equal(unchangedReconciliation.newerSnapshotAvailable, false);

const newerSnapshot = Object.freeze({
  ...publishedSnapshot,
  publishedVersion: 4,
  acceptedRevisionId: "30000000-0000-4000-8000-000000000004",
  codeText: "console.log('published-v4');\n",
  language: "typescript",
  fileName: "published-v4.ts",
  updatedAt: "2026-08-01T11:00:00.000Z",
});
assert.equal(isSamePublishedSnapshotVersion(publishedSnapshot, newerSnapshot), false);

const cleanRefresh = reconcileProposalDraft({ baseline: publishedSnapshot, draft: cleanDraft, latestSnapshot: newerSnapshot });
assert.equal(cleanRefresh.action, "refreshed_clean");
assert.equal(cleanRefresh.draft.sourcePublishedVersion, 4);
assert.equal(cleanRefresh.draft.codeText, newerSnapshot.codeText);
assert.equal(cleanRefresh.draft.language, newerSnapshot.language);
assert.equal(cleanRefresh.draft.fileName, newerSnapshot.fileName);
assert.equal(cleanRefresh.draft.changeSummary, "");
assert.equal(cleanRefresh.draft.explanation, "");

for (const [field, value] of [
  ["codeText", "dirty code"],
  ["language", "python"],
  ["fileName", "dirty.py"],
  ["changeSummary", "Dirty summary"],
  ["explanation", "Dirty explanation"],
]) {
  const dirtyDraft = { ...cleanDraft, [field]: value };
  const preserved = reconcileProposalDraft({ baseline: publishedSnapshot, draft: dirtyDraft, latestSnapshot: newerSnapshot });
  assert.equal(preserved.action, "preserved_dirty", `${field} edits must survive a newer published version`);
  assert.strictEqual(preserved.draft, dirtyDraft, `${field} edits must not be cloned, merged, or overwritten during refresh`);
  assert.strictEqual(preserved.baseline, publishedSnapshot, `${field} edits must retain their submission-time baseline`);
  assert.equal(preserved.newerSnapshotAvailable, true);
}

const explicitLatestReset = publishedSnapshotToDraft(newerSnapshot);
assert.equal(explicitLatestReset.sourcePublishedVersion, 4);
assert.equal(explicitLatestReset.codeText, newerSnapshot.codeText);
assert.equal(explicitLatestReset.changeSummary, "");
assert.equal(explicitLatestReset.explanation, "");
assert.equal(isProposalDraftDirty(newerSnapshot, explicitLatestReset), false);
assert.equal(newerSnapshotDraftWarning(newerSnapshot), "A newer published snapshot is available. Your current draft has been preserved.");
assert.equal(resetDraftToLatestLabel(newerSnapshot), "Reset draft to latest published snapshot");

console.log("Coding Workbench snapshot/draft state tests ok.");
