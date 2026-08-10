export type ParentPublicationState = "published" | "circle" | "attached";

export type PublishedSnapshot = {
  snippetId: string;
  postId: string;
  publishedVersion: number;
  acceptedRevisionId: string | null;
  codeText: string;
  language: string;
  fileName: string;
  acceptedRevisionSummary: string | null;
  parentPublicationState: ParentPublicationState;
  updatedAt: string | null;
};

export type ProposalDraft = {
  sourceSnippetId: string;
  sourcePublishedVersion: number;
  sourceAcceptedRevisionId: string | null;
  sourceUpdatedAt: string | null;
  codeText: string;
  language: string;
  fileName: string;
  changeSummary: string;
  explanation: string;
};

export type PublishedSnapshotSource = {
  id: string;
  post_id: string;
  accepted_version_number?: number | null;
  accepted_revision_id?: string | null;
  code_text: string;
  language?: string | null;
  file_name?: string | null;
  accepted_revision_summary?: string | null;
  updated_at?: string | null;
};

export type ProposalArtifactChanges = {
  codeChanged: boolean;
  languageChanged: boolean;
  fileNameChanged: boolean;
  changed: boolean;
};

export type ProposalSubmissionReadiness = ProposalArtifactChanges & {
  validLanguage: boolean;
  validFileName: boolean;
  validChangeSummary: boolean;
  canSubmit: boolean;
};

export type ProposalDraftReconciliation = {
  action: "unchanged" | "initialized" | "refreshed_clean" | "preserved_dirty";
  baseline: PublishedSnapshot;
  draft: ProposalDraft;
  newerSnapshotAvailable: boolean;
};

export type WorkbenchSandboxInput = {
  snapshotId: string;
  sourceType: "commune_post_snippet" | "manual_snapshot";
  sourceId: string | null;
  postId: string;
  language: string;
  fileName: string;
  code: string;
};

export function createPublishedSnapshot(
  source: PublishedSnapshotSource,
  parentPublicationState: ParentPublicationState,
): PublishedSnapshot {
  return {
    snippetId: source.id,
    postId: source.post_id,
    publishedVersion: source.accepted_version_number ?? 1,
    acceptedRevisionId: source.accepted_revision_id ?? null,
    codeText: source.code_text,
    language: source.language ?? "text",
    fileName: source.file_name ?? "snippet.txt",
    acceptedRevisionSummary: source.accepted_revision_summary ?? null,
    parentPublicationState,
    updatedAt: source.updated_at ?? null,
  };
}

export function publishedSnapshotToDraft(snapshot: PublishedSnapshot): ProposalDraft {
  return {
    sourceSnippetId: snapshot.snippetId,
    sourcePublishedVersion: snapshot.publishedVersion,
    sourceAcceptedRevisionId: snapshot.acceptedRevisionId,
    sourceUpdatedAt: snapshot.updatedAt,
    codeText: snapshot.codeText,
    language: snapshot.language,
    fileName: snapshot.fileName,
    changeSummary: "",
    explanation: "",
  };
}

export function stableSnapshotSuffix(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function publishedSnapshotSandboxInput(snapshot: PublishedSnapshot): WorkbenchSandboxInput {
  return {
    snapshotId: snapshot.acceptedRevisionId ?? snapshot.snippetId,
    sourceType: "commune_post_snippet",
    sourceId: snapshot.snippetId,
    postId: snapshot.postId,
    language: snapshot.language,
    fileName: snapshot.fileName,
    code: snapshot.codeText,
  };
}

export function proposalDraftSandboxInput(snapshot: PublishedSnapshot, draft: ProposalDraft): WorkbenchSandboxInput {
  return {
    snapshotId: `proposal-draft-${snapshot.snippetId}-${stableSnapshotSuffix([draft.language, draft.fileName, draft.codeText].join("\n---coding-cornucopia-draft---\n"))}`,
    sourceType: "manual_snapshot",
    sourceId: null,
    postId: snapshot.postId,
    language: draft.language,
    fileName: draft.fileName,
    code: draft.codeText,
  };
}

export function snapshotVisibilityWord(snapshot: Pick<PublishedSnapshot, "parentPublicationState">) {
  return snapshot.parentPublicationState === "published" ? "published" : snapshot.parentPublicationState === "circle" ? "private Circle" : "attached";
}

export function currentSnapshotHeading(snapshot: Pick<PublishedSnapshot, "parentPublicationState" | "publishedVersion">) {
  return `Current ${snapshotVisibilityWord(snapshot)} snapshot v${snapshot.publishedVersion}`;
}

export function currentSnapshotRunLabel(snapshot: Pick<PublishedSnapshot, "parentPublicationState">) {
  return `Run current ${snapshotVisibilityWord(snapshot)} snapshot in sandbox`;
}

export function resetDraftLabel(snapshot: Pick<PublishedSnapshot, "parentPublicationState">) {
  return `Reset draft to ${snapshotVisibilityWord(snapshot)} snapshot`;
}

export function resetDraftConfirmation(snapshot: Pick<PublishedSnapshot, "parentPublicationState">) {
  return `Draft reset to the current ${snapshotVisibilityWord(snapshot)} snapshot. Proposal summary and explanation were cleared.`;
}

export function proposalArtifactChanges(
  baseline: Pick<PublishedSnapshot, "codeText" | "language" | "fileName">,
  draft: Pick<ProposalDraft, "codeText" | "language" | "fileName">,
  normalizeLanguage: (language: string) => string = (language) => language.trim().toLowerCase(),
): ProposalArtifactChanges {
  const codeChanged = draft.codeText !== baseline.codeText;
  const languageChanged = normalizeLanguage(draft.language) !== normalizeLanguage(baseline.language);
  const fileNameChanged = draft.fileName.trim() !== baseline.fileName.trim();
  return {
    codeChanged,
    languageChanged,
    fileNameChanged,
    changed: codeChanged || languageChanged || fileNameChanged,
  };
}

export function isProposalDraftDirty(
  baseline: PublishedSnapshot,
  draft: ProposalDraft,
): boolean {
  return draft.sourceSnippetId !== baseline.snippetId
    || draft.sourcePublishedVersion !== baseline.publishedVersion
    || draft.sourceAcceptedRevisionId !== baseline.acceptedRevisionId
    || draft.sourceUpdatedAt !== baseline.updatedAt
    || draft.codeText !== baseline.codeText
    || draft.language !== baseline.language
    || draft.fileName !== baseline.fileName
    || draft.changeSummary !== ""
    || draft.explanation !== "";
}

export function proposalSubmissionReadiness(input: {
  baseline: PublishedSnapshot;
  draft: ProposalDraft;
  supportedLanguages: readonly string[];
  normalizeLanguage?: (language: string) => string;
  sanitizeFileName: (fileName: string) => string;
  pending: boolean;
}): ProposalSubmissionReadiness {
  const normalizeLanguage = input.normalizeLanguage ?? ((language: string) => language.trim().toLowerCase());
  const changes = proposalArtifactChanges(input.baseline, input.draft, normalizeLanguage);
  const language = normalizeLanguage(input.draft.language);
  const supportedLanguages = input.supportedLanguages.map(normalizeLanguage);
  const trimmedFileName = input.draft.fileName.trim();
  const summary = input.draft.changeSummary.trim();
  const validLanguage = supportedLanguages.includes(language);
  const validFileName = Boolean(trimmedFileName) && input.sanitizeFileName(input.draft.fileName) === trimmedFileName;
  const validChangeSummary = summary.length >= 1 && summary.length <= 500;
  return {
    ...changes,
    validLanguage,
    validFileName,
    validChangeSummary,
    canSubmit: changes.changed && validLanguage && validFileName && validChangeSummary && !input.pending,
  };
}

export function isSamePublishedSnapshotVersion(first: PublishedSnapshot, second: PublishedSnapshot): boolean {
  return first.snippetId === second.snippetId
    && first.publishedVersion === second.publishedVersion
    && first.acceptedRevisionId === second.acceptedRevisionId
    && first.updatedAt === second.updatedAt
    && first.codeText === second.codeText
    && first.language === second.language
    && first.fileName === second.fileName;
}

export function reconcileProposalDraft(input: {
  baseline: PublishedSnapshot | null;
  draft: ProposalDraft | null;
  latestSnapshot: PublishedSnapshot;
}): ProposalDraftReconciliation {
  const { baseline, draft, latestSnapshot } = input;
  if (!baseline || !draft || baseline.snippetId !== latestSnapshot.snippetId || draft.sourceSnippetId !== latestSnapshot.snippetId) {
    return {
      action: "initialized",
      baseline: latestSnapshot,
      draft: publishedSnapshotToDraft(latestSnapshot),
      newerSnapshotAvailable: false,
    };
  }
  if (isSamePublishedSnapshotVersion(baseline, latestSnapshot)) {
    return {
      action: "unchanged",
      baseline: baseline.parentPublicationState === latestSnapshot.parentPublicationState
        ? baseline
        : { ...baseline, parentPublicationState: latestSnapshot.parentPublicationState },
      draft,
      newerSnapshotAvailable: false,
    };
  }
  if (isProposalDraftDirty(baseline, draft)) {
    return {
      action: "preserved_dirty",
      baseline,
      draft,
      newerSnapshotAvailable: true,
    };
  }
  return {
    action: "refreshed_clean",
    baseline: latestSnapshot,
    draft: publishedSnapshotToDraft(latestSnapshot),
    newerSnapshotAvailable: false,
  };
}

export function newerSnapshotDraftWarning(snapshot: Pick<PublishedSnapshot, "parentPublicationState">) {
  return `A newer ${snapshotVisibilityWord(snapshot)} snapshot is available. Your current draft has been preserved.`;
}

export function resetDraftToLatestLabel(snapshot: Pick<PublishedSnapshot, "parentPublicationState">) {
  return `Reset draft to latest ${snapshotVisibilityWord(snapshot)} snapshot`;
}
