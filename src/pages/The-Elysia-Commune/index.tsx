import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { yaml } from "@codemirror/lang-yaml";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { Link, useLocation, useParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import {
  clearCommuneReaction,
  castCommunityVoteBallot,
  communeReactionKey,
  createOfficialCodeSnippet,
  createCodeSnippet,
  ensureCommuneThreadForPost,
  followThread,
  loadCategories,
  loadCommuneData,
  loadCommuneModerationQueue,
  loadCommuneReactionSummary,
  loadCodeSnippets,
  loadIterationShowcaseForContext,
  loadRepositoryShowcaseForContext,
  markThreadRead,
  moderateCommuneContentTarget,
  moderateCommuneItem,
  postTypeOptions,
  recordCodingSandboxRunResult,
  reportCommuneContent,
  requestIterationShowcaseSandboxReview,
  reportTypes,
  savePost,
  setCommuneReaction,
  submitCommunityVotePost,
  submitCommunePost,
  submitComment,
  submitIterationShowcase,
  submitJobPost,
  submitOfficialUpdate,
  submitResearchNotesPost,
  submitRepositoryShowcase,
  submitSandboxReview,
  submitTroubleshootingPost,
  updateJobPostApplicationStatus,
  updateJobPostReviewStatus,
  updateOfficialCodeSnippet,
  updateOfficialUpdateMetadata,
  updateCommunityVoteLifecycle,
  updateResearchNotesReviewStatus,
  updateTroubleshootingStatus,
  markTroubleshootingResolved,
  type CommuneComment,
  type CommuneCategory,
  type CommuneCodeSnippet,
  type CommuneMediaAttachment,
  type CommuneModerationItem,
  type CommunePost,
  type CommunePostType,
  type CommuneReaction,
  type CommuneReactionSummary,
  type CommuneReactionTargetType,
  type CommuneRoom,
  type ElysiaIterationShowcaseMetadata,
  type JobPostAntiScamReviewStatus,
  type JobPostApplicationStatus,
  type JobPostMetadata,
  type OfficialUpdateCodeSnippet,
  type OfficialUpdateMetadata,
  type OfficialUpdateSeverity,
  type OfficialUpdateStatus,
  type OfficialUpdateType,
  type RepositoryShowcaseMetadata,
  type ResearchNotesMetadata,
  type ResearchReviewStatus,
  type TroubleshootingMetadata,
  type TroubleshootingResolutionKind,
  type TroubleshootingStatus,
  type CommuneThread,
  type CommunityVoteLifecycleAction,
  type CommunityVoteOption,
  type CommunityVoteStatus,
  type CommunityVoteResultsVisibility,
  type CommunityVoteView
} from "./communeAccountApi";
import { communeFallbackCategories, formatCommuneTag, formatCommuneTags, inertCodeSnippetLabel, parseCommuneTags, scanCommuneTextForSecrets, validateCommuneMediaFile } from "./communeSafety";
import {
  acquireEditLock,
  archiveCodeDocument,
  buildPatchOrDiffPreview,
  codeReviewReportReasons,
  createAnnotation,
  createCodeDocument,
  createDocumentVersion,
  decideCodeRevisionProposal,
  detectSecretLikeCodeText,
  hideAnnotation,
  hideCodeDocument,
  listAnnotations,
  listCodeRevisionProposals,
  listDocumentVersions,
  listMyCodeDocuments,
  listPublishedCodeDocuments,
  loadCodeReviewAccount,
  publishCodeDocument,
  releaseEditLock,
  removeAnnotation,
  removeCodeDocument,
  reportCodeAnnotation,
  reportCodeDocument,
  resolveAnnotation,
  submitCodeRevisionProposal,
  submitCodeDocumentForReview,
  updateCodeDocument,
  withdrawCodeRevisionProposal,
  type CodeAnnotation,
  type CodeDocument,
  type CodeDocumentVersion,
  type CodeRevisionProposal,
  type CodeSession
} from "./communeCodeReviewApi";
import {
  detectSecretLikeChatText,
  hideRealtimeMessage,
  listRecentMessages,
  listRealtimeRooms,
  loadRealtimeAccountState,
  realtimeReportReasons,
  removeRealtimeMessage,
  reportRealtimeMessage,
  sendRealtimeMessage,
  subscribeToRoomMessages,
  validateChatMessageInput,
  type RealtimeConnectionStatus,
  type RealtimeMessage,
  type RealtimeRoom
} from "./communeRealtimeApi";
import {
  buildLocalHandoffBundle,
  createSandboxRequestDraft,
  detectSecretLikeSandboxText,
  exportLocalHandoffBundle,
  listMySandboxRequests,
  sanitizeDeclaredDomains,
  sanitizeDeclaredFileScopes,
  submitSandboxRequest,
  updateSandboxRequestDraft,
  validateSandboxRequestInput,
  type SandboxHandoffExport
} from "./communeSandboxHandoffApi";
import { type SandboxRequestInput, type SandboxRequestRecord } from "../../shared/sandbox/sandboxHandoffTypes";
import { codingLanguageOptions, codingLanguageStatusLabel, getCodingLanguagePolicy, normalizeCodingLanguage } from "./codeLanguagePolicies";
import { runStaticCodingDiagnostics, type CodingDiagnostic, type SandboxRunResult } from "./codeDiagnosticTypes";
import { requestSandboxRun, sandboxEndpointState } from "./codingSandboxClient";

type CommuneStatus =
  | "draft_local"
  | "pending_moderator_review_local"
  | "submitted_for_review"
  | "needs_redaction"
  | "security_hold"
  | "approved"
  | "rejected"
  | "published"
  | "archived"
  | "blocked";

type CommunePostTypeCard = {
  id: string;
  backendValue: CommunePostType;
  name: string;
  purpose: string;
  allowedContent: string;
  cautions: string;
  currentStatus: string[];
  futureFeatures: string;
};

type CommuneFilters = {
  search: string;
  category: string;
  status: string;
  safety: string;
};

type PostDraft = {
  id: string;
  postType: string;
  title: string;
  summary: string;
  body: string;
  tags: string;
  sourceLinks: string;
  licenseNotes: string;
  redactionNotes: string;
  intendedAudience: string;
  submitterName: string;
  submitterContact: string;
  checklist: Record<string, boolean>;
  status: CommuneStatus;
  createdAt: string;
};

type RepoShowcaseDraft = {
  id: string;
  schemaVersion?: string;
  title: string;
  repoUrl: string;
  provider: string;
  branch: string;
  commit: string;
  license: string;
  description: string;
  readmePreview: string;
  fileTreePreview: string;
  screenshotNotes: string;
  manifestStatus: string;
  compatibility: string;
  warnings: string[];
  importSource?: string;
  importedAt?: string | null;
  importedMetadata?: Record<string, unknown>;
  redactionNotes?: string;
  adminGuidancePost?: boolean;
  createdAt: string;
};

type IterationShowcaseDraft = {
  id: string;
  schemaVersion?: string;
  title: string;
  summary: string;
  tags: string;
  links: string;
  iterationType: string;
  versionBuildLabel: string;
  whatChanged: string;
  whyItMatters: string;
  knownLimitations: string;
  nextStep: string;
  body: string;
  relatedRepoUrl: string;
  provider: string;
  branch: string;
  commitSha: string;
  releaseTag: string;
  pullRequestUrl: string;
  developerForgeLink: string;
  marketplaceLink: string;
  testingStatus: string;
  compatibilityNote: string;
  riskFlags: string[];
  importSource?: string;
  importedAt?: string | null;
  importedMetadata?: Record<string, unknown>;
  redactionNotes?: string;
  createdAt: string;
};

type SandboxRequestDraft = {
  id: string;
  title: string;
  relatedUrl: string;
  codePurpose: string;
  expectedCommand: string;
  dependencies: string;
  networkNeeded: string;
  fileAccessNeeded: string;
  estimatedRuntime: string;
  whySandbox: string;
  riskNotes: string;
  createdAt: string;
};

const communeModerationConfig = {
  moderatorAccountEmail: null,
  administratorAccountEmail: null,
  liveSubmissionEnabled: false,
  backendReviewQueueEnabled: false
} as const;

const storageKeys = {
  postDrafts: "commune.postDrafts.v1",
  postRequests: "commune.postRequests.v1",
  repoShowcaseDrafts: "commune.repoShowcaseDrafts.v1",
  iterationShowcaseDrafts: "commune.iterationShowcaseDrafts.v1",
  sandboxRequestDrafts: "commune.sandboxRequestDrafts.v1",
  savedPosts: "commune.savedPosts.v1",
  followedThreads: "commune.followedThreads.v1"
} as const;

const postTypes: CommunePostTypeCard[] = [
  {
    id: "media-garden",
    backendValue: "media_garden",
    name: "Media Garden",
    purpose: "Images, videos, demos, artwork, project updates, and public storytelling around Elysia.",
    allowedContent: "Public images, videos, demos, artwork notes, visual/read-only code snippets, project updates, and storytelling drafts.",
    cautions: "Code snippets may be visual/read-only material only; they are not executed by the website and are not a trust signal. Do not upload secrets, credentials, environment-variable files, private logs, vault material, private documents, faces without consent, sensitive location data, copyrighted media without permission, or private screenshots.",
    currentStatus: ["Local draft available", "Requires moderation", "Backend enhanced"],
    futureFeatures: "Moderated media posts, attribution prompts, file limits, storage policy, and abuse controls."
  },
  {
    id: "troubleshooting-grove",
    backendValue: "troubleshooting",
    name: "Troubleshooting Grove",
    purpose: "Help threads, known issues, install problems, bug reports, and shared learning.",
    allowedContent: "Public bug descriptions, redacted logs, install notes, workaround drafts, and known-issue writeups.",
    cautions: "Redact logs. Do not paste tokens, .env files, local file paths, private machine inventories, or account details.",
    currentStatus: ["Local draft available", "Requires moderation", "Backend enhanced"],
    futureFeatures: "Moderated threads, issue tags, solved labels, and safe troubleshooting templates."
  },
  {
    id: "code-sharing",
    backendValue: "code_sharing",
    name: "Coding Cornucopia",
    purpose: "Shared code, collaborative review, safe snippets, sandboxed runs, diagnostics, and development knowledge for the Elysia ecosystem.",
    allowedContent: "Snippets, examples, add-on ideas, scripts, safe development notes, review requests, collaborative coding sessions, and governed sandbox diagnostics.",
    cautions: "Shared code is public knowledge, not automatic trust. Coding Cornucopia can execute code only through a governed sandbox boundary with strict limits, audit, and review.",
    currentStatus: ["Local draft available", "Requires moderation", "Sandbox-gated execution", "Diagnostics"],
    futureFeatures: "CodeMirror editor, manifest checks, snippet labels, sandbox review requests, structured diagnostics, and safe collaboration sessions."
  },
  {
    id: "repository-showcase",
    backendValue: "repository_showcase",
    name: "Repository Showcase",
    purpose: "Public project pages for GitHub, GitLab, Codeberg, Forgejo, or uploaded archives later.",
    allowedContent: "Repo links, pasted README previews, file tree summaries, screenshots, license notes, and compatibility notes.",
    cautions: "A public repo is not automatically safe, compatible, licensed, or free of secrets.",
    currentStatus: ["Local draft available", "Requires moderation", "Backend enhanced"],
    futureFeatures: "Repo showcase pages, manifest review, compatibility labels, and optional sandbox requests."
  },
  {
    id: "community-network",
    backendValue: "community_network",
    name: "Community Network",
    purpose: "Introductions, collaboration interests, role interests, project circles, and community coordination.",
    allowedContent: "Public introductions, collaboration interests, project circle notes, and role-interest drafts.",
    cautions: "Avoid personal oversharing and private-contact pressure.",
    currentStatus: ["Local draft available", "Requires moderation", "Backend enhanced"],
    futureFeatures: "Profiles, circles, follows, introductions, and safer contact preferences."
  },
  {
    id: "job-post",
    backendValue: "job_post",
    name: "Job Post",
    purpose: "Public EcoSyneva, Elysia, and community opportunity listings, volunteer calls, paid roles, research roles, contributor needs, and project recruitment.",
    allowedContent: "Clear role summaries, role type, paid/volunteer status, compensation clarity, location/remote notes, time commitment, safe contact paths, and project needs.",
    cautions: "Normal-user Job Posts require admin approval before publication. No resumes/CVs, SSNs, bank details, identity documents, private addresses, private phone numbers, or private application data in public comments.",
    currentStatus: ["Local draft available", "Requires moderation", "Backend enhanced"],
    futureFeatures: "Structured anti-scam review, filled/closed listing states, Work With private intake bridge, and search over job metadata."
  },
  {
    id: "research-notes",
    backendValue: "research_note",
    name: "Research Notes",
    purpose: "Public research notes, evidence summaries, source discussions, ecological observations, and Living Library-linked work.",
    allowedContent: "Evidence summaries, source links, citation notes, uncertainties, ecological observations, method/context notes, and interpretation boundaries.",
    cautions: "Cite sources, separate evidence from interpretation, disclose uncertainty, and do not expose sensitive locations, private research participant data, copyrighted full-text papers, private local Elysia data, or hidden notes.",
    currentStatus: ["Local draft available", "Requires moderation", "Structured metadata", "Evidence-aware"],
    futureFeatures: "Living Library source cards, richer source lookup, correction trails, and evidence review labels."
  },
  {
    id: "elysia-iteration-showcase",
    backendValue: "elysia_iteration_showcase",
    name: "Elysia Iteration Showcase",
    purpose: "Demos, screenshots, version notes, UI updates, add-on previews, and design progress.",
    allowedContent: "Public screenshots, design notes, add-on previews, version notes, and demo summaries.",
    cautions: "Do not expose private prompts, local file paths, credentials, logs, or sealed memory.",
    currentStatus: ["Local draft available", "Requires moderation", "Backend enhanced"],
    futureFeatures: "Iteration galleries, changelog links, media review, and public/private boundary checks."
  },
  {
    id: "community-vote",
    backendValue: "community_vote",
    name: "Community Voting Room",
    purpose: "Admin-controlled public guidance votes for website stewardship, priorities, fixes, additions, removals, and direction-of-work questions.",
    allowedContent: "Clear advisory questions, public context, options members can choose from, lifecycle outcomes, and optional manual links to later Official Updates.",
    cautions: "Community votes guide stewardship decisions. They do not automatically govern the site, change policy, create safety/legal obligations, alter Marketplace or Developer Forge behavior, change Elysia behavior, or publish Official Updates.",
    currentStatus: ["Admin-created", "Member ballots", "Aggregate results", "Advisory governance"],
    futureFeatures: "Richer result filters, scheduled votes, and deeper Signal Console review lanes."
  },
  {
    id: "official-update",
    backendValue: "official_update",
    name: "Official Update",
    purpose: "Official Elysia Ecobotics / EcoSyneva Commons announcements, releases, roadmap notes, governance updates, security notices, maintenance notices, and policy updates.",
    allowedContent: "Administrator-authored release notes, roadmap notes, governance updates, security notices, maintenance/incident updates, Developer Forge/Marketplace notices, official community notices, and read-only official code examples.",
    cautions: "Admin-only enforced. Community users cannot submit, request publication, self-assign authority, impersonate official notices, or edit official code. Official Update remains separate from Community Voting Room outcomes.",
    currentStatus: ["Admin-only enforced", "Structured metadata", "Official code read-only", "Audit-aware"],
    futureFeatures: "Corrections, retractions, archive state, comment locks, official Signal Console activity, and public brand-authoritative records."
  }
];

const roomSlugByPostType: Record<CommunePostType, string> = {
  media_garden: "media-garden",
  troubleshooting: "troubleshooting-grove",
  code_sharing: "coding-cornucopia",
  repository_showcase: "repository-showcase",
  community_network: "community-network",
  job_post: "job-post",
  research_note: "research-notes",
  elysia_iteration_showcase: "elysia-iteration-showcase",
  community_vote: "community-vote",
  official_update: "official-updates"
};

const legacyRoomSlugAliases: Record<string, string> = {
  "code-sharing": "coding-cornucopia"
};

function normalizeCommuneRoomSlug(slugValue?: string | null) {
  if (!slugValue) return slugValue ?? undefined;
  return legacyRoomSlugAliases[slugValue] ?? slugValue;
}

function roomSlugCandidates(slugValue?: string | null) {
  const normalized = normalizeCommuneRoomSlug(slugValue);
  if (!normalized) return [];
  return normalized === "coding-cornucopia" ? ["coding-cornucopia", "code-sharing"] : [normalized];
}

const postTypeByRoomSlug = new Map([
  ...postTypes.map((type) => [roomSlugByPostType[type.backendValue], type] as const),
  ["code-sharing", postTypes.find((type) => type.backendValue === "code_sharing")!]
]);

function roomPathForType(type: CommunePostTypeCard) {
  return `/commune/rooms/${roomSlugByPostType[type.backendValue]}`;
}

function roomNewPathForType(type: CommunePostTypeCard) {
  return `${roomPathForType(type)}/new`;
}

function roomPostsPathForType(type: CommunePostTypeCard) {
  return `${roomPathForType(type)}/posts`;
}

function sectionBlock(title: string, value?: string | null) {
  const text = String(value ?? "").trim();
  return text ? `## ${title}\n${text}` : "";
}

const codeEditorBaseTheme = EditorView.theme({
  "&": {
    backgroundColor: "rgba(2, 8, 14, 0.9)",
    color: "#e7f7f6",
    border: "1px solid rgba(142, 232, 220, 0.26)",
    borderRadius: "14px",
    overflow: "hidden"
  },
  ".cm-gutters": {
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    color: "rgba(232, 248, 247, 0.52)",
    borderRight: "1px solid rgba(142, 232, 220, 0.16)"
  },
  ".cm-content": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: "0.9rem"
  }
});

function codeMirrorLanguageExtensions(language?: string | null): Extension[] {
  switch (normalizeCodingLanguage(language)) {
    case "javascript":
    case "typescript":
      return [javascript({ jsx: true, typescript: normalizeCodingLanguage(language) === "typescript" })];
    case "python":
      return [python()];
    case "json":
      return [json()];
    case "markdown":
      return [markdown()];
    case "html":
      return [html()];
    case "css":
      return [css()];
    case "yaml":
      return [yaml()];
    case "java":
      return [java()];
    case "cpp":
      return [cpp()];
    case "rust":
      return [rust()];
    case "go":
      return [go()];
    default:
      return [];
  }
}

function CodeWorkspaceEditor({ value, language, onChange, readOnly = false, minHeight = "320px" }: { value: string; language?: string | null; onChange?: (value: string) => void; readOnly?: boolean; minHeight?: string }) {
  return <div className="coding-cornucopia-editor">
    <CodeMirror
      value={value}
      height={minHeight}
      theme="dark"
      basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: !readOnly, autocompletion: !readOnly, searchKeymap: true }}
      extensions={[codeEditorBaseTheme, ...codeMirrorLanguageExtensions(language), EditorView.lineWrapping]}
      editable={!readOnly}
      readOnly={readOnly}
      onChange={(next) => onChange?.(next)}
    />
  </div>;
}

function DiagnosticsList({ diagnostics }: { diagnostics: CodingDiagnostic[] }) {
  if (!diagnostics.length) return <p className="boundary-note">No static diagnostics yet. This does not mean the code is trusted or approved.</p>;
  return <div className="coding-diagnostics-list">
    {diagnostics.map((item, index) => <article className={`coding-diagnostic coding-diagnostic--${item.severity}`} key={`${item.category}-${index}`}>
      <strong>{item.severity.toUpperCase()} · {item.category.replace(/_/g, " ")}</strong>
      <p>{item.message}</p>
      <span>{item.source}{item.line ? ` · line ${item.line}${item.column ? `:${item.column}` : ""}` : ""}</span>
    </article>)}
  </div>;
}

type SandboxRunUiState = "idle" | "preparing_snapshot" | SandboxRunResult["status"];

function stableSnapshotSuffix(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function proposalDraftSnapshotId(snippetId: string, input: { codeText: string; language: string; fileName: string }) {
  return `proposal-draft-${snippetId}-${stableSnapshotSuffix([input.language, input.fileName, input.codeText].join("\n---coding-cornucopia-draft---\n"))}`;
}

function CodingSandboxRunPanel({ snapshotId, sourceType, sourceId, postId, codeDocumentId, codeVersionId, language, fileName, code, signedIn = true, runLabel = "Run snapshot in sandbox" }: {
  snapshotId: string;
  sourceType: "commune_post_snippet" | "commune_code_document" | "commune_code_version" | "repository_showcase_artifact" | "iteration_showcase_artifact";
  sourceId?: string | null;
  postId?: string | null;
  codeDocumentId?: string | null;
  codeVersionId?: string | null;
  language: string;
  fileName?: string | null;
  code: string;
  signedIn?: boolean;
  runLabel?: string;
}) {
  const normalizedLanguage = normalizeCodingLanguage(language);
  const policy = getCodingLanguagePolicy(normalizedLanguage);
  const endpoint = sandboxEndpointState();
  const staticDiagnostics = useMemo(() => runStaticCodingDiagnostics({ language: normalizedLanguage, fileName, code }), [normalizedLanguage, fileName, code]);
  const [result, setResult] = useState<SandboxRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runState, setRunState] = useState<SandboxRunUiState>("idle");
  const [recordMessage, setRecordMessage] = useState("");
  useEffect(() => {
    setResult(null);
    setRunState("idle");
    setRecordMessage("");
  }, [snapshotId, sourceType, sourceId, normalizedLanguage, fileName, code]);
  const hasSnapshot = Boolean(snapshotId.trim());
  const hasCode = Boolean(code.trim());
  const policyEligible = policy.status === "active_sandbox" || policy.status === "static_diagnostics";
  const disabledReason = !signedIn
    ? "Sign in to request and record governed sandbox diagnostics."
    : !endpoint.configured
      ? "Sandbox endpoint not configured. Set VITE_CODING_SANDBOX_ENDPOINT to the isolated runner service before requesting a run."
      : !hasSnapshot
        ? "Create or choose an explicit snapshot before running."
        : !hasCode
          ? "Add code before requesting sandbox diagnostics."
          : !policyEligible
            ? `${policy.label} is not executable in V1. Static review remains available; shell and native-code policies stay disabled/future until hardened.`
            : "";
  const canRun = !disabledReason;

  async function runSnapshot() {
    if (!canRun) return;
    setRunning(true);
    setRunState("preparing_snapshot");
    setRecordMessage("");
    try {
      setRunState("running");
      const runResult = await requestSandboxRun({ snapshotId, sourceType, sourceId, language: normalizedLanguage, fileName, code });
      setResult(runResult);
      setRunState(runResult.status);
      const record = await recordCodingSandboxRunResult({
        snapshotId,
        sourceType,
        sourceId,
        postId,
        codeDocumentId,
        codeVersionId,
        language: normalizedLanguage,
        fileName,
        requestPayload: {
          source_type: sourceType,
          source_id: sourceId ?? null,
          snapshot_id: snapshotId,
          language: normalizedLanguage,
          file_name: fileName ?? null,
          network_policy: "disabled",
          filesystem_policy: "temporary_workspace_only"
        },
        result: runResult
      });
      setRecordMessage(record.ok ? record.message : record.message);
    } catch (error) {
      const failedResult: SandboxRunResult = {
        ok: false,
        status: "failed",
        language: normalizedLanguage,
        file: fileName ?? null,
        snapshotId,
        diagnostics: [{
          severity: "error",
          phase: "sandbox",
          category: "sandbox_internal_failure",
          language: normalizedLanguage,
          file: fileName ?? null,
          line: null,
          column: null,
          source: "Coding Cornucopia sandbox client",
          message: error instanceof Error ? error.message : "Sandbox request failed."
        }],
        message: "Sandbox request failed before a run result was returned."
      };
      setResult(failedResult);
      setRunState("failed");
    } finally {
      setRunning(false);
    }
  }

  return <section className="coding-sandbox-panel">
    <div className="addon-card__topline"><strong>Sandbox diagnostics</strong><span>{codingLanguageStatusLabel(policy.status)}</span></div>
    <p className="boundary-note">{endpoint.message}</p>
    <p className="boundary-note">Runs are snapshot-based. No browser execution, no terminal, no package install, no repo clone, no Local Elysia handoff, and no trust label is created by a successful run.</p>
    <StatusBadges labels={[`state: ${runState.replace(/_/g, " ")}`, policy.sandboxRuntime ? `runtime: ${policy.sandboxRuntime}` : "no active runtime", "network disabled", "ephemeral workspace"]} />
    <DiagnosticsList diagnostics={staticDiagnostics} />
    <div className="button-row">
      <button type="button" disabled={!canRun || running} onClick={() => void runSnapshot()}>{running ? "Running in sandbox..." : runLabel}</button>
      {!endpoint.configured && <Link className="button-link" to="/commune/coding-cornucopia/sandbox-request">Prepare governed sandbox request</Link>}
    </div>
    {disabledReason && <p className="boundary-note">{disabledReason}</p>}
    {recordMessage && <p className="boundary-note">{recordMessage}</p>}
    {result && <article className="coding-run-result">
      <div className="addon-card__topline"><strong>{result.status.replace(/_/g, " ")}</strong><span>{result.runId ?? "no run id"}</span></div>
      <p>{result.message}</p>
      <DiagnosticsList diagnostics={result.diagnostics} />
      {(result.stdout || result.stderr) && <div className="coding-output-grid">
        <article><h4>stdout</h4><pre>{result.stdout || "(empty)"}</pre></article>
        <article><h4>stderr</h4><pre>{result.stderr || "(empty)"}</pre></article>
      </div>}
      <p className="boundary-note">Exit code: {result.exitCode ?? "n/a"} · Duration: {result.durationMs ?? "n/a"} ms</p>
    </article>}
  </section>;
}

type RoomNativeField = { heading: string; body: string; tone?: "default" | "pre" };
type ParsedPostSection = { heading: string; body: string };

function normalizeRoomNativeHeading(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function splitPostSections(body: string): { intro: string; sections: ParsedPostSection[] } {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const introLines: string[] = [];
  const sections: ParsedPostSection[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      if (current) sections.push({ heading: current.heading, body: current.lines.join("\n").trim() });
      current = { heading: heading[1].trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
    else introLines.push(line);
  }

  if (current) sections.push({ heading: current.heading, body: current.lines.join("\n").trim() });
  return { intro: introLines.join("\n").trim(), sections: sections.filter((section) => section.heading && section.body) };
}

function explicitFormSectionValue(parsed: ReturnType<typeof splitPostSections>, ...headings: string[]) {
  const wanted = new Set(headings.map(normalizeRoomNativeHeading));
  return parsed.sections.find((section) => wanted.has(normalizeRoomNativeHeading(section.heading)))?.body ?? "";
}

function stripExplicitFormSections(body: string, headings: string[]) {
  const wanted = new Set(headings.map(normalizeRoomNativeHeading));
  if (!wanted.size) return body.trim();
  const parsed = splitPostSections(body);
  const keptSections = parsed.sections.filter((section) => !wanted.has(normalizeRoomNativeHeading(section.heading)));
  return [
    parsed.intro,
    ...keptSections.map((section) => `## ${section.heading}\n\n${section.body}`)
  ].filter(Boolean).join("\n\n").trim();
}

function formLineValue(body: string, label: string) {
  const prefix = `${label.toLowerCase()}:`;
  const line = body.split("\n").map((item) => item.trim()).find((item) => item.toLowerCase().startsWith(prefix));
  return line ? line.slice(line.indexOf(":") + 1).trim() : "";
}

function metadataText(value?: string | null) {
  return String(value ?? "").trim();
}

const roomNativeFormHeadingsByPostType: Partial<Record<CommunePostType, string[]>> = {
  community_network: [
    "Introduction type",
    "Collaboration interest",
    "Role interest",
    "Project circle or topic",
    "Availability / involvement level",
    "Public contact preference",
    "Boundary note"
  ],
  troubleshooting: [
    "Issue type",
    "Affected area",
    "Environment",
    "Environment notes",
    "Steps tried / reproduce",
    "Steps to reproduce / tried",
    "Expected behavior",
    "Actual behavior",
    "Error message",
    "Redacted logs",
    "Known workaround",
    "Issue status"
  ],
  repository_showcase: [
    "Repository URL",
    "Provider",
    "Branch",
    "Commit",
    "License notes",
    "README preview",
    "File tree summary",
    "Screenshots / notes",
    "Compatibility notes",
    "Manifest status",
    "Risk warnings",
    "Repository safety boundary"
  ],
  job_post: [
    "Role title",
    "Organization / project",
    "Role type",
    "Paid / volunteer status",
    "Compensation clarity",
    "Location / remote / hybrid",
    "Location details",
    "Time commitment",
    "Deadline",
    "Contact path",
    "Requirements / skills",
    "Role summary",
    "Application status",
    "Anti-scam review",
    "Work With private application path",
    "Job safety notes",
    "Public correction note"
  ],
  research_note: [
    "Research question / topic",
    "Source links",
    "Citation notes",
    "Evidence summary",
    "Observation",
    "Interpretation",
    "Uncertainty",
    "Evidence strength / confidence",
    "Living Library source link",
    "Domain",
    "Geographic scope",
    "Ecological subsystem",
    "Method type",
    "Data type",
    "Ethics / sensitivity note"
  ],
  elysia_iteration_showcase: [
    "Iteration type",
    "Version / build label",
    "What changed",
    "Why it matters",
    "Known limitations",
    "Next step",
    "Risk flags"
  ],
  official_update: [
    "Official notice type",
    "Official status",
    "Severity",
    "Audience",
    "Effective date",
    "Version / tag",
    "Affected systems",
    "Related room",
    "Related repository",
    "Related migration",
    "Related links",
    "Known limitations",
    "Migration required",
    "User action required",
    "Priority",
    "Correction note"
  ]
};

function legacyCommunityNetworkDetails(parsed: ReturnType<typeof splitPostSections>): RoomNativeField[] {
  return [
    ["Introduction type", explicitFormSectionValue(parsed, "Introduction type")],
    ["Role interest", explicitFormSectionValue(parsed, "Role interest")],
    ["Project circle/topic", explicitFormSectionValue(parsed, "Project circle or topic", "Project circle/topic")],
    ["Collaboration interest", explicitFormSectionValue(parsed, "Collaboration interest")],
    ["Availability / involvement level", explicitFormSectionValue(parsed, "Availability / involvement level")],
    ["Public contact preference", explicitFormSectionValue(parsed, "Public contact preference")],
    ["Boundary note", explicitFormSectionValue(parsed, "Boundary note")]
  ].map(([heading, body]) => ({ heading, body })).filter((field) => field.body);
}

function bodyMarkdownForPost(post: CommunePost) {
  if (isRepositoryShowcaseGuidancePost(post)) return post.body.trim();
  return stripExplicitFormSections(post.body, roomNativeFormHeadingsByPostType[post.post_type] ?? []);
}

function renderCommuneInlineMarkdown(text: string, keyPrefix: string): ReactNode {
  const nodes: ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let lastIndex = 0;
  for (const match of text.matchAll(linkPattern)) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    nodes.push(<a href={match[2]} target="_blank" rel="noreferrer" key={`${keyPrefix}-${match.index}`}>{match[1]}</a>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length ? nodes : text;
}

type CommuneMarkdownBlock =
  | { type: "heading"; level: 2 | 3 | 4; text: string }
  | { type: "paragraph"; text: string }
  | { type: "unordered"; items: string[] }
  | { type: "ordered"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; text: string; language: string };

function parseCommuneMarkdownBlocks(body: string): CommuneMarkdownBlock[] {
  const blocks: CommuneMarkdownBlock[] = [];
  const paragraph: string[] = [];
  let list: { type: "unordered" | "ordered"; items: string[] } | null = null;
  let quote: string[] = [];
  let code: { language: string; lines: string[] } | null = null;

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
      paragraph.length = 0;
    }
  }
  function flushList() {
    if (list?.items.length) blocks.push({ type: list.type, items: list.items });
    list = null;
  }
  function flushQuote() {
    if (quote.length) blocks.push({ type: "quote", text: quote.join("\n").trim() });
    quote = [];
  }
  function flushLooseBlocks() {
    flushParagraph();
    flushList();
    flushQuote();
  }

  for (const rawLine of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    const fence = line.match(/^```\s*([A-Za-z0-9_-]*)\s*$/);
    if (code) {
      if (fence) {
        blocks.push({ type: "code", text: code.lines.join("\n"), language: code.language });
        code = null;
      } else {
        code.lines.push(rawLine);
      }
      continue;
    }
    if (fence) {
      flushLooseBlocks();
      code = { language: fence[1] || "text", lines: [] };
      continue;
    }
    if (!line.trim()) {
      flushLooseBlocks();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (heading) {
      flushLooseBlocks();
      const level = heading[1].length <= 2 ? 2 : heading[1].length === 3 ? 3 : 4;
      blocks.push({ type: "heading", level, text: heading[2].trim() });
      continue;
    }
    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      flushQuote();
      if (!list || list.type !== "unordered") flushList();
      list = list ?? { type: "unordered", items: [] };
      list.items.push(unordered[1].trim());
      continue;
    }
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      flushQuote();
      if (!list || list.type !== "ordered") flushList();
      list = list ?? { type: "ordered", items: [] };
      list.items.push(ordered[1].trim());
      continue;
    }
    const blockquote = line.match(/^>\s?(.*)$/);
    if (blockquote) {
      flushParagraph();
      flushList();
      quote.push(blockquote[1]);
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }

  if (code) blocks.push({ type: "code", text: code.lines.join("\n"), language: code.language });
  flushLooseBlocks();
  return blocks.filter((block) => block.type === "code" || (block.type === "heading" ? block.text : true));
}

function CommunePostBody({ body }: { body: string }) {
  const blocks = parseCommuneMarkdownBlocks(body.trim());
  if (!blocks.length) return null;
  return <div className="commune-post-body commune-post-prose">
    {blocks.map((block, index) => {
      if (block.type === "heading") {
        if (block.level === 2) return <h2 key={index}>{block.text}</h2>;
        if (block.level === 3) return <h3 key={index}>{block.text}</h3>;
        return <h4 key={index}>{block.text}</h4>;
      }
      if (block.type === "unordered") return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderCommuneInlineMarkdown(item, `${index}-${itemIndex}`)}</li>)}</ul>;
      if (block.type === "ordered") return <ol key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderCommuneInlineMarkdown(item, `${index}-${itemIndex}`)}</li>)}</ol>;
      if (block.type === "quote") return <blockquote key={index}>{renderCommuneInlineMarkdown(block.text, `${index}-quote`)}</blockquote>;
      if (block.type === "code") return <pre key={index} className="commune-post-code-block"><code>{block.text}</code></pre>;
      return <p key={index}>{renderCommuneInlineMarkdown(block.text, `${index}-paragraph`)}</p>;
    })}
  </div>;
}

function RoomNativeDetails({ label, fields, className = "" }: { label: string; fields: RoomNativeField[]; className?: string }) {
  const visibleFields = fields.filter((field) => metadataText(field.body));
  if (!visibleFields.length) return null;
  return <div className={["commune-room-native-details", className].filter(Boolean).join(" ")}>
    <p className="eyebrow">{label}</p>
    <div className="commune-room-native-grid">
      {visibleFields.map((field) => <article className="commune-room-native-field" key={field.heading}>
        <h3>{field.heading}</h3>
        {field.tone === "pre" ? <pre className="commune-repo-text-block">{field.body}</pre> : <p>{field.body}</p>}
      </article>)}
    </div>
  </div>;
}

const repositoryShowcaseGuidanceBoundaryCopy = "This is admin-authored Repository Showcase guidance. It is not a repository approval, compatibility review, Marketplace listing, install recommendation, or trust signal.";

function isRepositoryShowcaseGuidancePost(post: CommunePost) {
  if (post.post_type !== "repository_showcase" || post.repository_url) return false;
  const tags = new Set((post.tags ?? []).map((tag) => tag.toLowerCase()));
  return (tags.has("admin") && (tags.has("guidance") || tags.has("template") || tags.has("policy")))
    || /admin-authored repository showcase guidance/i.test(post.body);
}

const redactionChecklist = [
  "I removed secrets, tokens, API keys, and passwords.",
  "I removed private Elysia memory, private logs, and local vault content.",
  "I removed .env contents and credentials.",
  "I removed personal, customer, or user data.",
  "I have the right to share included text, media, links, or code.",
  "I understand this is public-facing content and must be moderator-reviewed before becoming visible."
];

const routeAcknowledgements = [
  "I will not upload secrets, credentials, .env files, private local Elysia memory/logs/vaults, or sensitive private data.",
  "I understand posts/comments may require moderation before public display.",
  "I understand repository/code showcases are not executed by the website.",
  "I have the right to share included text, media, links, or code."
];

const repoWarnings = [
  "May contain secrets",
  "License unclear",
  "Network behavior unclear",
  "Dependency risk",
  "Runs commands",
  "Uses Docker",
  "Reads files",
  "Requires external account",
  "Requires API keys",
  "Unknown maintainer",
  "Private repo source",
  "Unclear data handling",
  "Large model/download required",
  "Hardware required",
  "Cloud account required",
  "Potential scraping/API risk",
  "Untrusted install script",
  "Marketplace-ineligible until reviewed",
  "Needs review"
];

const iterationRiskFlags = [
  "Contains unreleased feature",
  "May expose private screenshot details",
  "May include local path risk",
  "Needs sandbox review",
  "Add-on preview only",
  "Not Marketplace approved",
  "Not Developer Forge approved",
  "Repo metadata unverified",
  "Requires manual browser test",
  "Requires Supabase migration",
  "Requires external service"
];

const officialUpdateTypeOptions: Array<{ value: OfficialUpdateType; label: string }> = [
  { value: "release_note", label: "Release note" },
  { value: "roadmap_update", label: "Roadmap update" },
  { value: "governance_update", label: "Governance update" },
  { value: "security_notice", label: "Security notice" },
  { value: "maintenance_notice", label: "Maintenance notice" },
  { value: "incident_update", label: "Incident / status update" },
  { value: "community_notice", label: "Official community notice" },
  { value: "developer_notice", label: "Developer Forge notice" },
  { value: "marketplace_notice", label: "Marketplace notice" },
  { value: "policy_update", label: "Policy update" },
  { value: "migration_notice", label: "Migration notice" },
  { value: "official_statement", label: "Official statement" }
];

const officialStatusOptions: OfficialUpdateStatus[] = ["published", "updated", "corrected", "retracted", "archived", "resolved", "monitoring"];
const officialSeverityOptions: OfficialUpdateSeverity[] = ["info", "notice", "important", "urgent", "critical"];
const troubleshootingStatusOptions: Array<{ value: TroubleshootingStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "needs_information", label: "Needs information" },
  { value: "in_progress", label: "In progress" },
  { value: "workaround_found", label: "Workaround found" },
  { value: "fix_proposed", label: "Fix proposed" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" }
];
const troubleshootingResolutionOptions: Array<{ value: TroubleshootingResolutionKind; label: string }> = [
  { value: "comment", label: "Accepted comment" },
  { value: "workaround", label: "Accepted workaround" },
  { value: "manual_note", label: "Manual resolution note" }
];
const researchEvidenceStrengthOptions = [
  { value: "preliminary", label: "Preliminary" },
  { value: "anecdotal", label: "Anecdotal observation" },
  { value: "moderate", label: "Moderate evidence" },
  { value: "strong", label: "Strong source trail" },
  { value: "mixed", label: "Mixed evidence" },
  { value: "needs_verification", label: "Needs verification" },
  { value: "unknown", label: "Unknown / not rated" }
];
const researchReviewStatusOptions: Array<{ value: ResearchReviewStatus; label: string }> = [
  { value: "submitted", label: "Submitted" },
  { value: "published", label: "Published" },
  { value: "needs_citation", label: "Needs citation" },
  { value: "needs_clarification", label: "Needs clarification" },
  { value: "source_issue", label: "Source issue" },
  { value: "overclaiming_evidence", label: "Overclaiming evidence" },
  { value: "corrected", label: "Corrected" },
  { value: "archived", label: "Archived" }
];
const mediaGardenCodeSafetyCopy = "Code snippets in Media Garden are visual/read-only material. They are not executed by the website and are not a trust signal.";
const mediaGardenCodePrivateDataCopy = "Use this only for discussion, design, structure, symbols, or aesthetic context. Do not upload secrets, credentials, environment-variable files, private logs, vault material, or sensitive private data.";

function isMediaGardenVisualCodePost(postType: CommunePostType) {
  return postType === "media_garden";
}

function isSandboxCapableCodePost(postType: CommunePostType) {
  return postType === "code_sharing" || postType === "troubleshooting";
}

function supportsCommuneCodeSnippetFields(postType: CommunePostType) {
  return isMediaGardenVisualCodePost(postType) || isSandboxCapableCodePost(postType);
}

const jobRoleTypeOptions: Array<{ value: JobPostMetadata["role_type"]; label: string }> = [
  { value: "paid_role", label: "Paid role" },
  { value: "volunteer_call", label: "Volunteer call" },
  { value: "stipend_role", label: "Stipend role" },
  { value: "contract", label: "Contract opportunity" },
  { value: "internship", label: "Internship" },
  { value: "research_role", label: "Research role" },
  { value: "collaboration_role", label: "Collaboration role" },
  { value: "contributor_call", label: "Contributor call" },
  { value: "reviewer_moderator_need", label: "Reviewer / moderator need" },
  { value: "other", label: "Other / explain clearly" }
];
const jobPaidStatusOptions: Array<{ value: JobPostMetadata["paid_volunteer_status"]; label: string }> = [
  { value: "paid", label: "Paid" },
  { value: "volunteer", label: "Volunteer" },
  { value: "stipend", label: "Stipend" },
  { value: "unpaid", label: "Unpaid" },
  { value: "mixed", label: "Mixed / explain clearly" },
  { value: "must_clarify", label: "Must clarify before approval" }
];
const jobLocationModeOptions: Array<{ value: JobPostMetadata["location_mode"]; label: string }> = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "local", label: "Local / onsite" },
  { value: "field_based", label: "Field-based" },
  { value: "unspecified", label: "Unspecified / clarify" }
];
const jobApplicationStatusOptions: Array<{ value: JobPostApplicationStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "reviewing", label: "Reviewing applications" },
  { value: "filled", label: "Filled" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
  { value: "needs_clarification", label: "Needs clarification" }
];
const jobAntiScamStatusOptions: Array<{ value: JobPostAntiScamReviewStatus; label: string }> = [
  { value: "not_reviewed", label: "Not reviewed" },
  { value: "reviewed_clear", label: "Reviewed clear" },
  { value: "needs_pay_clarification", label: "Needs pay clarification" },
  { value: "needs_contact_clarification", label: "Needs contact clarification" },
  { value: "needs_location_clarification", label: "Needs location clarification" },
  { value: "suspicious", label: "Suspicious / needs admin follow-up" },
  { value: "removed", label: "Removed" }
];
const jobPrivateApplicationSystemNotice = "Use Work With Elysia Ecobotics for private application materials such as resumes/CVs. Do not post resumes, CVs, identity documents, private contact details, SSNs, bank details, or private application materials in public comments.";

const researchEcologicalSubsystemOptions = [
  { value: "", label: "Not specified" },
  { value: "general", label: "General" },
  { value: "verdante", label: "Verdante" },
  { value: "sylphora", label: "Sylphora" },
  { value: "ecotiva", label: "Ecotiva" },
  { value: "aurania", label: "Aurania" },
  { value: "terraflux", label: "Terraflux" },
  { value: "aquaria", label: "Aquaria" },
  { value: "aetheria", label: "Aetheria" },
  { value: "not_applicable", label: "Not applicable" }
];

const futureSupportTables = [
  "commune_post_saves",
  "commune_thread_follows",
  "commune_code_documents",
  "commune_code_document_versions",
  "commune_code_annotations",
  "commune_reactions",
  "commune_profiles",
  "commune_room_memberships",
  "commune_sandbox_requests",
  "commune_audit_events",
  "commune_admin_actions",
  "commune_upload_reviews",
  "commune_blocklist_terms"
];

const statusFilters = ["All", "Published", "Local drafts", "Pending review", "Repository showcases", "Sandbox requests", "Needs backend"];
const safetyFilters = ["All", "No code execution", "Requires moderation", "Requires backend", "Requires sandbox", "Admin-only enforced"];
const communeActions = [
  { label: "Troubleshooting", href: "/commune/troubleshooting", kind: "troubleshooting" },
  { label: "Repository showcase", href: "/commune/repository-showcase", kind: "repository" },
  { label: "Sandbox review request", href: "/commune/sandbox-review", kind: "sandbox" }
] as const;

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function downloadText(filename: string, text: string, type: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function copyText(text: string, fallback: (message: string) => void) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    fallback("Clipboard is unavailable here. The Markdown is still exportable.");
    return;
  }
  void navigator.clipboard.writeText(text).then(
    () => fallback("Copied Markdown to clipboard."),
    () => fallback("Clipboard write failed. The Markdown is still exportable.")
  );
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "commune-draft";
}

function postMarkdown(draft: PostDraft) {
  return [
    `# ${draft.title || "Untitled Commune draft"}`,
    "",
    `Status: ${draft.status}`,
    `Post type: ${draft.postType}`,
    `Created: ${draft.createdAt}`,
    "",
    `Summary: ${draft.summary}`,
    "",
    draft.body,
    "",
    `Tags: ${draft.tags}`,
    `Source/repo links: ${draft.sourceLinks}`,
    `License/citation notes: ${draft.licenseNotes}`,
    `Privacy/redaction notes: ${draft.redactionNotes}`,
    `Intended audience: ${draft.intendedAudience}`,
    `Submitter: ${draft.submitterName || "Not supplied"}`,
    `Optional contact: ${draft.submitterContact || "Not supplied"}`,
    "",
    "Local draft mode: this was not sent to a live moderator queue unless the account-backed submit action separately succeeded."
  ].join("\n");
}

function repoMarkdown(draft: RepoShowcaseDraft) {
  const adminGuidancePost = Boolean(draft.adminGuidancePost);
  return [
    `# ${draft.title || (adminGuidancePost ? "Untitled Repository Showcase guidance" : "Untitled repository showcase")}`,
    "",
    `Post kind: ${adminGuidancePost ? "Admin guidance post" : "Repository listing"}`,
    `Provider: ${draft.provider}`,
    `Repository URL: ${adminGuidancePost && !draft.repoUrl ? "Not required for admin guidance" : draft.repoUrl}`,
    `Branch: ${draft.branch}`,
    `Commit: ${draft.commit}`,
    `License: ${draft.license}`,
    `Manifest status: ${draft.manifestStatus}`,
    `Elysia compatibility: ${draft.compatibility}`,
    `Security warnings: ${draft.warnings.join(", ") || "None selected"}`,
    "",
    draft.description,
    "",
    "## README preview pasted by user",
    draft.readmePreview,
    "",
    "## File tree preview pasted by user",
    draft.fileTreePreview,
    "",
    `Screenshot notes or URLs: ${draft.screenshotNotes}`,
    "",
    adminGuidancePost ? repositoryShowcaseGuidanceBoundaryCopy : "Draft only. This page does not fetch, clone, or validate the repository."
  ].join("\n");
}

function repoShowcaseManifest(draft: RepoShowcaseDraft) {
  return {
    schema_version: "repository_showcase_manifest.v1",
    project_name: draft.title,
    repository_url: draft.repoUrl,
    provider: draft.provider,
    branch: draft.branch,
    commit: draft.commit,
    license: draft.license,
    manifest_status: draft.manifestStatus,
    elysia_compatibility: draft.compatibility,
    short_description: draft.description,
    readme_preview: draft.readmePreview,
    file_tree_preview: draft.fileTreePreview,
    screenshot_notes_or_urls: draft.screenshotNotes,
    risk_flags: draft.warnings,
    import_source: draft.importSource ?? "manual",
    imported_at: draft.importedAt ?? null,
    imported_metadata: draft.importedMetadata ?? {},
    admin_guidance_post: Boolean(draft.adminGuidancePost),
    generated_by: "Elysia Ecobotics Online Repository Showcase",
    generated_at: new Date().toISOString(),
    redaction_notes: draft.redactionNotes ?? ""
  };
}

function repoManifestJson(draft: RepoShowcaseDraft) {
  return JSON.stringify(repoShowcaseManifest(draft), null, 2);
}

function iterationShowcaseManifest(draft: IterationShowcaseDraft) {
  return {
    schema_version: "elysia_iteration_showcase_manifest.v1",
    title: draft.title,
    summary: draft.summary,
    tags: draft.tags,
    links: draft.links,
    iteration_type: draft.iterationType,
    version_build_label: draft.versionBuildLabel,
    what_changed: draft.whatChanged,
    why_it_matters: draft.whyItMatters,
    known_limitations: draft.knownLimitations,
    next_step: draft.nextStep,
    body: draft.body,
    related_repo_url: draft.relatedRepoUrl,
    provider: draft.provider,
    branch: draft.branch,
    commit_sha: draft.commitSha,
    release_tag: draft.releaseTag,
    pull_request_url: draft.pullRequestUrl,
    developer_forge_link: draft.developerForgeLink,
    marketplace_link: draft.marketplaceLink,
    testing_status: draft.testingStatus,
    compatibility_note: draft.compatibilityNote,
    risk_flags: draft.riskFlags,
    import_source: draft.importSource ?? "manual",
    imported_at: draft.importedAt ?? null,
    imported_metadata: draft.importedMetadata ?? {},
    screenshots_demo_notes: "",
    generated_by: "Elysia Ecobotics Online Elysia Iteration Showcase",
    generated_at: new Date().toISOString(),
    redaction_notes: draft.redactionNotes ?? ""
  };
}

function iterationManifestJson(draft: IterationShowcaseDraft) {
  return JSON.stringify(iterationShowcaseManifest(draft), null, 2);
}

type ParsedGitHubRepoUrl = { owner: string; repo: string; cleanUrl: string };

function parsePublicGitHubRepoUrl(value: string): ParsedGitHubRepoUrl | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") return null;
    const [owner, repoPart] = url.pathname.split("/").filter(Boolean);
    if (!owner || !repoPart || owner === "gist" || repoPart === "gist") return null;
    const repo = repoPart.replace(/\.git$/i, "");
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
    return { owner, repo, cleanUrl: `https://github.com/${owner}/${repo}` };
  } catch {
    return null;
  }
}

function asStringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function repoSectionValue(parsed: ReturnType<typeof splitPostSections>, heading: string) {
  return explicitFormSectionValue(parsed, heading);
}

function truncateRepositoryText(value: string, limit = 12000) {
  return value.length > limit ? `${value.slice(0, limit)}\n\n[Truncated for public display.]` : value;
}

function sandboxMarkdown(draft: SandboxRequestDraft) {
  return [
    `# ${draft.title || "Untitled sandbox request"}`,
    "",
    `Related post/repo URL: ${draft.relatedUrl}`,
    `Expected command: ${draft.expectedCommand}`,
    `Dependencies: ${draft.dependencies}`,
    `Network needed: ${draft.networkNeeded}`,
    `File access needed: ${draft.fileAccessNeeded}`,
    `Estimated runtime: ${draft.estimatedRuntime}`,
    "",
    `Purpose: ${draft.codePurpose}`,
    "",
    `Why sandbox is needed: ${draft.whySandbox}`,
    "",
    `Risk notes: ${draft.riskNotes}`,
    "",
    "Sandbox requests are not execution permission."
  ].join("\n");
}

function isBackendDiagnostic(message: string) {
  const patterns = [
    ["Could", "not", "find"].join(" "),
    ["schema", "cache"].join(" "),
    ["permission", "denied"].join(" "),
    "row-level security",
    "violates row-level security",
    "relation \"public.",
    "not configured",
    "temporarily unavailable",
    "Supabase is not configured"
  ];
  return patterns.some((pattern) => message.toLowerCase().includes(pattern.toLowerCase()));
}

function cleanCommuneMessage(message: string, fallback: string) {
  return isBackendDiagnostic(message) ? fallback : message;
}

function logCommuneDiagnostics(scope: string, warnings: string[]) {
  if (import.meta.env.DEV && warnings.length) console.warn(`[Commune ${scope}]`, warnings);
}

function StatusBadges({ labels }: { labels: string[] }) {
  return <div className="commune-badge-row">{labels.filter(Boolean).map((label) => <span key={label}>{label.replace(/_/g, " ")}</span>)}</div>;
}

function TagChips({ tags }: { tags?: string[] | string | null }) {
  const normalizedTags = formatCommuneTags(tags);
  if (!normalizedTags.length) return null;
  return <div className="tag-row">{normalizedTags.map((tag) => <span key={tag}>{tag}</span>)}</div>;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/#/g, "").replace(/[_-]+/g, " ");
}

function matchesSearch(values: string[], search: string) {
  const query = normalize(search.trim());
  return !query || values.some((value) => normalize(value).includes(query));
}

function troubleshootingStatusLabel(status?: string | null) {
  return (status || "open").replace(/_/g, " ");
}

function troubleshootingSearchValues(item?: TroubleshootingMetadata | null) {
  if (!item) return [];
  return [
    item.issue_type,
    item.affected_area ?? "",
    item.environment_os ?? "",
    item.environment_browser ?? "",
    item.app_version ?? "",
    item.environment_notes ?? "",
    item.steps_to_reproduce ?? "",
    item.expected_result ?? "",
    item.actual_result ?? "",
    item.error_message ?? "",
    item.redacted_logs ?? "",
    item.workaround ?? "",
    item.troubleshooting_status,
    item.accepted_resolution_kind ?? "",
    item.accepted_summary ?? ""
  ];
}

function researchEvidenceLabel(value?: string | null) {
  return researchEvidenceStrengthOptions.find((option) => option.value === value)?.label ?? (value ? value.replace(/_/g, " ") : "Unknown / not rated");
}

function researchReviewStatusLabel(value?: string | null) {
  return researchReviewStatusOptions.find((option) => option.value === value)?.label ?? (value ? value.replace(/_/g, " ") : "submitted");
}

function jobRoleLabel(value?: string | null) {
  return jobRoleTypeOptions.find((option) => option.value === value)?.label ?? (value ? value.replace(/_/g, " ") : "Role type not specified");
}

function jobPaidStatusLabel(value?: string | null) {
  return jobPaidStatusOptions.find((option) => option.value === value)?.label ?? (value ? value.replace(/_/g, " ") : "Pay status not specified");
}

function jobLocationModeLabel(value?: string | null) {
  return jobLocationModeOptions.find((option) => option.value === value)?.label ?? (value ? value.replace(/_/g, " ") : "Location not specified");
}

function jobApplicationStatusLabel(value?: string | null) {
  return jobApplicationStatusOptions.find((option) => option.value === value)?.label ?? (value ? value.replace(/_/g, " ") : "open");
}

function jobAntiScamStatusLabel(value?: string | null) {
  return jobAntiScamStatusOptions.find((option) => option.value === value)?.label ?? (value ? value.replace(/_/g, " ") : "not reviewed");
}

function jobSearchValues(item?: JobPostMetadata | null) {
  if (!item) return [];
  return [
    item.role_title ?? "",
    item.organization_project ?? "",
    item.role_type,
    jobRoleLabel(item.role_type),
    item.paid_volunteer_status,
    jobPaidStatusLabel(item.paid_volunteer_status),
    item.location_mode,
    jobLocationModeLabel(item.location_mode),
    item.location_text ?? "",
    item.time_commitment ?? "",
    item.deadline ?? "",
    item.compensation_clarity ?? "",
    item.contact_path ?? "",
    item.requirements_skills ?? "",
    item.safety_notes ?? "",
    item.role_summary ?? "",
    item.application_status,
    jobApplicationStatusLabel(item.application_status),
    item.anti_scam_review_status,
    jobAntiScamStatusLabel(item.anti_scam_review_status),
    item.public_correction_note ?? ""
  ];
}

function researchSearchValues(item?: ResearchNotesMetadata | null) {
  if (!item) return [];
  return [
    item.research_question ?? "",
    item.domain ?? "",
    item.evidence_strength,
    researchEvidenceLabel(item.evidence_strength),
    item.living_library_source_link ?? "",
    item.citation_notes ?? "",
    item.evidence_summary ?? "",
    item.observation ?? "",
    item.interpretation ?? "",
    item.uncertainty ?? "",
    item.context_discussion ?? "",
    ...(item.source_links ?? []),
    item.geographic_scope ?? "",
    item.ecological_subsystem ?? "",
    item.method_type ?? "",
    item.data_type ?? "",
    item.ethics_note ?? "",
    item.review_status,
    item.correction_note ?? ""
  ];
}

function matchesCategory(typeName: string, category: string) {
  return category === "All" || typeName === category;
}

function matchesStatus(labels: string[], status: string) {
  if (status === "All") return true;
  const haystack = labels.map(normalize).join(" ");
  const needle = normalize(status);
  if (needle === "published") return haystack.includes("published");
  if (needle === "local drafts") return haystack.includes("local") || haystack.includes("draft");
  if (needle === "pending review") return haystack.includes("pending") || haystack.includes("review");
  if (needle === "repository showcases") return haystack.includes("repository") || haystack.includes("repo");
  if (needle === "sandbox requests") return haystack.includes("sandbox");
  if (needle === "needs backend") return haystack.includes("backend");
  return true;
}

function matchesSafety(labels: string[], safety: string) {
  if (safety === "All") return true;
  const haystack = labels.map(normalize).join(" ");
  return haystack.includes(normalize(safety));
}

function authorLink(username?: string | null) {
  if (!username) return <span>Community member</span>;
  return <Link to={`/commons-circle/@${encodeURIComponent(username)}`}>@{username}</Link>;
}

function CommuneActionNav({ activeKind, includeModeration }: { activeKind?: string; includeModeration?: boolean }) {
  return <div className="commune-action-row">{communeActions.map((action) => <Link className={activeKind === action.kind ? "button-link button-link--primary" : "button-link"} to={action.href} key={action.kind}>{action.label}</Link>)}{includeModeration && <Link className={activeKind === "moderation" ? "button-link button-link--primary" : "button-link"} to="/commune/moderation">Moderation</Link>}</div>;
}

function CommuneFocusedToolbar() {
  return <div className="commune-focused-toolbar"><Link className="button-link" to="/commune">← Back to The Elysia Commune</Link></div>;
}

function Doctrine() {
  return <section className="commune-doctrine-grid">
    <WarningCallout title="Share carefully">
      <p>Do not upload .env files, API keys, tokens, credentials, private logs, or vault data. Do not upload private Elysia memory, personal documents, or unredacted customer/user data. Public posts are not private support tickets. Anything drafted here should be safe to be public.</p>
    </WarningCallout>
    <WarningCallout title="Execute nowhere by default">
      <p>Community code must not run directly on Supabase, Cloudflare backend, Elysia core, Bradley's machine, or any shared website server. Repository showcases and sandbox requests are metadata and review requests only.</p>
    </WarningCallout>
    <WarningCallout title="Moderated by design">
      <p>Public posts, comments, uploads, repository showcases, and sandbox requests are governed by moderation and RLS when account mode is active. Users cannot self-assign moderator, reviewer, guardian, or admin roles.</p>
    </WarningCallout>
  </section>;
}

function RedactionPanel() {
  return <section className="section-card"><p className="eyebrow">Redaction Checklist</p><h2>Before sharing logs, screenshots, repo notes, or code, redact these.</h2><div className="commune-redaction-grid">{["API keys", "tokens", "passwords", "emails", "phone numbers", "addresses", "private local file paths", "machine usernames", "database URLs", "Supabase keys", "Cloudflare tokens", "GitHub tokens", ".env contents", "customer/user records"].map((item) => <span key={item}>{item}</span>)}</div></section>;
}

function CommuneLobby() {
  return <section className="section-card commune-lobby" id="commune-lobby">
    <div>
      <p className="eyebrow">Commune Lobby</p>
      <h2>Welcome in. Choose a room, read public posts, or start a careful thread.</h2>
      <p>The Commune is where Elysia Ecobotics members gather around public updates, troubleshooting, research notes, repository showcases, add-on ideas, ecological work, and community coordination. Everything here should be safe to make public. Redact first. Code executes nowhere by default.</p>
    </div>
    <CommuneActionNav activeKind="" />
    <div className="commune-action-row"><a className="button-link" href="#commune-rooms">Choose a room</a><a className="button-link" href="#commune-feed">Browse posts</a><a className="button-link" href="#commune-local-drafts">View local drafts</a></div>
  </section>;
}

function CommuneSearchPanel({ filters, setFilters }: { filters: CommuneFilters; setFilters: (filters: CommuneFilters) => void }) {
  return <section className="section-card commune-search-panel" id="commune-search">
    <div className="section-heading section-heading--inline">
      <div>
        <p className="eyebrow">Search and filters</p>
        <h2>Find the right room before the page gets long.</h2>
        <p>Filters apply to the community feed and local drafts. The full room directory stays available from the Rooms gateway.</p>
      </div>
      <button type="button" onClick={() => setFilters({ search: "", category: "All", status: "All", safety: "All" })}>Clear filters</button>
    </div>
    <label><span>Search keyword</span><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="troubleshooting, repo, research, sandbox..." /></label>
    <div className="commune-filter-group">
      <p>Category</p>
      <div className="commune-filter-chips">{["All", ...postTypes.map((type) => type.name)].map((category) => <button className={filters.category === category ? "button-primary" : ""} type="button" key={category} onClick={() => setFilters({ ...filters, category })}>{category}</button>)}</div>
    </div>
    <div className="commune-filter-group">
      <p>Status / visibility</p>
      <div className="commune-filter-chips">{statusFilters.map((status) => <button className={filters.status === status ? "button-primary" : ""} type="button" key={status} onClick={() => setFilters({ ...filters, status })}>{status}</button>)}</div>
    </div>
    <div className="commune-filter-group">
      <p>Safety</p>
      <div className="commune-filter-chips">{safetyFilters.map((safety) => <button className={filters.safety === safety ? "button-primary" : ""} type="button" key={safety} onClick={() => setFilters({ ...filters, safety })}>{safety}</button>)}</div>
    </div>
  </section>;
}

function ZoneCatalog({ filters }: { filters: CommuneFilters }) {
  const filteredTypes = postTypes.filter((type) => {
    const labels = [...type.currentStatus, type.futureFeatures, type.cautions, type.allowedContent];
    return matchesCategory(type.name, filters.category) && matchesSearch([type.name, type.purpose, type.allowedContent, type.cautions, type.futureFeatures], filters.search) && matchesStatus(labels, filters.status) && matchesSafety(labels, filters.safety);
  });
  return <section className="section-card">
    <p className="eyebrow">Commune Zones</p>
    <h2>{filteredTypes.length ? "Post types and boundaries" : "No matching Commune zones"}</h2>
    <div className="commune-zone-grid">
      {filteredTypes.map((type) => (
        <article className="commune-zone-card" key={type.id}>
          <span className="commune-card-sigil" aria-hidden="true">{type.name.slice(0, 1)}</span>
          <h3>{type.name}</h3>
          <p>{type.purpose}</p>
          <p><strong>Allowed:</strong> {type.allowedContent}</p>
          <p><strong>Caution:</strong> {type.cautions}</p>
          <StatusBadges labels={type.currentStatus} />
          <a className="button-link commune-anchor-button" href="#commune-post-composer">Draft this type</a>
          <details><summary>Future features</summary><p>{type.futureFeatures}</p></details>
        </article>
      ))}
    </div>
    {!filteredTypes.length && <p className="commune-empty-state">Try clearing a filter or searching for a broader room theme.</p>}
  </section>;
}

function RoomCards() {
  return <section className="section-card" id="commune-rooms"><p className="eyebrow">Rooms</p><h2>Choose a moderated community room</h2><div className="commune-zone-grid">{postTypes.map((type) => <article className="commune-zone-card commune-room-card" key={type.id}><span className="commune-card-sigil" aria-hidden="true">{type.name.slice(0, 1)}</span><h3>{type.name}</h3><p>{type.purpose}</p><p><strong>Allowed:</strong> {type.allowedContent}</p><p><strong>Caution:</strong> {type.cautions}</p><StatusBadges labels={type.currentStatus} /><RoomCardEnterAction type={type} /></article>)}</div></section>;
}

function RoomCardEnterAction({ type }: { type: CommunePostTypeCard }) {
  return <div className="commune-room-card-actions"><Link className="button-link commune-room-enter-button" to={roomPathForType(type)}>Enter room</Link></div>;
}

function CommuneRoomsGateway() {
  return <section className="section-card commune-rooms-gateway" id="commune-rooms">
    <div>
      <p className="eyebrow">Commune Rooms</p>
      <h2>Explore moderated community rooms.</h2>
      <p>Choose the right doorway for media, troubleshooting, code, repositories, community coordination, public opportunities, research, iteration showcases, community voting, or official notices.</p>
    </div>
    <div className="commune-room-gateway-actions">
      <span>10 moderated rooms</span>
      <Link className="button-link button-link--primary" to="/commune/rooms">Browse Commune Rooms</Link>
    </div>
  </section>;
}

function CommuneRoomsIndexPage() {
  return <>
    <CommuneFocusedToolbar />
    <section className="section-card commune-rooms-index-intro">
      <p className="eyebrow">Rooms directory</p>
      <h2>Find the right Commune room before you post.</h2>
      <p className="boundary-note">Each room keeps its own safety boundary, post type, and moderation flow. Enter a room to see its front desk, create a post, or browse its posts.</p>
      <Link className="button-link" to="/commune">Back to Commune</Link>
    </section>
    <RoomCards />
  </>;
}

function RoomPickerPanel() {
  return <section className="section-card" id="commune-room-picker">
    <p className="eyebrow">Start a thread</p>
    <h2>Choose a room before posting</h2>
    <p className="boundary-note">Posts are created from inside their room so the format, safety notes, and context match what you are sharing.</p>
    <div className="commune-zone-grid">{postTypes.map((type) => <article className="commune-zone-card commune-room-card" key={type.id}><span className="commune-card-sigil" aria-hidden="true">{type.name.slice(0, 1)}</span><h3>{type.name}</h3><p>{type.purpose}</p><StatusBadges labels={type.currentStatus} /><RoomCardEnterAction type={type} /></article>)}</div>
  </section>;
}

function ReactionBar({ targetType, targetId, signedIn, onMessage }: { targetType: CommuneReactionTargetType; targetId: string; signedIn: boolean; onMessage?: (message: string) => void }) {
  const [summary, setSummary] = useState<CommuneReactionSummary>({ helpful: 0, caution: 0, viewerReaction: null });
  const [signalMessage, setSignalMessage] = useState("");
  const [voting, setVoting] = useState<CommuneReaction | null>(null);
  const key = communeReactionKey(targetType, targetId);
  const refresh = useCallback(async () => {
    const result = await loadCommuneReactionSummary([{ targetType, targetId }]);
    setSummary(result.summaries[key] ?? { helpful: 0, caution: 0, viewerReaction: null });
    if (result.warnings.length) setSignalMessage(result.warnings[0]);
  }, [key, targetId, targetType]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function vote(reaction: CommuneReaction) {
    if (!signedIn) {
      const signInMessage = "Sign in to add a Commune community signal. Anonymous visitors can still read signal counts.";
      setSignalMessage(signInMessage);
      onMessage?.(signInMessage);
      return;
    }
    setVoting(reaction);
    setSignalMessage(reaction === summary.viewerReaction ? "Removing your community signal..." : "Saving your community signal...");
    const result = summary.viewerReaction === reaction ? await clearCommuneReaction(targetType, targetId) : await setCommuneReaction(targetType, targetId, reaction);
    const visibleMessage = cleanCommuneMessage(result.message, "Commune community signals are not active until the reaction migration is applied.");
    setSignalMessage(visibleMessage);
    onMessage?.(visibleMessage);
    await refresh();
    setVoting(null);
  }
  return <div className="commune-signal-bar" aria-label="Community signal">
    <span className="commune-signal-note">Community signal, not verification.</span>
    <button className={summary.viewerReaction === "helpful" ? "commune-signal-button is-active" : "commune-signal-button"} type="button" disabled={Boolean(voting)} onClick={() => void vote("helpful")}>{voting === "helpful" ? "Saving..." : "Helpful"} <strong>{summary.helpful}</strong></button>
    <button className={summary.viewerReaction === "caution" ? "commune-signal-button is-active" : "commune-signal-button"} type="button" disabled={Boolean(voting)} onClick={() => void vote("caution")}>{voting === "caution" ? "Saving..." : "Needs caution"} <strong>{summary.caution}</strong></button>
    {signalMessage && <span className="commune-signal-message">{signalMessage}</span>}
  </div>;
}

function AdminContentControls({ targetType, targetId, isModerator, onChanged, onDeleted, onMessage }: { targetType: CommuneReactionTargetType; targetId: string; isModerator: boolean; onChanged?: () => Promise<void>; onDeleted?: (targetId: string) => void; onMessage: (message: string) => void }) {
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [status, setStatus] = useState("");
  if (!isModerator) return null;
  async function act(action: "flag" | "hide" | "delete") {
    const result = await moderateCommuneContentTarget({ targetType, targetId, action, reason });
    const visibleMessage = cleanCommuneMessage(result.message, "Commune moderation controls are not active for this session yet.");
    setStatus(visibleMessage);
    onMessage(visibleMessage);
    setConfirmDelete(false);
    if (result.ok && action === "delete") onDeleted?.(targetId);
    if (result.ok) await onChanged?.();
  }
  return <div className="commune-admin-controls">
    <p className="eyebrow">Admin moderation</p>
    <label><span>Moderation reason</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Private admin history note" /></label>
    <div className="button-row"><button type="button" onClick={() => void act("flag")}>Flag for removal</button><button type="button" onClick={() => void act("hide")}>Hide from public</button><button type="button" onClick={() => setConfirmDelete(true)}>Delete</button></div>
    {confirmDelete && <div className="commune-delete-confirm"><h3>Delete/remove this Commune content?</h3><p>This removes the item from public views. No keeps it unchanged. Admin-only History records the action.</p><div className="button-row"><button type="button" onClick={() => void act("delete")}>Yes, delete/remove</button><button type="button" onClick={() => setConfirmDelete(false)}>No, keep it</button></div></div>}
    {status && <p className="message">{status}</p>}
  </div>;
}

const communityVoteResultsOptions: Array<{ value: CommunityVoteResultsVisibility; label: string }> = [
  { value: "always", label: "Always visible" },
  { value: "after_vote", label: "After member votes" },
  { value: "after_close", label: "After close" },
  { value: "staff_only", label: "Staff only" }
];

const communityVoteInitialStatusOptions: Array<{ value: CommunityVoteStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "open", label: "Open now" }
];

function communityVoteStatusLabel(status?: string | null) {
  return String(status ?? "draft").replace(/_/g, " ");
}

function communityVoteDateLabel(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not set";
}

function datetimeLocalToIso(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function communityVoteResultByOption(vote: CommunityVoteView, optionId: string) {
  return vote.results.find((result) => result.option_id === optionId) ?? null;
}

function communityVoteTotal(vote: CommunityVoteView) {
  return vote.results.reduce((max, result) => Math.max(max, result.total_ballots || 0), 0);
}

function communityVoteEffectiveOpen(vote: CommunityVoteView) {
  if (vote.vote.vote_status !== "open") return false;
  const now = new Date();
  const opensAt = vote.vote.opens_at ? new Date(vote.vote.opens_at) : null;
  const closesAt = vote.vote.closes_at ? new Date(vote.vote.closes_at) : null;
  if (opensAt && Number.isFinite(opensAt.getTime()) && now < opensAt) return false;
  if (closesAt && Number.isFinite(closesAt.getTime()) && now > closesAt) return false;
  return true;
}

function CommunityVoteResultBar({ percentage }: { percentage: number }) {
  const width = Math.max(0, Math.min(100, percentage));
  return <span className="commune-vote-result-bar" aria-hidden="true"><span className="commune-vote-result-fill" style={{ width: `${width}%` }} /></span>;
}

function CommunityVoteMiniPanel({ communityVote }: { communityVote?: CommunityVoteView | null }) {
  if (!communityVote) return <div className="commune-vote-card"><p className="commune-vote-boundary-note">Community Voting Room tables are not available yet. Apply the community voting room migration before using this feature.</p></div>;
  const total = communityVoteTotal(communityVote);
  return <div className="commune-vote-card">
    <div className="addon-card__topline"><strong>Community Voting Room</strong><span className="commune-vote-status">{communityVoteStatusLabel(communityVote.vote.vote_status)}</span></div>
    <p className="commune-vote-boundary-note">Community votes guide stewardship decisions. They do not automatically change site policy, safety rules, legal terms, Marketplace behavior, Developer Forge behavior, Elysia behavior, or Official Updates.</p>
    <div className="commune-vote-option-list">
      {communityVote.options.slice(0, 3).map((option) => {
        const result = communityVoteResultByOption(communityVote, option.id);
        const percentage = result?.percentage ?? (total ? ((result?.ballot_count ?? 0) / total) * 100 : 0);
        return <div className={communityVote.viewerBallot?.option_id === option.id ? "commune-vote-option-card commune-vote-option-card--selected" : "commune-vote-option-card"} key={option.id}>
          <strong>{option.option_label}</strong>
          <CommunityVoteResultBar percentage={percentage} />
          <span>{result?.ballot_count ?? 0} vote{(result?.ballot_count ?? 0) === 1 ? "" : "s"}</span>
        </div>;
      })}
    </div>
    <p className="boundary-note">{total} total vote{total === 1 ? "" : "s"} · results: {communityVote.vote.results_visibility.replace(/_/g, " ")}</p>
  </div>;
}

function CommunityVoteComposer({ roomId, onRefresh, isAdmin }: { roomId?: string; onRefresh: () => Promise<void>; isAdmin: boolean }) {
  const [form, setForm] = useState({
    question: "",
    context: "",
    tags: "governance, stewardship",
    links: "",
    options: "Yes\nNo",
    opensAt: "",
    closesAt: "",
    resultsVisibility: "after_vote" as CommunityVoteResultsVisibility,
    initialStatus: "open" as CommunityVoteStatus,
    allowComments: true,
    officialUpdatePostId: "",
    acknowledgement: true
  });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!isAdmin) return null;
  function parsedOptions() {
    return form.options.split("\n").map((line) => {
      const [label, ...descriptionParts] = line.split("|");
      return { label: label.trim(), description: descriptionParts.join("|").trim() };
    }).filter((option) => option.label);
  }
  async function submit() {
    setSubmitting(true);
    setMessage("Creating Community Voting Room vote...");
    try {
      const result = await submitCommunityVotePost({
        question: form.question,
        context: form.context,
        tags: form.tags,
        links: form.links,
        roomId,
        options: parsedOptions(),
        opensAt: datetimeLocalToIso(form.opensAt),
        closesAt: datetimeLocalToIso(form.closesAt),
        resultsVisibility: form.resultsVisibility,
        initialStatus: form.initialStatus,
        allowComments: form.allowComments,
        officialUpdatePostId: form.officialUpdatePostId.trim() || null,
        acknowledgement: form.acknowledgement
      });
      setMessage(result.message);
      if (result.ok) {
        setForm({ ...form, question: "", context: "", options: "Yes\nNo", officialUpdatePostId: "" });
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }
  return <section className="section-card commune-vote-admin-panel commune-vote-composer" id="commune-vote-composer">
    <p className="eyebrow">Admin vote creation</p>
    <h2>Create Community Voting Room vote</h2>
    <p className="commune-vote-boundary-note">Community votes guide stewardship decisions. They do not automatically govern the site, change policy, create safety/legal obligations, alter Marketplace/Developer Forge behavior, change Elysia behavior, or publish Official Updates.</p>
    <div className="commune-form-grid">
      <label className="wide-field"><span>Question</span><input value={form.question} onChange={(event) => setForm({ ...form, question: event.target.value })} placeholder="Which website stewardship priority should we consider next?" /></label>
      <label className="wide-field"><span>Context</span><textarea rows={4} value={form.context} onChange={(event) => setForm({ ...form, context: event.target.value })} /></label>
      <label className="wide-field"><span>Options, one per line</span><textarea rows={5} value={form.options} onChange={(event) => setForm({ ...form, options: event.target.value })} placeholder="Option label | optional description" /></label>
      <label><span>Initial status</span><select value={form.initialStatus} onChange={(event) => setForm({ ...form, initialStatus: event.target.value as CommunityVoteStatus })}>{communityVoteInitialStatusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      <label><span>Results visibility</span><select value={form.resultsVisibility} onChange={(event) => setForm({ ...form, resultsVisibility: event.target.value as CommunityVoteResultsVisibility })}>{communityVoteResultsOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      <label><span>Opens at</span><input type="datetime-local" value={form.opensAt} onChange={(event) => setForm({ ...form, opensAt: event.target.value })} /></label>
      <label><span>Closes at</span><input type="datetime-local" value={form.closesAt} onChange={(event) => setForm({ ...form, closesAt: event.target.value })} /></label>
      <label className="wide-field"><span>Tags</span><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></label>
      <label className="wide-field"><span>Links</span><input value={form.links} onChange={(event) => setForm({ ...form, links: event.target.value })} placeholder="Public HTTP(S) links only" /></label>
      <label className="wide-field"><span>Manual Official Update post id, optional</span><input value={form.officialUpdatePostId} onChange={(event) => setForm({ ...form, officialUpdatePostId: event.target.value })} placeholder="Optional later admin-filled link only" /></label>
      <label className="checkbox-row wide-field"><input type="checkbox" checked={form.allowComments} onChange={(event) => setForm({ ...form, allowComments: event.target.checked })} /> Allow comments</label>
      <label className="checkbox-row wide-field"><input type="checkbox" checked={form.acknowledgement} onChange={(event) => setForm({ ...form, acknowledgement: event.target.checked })} /> I confirm this is advisory guidance, not automatic governance or Official Update publishing.</label>
    </div>
    <div className="button-row"><button type="button" disabled={submitting} onClick={() => void submit()}>{submitting ? "Creating vote..." : "Create community vote"}</button></div>
    <p className="message">{message}</p>
  </section>;
}

function CommunityVoteAdminPanel({ communityVote, onMessage, onChanged }: { communityVote: CommunityVoteView | null; onMessage: (message: string) => void; onChanged: () => Promise<void> }) {
  const [outcome, setOutcome] = useState(communityVote?.vote.admin_outcome_summary ?? "");
  const [officialUpdatePostId, setOfficialUpdatePostId] = useState(communityVote?.vote.official_update_post_id ?? "");
  useEffect(() => {
    setOutcome(communityVote?.vote.admin_outcome_summary ?? "");
    setOfficialUpdatePostId(communityVote?.vote.official_update_post_id ?? "");
  }, [communityVote?.vote.admin_outcome_summary, communityVote?.vote.official_update_post_id]);
  if (!communityVote) return <section className="commune-admin-controls commune-vote-admin-panel"><p className="eyebrow">Community vote admin</p><p>Structured Community Voting Room metadata is not active for this post yet.</p></section>;
  const activeCommunityVote = communityVote;
  async function act(action: CommunityVoteLifecycleAction, patch: Partial<{ adminOutcomeSummary: string; officialUpdatePostId: string | null; commentsEnabled: boolean; eventNote: string }> = {}) {
    const result = await updateCommunityVoteLifecycle({
      votePostId: activeCommunityVote.vote.post_id,
      action,
      adminOutcomeSummary: patch.adminOutcomeSummary,
      officialUpdatePostId: patch.officialUpdatePostId,
      commentsEnabled: patch.commentsEnabled,
      eventNote: patch.eventNote
    });
    onMessage(result.message);
    if (result.ok) await onChanged();
  }
  const commentsEnabled = activeCommunityVote.vote.allow_comments !== false;
  return <section className="commune-admin-controls commune-vote-admin-panel">
    <p className="eyebrow">Community vote admin lifecycle</p>
    <div className="commune-form-grid">
      <label className="wide-field"><span>Admin outcome summary</span><textarea rows={3} value={outcome} onChange={(event) => setOutcome(event.target.value)} /></label>
      <label className="wide-field"><span>Manual Official Update post id</span><input value={officialUpdatePostId} onChange={(event) => setOfficialUpdatePostId(event.target.value)} placeholder="Optional manual link; no Official Update is auto-created" /></label>
    </div>
    <div className="button-row">
      <button type="button" onClick={() => void act("open")}>Open</button>
      <button type="button" onClick={() => void act("close")}>Close</button>
      <button type="button" onClick={() => void act("reopen")}>Reopen</button>
      <button type="button" onClick={() => void act("accept", { adminOutcomeSummary: outcome })}>Accept</button>
      <button type="button" onClick={() => void act("decline", { adminOutcomeSummary: outcome })}>Decline</button>
      <button type="button" onClick={() => void act("archive")}>Archive</button>
      <button type="button" onClick={() => void act("update_outcome", { adminOutcomeSummary: outcome, officialUpdatePostId: officialUpdatePostId.trim() || null })}>Save outcome summary</button>
      <button type="button" onClick={() => void act("mark_posted_to_official_update", { adminOutcomeSummary: outcome, officialUpdatePostId: officialUpdatePostId.trim() || null })}>Mark posted to Official Update</button>
      <button type="button" onClick={() => void act(commentsEnabled ? "disable_comments" : "enable_comments", { commentsEnabled: !commentsEnabled })}>{commentsEnabled ? "Disable comments" : "Enable comments"}</button>
    </div>
    <p className="boundary-note">These controls record vote lifecycle events. They do not publish Official Updates or automatically change policy, safety/legal terms, Marketplace, Developer Forge, or Elysia behavior.</p>
  </section>;
}

function CommunityVoteDetail({ communityVote, signedIn, isAdmin, onMessage, onChanged }: { communityVote: CommunityVoteView | null; signedIn: boolean; isAdmin: boolean; onMessage: (message: string) => void; onChanged: () => Promise<void> }) {
  const [castingOptionId, setCastingOptionId] = useState<string | null>(null);
  if (!communityVote) return <div className="commune-vote-detail"><p className="commune-vote-boundary-note">Community Voting Room tables are not available yet. Apply the community voting room migration before using this feature.</p></div>;
  const activeCommunityVote = communityVote;
  const total = communityVoteTotal(activeCommunityVote);
  const open = communityVoteEffectiveOpen(activeCommunityVote);
  async function cast(option: CommunityVoteOption) {
    setCastingOptionId(option.id);
    const result = await castCommunityVoteBallot({ votePostId: activeCommunityVote.vote.post_id, optionId: option.id, vote: activeCommunityVote.vote, options: activeCommunityVote.options });
    onMessage(result.message);
    if (result.ok) await onChanged();
    setCastingOptionId(null);
  }
  return <div className="commune-vote-detail">
    <section className="commune-official-identity">
      <p className="eyebrow">Advisory governance</p>
      <h3>{communityVote.vote.question}</h3>
      <p>{communityVote.vote.context || "This vote is open for public guidance within the Community Voting Room."}</p>
      <StatusBadges labels={["Community Voting Room", communityVoteStatusLabel(communityVote.vote.vote_status), communityVote.vote.results_visibility.replace(/_/g, " "), communityVote.vote.allow_comments ? "comments open" : "comments disabled"]} />
    </section>
    <p className="commune-vote-boundary-note">Community votes guide stewardship decisions. They do not automatically change site policy, safety rules, legal terms, Marketplace behavior, Developer Forge behavior, Elysia behavior, or Official Updates. Admins control lifecycle and outcomes.</p>
    <div className="commune-room-native-details">
      <p className="eyebrow">Voting window</p>
      <div className="commune-room-native-grid">
        <article className="commune-room-native-field"><h3>Opens</h3><p>{communityVoteDateLabel(communityVote.vote.opens_at)}</p></article>
        <article className="commune-room-native-field"><h3>Closes</h3><p>{communityVoteDateLabel(communityVote.vote.closes_at)}</p></article>
        <article className="commune-room-native-field"><h3>Total votes</h3><p>{total}</p></article>
      </div>
    </div>
    <div className="commune-vote-option-list">
      {communityVote.options.map((option) => {
        const result = communityVoteResultByOption(communityVote, option.id);
        const count = result?.ballot_count ?? 0;
        const percentage = result?.percentage ?? (total ? (count / total) * 100 : 0);
        const selected = communityVote.viewerBallot?.option_id === option.id;
        return <button className={selected ? "commune-vote-option-card commune-vote-option-card--selected" : "commune-vote-option-card"} type="button" key={option.id} disabled={!signedIn || !open || Boolean(castingOptionId)} onClick={() => void cast(option)}>
          <span className="addon-card__topline"><strong>{option.option_label}</strong>{selected && <span>Selected option</span>}</span>
          {option.option_description && <span>{option.option_description}</span>}
          <CommunityVoteResultBar percentage={percentage} />
          <span>{count} vote{count === 1 ? "" : "s"} · {percentage.toFixed(1)}%</span>
          {castingOptionId === option.id && <span>Saving ballot...</span>}
        </button>;
      })}
    </div>
    {!signedIn && <p className="message">Anonymous visitors can view Community Voting Room votes, options, and allowed aggregate results, but cannot vote. Sign in as a member to cast or change one ballot while the vote is open.</p>}
    {signedIn && !open && <p className="message">This vote is not open for ballots right now. Closed, scheduled, archived, or out-of-window votes reject ballots in the UI and by database policy.</p>}
    {communityVote.vote.admin_outcome_summary && <article className="commune-room-native-field"><h3>Admin outcome summary</h3><p>{communityVote.vote.admin_outcome_summary}</p></article>}
    {communityVote.vote.official_update_post_id && <p className="boundary-note">Manual Official Update link: <Link to={`/commune/posts/${communityVote.vote.official_update_post_id}`}>{communityVote.vote.official_update_post_id}</Link>. No Official Update was auto-created by this vote.</p>}
    {communityVote.events.length > 0 && <div className="commune-vote-event-list"><p className="eyebrow">Lifecycle events</p>{communityVote.events.map((event) => <article className="commune-preview-card" key={event.id}><strong>{event.event_type.replace(/_/g, " ")}</strong><p>{event.event_note || "Lifecycle event recorded."}</p><span>{event.created_at ? new Date(event.created_at).toLocaleString() : "date unavailable"} · {event.event_visibility}</span></article>)}</div>}
    {isAdmin && <CommunityVoteAdminPanel communityVote={communityVote} onMessage={onMessage} onChanged={onChanged} />}
  </div>;
}

function PostCard({ post, saved, onSave, signedIn, officialUpdate, troubleshooting, jobPost, researchNote, communityVote }: { post: CommunePost; saved: boolean; onSave: (id: string) => void; signedIn: boolean; officialUpdate?: OfficialUpdateMetadata | null; troubleshooting?: TroubleshootingMetadata | null; jobPost?: JobPostMetadata | null; researchNote?: ResearchNotesMetadata | null; communityVote?: CommunityVoteView | null }) {
  const officialLabels = officialUpdate ? ["Official", officialUpdate.update_type.replace(/_/g, " "), officialUpdate.official_status, officialUpdate.severity, officialUpdate.pinned ? "Pinned" : "", officialUpdate.important ? "Important" : ""].filter(Boolean) : [];
  const voteLabels = communityVote ? ["Community Voting Room", communityVoteStatusLabel(communityVote.vote.vote_status), `${communityVoteTotal(communityVote)} votes`].filter(Boolean) : [];
  const troubleshootingLabels = troubleshooting ? ["Troubleshooting Grove", troubleshooting.issue_type, troubleshooting.troubleshooting_status, troubleshooting.affected_area ?? ""].filter(Boolean) : [];
  const researchLabels = researchNote ? ["Research Notes", researchEvidenceLabel(researchNote.evidence_strength), researchReviewStatusLabel(researchNote.review_status), researchNote.domain ?? ""].filter(Boolean) : [];
  const jobLabels = jobPost ? ["Job Post", jobRoleLabel(jobPost.role_type), jobPaidStatusLabel(jobPost.paid_volunteer_status), jobApplicationStatusLabel(jobPost.application_status), jobAntiScamStatusLabel(jobPost.anti_scam_review_status)].filter(Boolean) : [];
  const repositoryGuidanceLabels = isRepositoryShowcaseGuidancePost(post) ? ["Repository Showcase guidance", "Admin guidance post", "Not a trust signal"] : [];
  return <article className={post.post_type === "official_update" ? "commune-post-card commune-official-card" : post.post_type === "community_vote" ? "commune-post-card commune-vote-post-card" : "commune-post-card"}><div className="addon-card__topline"><StatusBadges labels={officialLabels.length ? officialLabels : voteLabels.length ? voteLabels : troubleshootingLabels.length ? troubleshootingLabels : researchLabels.length ? researchLabels : jobLabels.length ? jobLabels : repositoryGuidanceLabels.length ? repositoryGuidanceLabels : [post.post_type, post.status]} /></div><h3><Link to={`/commune/posts/${post.id}`}>{post.title}</Link></h3><p>{officialUpdate?.summary || communityVote?.vote.context || researchNote?.evidence_summary || jobPost?.role_summary || post.excerpt || post.body.slice(0, 180)}</p>{repositoryGuidanceLabels.length > 0 && <p className="boundary-note">Repository Showcase guidance is not a repository approval, compatibility review, Marketplace listing, install recommendation, or trust signal.</p>}{communityVote && <CommunityVoteMiniPanel communityVote={communityVote} />}{troubleshooting?.accepted_summary && <p className="boundary-note">Accepted {troubleshooting.accepted_resolution_kind?.replace(/_/g, " ") ?? "resolution"}: {troubleshooting.accepted_summary}</p>}{researchNote?.uncertainty && <p className="boundary-note">Uncertainty: {researchNote.uncertainty.slice(0, 180)}</p>}{jobPost && <p className="boundary-note">{jobPaidStatusLabel(jobPost.paid_volunteer_status)} · {jobLocationModeLabel(jobPost.location_mode)} · {jobApplicationStatusLabel(jobPost.application_status)}</p>}<p>{post.post_type === "official_update" ? "By Elysia Ecobotics Official" : <>By {authorLink(post.author_username)}</>} · {post.published_at ? new Date(post.published_at).toLocaleDateString() : "public date unavailable"}</p><TagChips tags={(post.tags ?? []).slice(0, 5)} /><ReactionBar targetType="post" targetId={post.id} signedIn={signedIn} /><div className="button-row"><Link className="button-link" to={`/commune/posts/${post.id}`}>Read</Link><button type="button" onClick={() => onSave(post.id)}>{saved ? "Saved" : "Save post"}</button></div></article>;
}

function CommunityFeed({ posts, savedPostIds, onSave, filters, signedIn, troubleshootingPosts, jobPosts, researchNotes, votePosts }: { posts: CommunePost[]; savedPostIds: string[]; onSave: (id: string) => void; filters: CommuneFilters; signedIn: boolean; troubleshootingPosts?: TroubleshootingMetadata[]; jobPosts?: JobPostMetadata[]; researchNotes?: ResearchNotesMetadata[]; votePosts?: CommunityVoteView[] }) {
  const troubleshootingByPostId = new Map((troubleshootingPosts ?? []).map((item) => [item.post_id, item]));
  const jobByPostId = new Map((jobPosts ?? []).map((item) => [item.post_id, item]));
  const researchByPostId = new Map((researchNotes ?? []).map((item) => [item.post_id, item]));
  const voteByPostId = new Map((votePosts ?? []).map((item) => [item.vote.post_id, item]));
  const filteredPosts = posts.filter((post) => {
    const type = postTypes.find((item) => item.backendValue === post.post_type);
    const troubleshooting = troubleshootingByPostId.get(post.id);
    const researchNote = researchByPostId.get(post.id);
    const jobPost = jobByPostId.get(post.id);
    const votePost = voteByPostId.get(post.id);
    const labels = [post.status, post.visibility, type?.name ?? post.post_type, ...(post.tags ?? []), ...(troubleshooting ? [troubleshooting.issue_type, troubleshooting.troubleshooting_status, troubleshooting.affected_area ?? ""] : []), ...(researchNote ? [researchEvidenceLabel(researchNote.evidence_strength), researchNote.review_status, researchNote.domain ?? ""] : []), ...(jobPost ? [jobPost.role_type, jobPost.paid_volunteer_status, jobPost.location_mode, jobPost.application_status, jobPost.anti_scam_review_status] : []), ...(votePost ? [votePost.vote.vote_status, votePost.vote.results_visibility, "advisory governance", "Community Voting Room"] : [])];
    return matchesCategory(type?.name ?? post.post_type, filters.category) && matchesSearch([post.title, post.excerpt ?? "", post.body, ...(post.tags ?? []), ...troubleshootingSearchValues(troubleshooting), ...researchSearchValues(researchNote), ...jobSearchValues(jobPost), ...(votePost ? [votePost.vote.question, votePost.vote.context ?? "", ...votePost.options.map((option) => option.option_label)] : [])], filters.search) && matchesStatus(labels, filters.status) && matchesSafety(labels, filters.safety);
  });
  const emptyCards = postTypes.filter((type) => matchesCategory(type.name, filters.category) && matchesSearch([type.name, type.purpose], filters.search) && matchesStatus([...type.currentStatus, "needs backend"], filters.status) && matchesSafety([...type.currentStatus, type.cautions], filters.safety)).slice(0, 5);
  return <section className="section-card commune-feed" id="commune-feed">
    <p className="eyebrow">Community Feed</p>
    <h2>{filteredPosts.length ? `${filteredPosts.length} published item${filteredPosts.length === 1 ? "" : "s"}` : "No published Commune posts yet"}</h2>
    <p className="boundary-note">Only posts approved/published by moderation are public here. Drafts and pending requests remain private to their owner and reviewers.</p>
    {filteredPosts.length ? <div className="commune-feed-grid">{filteredPosts.map((post) => <PostCard key={post.id} post={post} saved={savedPostIds.includes(post.id)} onSave={onSave} signedIn={signedIn} troubleshooting={troubleshootingByPostId.get(post.id)} jobPost={jobByPostId.get(post.id)} researchNote={researchByPostId.get(post.id)} communityVote={voteByPostId.get(post.id)} />)}</div> : <div className="commune-feed-grid">{emptyCards.map((type) => <article className="commune-feed-card" key={type.id}><div className="commune-author-sigil" aria-hidden="true">{type.name.slice(0, 1)}</div><p className="eyebrow">{type.name}</p><h3>No {type.name} posts yet.</h3><p>{type.purpose}</p><Link className="button-link" to={roomPathForType(type)}>Enter room</Link></article>)}</div>}
  </section>;
}

type RoomPageMode = "hub" | "posts" | "composer";

function roomCreateLabel(type: CommunePostTypeCard) {
  if (type.backendValue === "troubleshooting") return "Create Troubleshooting Post";
  if (type.backendValue === "job_post") return "Create Job Post";
  if (type.backendValue === "repository_showcase") return "Create Repository Showcase";
  if (type.backendValue === "community_vote") return "Create community vote";
  if (type.backendValue === "official_update") return "Publish Official Update";
  return `Create ${type.name} Post`;
}

function RoomPermissionBoundary({ type }: { type: CommunePostTypeCard }) {
  return <section className="section-card commune-room-permission-boundary">
    <p className="eyebrow">Permission boundary</p>
    <h2>{type.name} authoring is restricted.</h2>
    <p>{type.backendValue === "community_vote" ? "Community Voting Room votes are created by administrators so options, lifecycle status, ballot privacy, and advisory-governance boundaries are saved together." : "Official Updates are restricted to authorized Elysia Ecobotics administrators. Community users cannot self-assign official publishing authority."}</p>
    <div className="button-row"><Link className="button-link" to={roomPathForType(type)}>Back to {type.name}</Link><Link className="button-link" to={roomPostsPathForType(type)}>Browse {type.name} posts</Link></div>
  </section>;
}

function RoomPostsGateway({ type, count }: { type: CommunePostTypeCard; count: number }) {
  return <section className="section-card commune-room-posts-gateway" id="commune-room-posts-gateway">
    <p className="eyebrow">{type.name} Posts</p>
    <h2>{count ? `${count} published item${count === 1 ? "" : "s"}` : `No published ${type.name} posts yet`}</h2>
    <p className="boundary-note">This room follows the Commune model: room posts become threads, and replies appear after moderation.</p>
    <div className="button-row"><Link className="button-link button-link--primary" to={roomPostsPathForType(type)}>Browse all {type.name} posts</Link></div>
  </section>;
}

function RoomPage({ roomSlug, roomId, posts, officialUpdates, troubleshootingPosts, jobPosts, researchNotes, votePosts, savedPostIds, onSave, localDrafts, categories, onRefresh, signedIn, isAdmin, mode = "hub" }: { roomSlug: string; roomId?: string; posts: CommunePost[]; officialUpdates: OfficialUpdateMetadata[]; troubleshootingPosts: TroubleshootingMetadata[]; jobPosts: JobPostMetadata[]; researchNotes: ResearchNotesMetadata[]; votePosts: CommunityVoteView[]; savedPostIds: string[]; onSave: (id: string) => void; localDrafts: ReturnType<typeof useLocalDraftState>; categories: CommuneCategory[]; onRefresh: () => Promise<void>; signedIn: boolean; isAdmin: boolean; mode?: RoomPageMode }) {
  const normalizedRoomSlug = normalizeCommuneRoomSlug(roomSlug) ?? roomSlug;
  const type = postTypeByRoomSlug.get(normalizedRoomSlug);
  const officialByPostId = new Map(officialUpdates.map((item) => [item.post_id, item]));
  const troubleshootingByPostId = new Map(troubleshootingPosts.map((item) => [item.post_id, item]));
  const researchByPostId = new Map(researchNotes.map((item) => [item.post_id, item]));
  const jobByPostId = new Map(jobPosts.map((item) => [item.post_id, item]));
  const voteByPostId = new Map(votePosts.map((item) => [item.vote.post_id, item]));
  const roomPosts = type ? posts.filter((post) => post.post_type === type.backendValue).sort((left, right) => {
    if (type.backendValue !== "official_update") return 0;
    const leftMeta = officialByPostId.get(left.id);
    const rightMeta = officialByPostId.get(right.id);
    const leftScore = (leftMeta?.pinned ? 4 : 0) + (leftMeta?.important ? 2 : 0) + (["critical", "urgent"].includes(leftMeta?.severity ?? "") ? 1 : 0);
    const rightScore = (rightMeta?.pinned ? 4 : 0) + (rightMeta?.important ? 2 : 0) + (["critical", "urgent"].includes(rightMeta?.severity ?? "") ? 1 : 0);
    return rightScore - leftScore || new Date(right.published_at ?? right.created_at ?? 0).getTime() - new Date(left.published_at ?? left.created_at ?? 0).getTime();
  }) : [];
  if (!type) {
    return <section className="section-card"><p className="eyebrow">Room</p><h2>Room not found</h2><p>This Commune room is not available yet. Choose another room from the lobby.</p><Link className="button-link" to="/commune">Back to Commune</Link></section>;
  }
  const canDraft = type.backendValue !== "official_update" || isAdmin;
  const roomPostComposer = canDraft && !["repository_showcase", "community_vote"].includes(type.backendValue);
  const canOpenComposer = type.backendValue === "community_vote" || type.backendValue === "official_update" ? isAdmin : true;
  const createPath = roomNewPathForType(type);
  const postsPath = roomPostsPathForType(type);
  const hubPath = roomPathForType(type);
  const createLabel = roomCreateLabel(type);
  const composer = () => {
    if (type.backendValue === "community_vote") return isAdmin ? <CommunityVoteComposer roomId={roomId} onRefresh={onRefresh} isAdmin={isAdmin} /> : <RoomPermissionBoundary type={type} />;
    if (type.backendValue === "repository_showcase") return <RepositoryShowcaseForm localDrafts={localDrafts} roomId={roomId} onRefresh={onRefresh} isAdmin={isAdmin} />;
    if (type.backendValue === "official_update" && !isAdmin) return <RoomPermissionBoundary type={type} />;
    if (roomPostComposer) return <PostComposer defaultType={type.backendValue} defaultRoomId={roomId} troubleshooting={type.backendValue === "troubleshooting"} localDrafts={localDrafts} categories={categories} onRefresh={onRefresh} isAdmin={isAdmin} />;
    return <RoomPermissionBoundary type={type} />;
  };
  return <>
    <CommuneFocusedToolbar />
    <section className="section-card commune-lobby">
      <div>
        <p className="eyebrow">Commune Room</p>
        <h2>{type.name}</h2>
        <p>{type.purpose}</p>
      </div>
      <p><strong>Allowed:</strong> {type.allowedContent}</p>
      <p><strong>Caution:</strong> {type.cautions}</p>
      <StatusBadges labels={type.currentStatus} />
      <div className="commune-action-row">
        {roomPostComposer && <Link className="button-link button-link--primary" to={createPath}>{createLabel}</Link>}
        {type.backendValue === "repository_showcase" && <Link className="button-link button-link--primary" to={createPath}>Create Repository Showcase</Link>}
        {type.backendValue === "elysia_iteration_showcase" && <Link className="button-link" to="/commune/elysia-iteration-showcase/sandbox-request">Review selected iteration artifact</Link>}
        {type.backendValue === "code_sharing" && <><Link className="button-link button-link--primary" to={createPath}>Draft Coding Cornucopia Post</Link><Link className="button-link" to="/commune/coding-cornucopia/review">Open Coding Workbench</Link><Link className="button-link" to="/commune/coding-cornucopia/sandbox-request">Prepare Sandbox Review Request</Link></>}
        {type.backendValue === "community_vote" && (isAdmin ? <Link className="button-link button-link--primary" to={createPath}>Create community vote</Link> : <Link className="button-link button-link--primary" to={postsPath}>Browse guidance votes</Link>)}
        {type.backendValue === "official_update" && (isAdmin ? <Link className="button-link button-link--primary" to={createPath}>Publish Official Update</Link> : <Link className="button-link button-link--primary" to={postsPath}>Read official updates</Link>)}
        {mode !== "posts" && <Link className="button-link" to={postsPath}>View all posts</Link>}
        <Link className="button-link" to="/commune/rooms">Rooms directory</Link>
      </div>
    </section>
    {mode === "hub" && <RoomPostsGateway type={type} count={roomPosts.length} />}
    {mode === "hub" && type.backendValue === "community_vote" && <section className="section-card commune-vote-detail"><p className="eyebrow">Stewardship guidance, not automatic governance</p><h2>Community votes guide decisions; admins control lifecycle and outcomes.</h2><p className="commune-vote-boundary-note">Community votes guide stewardship decisions. They do not automatically change site policy, safety rules, legal terms, Marketplace behavior, Developer Forge behavior, Elysia behavior, or Official Updates.</p><p>{signedIn ? "Signed-in members can cast one ballot and change it while a vote is open." : "Anonymous visitors can read public votes and allowed aggregate results, but voting requires a signed-in member account."}</p></section>}
    {mode === "hub" && type.backendValue === "job_post" && <section className="section-card commune-job-bridge"><p className="eyebrow">Public board, private applications separate</p><h2>Job Posts are public listings; Work With is the private intake path.</h2><p>Community members may submit public opportunities, but normal-user Job Posts require admin approval before publication. Do not ask for resumes, CVs, SSNs, bank details, IDs, private addresses, private phone numbers, or private applicant packets in public comments.</p><div className="button-row"><Link className="button-link" to="/work-with-elysia-ecobotics">Open Work With private intake</Link><Link className="button-link" to={postsPath}>Browse public Job Posts</Link></div></section>}
    {mode === "posts" && <section className="section-card commune-feed" id="commune-room-feed">
      <div className="section-heading section-heading--inline">
        <div>
          <p className="eyebrow">{type.name} Posts</p>
          <h2>{roomPosts.length ? `${roomPosts.length} published item${roomPosts.length === 1 ? "" : "s"}` : `No published ${type.name} posts yet`}</h2>
          <p className="boundary-note">This room follows the Commune model: room posts become threads, and replies appear after moderation.</p>
        </div>
        <div className="button-row"><Link className="button-link" to={hubPath}>Back to {type.name}</Link>{canOpenComposer && <Link className="button-link button-link--primary" to={createPath}>{createLabel}</Link>}</div>
      </div>
      {roomPosts.length ? <div className="commune-feed-grid">{roomPosts.map((post) => <PostCard key={post.id} post={post} saved={savedPostIds.includes(post.id)} onSave={onSave} signedIn={signedIn} officialUpdate={officialByPostId.get(post.id)} troubleshooting={troubleshootingByPostId.get(post.id)} jobPost={jobByPostId.get(post.id)} researchNote={researchByPostId.get(post.id)} communityVote={voteByPostId.get(post.id)} />)}</div> : <p className="commune-empty-state">Published posts will appear here after moderation. Start with a careful draft when you are ready.</p>}
    </section>}
    {type.backendValue === "repository_showcase" && mode === "hub" && <section className="section-card commune-repo-card"><p className="eyebrow">Repository Showcase</p><h2>Metadata only, never execution</h2><p>A public repo is not automatically safe, compatible, licensed, or free of secrets. The website does not fetch, clone, build, run, or validate repositories from this room. Developer Forge and Marketplace approval remain separate from showcase posts.</p><div className="button-row"><Link className="button-link button-link--primary" to={createPath}>Open repository showcase form</Link><Link className="button-link" to="/commune/repository-showcase/sandbox-request">Review selected repository artifact</Link></div></section>}
    {mode === "hub" && type.backendValue === "code_sharing" && <section className="section-card commune-sandbox-card coding-cornucopia-tools"><p className="eyebrow">Coding Cornucopia Tools</p><h2>Collaborative code review, snapshots, diagnostics, and sandbox-gated runs.</h2><p>Shared code is public knowledge, not automatic trust. The browser page never executes snippets; configured sandbox runs use explicit snapshots, network-disabled containers, resource limits, and audit records.</p><StatusBadges labels={["CodeMirror editor", "Static diagnostics", "Snapshot runs", "No terminal", "No package install", "Marketplace separate"]} /><div className="button-row"><Link className="button-link" to="/commune/coding-cornucopia/review">Open Coding Workbench</Link><Link className="button-link" to="/commune/coding-cornucopia/sandbox-request">Prepare Sandbox Review Request</Link></div></section>}
    {mode === "hub" && type.backendValue === "official_update" && <section className="section-card"><p className="eyebrow">Official Updates</p><h2>{isAdmin ? "Administrator authoring enabled" : "Read-only for community members"}</h2><p>Official release, security, roadmap, and governance notices are restricted to authorized Elysia Ecobotics administrators. Community users cannot self-assign official publishing authority.</p></section>}
    {mode === "composer" && <div id="commune-room-composer">
      <section className="section-card commune-room-composer-shell">
        <div className="section-heading section-heading--inline">
          <div>
            <p className="eyebrow">{type.name} composer</p>
            <h2>{createLabel}</h2>
            <p className="boundary-note">This page keeps the complete current room-specific composer, draft controls, exports, validation, moderation behavior, and role gates for {type.name}.</p>
          </div>
          <div className="button-row"><Link className="button-link" to={hubPath}>Back to {type.name}</Link><Link className="button-link" to={postsPath}>Browse posts</Link></div>
        </div>
      </section>
      {composer()}
    </div>}
  </>;
}

function useCommuneLoad(roomSlug?: string, postId?: string, postType?: CommunePostType) {
  const [state, setState] = useState({ rooms: [] as CommuneRoom[], posts: [] as CommunePost[], comments: [] as CommuneComment[], threads: [] as CommuneThread[], media: [] as CommuneMediaAttachment[], troubleshootingPosts: [] as TroubleshootingMetadata[], jobPosts: [] as JobPostMetadata[], researchNotes: [] as ResearchNotesMetadata[], repositoryShowcases: [] as RepositoryShowcaseMetadata[], iterationShowcases: [] as ElysiaIterationShowcaseMetadata[], officialUpdates: [] as OfficialUpdateMetadata[], officialCodeSnippets: [] as OfficialUpdateCodeSnippet[], votePosts: [] as CommunityVoteView[], savedPostIds: [] as string[], followedThreadIds: [] as string[], signedIn: false, userId: null as string | null, isAdmin: false, isModerator: false, accountReady: false });
  const refresh = useCallback(async () => {
    const result = await loadCommuneData(roomSlug, postId, postType);
    logCommuneDiagnostics("load", [...result.account.warnings, ...result.warnings]);
    setState({ rooms: result.rooms, posts: result.posts, comments: result.comments, threads: result.threads, media: result.media, troubleshootingPosts: result.troubleshootingPosts, jobPosts: result.jobPosts, researchNotes: result.researchNotes, repositoryShowcases: result.repositoryShowcases, iterationShowcases: result.iterationShowcases, officialUpdates: result.officialUpdates, officialCodeSnippets: result.officialCodeSnippets, votePosts: result.votePosts, savedPostIds: result.savedPostIds, followedThreadIds: result.followedThreadIds, signedIn: result.account.signedIn, userId: result.account.userId, isAdmin: result.account.isAdmin, isModerator: result.account.isModerator, accountReady: !result.warnings.some(isBackendDiagnostic) });
  }, [roomSlug, postId, postType]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { state, refresh };
}

function useLocalDraftState() {
  const [postDrafts, setPostDrafts] = useState<PostDraft[]>(() => readStorage(storageKeys.postDrafts, []));
  const [postRequests, setPostRequests] = useState<PostDraft[]>(() => readStorage(storageKeys.postRequests, []));
  const [repoDrafts, setRepoDrafts] = useState<RepoShowcaseDraft[]>(() => readStorage(storageKeys.repoShowcaseDrafts, []));
  const [iterationDrafts, setIterationDrafts] = useState<IterationShowcaseDraft[]>(() => readStorage(storageKeys.iterationShowcaseDrafts, []));
  const [sandboxDrafts, setSandboxDrafts] = useState<SandboxRequestDraft[]>(() => readStorage(storageKeys.sandboxRequestDrafts, []));

  return {
    postDrafts,
    postRequests,
    repoDrafts,
    iterationDrafts,
    sandboxDrafts,
    updatePostDrafts(next: PostDraft[]) { setPostDrafts(next); writeStorage(storageKeys.postDrafts, next); },
    updatePostRequests(next: PostDraft[]) { setPostRequests(next); writeStorage(storageKeys.postRequests, next); },
    updateRepoDrafts(next: RepoShowcaseDraft[]) { setRepoDrafts(next); writeStorage(storageKeys.repoShowcaseDrafts, next); },
    updateIterationDrafts(next: IterationShowcaseDraft[]) { setIterationDrafts(next); writeStorage(storageKeys.iterationShowcaseDrafts, next); },
    updateSandboxDrafts(next: SandboxRequestDraft[]) { setSandboxDrafts(next); writeStorage(storageKeys.sandboxRequestDrafts, next); }
  };
}

function AccountModePanel({ signedIn, isModerator, accountReady, activeKind }: { signedIn: boolean; isModerator: boolean; accountReady: boolean; activeKind?: string }) {
  return <section className="section-card commune-status-card">
    <p className="eyebrow">Account-backed mode</p>
    <h2>{signedIn ? "Signed in community actions available" : "Public read mode"}</h2>
    <p>{signedIn ? "You can submit posts/comments for moderation, save posts, follow threads, upload safe attachments privately for review, and report content when account-backed tables are active." : "Signed-out users can see published public posts and use local draft/export tools. Sign in to submit posts, comments, saves, follows, reports, or uploads."}</p>
    {!accountReady && <p className="boundary-note">Some signed-in community actions may be unavailable in this session. Local draft and export tools remain available.</p>}
    <CommuneActionNav activeKind={activeKind} includeModeration={isModerator} />
  </section>;
}

function PostComposer({ defaultType = "media_garden" as CommunePostType, defaultRoomId, troubleshooting = false, localDrafts, categories, onRefresh, isAdmin = false }: { defaultType?: CommunePostType; defaultRoomId?: string; troubleshooting?: boolean; localDrafts: ReturnType<typeof useLocalDraftState>; categories: CommuneCategory[]; onRefresh?: () => Promise<void>; isAdmin?: boolean }) {
  const [form, setForm] = useState({
    postType: defaultType,
    categorySlug: categories[0]?.slug ?? "general",
    roomId: defaultRoomId || "",
    title: "",
    summary: "",
    body: "",
    tags: "",
    links: "",
    repositoryUrl: "",
    os: "",
    browser: "",
    version: "",
    environmentNotes: "",
    stepsTried: "",
    issueType: "",
    affectedArea: "",
    expectedBehavior: "",
    actualBehavior: "",
    errorMessage: "",
    redactedLogs: "",
    workaround: "",
    issueStatus: "Open",
    codeLanguage: "",
    codeFileName: "",
    codeText: "",
    introductionType: "",
    collaborationInterest: "",
    roleInterest: "",
    projectCircle: "",
    involvementLevel: "",
    publicContactPreference: "",
    communityBoundary: "",
    roleTitle: "",
    organizationProject: "",
    roleType: "paid_role",
    payStatus: "must_clarify",
    compensationClarity: "",
    locationMode: "unspecified",
    locationDetails: "",
    timeCommitment: "",
    deadline: "",
    contactPath: "",
    requirementsSkills: "",
    jobSafetyNotes: "",
    jobRoleSummary: "",
    jobApplicationStatus: "open" as JobPostApplicationStatus,
    jobAntiScamReviewStatus: "not_reviewed" as JobPostAntiScamReviewStatus,
    jobWorkWithLinkEnabled: true,
    jobPrivateApplicationNote: "",
    jobPublicCorrectionNote: "",
    researchQuestion: "",
    citationNotes: "",
    evidenceSummary: "",
    observation: "",
    interpretation: "",
    uncertainty: "",
    evidenceStrength: "",
    livingLibraryLink: "",
    researchDomain: "",
    researchGeographicScope: "",
    researchEcologicalSubsystem: "",
    researchMethodType: "",
    researchDataType: "",
    researchEthicsNote: "",
    iterationType: "",
    versionLabel: "",
    whatChanged: "",
    whyItMatters: "",
    knownLimitations: "",
    nextStep: "",
    iterationRelatedRepoUrl: "",
    iterationProvider: "",
    iterationBranch: "",
    iterationCommit: "",
    iterationReleaseTag: "",
    iterationPullRequestUrl: "",
    iterationDeveloperForgeLink: "",
    iterationMarketplaceLink: "",
    iterationTestingStatus: "Not tested yet",
    iterationCompatibilityNote: "",
    iterationRiskFlags: [] as string[],
    iterationImportSource: "manual",
    iterationImportedAt: null as string | null,
    iterationImportedMetadata: {} as Record<string, unknown>,
    iterationRedactionNotes: "",
    officialNoticeType: "official_statement" as OfficialUpdateType,
    officialStatus: "published" as OfficialUpdateStatus,
    officialSeverity: "info" as OfficialUpdateSeverity,
    officialAudience: "public",
    officialEffectiveDate: "",
    officialVersion: "",
    officialAffectedSystems: "",
    officialRelatedRoomSlug: "",
    officialRelatedRepoUrl: "",
    officialRelatedMigration: "",
    officialRelatedLinks: "",
    officialKnownLimitations: "",
    officialMigrationRequired: false,
    officialUserActionRequired: "",
    officialPinned: false,
    officialImportant: false,
    officialCommentsEnabled: true,
    officialAuditNote: "",
    officialCodeLanguage: "text",
    officialCodeFileName: "",
    officialCodeContextNote: "",
    officialCodeText: "",
    officialCodeCorrectionNote: "",
    stepsCodeAck: false,
    acknowledgement: false,
    sandboxRequested: false
  });
  const [file, setFile] = useState<File | null>(null);
  const [iterationManifestInput, setIterationManifestInput] = useState("");
  const [iterationImporting, setIterationImporting] = useState(false);
  const submitLabel = form.postType === "official_update" ? "Publish Official Update" : isAdmin ? "Publish as admin" : "Submit for moderation";
  const [message, setMessage] = useState(isAdmin ? "Admins can publish room posts directly. Attachments still follow Commune media safety rules." : "Signed-in users can submit posts for moderation. Local draft/export is available even when backend review is not active.");
  const secretScan = scanCommuneTextForSecrets([
    form.title,
    form.summary,
    form.body,
    form.environmentNotes,
    form.errorMessage,
    form.redactedLogs,
    form.codeFileName,
    form.codeText,
    form.repositoryUrl,
    form.roleTitle,
    form.organizationProject,
    form.roleType,
    form.payStatus,
    form.compensationClarity,
    form.locationMode,
    form.locationDetails,
    form.timeCommitment,
    form.deadline,
    form.contactPath,
    form.requirementsSkills,
    form.jobSafetyNotes,
    form.jobRoleSummary,
    form.jobPrivateApplicationNote,
    form.jobPublicCorrectionNote,
    form.researchQuestion,
    form.citationNotes,
    form.evidenceSummary,
    form.observation,
    form.interpretation,
    form.uncertainty,
    form.livingLibraryLink,
    form.researchDomain,
    form.researchGeographicScope,
    form.researchEcologicalSubsystem,
    form.researchMethodType,
    form.researchDataType,
    form.researchEthicsNote,
    form.iterationRelatedRepoUrl,
    form.iterationPullRequestUrl,
    form.iterationDeveloperForgeLink,
    form.iterationMarketplaceLink,
    form.iterationRedactionNotes,
    form.officialAffectedSystems,
    form.officialRelatedRepoUrl,
    form.officialRelatedMigration,
    form.officialRelatedLinks,
    form.officialKnownLimitations,
    form.officialUserActionRequired,
    form.officialAuditNote,
    form.officialCodeFileName,
    form.officialCodeContextNote,
    form.officialCodeText,
    form.officialCodeCorrectionNote,
    JSON.stringify(form.iterationImportedMetadata ?? {})
  ].join("\n"));
  const fileValidation = file ? validateCommuneMediaFile(file) : null;
  const selectedPostTypeLabel = postTypeOptions.find((type) => type.value === form.postType)?.label ?? form.postType;
  const normalizedTags = parseCommuneTags(form.tags);
  const showTroubleshootingFields = form.postType === "troubleshooting";
  const showCodeFields = supportsCommuneCodeSnippetFields(form.postType);
  const showMediaGardenCodeFields = isMediaGardenVisualCodePost(form.postType);
  const showSandboxCapableCodeFields = isSandboxCapableCodePost(form.postType);
  const showRepositoryField = form.postType === "code_sharing";
  const showAttachmentField = true;
  const showCommunityFields = form.postType === "community_network";
  const showJobFields = form.postType === "job_post";
  const showResearchFields = form.postType === "research_note";
  const showIterationFields = form.postType === "elysia_iteration_showcase";
  const showOfficialFields = form.postType === "official_update";
  const codeSectionTitle = showTroubleshootingFields ? "Code / reproduction snippet optional" : showMediaGardenCodeFields ? "Inert visual code snippet" : "Inert code snippet";
  const codePreviewTitle = showTroubleshootingFields ? "Reproduction snippet preview" : showMediaGardenCodeFields ? "Visual code snippet preview" : inertCodeSnippetLabel(form.codeLanguage);
  const codeSafetyCopy = showTroubleshootingFields
    ? "Code is optional and should be a minimal redacted reproduction. Do not include tokens, API keys, .env files, passwords, private paths, private logs, local Elysia memory, vault data, credentials, account secrets, or private user data."
    : showMediaGardenCodeFields
      ? `${mediaGardenCodeSafetyCopy} ${mediaGardenCodePrivateDataCopy}`
      : "Code is shown for discussion only. Do not run code you do not trust. Visibility is not a trust signal.";

  useEffect(() => {
    setForm((current) => current.postType === defaultType && current.roomId === (defaultRoomId || "") ? current : { ...current, postType: defaultType, roomId: defaultRoomId || "" });
  }, [defaultType, defaultRoomId]);

  function roomNativeBlocks() {
    if (form.postType === "troubleshooting") return [
      sectionBlock("Issue type", form.issueType),
      sectionBlock("Affected area", form.affectedArea),
      sectionBlock("Environment", [`OS: ${form.os}`, `Browser/app: ${form.browser}`, `Elysia version: ${form.version}`].filter((line) => !line.endsWith(": ")).join("\n")),
      sectionBlock("Environment notes", form.environmentNotes),
      sectionBlock("Steps tried / reproduce", form.stepsTried),
      sectionBlock("Expected behavior", form.expectedBehavior),
      sectionBlock("Actual behavior", form.actualBehavior),
      sectionBlock("Error message", form.errorMessage),
      sectionBlock("Redacted logs", form.redactedLogs),
      sectionBlock("Known workaround", form.workaround),
      sectionBlock("Issue status", form.issueStatus)
    ].filter(Boolean);
    if (form.postType === "community_network") return [
      sectionBlock("Introduction type", form.introductionType),
      sectionBlock("Collaboration interest", form.collaborationInterest),
      sectionBlock("Role interest", form.roleInterest),
      sectionBlock("Project circle or topic", form.projectCircle),
      sectionBlock("Availability / involvement level", form.involvementLevel),
      sectionBlock("Public contact preference", form.publicContactPreference),
      sectionBlock("Boundary note", form.communityBoundary)
    ].filter(Boolean);
    if (form.postType === "job_post") return [
      sectionBlock("Role title", form.roleTitle),
      sectionBlock("Organization / project", form.organizationProject),
      sectionBlock("Role type", jobRoleLabel(form.roleType)),
      sectionBlock("Paid / volunteer status", jobPaidStatusLabel(form.payStatus)),
      sectionBlock("Compensation clarity", form.compensationClarity),
      sectionBlock("Location / remote / hybrid", jobLocationModeLabel(form.locationMode)),
      sectionBlock("Location details", form.locationDetails),
      sectionBlock("Time commitment", form.timeCommitment),
      sectionBlock("Deadline", form.deadline),
      sectionBlock("Contact path", form.contactPath),
      sectionBlock("Requirements / skills", form.requirementsSkills),
      sectionBlock("Role summary", form.jobRoleSummary),
      sectionBlock("Application status", jobApplicationStatusLabel(form.jobApplicationStatus)),
      sectionBlock("Anti-scam review", jobAntiScamStatusLabel(form.jobAntiScamReviewStatus)),
      sectionBlock("Work With private application path", "Enabled - private applications/resumes/CVs belong on Work With Elysia Ecobotics, not public Job Post comments."),
      sectionBlock("Job safety notes", form.jobSafetyNotes),
      sectionBlock("Public correction note", form.jobPublicCorrectionNote)
    ].filter(Boolean);
    if (form.postType === "research_note") return [
      sectionBlock("Research question / topic", form.researchQuestion),
      sectionBlock("Source links", form.links),
      sectionBlock("Citation notes", form.citationNotes),
      sectionBlock("Evidence summary", form.evidenceSummary),
      sectionBlock("Observation", form.observation),
      sectionBlock("Interpretation", form.interpretation),
      sectionBlock("Uncertainty", form.uncertainty),
      sectionBlock("Evidence strength / confidence", form.evidenceStrength),
      sectionBlock("Living Library source link", form.livingLibraryLink),
      sectionBlock("Domain", form.researchDomain),
      sectionBlock("Geographic scope", form.researchGeographicScope),
      sectionBlock("Ecological subsystem", researchEcologicalSubsystemOptions.find((option) => option.value === form.researchEcologicalSubsystem)?.label ?? form.researchEcologicalSubsystem),
      sectionBlock("Method type", form.researchMethodType),
      sectionBlock("Data type", form.researchDataType),
      sectionBlock("Ethics / sensitivity note", form.researchEthicsNote)
    ].filter(Boolean);
    if (form.postType === "elysia_iteration_showcase") return [
      sectionBlock("Iteration type", form.iterationType),
      sectionBlock("Version / build label", form.versionLabel),
      sectionBlock("What changed", form.whatChanged),
      sectionBlock("Why it matters", form.whyItMatters),
      sectionBlock("Known limitations", form.knownLimitations),
      sectionBlock("Next step", form.nextStep)
    ].filter(Boolean);
    if (form.postType === "official_update") return [
      sectionBlock("Official notice type", officialUpdateTypeOptions.find((option) => option.value === form.officialNoticeType)?.label ?? form.officialNoticeType),
      sectionBlock("Official status", form.officialStatus),
      sectionBlock("Severity", form.officialSeverity),
      sectionBlock("Audience", form.officialAudience),
      sectionBlock("Effective date", form.officialEffectiveDate),
      sectionBlock("Version / tag", form.officialVersion),
      sectionBlock("Affected systems", form.officialAffectedSystems),
      sectionBlock("Related room", form.officialRelatedRoomSlug),
      sectionBlock("Related repository", form.officialRelatedRepoUrl),
      sectionBlock("Related migration", form.officialRelatedMigration),
      sectionBlock("Related links", form.officialRelatedLinks),
      sectionBlock("Known limitations", form.officialKnownLimitations),
      sectionBlock("Migration required", form.officialMigrationRequired ? "Yes" : "No"),
      sectionBlock("User action required", form.officialUserActionRequired),
      sectionBlock("Priority", [form.officialPinned ? "Pinned" : "", form.officialImportant ? "Important" : "", form.officialCommentsEnabled ? "Comments enabled" : "Comments locked"].filter(Boolean).join(", ")),
      sectionBlock("Correction note", form.officialAuditNote)
    ].filter(Boolean);
    return [];
  }

  function composedBody() {
    const base = form.body.trim();
    const native = roomNativeBlocks();
    return [base, ...native].filter(Boolean).join("\n\n");
  }

  function build(status: CommuneStatus): PostDraft {
    const codeBlock = form.codeText ? ["", `## ${codeSectionTitle} (${inertCodeSnippetLabel(form.codeLanguage)})`, "", "```" + inertCodeSnippetLabel(form.codeLanguage), form.codeText, "```", "", codeSafetyCopy].join("\n") : "";
    const officialCodeBlock = showOfficialFields && form.officialCodeText ? ["", `## Official read-only code (${inertCodeSnippetLabel(form.officialCodeLanguage)})`, "", form.officialCodeContextNote, "", "```" + inertCodeSnippetLabel(form.officialCodeLanguage), form.officialCodeText, "```", "", "Official code is read-only/copy-only. No workbench, sandbox, proposal flow, public editing, or Local Elysia execution is enabled from Official Update."].filter((line) => line !== undefined).join("\n") : "";
    const bodyBase = composedBody();
    const body = `${bodyBase}${codeBlock}${officialCodeBlock}`;
    return {
      id: `${status}-${Date.now()}`,
      postType: postTypeOptions.find((type) => type.value === form.postType)?.label ?? form.postType,
      title: form.title,
      summary: form.summary || body.slice(0, 180),
      body,
      tags: normalizedTags.map(formatCommuneTag).join(", "),
      sourceLinks: [form.links, form.repositoryUrl].filter(Boolean).join(", "),
      licenseNotes: "",
      redactionNotes: troubleshooting ? "Troubleshooting content should be redacted before sharing." : "Room-native public contribution. No private local Elysia data should be included.",
      intendedAudience: "Community review",
      submitterName: "",
      submitterContact: "",
      checklist: Object.fromEntries(routeAcknowledgements.map((item) => [item, form.acknowledgement])) as Record<string, boolean>,
      status,
      createdAt: new Date().toISOString()
    };
  }

  function buildIterationDraft(): IterationShowcaseDraft {
    return {
      id: "iteration-" + Date.now(),
      schemaVersion: "elysia_iteration_showcase_manifest.v1",
      title: form.title,
      summary: form.summary,
      tags: normalizedTags.map(formatCommuneTag).join(", "),
      links: form.links,
      iterationType: form.iterationType,
      versionBuildLabel: form.versionLabel,
      whatChanged: form.whatChanged,
      whyItMatters: form.whyItMatters,
      knownLimitations: form.knownLimitations,
      nextStep: form.nextStep,
      body: form.body,
      relatedRepoUrl: form.iterationRelatedRepoUrl,
      provider: form.iterationProvider,
      branch: form.iterationBranch,
      commitSha: form.iterationCommit,
      releaseTag: form.iterationReleaseTag,
      pullRequestUrl: form.iterationPullRequestUrl,
      developerForgeLink: form.iterationDeveloperForgeLink,
      marketplaceLink: form.iterationMarketplaceLink,
      testingStatus: form.iterationTestingStatus,
      compatibilityNote: form.iterationCompatibilityNote,
      riskFlags: form.iterationRiskFlags,
      importSource: form.iterationImportSource,
      importedAt: form.iterationImportedAt,
      importedMetadata: form.iterationImportedMetadata,
      redactionNotes: form.iterationRedactionNotes,
      createdAt: new Date().toISOString()
    };
  }

  function toggleIterationRisk(label: string) {
    setForm((current) => ({ ...current, iterationRiskFlags: current.iterationRiskFlags.includes(label) ? current.iterationRiskFlags.filter((item) => item !== label) : [...current.iterationRiskFlags, label] }));
  }

  function applyIterationManifestObject(raw: Record<string, unknown>) {
    const encoded = JSON.stringify(raw);
    if (encoded.length > 150000) { setMessage("Iteration manifest is too large. Keep imported metadata under 150 KB."); return; }
    const scan = scanCommuneTextForSecrets(encoded);
    if (scan.blocked) { setMessage("Iteration manifest import blocked because it appears to include private or secret material: " + scan.warnings.join(", ") + "."); return; }
    const stringValue = (...keys: string[]) => keys.map((key) => raw[key]).find((value) => typeof value === "string") as string | undefined;
    const importedRiskFlags = asStringList(raw.risk_flags ?? raw.warnings);
    setForm((current) => ({
      ...current,
      title: stringValue("title") ?? current.title,
      summary: stringValue("summary") ?? current.summary,
      tags: stringValue("tags") ?? current.tags,
      links: stringValue("links") ?? current.links,
      iterationType: stringValue("iteration_type", "iterationType") ?? current.iterationType,
      versionLabel: stringValue("version_build_label", "versionLabel", "version") ?? current.versionLabel,
      whatChanged: stringValue("what_changed", "whatChanged") ?? current.whatChanged,
      whyItMatters: stringValue("why_it_matters", "whyItMatters") ?? current.whyItMatters,
      knownLimitations: stringValue("known_limitations", "knownLimitations") ?? current.knownLimitations,
      nextStep: stringValue("next_step", "nextStep") ?? current.nextStep,
      body: stringValue("body") ?? current.body,
      iterationRelatedRepoUrl: stringValue("related_repo_url", "repoUrl", "repository_url") ?? current.iterationRelatedRepoUrl,
      iterationProvider: stringValue("provider") ?? current.iterationProvider,
      iterationBranch: stringValue("branch", "default_branch") ?? current.iterationBranch,
      iterationCommit: stringValue("commit_sha", "commit") ?? current.iterationCommit,
      iterationReleaseTag: stringValue("release_tag", "releaseTag") ?? current.iterationReleaseTag,
      iterationPullRequestUrl: stringValue("pull_request_url", "pullRequestUrl") ?? current.iterationPullRequestUrl,
      iterationDeveloperForgeLink: stringValue("developer_forge_link", "developerForgeLink") ?? current.iterationDeveloperForgeLink,
      iterationMarketplaceLink: stringValue("marketplace_link", "marketplaceLink") ?? current.iterationMarketplaceLink,
      iterationTestingStatus: stringValue("testing_status", "testingStatus") ?? current.iterationTestingStatus,
      iterationCompatibilityNote: stringValue("compatibility_note", "compatibilityNote") ?? current.iterationCompatibilityNote,
      iterationRiskFlags: importedRiskFlags.length ? importedRiskFlags : current.iterationRiskFlags,
      iterationImportSource: stringValue("import_source") ?? "local_iteration_manifest",
      iterationImportedAt: new Date().toISOString(),
      iterationImportedMetadata: { source_manifest_schema: raw.schema_version ?? "unknown", generated_by: raw.generated_by ?? "manual", generated_at: raw.generated_at ?? null },
      iterationRedactionNotes: stringValue("redaction_notes", "redactionNotes") ?? current.iterationRedactionNotes
    }));
    setMessage("Iteration manifest imported into the draft. Review and redact before publishing; nothing was submitted automatically.");
  }

  function importIterationManifestText(value = iterationManifestInput) {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      applyIterationManifestObject(parsed);
    } catch {
      setMessage("Iteration manifest JSON could not be parsed. Export JSON from this form or use schema_version elysia_iteration_showcase_manifest.v1.");
    }
  }

  function importIterationManifestFile(file?: File | null) {
    if (!file) return;
    if (file.size > 150000) { setMessage("Iteration manifest file is too large. Keep local manifest files under 150 KB."); return; }
    const reader = new FileReader();
    reader.onload = () => { const value = String(reader.result ?? ""); setIterationManifestInput(value); importIterationManifestText(value); };
    reader.readAsText(file);
  }

  async function importIterationGitHubMetadata() {
    const parsed = parsePublicGitHubRepoUrl(form.iterationRelatedRepoUrl);
    if (!parsed) { setMessage("Paste a public GitHub repo, commit, pull request, release, or branch URL. Private repos and GitHub account connection are not supported here."); return; }
    setIterationImporting(true);
    try {
      const url = new URL(form.iterationRelatedRepoUrl.trim());
      const parts = url.pathname.split("/").filter(Boolean);
      const base = "https://api.github.com/repos/" + parsed.owner + "/" + parsed.repo;
      const repoData = await fetch(base, { headers: { accept: "application/vnd.github+json" } }).then((response) => {
        if (!response.ok) throw new Error(response.status === 403 ? "GitHub public API rate limit or access block reached." : "GitHub public metadata request failed with HTTP " + response.status + ".");
        return response.json() as Promise<Record<string, unknown>>;
      });
      const defaultBranch = String(repoData.default_branch ?? "main");
      let branch = defaultBranch;
      let commitSha = "";
      let releaseTag = "";
      let pullRequestUrl = "";
      let importedTitle = String(repoData.name ?? parsed.repo);
      let importedSummary = String(repoData.description ?? "");
      const pathKind = parts[2] ?? "";
      if (pathKind === "commit" && parts[3]) commitSha = parts[3];
      if (pathKind === "pull" && parts[3]) {
        pullRequestUrl = `https://github.com/${parsed.owner}/${parsed.repo}/pull/${parts[3]}`;
        const pr = await fetch(base + "/pulls/" + encodeURIComponent(parts[3]), { headers: { accept: "application/vnd.github+json" } }).then((response) => response.ok ? response.json() as Promise<Record<string, unknown>> : null);
        if (pr) {
          importedTitle = String(pr.title ?? importedTitle);
          importedSummary = String(pr.body ?? importedSummary).slice(0, 2000);
          commitSha = String((pr.head as { sha?: unknown } | undefined)?.sha ?? "");
          branch = String((pr.head as { ref?: unknown } | undefined)?.ref ?? branch);
        }
      }
      if (pathKind === "releases" && parts[3] === "tag" && parts[4]) {
        releaseTag = decodeURIComponent(parts[4]);
        const release = await fetch(base + "/releases/tags/" + encodeURIComponent(releaseTag), { headers: { accept: "application/vnd.github+json" } }).then((response) => response.ok ? response.json() as Promise<Record<string, unknown>> : null);
        if (release) {
          importedTitle = String(release.name ?? releaseTag);
          importedSummary = String(release.body ?? importedSummary).slice(0, 2000);
        }
      }
      if (pathKind === "tree" && parts[3]) branch = decodeURIComponent(parts.slice(3).join("/"));
      const [readmeResult, commitResult, languagesResult] = await Promise.allSettled([
        fetch(base + "/readme", { headers: { accept: "application/vnd.github.raw" } }).then((response) => response.ok ? response.text() : ""),
        fetch(base + "/commits/" + encodeURIComponent(commitSha || branch)),
        fetch(base + "/languages", { headers: { accept: "application/vnd.github+json" } }).then((response) => response.ok ? response.json() as Promise<Record<string, unknown>> : {})
      ]);
      if (!commitSha && commitResult.status === "fulfilled" && commitResult.value.ok) {
        const commitData = await commitResult.value.json() as Record<string, unknown>;
        commitSha = String(commitData.sha ?? "");
      }
      const readme = readmeResult.status === "fulfilled" ? truncateRepositoryText(readmeResult.value, 4000) : "";
      const languages = languagesResult.status === "fulfilled" ? Object.keys(languagesResult.value) : [];
      setForm((current) => ({
        ...current,
        title: current.title || importedTitle,
        summary: current.summary || importedSummary.slice(0, 180),
        iterationRelatedRepoUrl: parsed.cleanUrl,
        iterationProvider: "GitHub",
        iterationBranch: branch,
        iterationCommit: commitSha.slice(0, 40),
        iterationReleaseTag: releaseTag || current.iterationReleaseTag,
        iterationPullRequestUrl: pullRequestUrl || current.iterationPullRequestUrl,
        whatChanged: current.whatChanged || importedSummary || readme.slice(0, 1200),
        iterationRiskFlags: Array.from(new Set([...current.iterationRiskFlags, "Repo metadata unverified"])),
        iterationImportSource: "github_public_api",
        iterationImportedAt: new Date().toISOString(),
        iterationImportedMetadata: {
          github_owner: parsed.owner,
          github_repo: parsed.repo,
          default_branch: defaultBranch,
          primary_language: repoData.language ?? null,
          languages,
          topics: asStringList(repoData.topics),
          stargazers_count: repoData.stargazers_count ?? null,
          pushed_at: repoData.pushed_at ?? null,
          readme_preview: readme
        }
      }));
      setMessage("Imported public GitHub metadata into the iteration draft. Review, redact, and edit before submitting. The site did not clone, install, build, or run the repository.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GitHub public metadata import failed. Manual entry remains available.");
    } finally {
      setIterationImporting(false);
    }
  }

  function saveLocal(status: CommuneStatus) {
    const draft = build(status);
    if (showIterationFields) {
      const iterationDraft = buildIterationDraft();
      localDrafts.updateIterationDrafts([iterationDraft, ...localDrafts.iterationDrafts]);
    }
    if (status === "pending_moderator_review_local") {
      localDrafts.updatePostRequests([draft, ...localDrafts.postRequests]);
      setMessage("Saved locally in this browser as a pending moderator-review draft. Backend review queue is not active yet.");
    } else {
      localDrafts.updatePostDrafts([draft, ...localDrafts.postDrafts]);
      setMessage("Commune post draft saved locally in this browser.");
    }
  }

  async function submit() {
    if (secretScan.blocked) {
      setMessage(`Submission blocked because it appears to include private or secret material: ${secretScan.warnings.join(", ")}. Remove it before submitting.`);
      return;
    }
    if (fileValidation && !fileValidation.ok) {
      setMessage(fileValidation.message);
      return;
    }
    if (form.codeText && !form.stepsCodeAck) {
      setMessage("Acknowledge that code snippets are inert/read-only material and not execution permission before submitting code.");
      return;
    }
    const bodyBase = composedBody();
    if (showOfficialFields) {
      const result = await submitOfficialUpdate({
        title: form.title,
        summary: form.summary,
        body: form.body,
        tags: form.tags,
        links: form.links,
        roomId: form.roomId || defaultRoomId,
        upload: file,
        acknowledgement: form.acknowledgement,
        updateType: form.officialNoticeType,
        officialStatus: form.officialStatus,
        severity: form.officialSeverity,
        audience: form.officialAudience,
        effectiveDate: form.officialEffectiveDate,
        releaseVersion: form.officialVersion,
        affectedSystems: form.officialAffectedSystems,
        relatedRoomSlug: form.officialRelatedRoomSlug,
        relatedRepoUrl: form.officialRelatedRepoUrl,
        relatedMigration: form.officialRelatedMigration,
        relatedLinks: form.officialRelatedLinks,
        knownLimitations: form.officialKnownLimitations,
        migrationRequired: form.officialMigrationRequired,
        userActionRequired: form.officialUserActionRequired,
        pinned: form.officialPinned,
        important: form.officialImportant,
        commentsEnabled: form.officialCommentsEnabled,
        correctionNote: form.officialAuditNote,
        codeSnippets: form.officialCodeText.trim() ? [{ language: form.officialCodeLanguage, fileName: form.officialCodeFileName, codeText: form.officialCodeText, contextNote: form.officialCodeContextNote, correctionNote: form.officialCodeCorrectionNote }] : []
      });
      if (result.ok) {
        setMessage(result.message);
        await onRefresh?.();
        return;
      }
      if (isBackendDiagnostic(result.message)) {
        saveLocal("draft_local");
        setMessage("Saved locally in this browser. Official Update structured backend is not active yet.");
        return;
      }
      setMessage(result.message);
      return;
    }
    if (showIterationFields) {
      const result = await submitIterationShowcase({
        title: form.title,
        summary: form.summary,
        body: bodyBase,
        tags: form.tags,
        links: form.links,
        roomId: form.roomId || defaultRoomId,
        upload: file,
        iterationType: form.iterationType,
        versionBuildLabel: form.versionLabel,
        whatChanged: form.whatChanged,
        whyItMatters: form.whyItMatters,
        knownLimitations: form.knownLimitations,
        nextStep: form.nextStep,
        relatedRepoUrl: form.iterationRelatedRepoUrl,
        provider: form.iterationProvider,
        branch: form.iterationBranch,
        commitSha: form.iterationCommit,
        releaseTag: form.iterationReleaseTag,
        pullRequestUrl: form.iterationPullRequestUrl,
        developerForgeLink: form.iterationDeveloperForgeLink,
        marketplaceLink: form.iterationMarketplaceLink,
        testingStatus: form.iterationTestingStatus,
        compatibilityNote: form.iterationCompatibilityNote,
        riskFlags: form.iterationRiskFlags,
        sandboxRequested: form.sandboxRequested,
        importSource: form.iterationImportSource,
        importedMetadata: form.iterationImportedMetadata,
        importedAt: form.iterationImportedAt,
        redactionNotes: form.iterationRedactionNotes
      });
      if (result.ok) {
        setMessage(result.message);
        await onRefresh?.();
        return;
      }
      if (isBackendDiagnostic(result.message)) {
        saveLocal("pending_moderator_review_local");
        setMessage("Saved locally in this browser. Elysia Iteration Showcase structured backend is not active yet.");
        return;
      }
      setMessage(result.message);
      return;
    }
    if (showJobFields) {
      const result = await submitJobPost({
        title: form.title,
        summary: form.summary,
        body: bodyBase,
        tags: form.tags,
        links: form.links,
        roomId: form.roomId || defaultRoomId,
        upload: file,
        acknowledgement: form.acknowledgement,
        roleTitle: form.roleTitle,
        organizationProject: form.organizationProject,
        roleType: form.roleType,
        paidVolunteerStatus: form.payStatus,
        locationMode: form.locationMode,
        locationText: form.locationDetails,
        timeCommitment: form.timeCommitment,
        deadline: form.deadline,
        compensationClarity: form.compensationClarity,
        contactPath: form.contactPath,
        requirementsSkills: form.requirementsSkills,
        safetyNotes: form.jobSafetyNotes,
        roleSummary: form.jobRoleSummary || form.body,
        applicationStatus: form.jobApplicationStatus,
        antiScamReviewStatus: form.jobAntiScamReviewStatus,
        workWithLinkEnabled: form.jobWorkWithLinkEnabled,
        privateApplicationNote: form.jobPrivateApplicationNote,
        publicCorrectionNote: form.jobPublicCorrectionNote
      });
      if (result.ok) {
        setMessage(result.message);
        await onRefresh?.();
        return;
      }
      if (isBackendDiagnostic(result.message)) {
        saveLocal("pending_moderator_review_local");
        setMessage("Saved locally in this browser. Job Post structured backend is not active yet.");
        return;
      }
      setMessage(cleanCommuneMessage(result.message, "Saved locally in this browser. Job Post backend review queue is not active yet."));
      return;
    }
    if (showResearchFields) {
      const result = await submitResearchNotesPost({
        title: form.title,
        summary: form.summary,
        body: bodyBase,
        tags: form.tags,
        links: form.links,
        roomId: form.roomId || defaultRoomId,
        upload: file,
        acknowledgement: form.acknowledgement,
        researchQuestion: form.researchQuestion,
        domain: form.researchDomain,
        evidenceStrength: form.evidenceStrength,
        livingLibrarySourceLink: form.livingLibraryLink,
        citationNotes: form.citationNotes,
        evidenceSummary: form.evidenceSummary,
        observation: form.observation,
        interpretation: form.interpretation,
        uncertainty: form.uncertainty,
        contextDiscussion: form.body,
        geographicScope: form.researchGeographicScope,
        ecologicalSubsystem: form.researchEcologicalSubsystem,
        methodType: form.researchMethodType,
        dataType: form.researchDataType,
        ethicsNote: form.researchEthicsNote
      });
      if (result.ok) {
        setMessage(result.message);
        await onRefresh?.();
        return;
      }
      if (isBackendDiagnostic(result.message)) {
        saveLocal("pending_moderator_review_local");
        setMessage("Saved locally in this browser. Research Notes structured backend is not active yet.");
        return;
      }
      setMessage(cleanCommuneMessage(result.message, "Saved locally in this browser. Research Notes backend review queue is not active yet."));
      return;
    }
    if (showTroubleshootingFields) {
      const body = form.codeText ? `${bodyBase}\n\nCode/reproduction snippet attached separately for inert display and governed sandbox diagnostics.` : bodyBase;
      const result = await submitTroubleshootingPost({
        title: form.title,
        summary: form.summary,
        body,
        tags: form.tags,
        links: form.links,
        roomId: form.roomId || defaultRoomId,
        upload: file,
        acknowledgement: form.acknowledgement,
        issueType: form.issueType,
        affectedArea: form.affectedArea,
        environmentOs: form.os,
        environmentBrowser: form.browser,
        appVersion: form.version,
        environmentNotes: form.environmentNotes,
        stepsToReproduce: form.stepsTried,
        expectedResult: form.expectedBehavior,
        actualResult: form.actualBehavior,
        errorMessage: form.errorMessage,
        redactedLogs: form.redactedLogs,
        workaround: form.workaround,
        troubleshootingStatus: form.issueStatus,
        codeText: form.codeText,
        codeLanguage: form.codeLanguage,
        codeFileName: form.codeFileName,
        codeAcknowledged: form.stepsCodeAck
      });
      if (result.ok) {
        setMessage(result.message);
        await onRefresh?.();
        return;
      }
      if (isBackendDiagnostic(result.message)) {
        saveLocal("pending_moderator_review_local");
        setMessage("Saved locally in this browser. Troubleshooting Grove structured backend is not active yet.");
        return;
      }
      setMessage(cleanCommuneMessage(result.message, "Saved locally in this browser. Troubleshooting Grove backend review queue is not active yet."));
      return;
    }
    const body = form.codeText ? `${bodyBase}\n\nCode snippet attached separately for inert display.` : bodyBase;
    const result = await submitCommunePost({ ...form, body, roomId: form.roomId || defaultRoomId, upload: file, sandboxRequested: form.sandboxRequested });
    if (result.ok) {
      if (form.codeText && result.postId) {
        const snippet = await createCodeSnippet({ postId: result.postId, language: form.codeLanguage, fileName: form.codeFileName, codeText: form.codeText, sandboxAcknowledged: form.stepsCodeAck });
        setMessage(`${result.message} ${snippet.message}`);
      } else {
      setMessage(result.message);
      }
      await onRefresh?.();
      return;
    }
    if (isBackendDiagnostic(result.message)) {
      saveLocal("pending_moderator_review_local");
      setMessage("Saved locally in this browser. Backend review queue is not active yet.");
      return;
    }
    setMessage(cleanCommuneMessage(result.message, "Saved locally in this browser. Backend review queue is not active yet."));
  }

  return <section className="section-card commune-composer-card commune-draft-desk" id="commune-post-composer">
    <p className="eyebrow">Room post request</p>
    <h2>{showOfficialFields ? "Publish an Official Update" : `Create a ${selectedPostTypeLabel} post`}</h2>
    <p className="boundary-note">Uploads are part of Elysia Ecobotics Online, not private local Elysia. Do not upload private local Elysia memory, logs, vault data, credentials, .env files, API keys, identity documents, or unredacted sensitive information.</p>
    <p className="boundary-note">Posting in: {selectedPostTypeLabel}</p>
    {isAdmin && <p className="boundary-note">Admin mode: this room post will publish directly. Attachment uploads still use the Commune media safety policy.</p>}
    {showOfficialFields && <><p className="boundary-note">Official Updates are administrator-authored public notices. Community users cannot self-assign official release, security, roadmap, or governance authority.</p><p className="boundary-note">Official Update composer: Community members can read and report Official Updates, but cannot submit, self-assign, or impersonate official authority.</p></>}
    <div className="commune-form-grid">
      <label><span>Title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label><span>Summary</span><input value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
      <label><span>Tags</span><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Add tags like #wetlands, #qgis, local-ai" /></label>
      <label><span>Links</span><input value={form.links} onChange={(event) => setForm({ ...form, links: event.target.value })} /></label>
      {showRepositoryField && <label><span>Repository URL optional</span><input value={form.repositoryUrl} onChange={(event) => setForm({ ...form, repositoryUrl: event.target.value })} /></label>}
      {showAttachmentField && <><label><span>Attachment optional</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><p className="boundary-note">Supported attachments: PNG, JPEG, WebP, PDF, TXT, Markdown, CSV, and JSON. Images are supported now. Video uploads are not enabled for this room yet. Video support is planned.</p>{showOfficialFields && <p className="boundary-note">Official attachments must not expose private admin pages, Supabase keys, service-role keys, .env files, local paths, private user data, hidden moderator notes, credentials, logs, vaults, or local Elysia data.</p>}</>}
      {showTroubleshootingFields && <><label><span>Issue type</span><input value={form.issueType} onChange={(event) => setForm({ ...form, issueType: event.target.value })} placeholder="bug, install issue, known issue, workaround" /></label><label><span>Affected area</span><input value={form.affectedArea} onChange={(event) => setForm({ ...form, affectedArea: event.target.value })} /></label><label><span>OS</span><input value={form.os} onChange={(event) => setForm({ ...form, os: event.target.value })} /></label><label><span>Browser/app</span><input value={form.browser} onChange={(event) => setForm({ ...form, browser: event.target.value })} /></label><label><span>Elysia version optional</span><input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} /></label><label><span>Status</span><select value={form.issueStatus} onChange={(event) => setForm({ ...form, issueStatus: event.target.value })}>{["Open", "Needs information", "In progress", "Workaround found", "Fix proposed", "Resolved", "Closed", "Archived"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="wide-field"><span>Environment notes</span><textarea rows={3} value={form.environmentNotes} onChange={(event) => setForm({ ...form, environmentNotes: event.target.value })} placeholder="Public-safe version/build context only. No private machine inventories or local paths." /></label><label className="wide-field"><span>Steps to reproduce / tried</span><textarea rows={4} value={form.stepsTried} onChange={(event) => setForm({ ...form, stepsTried: event.target.value })} /></label><label className="wide-field"><span>Expected behavior</span><textarea rows={3} value={form.expectedBehavior} onChange={(event) => setForm({ ...form, expectedBehavior: event.target.value })} /></label><label className="wide-field"><span>Actual behavior</span><textarea rows={3} value={form.actualBehavior} onChange={(event) => setForm({ ...form, actualBehavior: event.target.value })} /></label><label className="wide-field"><span>Error message</span><textarea rows={3} value={form.errorMessage} onChange={(event) => setForm({ ...form, errorMessage: event.target.value })} placeholder="Paste only the public-safe error message. Redact tokens, paths, emails, IDs, and account data." /></label><label className="wide-field"><span>Redacted logs</span><textarea rows={4} value={form.redactedLogs} onChange={(event) => setForm({ ...form, redactedLogs: event.target.value })} placeholder="Logs must be redacted. No .env, credentials, API keys, local Elysia memory/logs/vaults, or private user data." /></label><label className="wide-field"><span>Known workaround</span><textarea rows={3} value={form.workaround} onChange={(event) => setForm({ ...form, workaround: event.target.value })} /></label><p className="wide-field boundary-note">Troubleshooting Grove is public support context. Redact logs, screenshots, private paths, account details, credentials, tokens, .env contents, private local Elysia data, and sensitive user/customer data before submitting.</p></>}
      {showCommunityFields && <><label><span>Introduction type</span><input value={form.introductionType} onChange={(event) => setForm({ ...form, introductionType: event.target.value })} placeholder="intro, collaboration, project circle" /></label><label><span>Role interest</span><input value={form.roleInterest} onChange={(event) => setForm({ ...form, roleInterest: event.target.value })} /></label><label><span>Project circle/topic</span><input value={form.projectCircle} onChange={(event) => setForm({ ...form, projectCircle: event.target.value })} /></label><label><span>Availability / involvement level</span><input value={form.involvementLevel} onChange={(event) => setForm({ ...form, involvementLevel: event.target.value })} /></label><label className="wide-field"><span>Collaboration interest</span><textarea rows={4} value={form.collaborationInterest} onChange={(event) => setForm({ ...form, collaborationInterest: event.target.value })} /></label><label className="wide-field"><span>Public contact preference</span><input value={form.publicContactPreference} onChange={(event) => setForm({ ...form, publicContactPreference: event.target.value })} placeholder="public replies, website form, Commons profile link" /></label><label className="wide-field"><span>Boundary note</span><textarea rows={3} value={form.communityBoundary} onChange={(event) => setForm({ ...form, communityBoundary: event.target.value })} placeholder="No private-contact pressure; keep coordination public and respectful." /></label></>}
      {showJobFields && <>
        <label><span>Role title</span><input value={form.roleTitle} onChange={(event) => setForm({ ...form, roleTitle: event.target.value })} /></label>
        <label><span>Organization / project</span><input value={form.organizationProject} onChange={(event) => setForm({ ...form, organizationProject: event.target.value })} /></label>
        <label><span>Role type</span><select value={form.roleType} onChange={(event) => setForm({ ...form, roleType: event.target.value })}>{jobRoleTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Paid / volunteer status</span><select value={form.payStatus} onChange={(event) => setForm({ ...form, payStatus: event.target.value })}>{jobPaidStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Location / remote / hybrid</span><select value={form.locationMode} onChange={(event) => setForm({ ...form, locationMode: event.target.value })}>{jobLocationModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Time commitment</span><input value={form.timeCommitment} onChange={(event) => setForm({ ...form, timeCommitment: event.target.value })} /></label>
        <label><span>Deadline</span><input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label>
        <label className="wide-field"><span>Location details</span><input value={form.locationDetails} onChange={(event) => setForm({ ...form, locationDetails: event.target.value })} placeholder="Public-safe city/region, remote time zone, field area, or clarify if unknown" /></label>
        <label className="wide-field"><span>Role summary</span><textarea rows={4} value={form.jobRoleSummary} onChange={(event) => setForm({ ...form, jobRoleSummary: event.target.value })} placeholder="Summarize the role or public opportunity without requesting private applicant data." /></label>
        <label className="wide-field"><span>Compensation clarity</span><textarea rows={3} value={form.compensationClarity} onChange={(event) => setForm({ ...form, compensationClarity: event.target.value })} placeholder="Pay/range/stipend/volunteer clarity is required before public approval." /></label>
        <label className="wide-field"><span>Contact / application path</span><input value={form.contactPath} onChange={(event) => setForm({ ...form, contactPath: event.target.value })} placeholder="Public application/contact path; no SSNs, bank details, IDs, resumes/CVs, or private details in comments" /></label>
        <label className="wide-field"><span>Requirements / skills</span><textarea rows={4} value={form.requirementsSkills} onChange={(event) => setForm({ ...form, requirementsSkills: event.target.value })} /></label>
        <label className="wide-field"><span>Safety notes</span><textarea rows={3} value={form.jobSafetyNotes} onChange={(event) => setForm({ ...form, jobSafetyNotes: event.target.value })} placeholder="No SSNs, bank details, identity documents, private addresses, private phone numbers, resumes/CVs, contracts, or private-contact pressure." /></label>
        <p className="wide-field boundary-note">{jobPrivateApplicationSystemNotice}</p>
        {isAdmin && <><label className="wide-field"><span>Admin public-safe application clarification optional</span><input value={form.jobPrivateApplicationNote} onChange={(event) => setForm({ ...form, jobPrivateApplicationNote: event.target.value })} placeholder="Optional public-safe clarification; it does not replace the permanent system warning." /></label><label><span>Application status</span><select value={form.jobApplicationStatus} onChange={(event) => setForm({ ...form, jobApplicationStatus: event.target.value as JobPostApplicationStatus })}>{jobApplicationStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>Anti-scam review</span><select value={form.jobAntiScamReviewStatus} onChange={(event) => setForm({ ...form, jobAntiScamReviewStatus: event.target.value as JobPostAntiScamReviewStatus })}>{jobAntiScamStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="wide-field"><span>Public correction / clarification note</span><input value={form.jobPublicCorrectionNote} onChange={(event) => setForm({ ...form, jobPublicCorrectionNote: event.target.value })} placeholder="Public-safe admin clarification if needed" /></label></>}
        <p className="wide-field boundary-note">Job Post is a public opportunity board. Normal users submit for mandatory admin approval before publication. Do not post resumes/CVs, identity documents, SSNs, bank details, tax forms, private addresses, private phone numbers, private application packets, or Work With uploads here.</p>
      </>}
      {showResearchFields && <>
        <label><span>Research question / topic</span><input value={form.researchQuestion} onChange={(event) => setForm({ ...form, researchQuestion: event.target.value })} /></label>
        <label><span>Domain</span><input value={form.researchDomain} onChange={(event) => setForm({ ...form, researchDomain: event.target.value })} placeholder="ecology, robotics, restoration, AI, public policy" /></label>
        <label><span>Evidence strength / confidence</span><select value={form.evidenceStrength} onChange={(event) => setForm({ ...form, evidenceStrength: event.target.value })}><option value="">Select strength</option>{researchEvidenceStrengthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Ecological subsystem</span><select value={form.researchEcologicalSubsystem} onChange={(event) => setForm({ ...form, researchEcologicalSubsystem: event.target.value })}>{researchEcologicalSubsystemOptions.map((option) => <option key={option.value || "none"} value={option.value}>{option.label}</option>)}</select></label>
        <label className="wide-field"><span>Living Library source link</span><input value={form.livingLibraryLink} onChange={(event) => setForm({ ...form, livingLibraryLink: event.target.value })} placeholder="Public HTTPS source URL only" /></label>
        <label><span>Geographic scope</span><input value={form.researchGeographicScope} onChange={(event) => setForm({ ...form, researchGeographicScope: event.target.value })} placeholder="Broad public-safe region only; avoid sensitive locations" /></label>
        <label><span>Method type</span><input value={form.researchMethodType} onChange={(event) => setForm({ ...form, researchMethodType: event.target.value })} placeholder="field note, literature review, source comparison" /></label>
        <label><span>Data type</span><input value={form.researchDataType} onChange={(event) => setForm({ ...form, researchDataType: event.target.value })} placeholder="observation, citation, dataset summary, mixed" /></label>
        <label className="wide-field"><span>Citation notes</span><textarea rows={3} value={form.citationNotes} onChange={(event) => setForm({ ...form, citationNotes: event.target.value })} placeholder="Cite sources and state what each source supports." /></label>
        <label className="wide-field"><span>Evidence summary</span><textarea rows={4} value={form.evidenceSummary} onChange={(event) => setForm({ ...form, evidenceSummary: event.target.value })} /></label>
        <label className="wide-field"><span>Observation</span><textarea rows={4} value={form.observation} onChange={(event) => setForm({ ...form, observation: event.target.value })} /></label>
        <label className="wide-field"><span>Interpretation</span><textarea rows={4} value={form.interpretation} onChange={(event) => setForm({ ...form, interpretation: event.target.value })} /></label>
        <label className="wide-field"><span>Uncertainty</span><textarea rows={3} value={form.uncertainty} onChange={(event) => setForm({ ...form, uncertainty: event.target.value })} /></label>
        <label className="wide-field"><span>Ethics / sensitivity note</span><textarea rows={3} value={form.researchEthicsNote} onChange={(event) => setForm({ ...form, researchEthicsNote: event.target.value })} placeholder="Note redactions, participant privacy, sensitive ecological location handling, or copyright boundaries." /></label>
        <p className="wide-field boundary-note">Research Notes separate evidence, observation, interpretation, and uncertainty. Do not share private research participant data, sensitive ecological locations, copyrighted full-text papers without rights, private local Elysia data, hidden review notes, credentials, or local paths.</p>
      </>}
      {showIterationFields && <>
        <label><span>Iteration type</span><select value={form.iterationType} onChange={(event) => setForm({ ...form, iterationType: event.target.value })}><option value="">Select type</option>{["UI update", "Feature demo", "Design progress", "Add-on preview", "Version note", "Bug fix", "Documentation update", "Sandbox/diagnostics update", "Marketplace preview", "Developer Forge preview", "Accessibility improvement", "Performance improvement", "Visual design pass"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Version / build label</span><input value={form.versionLabel} onChange={(event) => setForm({ ...form, versionLabel: event.target.value })} /></label>
        <label><span>Testing status</span><select value={form.iterationTestingStatus} onChange={(event) => setForm({ ...form, iterationTestingStatus: event.target.value })}>{["Not tested yet", "Manual browser test planned", "Manual browser test passed", "Sandbox evidence attached", "Needs reviewer feedback", "Blocked / needs migration", "External service required"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Provider</span><select value={form.iterationProvider} onChange={(event) => setForm({ ...form, iterationProvider: event.target.value })}><option value="">Select provider</option>{["GitHub", "GitLab", "Codeberg", "Forgejo", "Local manifest", "Manual", "Other"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="wide-field"><span>What changed</span><textarea rows={4} value={form.whatChanged} onChange={(event) => setForm({ ...form, whatChanged: event.target.value })} /></label>
        <label className="wide-field"><span>Why it matters</span><textarea rows={4} value={form.whyItMatters} onChange={(event) => setForm({ ...form, whyItMatters: event.target.value })} /></label>
        <label className="wide-field"><span>Known limitations</span><textarea rows={3} value={form.knownLimitations} onChange={(event) => setForm({ ...form, knownLimitations: event.target.value })} /></label>
        <label className="wide-field"><span>Next step</span><textarea rows={3} value={form.nextStep} onChange={(event) => setForm({ ...form, nextStep: event.target.value })} /></label>
        <label className="wide-field"><span>Related repo / source URL optional</span><input value={form.iterationRelatedRepoUrl} onChange={(event) => setForm({ ...form, iterationRelatedRepoUrl: event.target.value })} placeholder="https://github.com/owner/repo, commit, pull request, release, or branch URL" /></label>
        <label><span>Branch</span><input value={form.iterationBranch} onChange={(event) => setForm({ ...form, iterationBranch: event.target.value })} /></label>
        <label><span>Commit</span><input value={form.iterationCommit} onChange={(event) => setForm({ ...form, iterationCommit: event.target.value })} /></label>
        <label><span>Release tag</span><input value={form.iterationReleaseTag} onChange={(event) => setForm({ ...form, iterationReleaseTag: event.target.value })} /></label>
        <label><span>Pull request URL</span><input value={form.iterationPullRequestUrl} onChange={(event) => setForm({ ...form, iterationPullRequestUrl: event.target.value })} /></label>
        <label><span>Developer Forge link optional</span><input value={form.iterationDeveloperForgeLink} onChange={(event) => setForm({ ...form, iterationDeveloperForgeLink: event.target.value })} /></label>
        <label><span>Marketplace link optional</span><input value={form.iterationMarketplaceLink} onChange={(event) => setForm({ ...form, iterationMarketplaceLink: event.target.value })} /></label>
        <label className="wide-field"><span>Compatibility note</span><textarea rows={3} value={form.iterationCompatibilityNote} onChange={(event) => setForm({ ...form, iterationCompatibilityNote: event.target.value })} placeholder="Describe compatibility carefully. Do not claim certification or Marketplace readiness." /></label>
        <label className="wide-field"><span>Redaction notes</span><textarea rows={3} value={form.iterationRedactionNotes} onChange={(event) => setForm({ ...form, iterationRedactionNotes: event.target.value })} placeholder="Confirm screenshots, links, and notes were reviewed for private prompts, local paths, credentials, logs, or sealed memory." /></label>
        <label className="checkbox-line wide-field"><input type="checkbox" checked={form.sandboxRequested} onChange={(event) => setForm({ ...form, sandboxRequested: event.target.checked })} /><span>Request Elysia Iteration Showcase selected-artifact sandbox review. This tests only a pasted snippet/config/manifest later; it does not run the full repository.</span></label>
      </>}
      {showOfficialFields && <>
        <label><span>Official notice type</span><select value={form.officialNoticeType} onChange={(event) => setForm({ ...form, officialNoticeType: event.target.value as OfficialUpdateType })}>{officialUpdateTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Official status</span><select value={form.officialStatus} onChange={(event) => setForm({ ...form, officialStatus: event.target.value as OfficialUpdateStatus })}>{officialStatusOptions.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select></label>
        <label><span>Severity</span><select value={form.officialSeverity} onChange={(event) => setForm({ ...form, officialSeverity: event.target.value as OfficialUpdateSeverity })}>{officialSeverityOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span>Audience</span><input value={form.officialAudience} onChange={(event) => setForm({ ...form, officialAudience: event.target.value })} placeholder="public, maintainers, website users" /></label>
        <label><span>Effective date</span><input type="date" value={form.officialEffectiveDate} onChange={(event) => setForm({ ...form, officialEffectiveDate: event.target.value })} /></label>
        <label><span>Version / release tag</span><input value={form.officialVersion} onChange={(event) => setForm({ ...form, officialVersion: event.target.value })} /></label>
        <label className="wide-field"><span>Affected systems / rooms</span><input value={form.officialAffectedSystems} onChange={(event) => setForm({ ...form, officialAffectedSystems: event.target.value })} placeholder="Coding Cornucopia, Commons Circle, Supabase, sandbox runner" /></label>
        <label><span>Related room slug</span><input value={form.officialRelatedRoomSlug} onChange={(event) => setForm({ ...form, officialRelatedRoomSlug: event.target.value })} placeholder="coding-cornucopia, repository-showcase" /></label>
        <label><span>Related migration</span><input value={form.officialRelatedMigration} onChange={(event) => setForm({ ...form, officialRelatedMigration: event.target.value })} /></label>
        <label className="wide-field"><span>Related public repository/reference URL</span><input value={form.officialRelatedRepoUrl} onChange={(event) => setForm({ ...form, officialRelatedRepoUrl: event.target.value })} placeholder="Public HTTPS URL only; no private repos or local paths" /></label>
        <label className="wide-field"><span>Related links</span><textarea rows={3} value={form.officialRelatedLinks} onChange={(event) => setForm({ ...form, officialRelatedLinks: event.target.value })} placeholder="One public URL per line, or Label | https://example.com" /></label>
        <label className="wide-field"><span>Known limitations</span><textarea rows={3} value={form.officialKnownLimitations} onChange={(event) => setForm({ ...form, officialKnownLimitations: event.target.value })} /></label>
        <label className="wide-field"><span>User action required</span><textarea rows={3} value={form.officialUserActionRequired} onChange={(event) => setForm({ ...form, officialUserActionRequired: event.target.value })} /></label>
        <label className="checkbox-line"><input type="checkbox" checked={form.officialMigrationRequired} onChange={(event) => setForm({ ...form, officialMigrationRequired: event.target.checked })} /><span>Migration or manual action required</span></label>
        <label className="checkbox-line"><input type="checkbox" checked={form.officialPinned} onChange={(event) => setForm({ ...form, officialPinned: event.target.checked })} /><span>Pin this notice</span></label>
        <label className="checkbox-line"><input type="checkbox" checked={form.officialImportant} onChange={(event) => setForm({ ...form, officialImportant: event.target.checked })} /><span>Mark as important</span></label>
        <label className="checkbox-line"><input type="checkbox" checked={form.officialCommentsEnabled} onChange={(event) => setForm({ ...form, officialCommentsEnabled: event.target.checked })} /><span>Comments enabled for this official update</span></label>
        <label className="wide-field"><span>Audit-safe note / correction note</span><textarea rows={3} value={form.officialAuditNote} onChange={(event) => setForm({ ...form, officialAuditNote: event.target.value })} placeholder="Public correction/update context if relevant." /></label>
      </>}
      <label className="wide-field"><span>{form.postType === "code_sharing" ? "Discussion / explanation" : showResearchFields ? "Context / discussion" : showJobFields ? "Public details / questions" : "Body"}</span><textarea rows={8} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
      {showCodeFields && <>
        <label><span>Code language</span><select value={normalizeCodingLanguage(form.codeLanguage)} onChange={(event) => setForm({ ...form, codeLanguage: event.target.value })}>{codingLanguageOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Code filename</span><input value={form.codeFileName} onChange={(event) => setForm({ ...form, codeFileName: event.target.value })} placeholder={showTroubleshootingFields ? "reproduction.js, failing-test.py" : showMediaGardenCodeFields ? "visual-snippet.css, shader.glsl" : "snippet.ts"} /></label>
        <label className="wide-field"><span>{codeSectionTitle}</span><CodeWorkspaceEditor value={form.codeText} language={form.codeLanguage} onChange={(value) => setForm({ ...form, codeText: value })} minHeight="260px" /></label>
        <p className="wide-field boundary-note">{codeSafetyCopy}</p>
      </>}
      {showOfficialFields && <>
        <label><span>Official code language</span><select value={normalizeCodingLanguage(form.officialCodeLanguage)} onChange={(event) => setForm({ ...form, officialCodeLanguage: event.target.value })}>{codingLanguageOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Official code filename</span><input value={form.officialCodeFileName} onChange={(event) => setForm({ ...form, officialCodeFileName: event.target.value })} placeholder="migration.sql, config.json, example.ts" /></label>
        <label className="wide-field"><span>Official code context</span><input value={form.officialCodeContextNote} onChange={(event) => setForm({ ...form, officialCodeContextNote: event.target.value })} placeholder="Read-only migration example, API sample, manifest example" /></label>
        <label className="wide-field"><span>Official read-only code snippet</span><CodeWorkspaceEditor value={form.officialCodeText} language={form.officialCodeLanguage} onChange={(value) => setForm({ ...form, officialCodeText: value })} minHeight="260px" /></label>
        <label className="wide-field"><span>Official code correction note</span><input value={form.officialCodeCorrectionNote} onChange={(event) => setForm({ ...form, officialCodeCorrectionNote: event.target.value })} placeholder="Optional public note if this code corrects/supersedes earlier code" /></label>
        <p className="wide-field boundary-note">Official code is public read-only/copy-only. This room never shows Coding Workbench, sandbox runs, proposal flows, public editing, package install, or Local Elysia execution for official code.</p>
      </>}
    </div>
    {showIterationFields && <section className="commune-repo-import-panel">
      <p className="eyebrow">Iteration source import</p>
      <h3>Import public metadata or a local iteration manifest</h3>
      <p className="boundary-note">GitHub import uses public unauthenticated metadata only. There is no GitHub account connection, no private repo import, no clone, no build, no install, and no execution.</p>
      <p className="boundary-note">Local iteration manifest import reads only the JSON file you choose or paste. The website does not inspect local repos, local Elysia files, logs, prompts, vaults, or machine data.</p>
      <div className="button-row"><button type="button" disabled={iterationImporting || !form.iterationRelatedRepoUrl.trim()} onClick={() => void importIterationGitHubMetadata()}>{iterationImporting ? "Importing public metadata..." : "Import public GitHub metadata"}</button><button type="button" onClick={() => setIterationManifestInput(iterationManifestJson(buildIterationDraft()))}>Preview export JSON in import box</button></div>
      <label><span>Paste local iteration manifest JSON</span><textarea rows={5} value={iterationManifestInput} onChange={(event) => setIterationManifestInput(event.target.value)} placeholder="Paste elysia-iteration-showcase.json or exported Iteration Showcase JSON here." /></label>
      <div className="button-row"><button type="button" onClick={() => importIterationManifestText()}>Import pasted manifest</button><label className="button-link"><span>Upload JSON manifest</span><input className="sr-only" type="file" accept="application/json,.json" onChange={(event) => importIterationManifestFile(event.target.files?.[0])} /></label></div>
      <p className="boundary-note">Review and redact imported fields before publishing. Import never submits automatically.</p>
    </section>}
    {showIterationFields && <div className="commune-checklist commune-warning-checks">
      {iterationRiskFlags.map((item) => <label className="checkbox-line" key={item}><input type="checkbox" checked={form.iterationRiskFlags.includes(item)} onChange={() => toggleIterationRisk(item)} /><span>{item}</span></label>)}
    </div>}
    {showIterationFields && <WarningCallout title="Official Update / Forge / Marketplace boundary"><p>Elysia Iteration Showcase is public progress and demo context. It is not an official release, Developer Forge approval, Marketplace readiness, security certification, installability proof, compatibility certification, or production readiness claim.</p></WarningCallout>}
    {showIterationFields && <p className="boundary-note">Screenshot/demo attachments are welcome when public-safe. Do not include private prompts, local paths, credentials, logs, admin screens, sealed memory, .env/API keys, or sensitive account details. Video upload remains planned, not enabled.</p>}
    <p className="boundary-note">Use hashtags, commas, or simple words. Tags help people find posts later.</p>
    <TagChips tags={normalizedTags} />
    {secretScan.warnings.length > 0 && <WarningCallout title="Secret warning"><p>{secretScan.blocked ? "Submission is blocked until private/secret material is removed." : "Review this content carefully before sharing."} Flags: {secretScan.warnings.join(", ")}.</p></WarningCallout>}
    {fileValidation && <p className={fileValidation.ok ? "boundary-note" : "message"}>{fileValidation.message}</p>}
    {form.codeText && <section className="commune-code-preview"><div className="addon-card__topline"><strong>{codePreviewTitle}</strong><span>{form.codeFileName || "snippet"}</span></div><CodeWorkspaceEditor value={form.codeText} language={form.codeLanguage} readOnly minHeight="220px" /><p className="boundary-note">{codeSafetyCopy}</p>{showSandboxCapableCodeFields ? <><p className="boundary-note">Code is inert unless it is sent to the governed sandbox runner. Sandbox success is evidence only, not approval, trust, Marketplace readiness, or permission to run code elsewhere.</p><DiagnosticsList diagnostics={runStaticCodingDiagnostics({ language: form.codeLanguage, fileName: form.codeFileName, code: form.codeText })} /></> : <p className="boundary-note">This Media Garden preview is read-only visual material. No run button, sandbox diagnostics, execution status, proposal flow, or trust label is enabled.</p>}</section>}
    {showOfficialFields && form.officialCodeText && <section className="commune-code-preview commune-official-code-preview"><div className="addon-card__topline"><strong>Official code preview</strong><span>{form.officialCodeFileName || "official-snippet"}</span></div><CodeWorkspaceEditor value={form.officialCodeText} language={form.officialCodeLanguage} readOnly minHeight="220px" /><p className="boundary-note">Official code examples are public read-only/copy-only records. No workbench, sandbox run, proposal, install, deploy, or Local Elysia execution controls are exposed.</p></section>}
    <div className="commune-checklist">{routeAcknowledgements.map((item) => <label className="checkbox-line" key={item}><input type="checkbox" checked={form.acknowledgement} onChange={(event) => setForm({ ...form, acknowledgement: event.target.checked })} /><span>{item}</span></label>)}{showCodeFields && <><label className="checkbox-line"><input type="checkbox" checked={form.stepsCodeAck} onChange={(event) => setForm({ ...form, stepsCodeAck: event.target.checked })} /><span>{showTroubleshootingFields ? "Any troubleshooting code/reproduction snippet is inert redacted text until an explicit sandbox run. It is not execution permission." : showMediaGardenCodeFields ? "Any Media Garden code snippet is visual/read-only material. It is not executed by the website, a trust signal, or execution permission." : "Any code snippet is inert text for discussion only. It is not execution permission."}</span></label>{showSandboxCapableCodeFields && <label className="checkbox-line"><input type="checkbox" checked={form.sandboxRequested} onChange={(event) => setForm({ ...form, sandboxRequested: event.target.checked })} /><span>{showTroubleshootingFields ? "Request sandbox review metadata for this reproduction case. This is not execution permission and does not prove the fix is safe." : "Request sandbox review for repository/code metadata. This is not execution permission."}</span></label>}</>}</div>
    <div className="button-row"><button type="button" className="button-primary" onClick={() => void submit()}>{submitLabel}</button><button type="button" onClick={() => saveLocal("draft_local")}>Save local draft</button>{!showOfficialFields && <button type="button" onClick={() => saveLocal("pending_moderator_review_local")}>Save local request</button>}<button type="button" onClick={() => downloadText(`${slug(form.title)}.md`, postMarkdown(build("draft_local")), "text/markdown")}>Export Markdown</button>{showIterationFields && <button type="button" onClick={() => downloadText(`${slug(form.title)}-iteration-showcase.json`, iterationManifestJson(buildIterationDraft()), "application/json")}>Export JSON</button>}<button type="button" onClick={() => copyText(postMarkdown(build("draft_local")), setMessage)}>Copy Markdown</button><Link className="button-link" to="/commune">Back to Commune</Link></div>
    <p className="message">{message}</p>
  </section>;
}

function RepositoryShowcaseForm({ localDrafts, roomId, onRefresh, isAdmin = false }: { localDrafts: ReturnType<typeof useLocalDraftState>; roomId?: string; onRefresh?: () => Promise<void>; isAdmin?: boolean }) {
  const [form, setForm] = useState({ title: "", repoUrl: "", provider: "GitHub", branch: "", commit: "", license: "", description: "", readmePreview: "", fileTreePreview: "", screenshotNotes: "", manifestStatus: "No manifest checked", compatibility: "Unknown", warnings: [] as string[], sandboxRequested: false, adminGuidancePost: false, importSource: "manual", importedAt: null as string | null, importedMetadata: {} as Record<string, unknown>, redactionNotes: "" });
  const [message, setMessage] = useState("Repository showcases are metadata only. The website does not fetch private repos, clone, build, run, install, or execute repository code.");
  const [manifestInput, setManifestInput] = useState("");
  const [importing, setImporting] = useState(false);
  const adminGuidancePost = isAdmin && form.adminGuidancePost;

  function draft(): RepoShowcaseDraft {
    return { ...form, id: "repo-" + Date.now(), schemaVersion: "repository_showcase_manifest.v1", createdAt: new Date().toISOString() };
  }

  function saveLocal() {
    const next = draft();
    localDrafts.updateRepoDrafts([next, ...localDrafts.repoDrafts]);
    setMessage("Repository showcase draft saved locally. No repository was fetched, cloned, or validated remotely.");
  }

  function repoBody() {
    if (adminGuidancePost) {
      return [
        form.description.trim(),
        sectionBlock("Admin guidance boundary", repositoryShowcaseGuidanceBoundaryCopy),
        sectionBlock("Marketplace and sandbox boundary", "This post explains how to share repositories safely. It does not approve, trust, sign, version, sandbox-approve, or make any repository install-safe."),
        sectionBlock("Template notes", form.readmePreview),
        sectionBlock("Safe sharing checklist", form.fileTreePreview),
        sectionBlock("Redaction notes", form.redactionNotes)
      ].filter(Boolean).join("\n\n");
    }
    return [
      form.description.trim(),
      sectionBlock("Repository URL", form.repoUrl),
      sectionBlock("Provider", form.provider),
      sectionBlock("Branch", form.branch),
      sectionBlock("Commit", form.commit),
      sectionBlock("License notes", form.license),
      sectionBlock("README preview", form.readmePreview),
      sectionBlock("File tree summary", form.fileTreePreview),
      sectionBlock("Screenshots / notes", form.screenshotNotes),
      sectionBlock("Compatibility notes", form.compatibility),
      sectionBlock("Manifest status", form.manifestStatus),
      sectionBlock("Risk warnings", form.warnings.join(", ")),
      sectionBlock("Repository safety boundary", "This showcased repository is not an approved add-on. The website did not fetch, clone, build, run, install, auto-train on, or validate this repository. Developer Forge and Marketplace approval remain separate security, compatibility, licensing, signing, versioning, and review processes.")
    ].filter(Boolean).join("\n\n");
  }

  async function submit() {
    const result = await submitRepositoryShowcase({ repositoryUrl: form.repoUrl, projectName: form.title, projectSummary: form.description || form.readmePreview, roomId, body: repoBody(), tags: adminGuidancePost ? "repository showcase admin guidance template policy" : "repository showcase", links: adminGuidancePost ? "" : form.repoUrl, provider: form.provider, branch: form.branch, commit: form.commit, license: form.license, readmePreview: form.readmePreview, fileTreePreview: form.fileTreePreview, screenshotNotes: form.screenshotNotes, manifestStatus: form.manifestStatus, compatibility: form.compatibility, warnings: form.warnings, sandboxRequested: adminGuidancePost ? false : form.sandboxRequested, importSource: form.importSource, importedMetadata: form.importedMetadata, importedAt: form.importedAt, redactionNotes: form.redactionNotes, adminGuidancePost });
    if (result.ok) {
      setMessage(result.message);
      await onRefresh?.();
    }
    else if (isBackendDiagnostic(result.message)) { saveLocal(); setMessage("Saved locally in this browser. Repository showcase review queue is not active yet."); }
    else setMessage(result.message);
  }

  function toggleWarning(label: string) {
    setForm((current) => ({ ...current, warnings: current.warnings.includes(label) ? current.warnings.filter((item) => item !== label) : [...current.warnings, label] }));
  }

  function applyManifestObject(raw: Record<string, unknown>) {
    const encoded = JSON.stringify(raw);
    if (encoded.length > 150000) { setMessage("Showcase manifest is too large. Keep imported metadata under 150 KB."); return; }
    const scan = scanCommuneTextForSecrets(encoded);
    if (scan.blocked) { setMessage("Manifest import blocked because it appears to include private or secret material: " + scan.warnings.join(", ") + "."); return; }
    const stringValue = (...keys: string[]) => keys.map((key) => raw[key]).find((value) => typeof value === "string") as string | undefined;
    const importedRiskFlags = asStringList(raw.risk_flags ?? raw.warnings);
    setForm((current) => ({
      ...current,
      title: stringValue("project_name", "title") ?? current.title,
      repoUrl: stringValue("repository_url", "repoUrl") ?? current.repoUrl,
      provider: stringValue("provider") ?? current.provider,
      branch: stringValue("branch", "default_branch") ?? current.branch,
      commit: stringValue("commit", "commit_sha") ?? current.commit,
      license: stringValue("license") ?? current.license,
      description: stringValue("short_description", "description", "project_summary") ?? current.description,
      readmePreview: truncateRepositoryText(stringValue("readme_preview", "readmePreview") ?? current.readmePreview),
      fileTreePreview: truncateRepositoryText(stringValue("file_tree_preview", "fileTreePreview") ?? current.fileTreePreview, 9000),
      screenshotNotes: stringValue("screenshot_notes_or_urls", "screenshotNotes") ?? current.screenshotNotes,
      manifestStatus: stringValue("manifest_status", "manifestStatus") ?? current.manifestStatus,
      compatibility: stringValue("elysia_compatibility", "compatibility") ?? current.compatibility,
      warnings: importedRiskFlags.length ? importedRiskFlags : current.warnings,
      importSource: stringValue("import_source") ?? "local_manifest",
      importedAt: new Date().toISOString(),
      importedMetadata: { source_manifest_schema: raw.schema_version ?? "unknown", generated_by: raw.generated_by ?? "manual", generated_at: raw.generated_at ?? null },
      redactionNotes: stringValue("redaction_notes", "redactionNotes") ?? current.redactionNotes
    }));
    setMessage("Showcase manifest imported into the draft. Review and redact before publishing; nothing was submitted automatically.");
  }

  function importManifestText(value = manifestInput) {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      applyManifestObject(parsed);
    } catch {
      setMessage("Showcase manifest JSON could not be parsed. Export JSON from this form or use schema_version repository_showcase_manifest.v1.");
    }
  }

  function importManifestFile(file?: File | null) {
    if (!file) return;
    if (file.size > 150000) { setMessage("Showcase manifest file is too large. Keep local manifest files under 150 KB."); return; }
    const reader = new FileReader();
    reader.onload = () => { const value = String(reader.result ?? ""); setManifestInput(value); importManifestText(value); };
    reader.readAsText(file);
  }

  async function fetchGitHubJson(path: string) {
    const response = await fetch(path, { headers: { accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(response.status === 403 ? "GitHub public API rate limit or access block reached." : "GitHub public metadata request failed with HTTP " + response.status + ".");
    return response.json() as Promise<Record<string, unknown>>;
  }

  async function importGitHubMetadata() {
    const parsed = parsePublicGitHubRepoUrl(form.repoUrl);
    if (!parsed) { setMessage("Paste a public GitHub URL such as https://github.com/owner/repo. Private repos and OAuth import are not supported here."); return; }
    setImporting(true);
    try {
      const base = "https://api.github.com/repos/" + parsed.owner + "/" + parsed.repo;
      const repoData = await fetchGitHubJson(base);
      const defaultBranch = String(repoData.default_branch ?? "main");
      const [readmeResult, treeResult, commitResult, languagesResult] = await Promise.allSettled([
        fetch(base + "/readme", { headers: { accept: "application/vnd.github.raw" } }).then((response) => response.ok ? response.text() : ""),
        fetchGitHubJson(base + "/git/trees/" + encodeURIComponent(defaultBranch) + "?recursive=1"),
        fetchGitHubJson(base + "/commits/" + encodeURIComponent(defaultBranch)),
        fetchGitHubJson(base + "/languages")
      ]);
      const readme = readmeResult.status === "fulfilled" ? truncateRepositoryText(readmeResult.value) : "";
      const treeRows = treeResult.status === "fulfilled" && Array.isArray(treeResult.value.tree)
        ? (treeResult.value.tree as Array<{ path?: string; type?: string; size?: number }>).slice(0, 80).map((item) => (item.type === "tree" ? "dir  " : "file ") + (item.path ?? "") + (typeof item.size === "number" ? " (" + item.size + " bytes)" : "")).join("\n")
        : "";
      const commitSha = commitResult.status === "fulfilled" ? String(commitResult.value.sha ?? "") : "";
      const languages = languagesResult.status === "fulfilled" ? Object.keys(languagesResult.value) : [];
      const license = repoData.license && typeof repoData.license === "object" ? String((repoData.license as { spdx_id?: unknown; name?: unknown }).spdx_id ?? (repoData.license as { name?: unknown }).name ?? "") : "";
      const nextWarnings = new Set(form.warnings);
      if (!license) nextWarnings.add("License unclear");
      if (repoData.private) nextWarnings.add("Private repo source");
      if (repoData.archived) nextWarnings.add("Unknown maintainer");
      setForm((current) => ({
        ...current,
        title: String(repoData.name ?? parsed.repo),
        repoUrl: String(repoData.html_url ?? parsed.cleanUrl),
        provider: "GitHub",
        branch: defaultBranch,
        commit: commitSha.slice(0, 40),
        license: license || current.license,
        description: String(repoData.description ?? current.description ?? ""),
        readmePreview: readme || current.readmePreview,
        fileTreePreview: treeRows || current.fileTreePreview,
        manifestStatus: current.manifestStatus || "No manifest checked",
        compatibility: current.compatibility || "Unknown",
        warnings: Array.from(nextWarnings),
        importSource: "github_public_api",
        importedAt: new Date().toISOString(),
        importedMetadata: {
          github_owner: parsed.owner,
          github_repo: parsed.repo,
          default_branch: defaultBranch,
          topics: asStringList(repoData.topics),
          primary_language: repoData.language ?? null,
          languages,
          stargazers_count: repoData.stargazers_count ?? null,
          forks_count: repoData.forks_count ?? null,
          pushed_at: repoData.pushed_at ?? null
        }
      }));
      setMessage("Imported public GitHub metadata. Review, redact, and edit before submitting. The site did not clone, build, install, or run the repository.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GitHub public metadata import failed. Manual entry remains available.");
    } finally {
      setImporting(false);
    }
  }

  return <section className="section-card commune-repo-card" id="commune-repository-showcase">
    <p className="eyebrow">Repository Showcase</p>
    <h2>{adminGuidancePost ? "Publish Repository Showcase guidance" : "Show a repository without running it"}</h2>
    <p>No repo APIs are called unless you explicitly import public metadata. Nothing is cloned, installed, built, remotely validated, or executed.</p>
    {isAdmin && <p className="boundary-note">Admin mode: this repository showcase can publish directly as a normal Commune post. It still does not imply installability, compatibility, license safety, or trust.</p>}
    {adminGuidancePost && <WarningCallout title="Admin guidance post"><p>{repositoryShowcaseGuidanceBoundaryCopy} This post explains how to share repositories safely, and it does not approve, trust, sign, version, sandbox-approve, or make any repository install-safe.</p></WarningCallout>}
    <section className="commune-repo-import-panel">
      <p className="eyebrow">Import source</p>
      <h3>Import public metadata or a local showcase manifest</h3>
      <p className="boundary-note">Local showcase manifest import/export is for reviewed metadata only; it does not inspect, clone, install, or run local repository files.</p>
      <p className="boundary-note">GitHub import uses public unauthenticated metadata only. There is no GitHub account connection, no private repo import, no clone, no build, and no execution.</p>
      {adminGuidancePost && <p className="boundary-note">Admin guidance mode is not a repository listing, so repository import is not used for publishing this guidance post.</p>}
      <div className="button-row"><button type="button" disabled={adminGuidancePost || importing || !form.repoUrl.trim()} onClick={() => void importGitHubMetadata()}>{importing ? "Importing public metadata..." : "Import public GitHub metadata"}</button><button type="button" onClick={() => setManifestInput(repoManifestJson(draft()))}>Preview export JSON in import box</button></div>
      <label><span>Paste local showcase manifest JSON</span><textarea rows={5} value={manifestInput} onChange={(event) => setManifestInput(event.target.value)} placeholder="Paste elysia-repo-showcase.json or exported Repository Showcase JSON here." /></label>
      <div className="button-row"><button type="button" disabled={adminGuidancePost} onClick={() => importManifestText()}>Import pasted manifest</button><label className={adminGuidancePost ? "button-link is-disabled" : "button-link"}><span>Upload JSON manifest</span><input className="sr-only" type="file" accept="application/json,.json" disabled={adminGuidancePost} onChange={(event) => importManifestFile(event.target.files?.[0])} /></label></div>
      <p className="boundary-note">Local manifest import never inspects your local repository. It only reads the JSON file you choose or paste and requires review before publishing.</p>
    </section>
    <div className={adminGuidancePost ? "commune-form-grid commune-repo-guidance-mode" : "commune-form-grid"}>
      <label className="commune-guidance-essential"><span>{adminGuidancePost ? "Guidance title" : "Showcase title"}</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label><span>{adminGuidancePost ? "Repo URL optional for admin guidance" : "Repo URL"}</span><input value={form.repoUrl} onChange={(event) => setForm({ ...form, repoUrl: event.target.value })} placeholder={adminGuidancePost ? "Leave blank for guidance/template posts" : "https://github.com/owner/repo"} /></label>
      {isAdmin && <label className="checkbox-line wide-field commune-guidance-essential"><input type="checkbox" checked={form.adminGuidancePost} onChange={(event) => setForm({ ...form, adminGuidancePost: event.target.checked, sandboxRequested: event.target.checked ? false : form.sandboxRequested })} /><span>Admin room guidance / template post. Publish as Repository Showcase guidance, not a repository listing.</span></label>}
      <label><span>Provider</span><select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })}>{["GitHub", "GitLab", "Codeberg", "Forgejo", "Uploaded zip later", "Other"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Branch</span><input value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value })} /></label>
      <label><span>Commit</span><input value={form.commit} onChange={(event) => setForm({ ...form, commit: event.target.value })} /></label>
      <label><span>License</span><input value={form.license} onChange={(event) => setForm({ ...form, license: event.target.value })} /></label>
      <label><span>Manifest status</span><select value={form.manifestStatus} onChange={(event) => setForm({ ...form, manifestStatus: event.target.value })}>{["No manifest checked", "Manifest missing", "Manifest present", "Manifest validates locally", "Manifest needs review", "Manifest unsafe/blocklisted"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Elysia compatibility</span><select value={form.compatibility} onChange={(event) => setForm({ ...form, compatibility: event.target.value })}>{["Unknown", "Concept only", "Website/resource only", "Add-on candidate", "Local Elysia compatible, unverified", "Local Elysia compatible, reviewed later", "Not compatible"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="wide-field commune-guidance-essential"><span>{adminGuidancePost ? "Guidance body" : "Short description"}</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} /></label>
      <label className="wide-field"><span>{adminGuidancePost ? "Template notes optional" : "README preview pasted by user or imported publicly"}</span><textarea value={form.readmePreview} onChange={(event) => setForm({ ...form, readmePreview: event.target.value })} rows={5} /></label>
      <label className="wide-field"><span>{adminGuidancePost ? "Safe sharing checklist optional" : "File tree preview pasted by user or imported publicly"}</span><textarea value={form.fileTreePreview} onChange={(event) => setForm({ ...form, fileTreePreview: event.target.value })} rows={5} /></label>
      <label className="wide-field"><span>Screenshot notes or URLs</span><textarea value={form.screenshotNotes} onChange={(event) => setForm({ ...form, screenshotNotes: event.target.value })} rows={3} /></label>
      <label className="wide-field"><span>Redaction notes</span><textarea value={form.redactionNotes} onChange={(event) => setForm({ ...form, redactionNotes: event.target.value })} rows={3} placeholder="Describe what you reviewed or removed before publishing." /></label>
      <label className="checkbox-line wide-field"><input type="checkbox" disabled={adminGuidancePost} checked={!adminGuidancePost && form.sandboxRequested} onChange={(event) => setForm({ ...form, sandboxRequested: event.target.checked })} /><span>{adminGuidancePost ? "Guidance posts cannot request selected-artifact sandbox review." : "Also request Repository Showcase selected-artifact sandbox review. This does not run or trust the whole repository."}</span></label>
    </div>
    <div className="commune-checklist commune-warning-checks">{repoWarnings.map((item) => <label className="checkbox-line" key={item}><input type="checkbox" checked={form.warnings.includes(item)} onChange={() => toggleWarning(item)} /><span>{item}</span></label>)}</div>
    <WarningCallout title="Developer Forge / Marketplace boundary"><p>Repository Showcase is a public presentation and discussion layer. Developer Forge and Marketplace approval remain separate security, compatibility, licensing, manifest, signing, versioning, and review processes.</p></WarningCallout>
    <div className="button-row"><button className="button-primary" type="button" onClick={() => void submit()}>{adminGuidancePost ? "Publish Repository Showcase guidance" : "Submit showcase for review"}</button><button type="button" onClick={saveLocal}>Save showcase draft locally</button><button type="button" onClick={() => downloadText(slug(form.title) + "-repo-showcase.md", repoMarkdown(draft()), "text/markdown")}>Export Markdown</button><button type="button" onClick={() => downloadText(slug(form.title) + "-repo-showcase.json", repoManifestJson(draft()), "application/json")}>Export JSON</button><button type="button" onClick={() => copyText(repoMarkdown(draft()), setMessage)}>Copy showcase Markdown</button><Link className="button-link" to="/commune">Back</Link></div>
    <p className="message">{message}</p>
  </section>;
}

function SandboxDraftPanel({ localDrafts }: { localDrafts: ReturnType<typeof useLocalDraftState> }) {
  const prefill = useMemo(() => readStorage<Partial<SandboxRequestInput> | null>("commune.sandboxHandoffPrefill.v1", null), []);
  const [form, setForm] = useState({
    title: prefill?.title ?? "",
    relatedUrl: "",
    sourceType: prefill?.source_type ?? "manual",
    sourceId: prefill?.source_id ?? prefill?.code_document_id ?? "",
    language: prefill?.language ?? "text",
    codePurpose: prefill?.summary ?? "",
    codeText: prefill?.code_text ?? "",
    expectedCommand: prefill?.expected_command ?? "",
    dependencies: (prefill?.declared_dependencies ?? []).join("\n"),
    networkPolicy: prefill?.declared_network_policy ?? "disabled",
    networkDomains: (prefill?.declared_network_domains ?? []).join("\n"),
    filesystemPolicy: prefill?.declared_filesystem_policy ?? "none",
    fileScopes: (prefill?.declared_file_scopes ?? []).join("\n"),
    cpuLimit: prefill?.requested_cpu_limit ?? "low",
    memoryLimit: prefill?.requested_memory_limit ?? "256 MB",
    timeoutSeconds: String(prefill?.requested_timeout_seconds ?? 10),
    whySandbox: "",
    riskNotes: prefill?.risk_notes ?? ""
  });
  const [acknowledgements, setAcknowledgements] = useState({ noExecution: Boolean(prefill?.user_acknowledged_no_execution), noSecrets: Boolean(prefill?.user_acknowledged_no_secrets), localAuthority: Boolean(prefill?.user_acknowledged_local_elysia_final_authority) });
  const [message, setMessage] = useState("Sandbox requests are metadata only. Reviewer approval can prepare a local handoff bundle, but Local Elysia must revalidate and ask explicit approval before anything runs.");
  const [requests, setRequests] = useState<SandboxRequestRecord[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<SandboxHandoffExport | null>(null);
  const [bundlePreview, setBundlePreview] = useState("");

  const input = useMemo<SandboxRequestInput>(() => ({
    source_type: form.sourceType as SandboxRequestInput["source_type"],
    source_id: form.sourceId || null,
    title: form.title,
    summary: form.codePurpose || form.whySandbox || null,
    language: form.language,
    code_text: form.codeText || null,
    code_document_id: form.sourceType === "commune_code_document" ? form.sourceId || null : null,
    expected_command: form.expectedCommand,
    declared_dependencies: form.dependencies.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
    declared_network_policy: form.networkPolicy as SandboxRequestInput["declared_network_policy"],
    declared_network_domains: sanitizeDeclaredDomains(form.networkDomains),
    declared_filesystem_policy: form.filesystemPolicy as SandboxRequestInput["declared_filesystem_policy"],
    declared_file_scopes: sanitizeDeclaredFileScopes(form.fileScopes),
    requested_cpu_limit: form.cpuLimit,
    requested_memory_limit: form.memoryLimit,
    requested_timeout_seconds: Number(form.timeoutSeconds) || null,
    risk_notes: [form.whySandbox, form.riskNotes].filter(Boolean).join("\n\n"),
    user_acknowledged_no_execution: acknowledgements.noExecution,
    user_acknowledged_no_secrets: acknowledgements.noSecrets,
    user_acknowledged_local_elysia_final_authority: acknowledgements.localAuthority
  }), [form, acknowledgements]);
  const validation = useMemo(() => validateSandboxRequestInput(input), [input]);
  const secretWarnings = useMemo(() => detectSecretLikeSandboxText([form.title, form.relatedUrl, form.codePurpose, form.codeText, form.expectedCommand, form.dependencies, form.networkDomains, form.fileScopes, form.whySandbox, form.riskNotes].join("\n")), [form]);
  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? null;

  const refreshRequests = useCallback(async () => {
    const result = await listMySandboxRequests();
    logCommuneDiagnostics("sandbox-handoff-requests", result.warnings);
    setRequests(result.requests);
  }, []);

  useEffect(() => { void refreshRequests(); }, [refreshRequests]);
  useEffect(() => { if (prefill) window.localStorage.removeItem("commune.sandboxHandoffPrefill.v1"); }, [prefill]);

  function draft(): SandboxRequestDraft {
    return { id: `sandbox-${Date.now()}`, title: form.title, relatedUrl: form.relatedUrl, codePurpose: form.codePurpose, expectedCommand: form.expectedCommand, dependencies: form.dependencies, networkNeeded: form.networkPolicy === "disabled" ? "No" : "Yes", fileAccessNeeded: form.filesystemPolicy === "none" ? "No" : "Yes", estimatedRuntime: `${form.timeoutSeconds}s / ${form.cpuLimit} / ${form.memoryLimit}`, whySandbox: form.whySandbox, riskNotes: form.riskNotes, createdAt: new Date().toISOString() };
  }

  function saveLocal() {
    const next = draft();
    localDrafts.updateSandboxDrafts([next, ...localDrafts.sandboxDrafts]);
    setMessage("Sandbox request draft saved locally. No code was executed and no permission was granted.");
  }

  function summaryMarkdown() {
    return [`# ${form.title || "Sandbox request"}`, "", "This is metadata for review only. The website did not execute code, install dependencies, clone repositories, call Local Elysia, or grant local permissions.", "", `- Source type: ${form.sourceType}`, `- Source id/link: ${form.sourceId || form.relatedUrl || "none"}`, `- Language: ${form.language}`, `- Expected command, metadata only: ${form.expectedCommand || "none"}`, `- Dependencies, names only: ${input.declared_dependencies?.join(", ") || "none"}`, `- Network policy: ${form.networkPolicy}`, `- Network domains: ${input.declared_network_domains?.join(", ") || "none"}`, `- Filesystem policy: ${form.filesystemPolicy}`, `- File scopes: ${input.declared_file_scopes?.join(", ") || "none"}`, `- Requested limits: ${form.cpuLimit}, ${form.memoryLimit}, ${form.timeoutSeconds}s`, "", "## Purpose", form.codePurpose || "Not supplied.", "", "## Risk notes", [form.whySandbox, form.riskNotes].filter(Boolean).join("\n\n") || "Not supplied.", "", "Local Elysia remains the final runtime/sandbox authority and must revalidate before any future execution."].join("\n");
  }

  async function saveAccountDraft() {
    const result = selectedRequest && ["draft", "changes_requested"].includes(selectedRequest.request_status) ? await updateSandboxRequestDraft(selectedRequest.id, input) : await createSandboxRequestDraft(input);
    setMessage(result.message);
    if (result.request) setSelectedRequestId(result.request.id);
    await refreshRequests();
  }

  async function submitAccountRequest() {
    if (!validation.ok) {
      setMessage(`Fix validation errors before submitting: ${validation.errors.map((item) => item.message).join(" ")}`);
      return;
    }
    const draftResult = selectedRequestId ? await updateSandboxRequestDraft(selectedRequestId, input) : await createSandboxRequestDraft(input);
    if (!draftResult.ok || !draftResult.request) {
      if (isBackendDiagnostic(draftResult.message)) { saveLocal(); setMessage("Saved locally in this browser. Sandbox handoff review storage is not active yet."); }
      else setMessage(draftResult.message);
      return;
    }
    const submitResult = await submitSandboxRequest(draftResult.request.id);
    setMessage(submitResult.message);
    setSelectedRequestId(draftResult.request.id);
    await refreshRequests();
  }

  async function previewOrExport(request: SandboxRequestRecord, mode: "preview" | "export") {
    const prepared = mode === "preview" ? await buildLocalHandoffBundle(request).then((result) => result.ok ? { filename: `${slug(request.title)}.elysia-sandbox-request.json`, checksum: result.checksum, json: result.json, bundle: result.bundle, message: "Handoff preview built. This is metadata only; it is not execution approval." } : result) : await exportLocalHandoffBundle(request).then((result) => result.ok && result.export ? { ...result.export, message: result.message } : result);
    if (!("json" in prepared)) { setMessage(prepared.message); return; }
    setHandoff(prepared);
    setBundlePreview(prepared.json);
    setMessage(prepared.message);
    if (mode === "export") downloadText(prepared.filename, prepared.json, "application/json");
  }

  return <section className="section-card commune-sandbox-card" id="commune-sandbox-review">
    <p className="eyebrow">Sandbox Request Draft</p>
    <h2>Prepare a Local Elysia handoff request.</h2>
    <p className="boundary-note">Sandbox requests are metadata only. The website does not execute code, install dependencies, clone repositories, open a terminal, call Local Elysia, or grant local permissions. Approved requests can export a JSON bundle for later Local Elysia import and revalidation.</p>
    <div className="commune-form-grid">
      <label><span>Request title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label><span>Source type</span><select value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value as typeof form.sourceType })}>{["manual", "commune_code_document", "commune_post", "developer_forge_addon", "marketplace_addon_version", "other"].map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select></label>
      <label><span>Source id/link, optional</span><input value={form.sourceId || form.relatedUrl} onChange={(event) => setForm({ ...form, sourceId: event.target.value, relatedUrl: event.target.value })} /></label>
      <label><span>Language</span><input value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} /></label>
      <label><span>Expected command, metadata only</span><input value={form.expectedCommand} onChange={(event) => setForm({ ...form, expectedCommand: event.target.value })} placeholder="Example: python main.py" /></label>
      <label><span>Dependencies, names only</span><input value={form.dependencies} onChange={(event) => setForm({ ...form, dependencies: event.target.value })} placeholder="numpy, requests" /></label>
      <label><span>Network policy</span><select value={form.networkPolicy} onChange={(event) => setForm({ ...form, networkPolicy: event.target.value as typeof form.networkPolicy })}><option value="disabled">disabled</option><option value="declared_domains_only">declared domains only</option><option value="future_review_required">future review required</option></select></label>
      <label><span>Declared domains</span><input value={form.networkDomains} onChange={(event) => setForm({ ...form, networkDomains: event.target.value })} /></label>
      <label><span>Filesystem policy</span><select value={form.filesystemPolicy} onChange={(event) => setForm({ ...form, filesystemPolicy: event.target.value as typeof form.filesystemPolicy })}><option value="none">none</option><option value="temporary_workspace_only">temporary workspace only</option><option value="declared_read_only_inputs">declared read-only inputs</option><option value="future_review_required">future review required</option></select></label>
      <label><span>Declared file scopes</span><input value={form.fileScopes} onChange={(event) => setForm({ ...form, fileScopes: event.target.value })} placeholder="uploaded sample.csv" /></label>
      <label><span>Requested CPU</span><input value={form.cpuLimit} onChange={(event) => setForm({ ...form, cpuLimit: event.target.value })} /></label>
      <label><span>Requested memory</span><input value={form.memoryLimit} onChange={(event) => setForm({ ...form, memoryLimit: event.target.value })} /></label>
      <label><span>Timeout seconds</span><input type="number" min="1" max="300" value={form.timeoutSeconds} onChange={(event) => setForm({ ...form, timeoutSeconds: event.target.value })} /></label>
      <label className="wide-field"><span>Code purpose</span><textarea value={form.codePurpose} onChange={(event) => setForm({ ...form, codePurpose: event.target.value })} rows={4} /></label>
      <label className="wide-field"><span>Code text or linked code summary, optional</span><textarea value={form.codeText} onChange={(event) => setForm({ ...form, codeText: event.target.value })} rows={6} placeholder="Paste only content you intentionally want in a review/export bundle. Do not include secrets." /></label>
      <label className="wide-field"><span>Why sandbox is needed</span><textarea value={form.whySandbox} onChange={(event) => setForm({ ...form, whySandbox: event.target.value })} rows={4} /></label>
      <label className="wide-field"><span>Risk notes</span><textarea value={form.riskNotes} onChange={(event) => setForm({ ...form, riskNotes: event.target.value })} rows={4} /></label>
    </div>
    <div className="commune-checklist commune-warning-checks">
      <label className="checkbox-line"><input type="checkbox" checked={acknowledgements.noExecution} onChange={(event) => setAcknowledgements({ ...acknowledgements, noExecution: event.target.checked })} /><span>I understand the website will not execute this, install dependencies, clone repositories, or call Local Elysia.</span></label>
      <label className="checkbox-line"><input type="checkbox" checked={acknowledgements.noSecrets} onChange={(event) => setAcknowledgements({ ...acknowledgements, noSecrets: event.target.checked })} /><span>I confirm I am not including secrets, credentials, private local Elysia logs, vault data, or private files.</span></label>
      <label className="checkbox-line"><input type="checkbox" checked={acknowledgements.localAuthority} onChange={(event) => setAcknowledgements({ ...acknowledgements, localAuthority: event.target.checked })} /><span>I understand Local Elysia must revalidate and ask explicit local approval before any future execution.</span></label>
    </div>
    {secretWarnings.length > 0 && <WarningCallout title="Secret/private material warning"><p>Remove before saving or submitting: {secretWarnings.join(", ")}.</p></WarningCallout>}
    <section className="commune-report-panel"><h3>Validation</h3><StatusBadges labels={[`risk: ${validation.risk_level}`, validation.ok ? "ready to submit" : "blocked until fixed", "network disabled by default", "filesystem isolated by default"]} />{validation.errors.map((item) => <p className="message" key={item.code}>{item.message}</p>)}{validation.warnings.map((item) => <p className="boundary-note" key={item.code}>{item.message}</p>)}{validation.info.map((item) => <p className="boundary-note" key={item.code}>{item.message}</p>)}</section>
    <div className="button-row"><button className="button-primary" type="button" onClick={() => void submitAccountRequest()}>Submit for review</button><button type="button" onClick={() => void saveAccountDraft()}>Save account draft</button><button type="button" onClick={saveLocal}>Save local draft</button><button type="button" onClick={() => setMessage(validation.ok ? "Validation passed for metadata review. This does not prove safety or grant execution permission." : `Validation blocked: ${validation.errors.map((item) => item.message).join(" ")}`)}>Validate request</button><button type="button" onClick={() => downloadText(`${slug(form.title)}-sandbox-request.md`, summaryMarkdown(), "text/markdown")}>Export Markdown</button><button type="button" onClick={() => downloadText(`${slug(form.title)}-sandbox-request.json`, JSON.stringify(input, null, 2), "application/json")}>Export request JSON</button><button type="button" onClick={() => copyText(summaryMarkdown(), setMessage)}>Copy request summary</button></div>
    <section className="commune-info-grid"><article><h3>My sandbox requests</h3>{!requests.length && <p className="commune-empty-state">No account-backed sandbox requests yet. Local drafts remain available above.</p>}{requests.map((request) => <article className="review-list-item" key={request.id}><strong>{request.title}</strong><StatusBadges labels={[request.request_status, request.review_status, request.handoff_status]} /><p>{request.reviewer_public_feedback ?? "No reviewer feedback yet."}</p><div className="button-row"><button type="button" onClick={() => setSelectedRequestId(request.id)}>Select</button><button type="button" disabled={request.request_status !== "approved_for_local_handoff" || request.review_status !== "approved"} onClick={() => void previewOrExport(request, "preview")}>Preview handoff</button><button type="button" disabled={request.request_status !== "approved_for_local_handoff" || request.review_status !== "approved"} onClick={() => void previewOrExport(request, "export")}>Export for Local Elysia</button></div></article>)}</article><article><h3>Local handoff panel</h3><p className="boundary-note">Export appears only for requests approved for local handoff. This is not an execution result. Local Elysia must revalidate, isolate, and ask explicit approval before running anything.</p>{handoff && <><p><strong>{handoff.filename}</strong></p><p className="boundary-note">SHA-256: {handoff.checksum}</p><div className="button-row"><button type="button" onClick={() => copyText(handoff.json, setMessage)}>Copy handoff JSON</button><button type="button" onClick={() => downloadText(handoff.filename, handoff.json, "application/json")}>Download handoff JSON</button></div></>}{bundlePreview && <pre className="admin-json-preview">{bundlePreview}</pre>}</article></section>
    <p className="message">{message}</p>
  </section>;
}

function RepositoryShowcaseSandboxRequestPanel({ signedIn }: { signedIn: boolean }) {
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const postParam = query.get("post");
  const showcaseParam = query.get("showcase");
  const [showcase, setShowcase] = useState<RepositoryShowcaseMetadata | null>(null);
  const [contextWarnings, setContextWarnings] = useState<string[]>([]);
  const [artifact, setArtifact] = useState({ fileName: "selected-artifact.js", language: "javascript", note: "", code: "" });
  const [message, setMessage] = useState("Repository sandbox review is selected-artifact only. The whole repository is not cloned, installed, built, tested, or trusted.");
  useEffect(() => {
    void loadRepositoryShowcaseForContext({ postId: postParam, showcaseId: showcaseParam }).then((result) => {
      setShowcase(result.showcase);
      setContextWarnings(result.warnings);
    });
  }, [postParam, showcaseParam]);
  const snapshotId = "repo-showcase-artifact-" + (showcase?.id ?? showcaseParam ?? postParam ?? "manual") + "-" + stableSnapshotSuffix([artifact.language, artifact.fileName, artifact.code].join("\n---repository-showcase-artifact---\n"));
  async function requestReviewMetadata() {
    if (!showcase && !postParam) { setMessage("Load or provide a Repository Showcase before creating a sandbox review request."); return; }
    const result = await submitSandboxReview({
      requestTitle: "Repository selected artifact review: " + (showcase?.project_name ?? artifact.fileName ?? "Repository artifact"),
      repositoryUrl: showcase?.repository_url ?? "",
      repositoryShowcaseId: showcase?.id,
      postId: showcase?.post_id ?? postParam ?? undefined,
      scope: "Selected artifact/snippet review only. No full repository clone, install, build, shell, Docker, dependency install, or test command is requested.",
      riskNotes: [artifact.note, "Reviewed artifact: " + (artifact.fileName || "unnamed snippet"), "Not reviewed: full repository clone, dependencies, install scripts, Docker behavior, network behavior, license safety, Marketplace compatibility."].filter(Boolean).join("\n"),
      permissions: []
    });
    setMessage(result.message);
  }
  return <section className="section-card commune-repo-sandbox-request" id="commune-repository-showcase-sandbox-request">
    <p className="eyebrow">Repository Showcase sandbox review</p>
    <h2>Review a selected artifact, not the whole repository</h2>
    <p className="boundary-note">A repository sandbox review does not mean the whole repository was run, trusted, installed, cloned, license-verified, Marketplace-ready, or Elysia-compatible.</p>
    {contextWarnings.length > 0 && <div className="message-stack">{contextWarnings.map((warning) => <p className="message" key={warning}>{warning}</p>)}</div>}
    <section className="commune-info-grid">
      <article className="commune-repo-identity-card"><h3>{showcase?.project_name ?? "Repository Showcase context"}</h3><dl className="mini-facts"><div><dt>Repository</dt><dd>{showcase?.repository_url ?? "Manual selected artifact"}</dd></div><div><dt>Provider</dt><dd>{showcase?.provider ?? showcase?.repository_host ?? "Unknown"}</dd></div><div><dt>Branch</dt><dd>{showcase?.default_branch ?? "Not supplied"}</dd></div><div><dt>Commit</dt><dd>{showcase?.commit_sha ?? "Not supplied"}</dd></div><div><dt>License</dt><dd>{showcase?.license ?? "Not verified"}</dd></div><div><dt>Manifest</dt><dd>{showcase?.manifest_status ?? "No manifest checked"}</dd></div><div><dt>Compatibility</dt><dd>{showcase?.elysia_compatibility ?? "Unknown"}</dd></div></dl>{showcase?.risk_flags?.length ? <StatusBadges labels={showcase.risk_flags} /> : <p className="boundary-note">No risk flags loaded. That is not a safety claim.</p>}</article>
      <WarningCallout title="Selected artifact boundary"><p>Paste only the file or snippet you intentionally want reviewed. Shell remains disabled. Package installs, repo clone, Docker behavior, dependency scripts, network behavior, and full-repo tests are not part of this route.</p></WarningCallout>
    </section>
    <div className="commune-form-grid"><label><span>Artifact filename</span><input value={artifact.fileName} onChange={(event) => setArtifact({ ...artifact, fileName: event.target.value })} /></label><label><span>Language</span><select value={artifact.language} onChange={(event) => setArtifact({ ...artifact, language: event.target.value })}>{codingLanguageOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="wide-field"><span>Review note</span><textarea rows={3} value={artifact.note} onChange={(event) => setArtifact({ ...artifact, note: event.target.value })} placeholder="Describe what this selected artifact is supposed to demonstrate." /></label><label className="wide-field"><span>Selected artifact / snippet</span><textarea rows={8} value={artifact.code} onChange={(event) => setArtifact({ ...artifact, code: event.target.value })} placeholder="Paste one public-safe selected artifact. Do not paste secrets, .env files, private logs, or private local Elysia data." /></label></div>
    <CodeWorkspaceEditor value={artifact.code} language={artifact.language} onChange={(code) => setArtifact({ ...artifact, code })} minHeight="280px" />
    <CodingSandboxRunPanel snapshotId={snapshotId} sourceType="repository_showcase_artifact" sourceId={showcase?.id ?? showcaseParam} postId={showcase?.post_id ?? postParam} language={artifact.language} fileName={artifact.fileName} code={artifact.code} signedIn={signedIn} runLabel="Run selected artifact in sandbox" />
    <div className="button-row"><button type="button" onClick={() => void requestReviewMetadata()}>Create sandbox review request</button><Link className="button-link" to={showcase?.post_id ? "/commune/posts/" + showcase.post_id : "/commune/repository-showcase"}>Back to showcase</Link></div>
    <p className="message">{message}</p>
  </section>;
}

function ElysiaIterationSandboxRequestPanel({ signedIn }: { signedIn: boolean }) {
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const postParam = query.get("post");
  const iterationParam = query.get("iteration");
  const [iteration, setIteration] = useState<ElysiaIterationShowcaseMetadata | null>(null);
  const [contextWarnings, setContextWarnings] = useState<string[]>([]);
  const [artifact, setArtifact] = useState({ fileName: "selected-iteration-artifact.js", language: "javascript", note: "", code: "" });
  const [message, setMessage] = useState("Elysia Iteration Showcase sandbox review is selected-artifact only. The full repo, whole app, local machine, Local Elysia, install scripts, and shell are not run.");
  useEffect(() => {
    void loadIterationShowcaseForContext({ postId: postParam, iterationId: iterationParam }).then((result) => {
      setIteration(result.iteration);
      setContextWarnings(result.warnings);
    });
  }, [postParam, iterationParam]);
  const snapshotId = "iteration-showcase-artifact-" + (iteration?.id ?? iterationParam ?? postParam ?? "manual") + "-" + stableSnapshotSuffix([artifact.language, artifact.fileName, artifact.code].join("\n---elysia-iteration-artifact---\n"));
  async function requestReviewMetadata() {
    if (!iteration && !postParam) { setMessage("Load or provide an Elysia Iteration Showcase before creating a sandbox review request."); return; }
    const result = await requestIterationShowcaseSandboxReview({
      iterationId: iteration?.id ?? iterationParam,
      postId: iteration?.post_id ?? postParam,
      title: iteration?.version_build_label ? `${iteration.iteration_type ?? "Iteration"} ${iteration.version_build_label}` : artifact.fileName,
      relatedRepoUrl: iteration?.related_repo_url,
      artifactFileName: artifact.fileName,
      artifactNote: artifact.note,
      knownLimitations: iteration?.known_limitations
    });
    setMessage(result.message);
  }
  return <section className="section-card commune-repo-sandbox-request commune-iteration-sandbox-request" id="commune-elysia-iteration-showcase-sandbox-request">
    <p className="eyebrow">Elysia Iteration Showcase sandbox review</p>
    <h2>Review one selected artifact from a progress/demo post</h2>
    <p className="boundary-note">This route reviews a pasted snippet, config, manifest, or small public-safe artifact. It does not clone, install, build, run, trust, certify, approve, or publish a whole repository or Elysia iteration.</p>
    {contextWarnings.length > 0 && <div className="message-stack">{contextWarnings.map((warning) => <p className="message" key={warning}>{warning}</p>)}</div>}
    <section className="commune-info-grid">
      <article className="commune-repo-identity-card">
        <h3>{iteration?.iteration_type ?? "Elysia Iteration Showcase context"}</h3>
        <dl className="mini-facts">
          <div><dt>Version/build</dt><dd>{iteration?.version_build_label ?? "Not supplied"}</dd></div>
          <div><dt>Related source</dt><dd>{iteration?.related_repo_url ?? "Manual selected artifact"}</dd></div>
          <div><dt>Provider</dt><dd>{iteration?.provider ?? "Unknown"}</dd></div>
          <div><dt>Branch</dt><dd>{iteration?.branch ?? "Not supplied"}</dd></div>
          <div><dt>Commit</dt><dd>{iteration?.commit_sha ?? "Not supplied"}</dd></div>
          <div><dt>Testing status</dt><dd>{iteration?.testing_status ?? "not_tested"}</dd></div>
        </dl>
        {iteration?.risk_flags?.length ? <StatusBadges labels={iteration.risk_flags} /> : <p className="boundary-note">No risk flags loaded. That is not a safety claim.</p>}
      </article>
      <WarningCallout title="Selected iteration artifact boundary"><p>Paste only the artifact you intentionally want reviewed. Shell, package installs, full-repo tests, network access, local Elysia data, private prompts, logs, vaults, hidden notes, and sealed memory are outside this route.</p></WarningCallout>
    </section>
    <div className="commune-form-grid">
      <label><span>Artifact filename</span><input value={artifact.fileName} onChange={(event) => setArtifact({ ...artifact, fileName: event.target.value })} /></label>
      <label><span>Language</span><select value={artifact.language} onChange={(event) => setArtifact({ ...artifact, language: event.target.value })}>{codingLanguageOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="wide-field"><span>Review note</span><textarea rows={3} value={artifact.note} onChange={(event) => setArtifact({ ...artifact, note: event.target.value })} placeholder="Describe what this selected iteration artifact is supposed to demonstrate." /></label>
      <label className="wide-field"><span>Selected artifact / snippet</span><textarea rows={8} value={artifact.code} onChange={(event) => setArtifact({ ...artifact, code: event.target.value })} placeholder="Paste one public-safe selected artifact. Do not paste secrets, private prompts, .env files, private logs, sealed memory, local Elysia data, or local paths." /></label>
    </div>
    <CodeWorkspaceEditor value={artifact.code} language={artifact.language} onChange={(code) => setArtifact({ ...artifact, code })} minHeight="280px" />
    <CodingSandboxRunPanel snapshotId={snapshotId} sourceType="iteration_showcase_artifact" sourceId={iteration?.id ?? iterationParam} postId={iteration?.post_id ?? postParam} language={artifact.language} fileName={artifact.fileName} code={artifact.code} signedIn={signedIn} runLabel="Run selected iteration artifact in sandbox" />
    <div className="button-row"><button type="button" onClick={() => void requestReviewMetadata()}>Create selected-artifact sandbox review request</button><Link className="button-link" to={iteration?.post_id ? "/commune/posts/" + iteration.post_id : "/commune/elysia-iteration-showcase"}>Back to Elysia Iteration Showcase</Link></div>
    <p className="message">{message}</p>
  </section>;
}

function LocalDraftStudio({ localDrafts, filters }: { localDrafts: ReturnType<typeof useLocalDraftState>; filters: CommuneFilters }) {
  const draftCards = [
    ...localDrafts.postDrafts.map((draft) => ({ id: draft.id, title: draft.title || "Untitled post draft", labels: [draft.status, draft.postType, draft.tags], summary: draft.summary, tags: draft.tags })),
    ...localDrafts.postRequests.map((draft) => ({ id: draft.id, title: draft.title || "Untitled post request", labels: [draft.status, draft.postType, draft.tags], summary: draft.summary, tags: draft.tags })),
    ...localDrafts.repoDrafts.map((draft) => ({ id: draft.id, title: draft.title || "Untitled repo showcase", labels: ["repo showcase draft", draft.provider, draft.manifestStatus, "Repository Showcase"], summary: draft.description })),
    ...localDrafts.iterationDrafts.map((draft) => ({ id: draft.id, title: draft.title || "Untitled iteration showcase", labels: ["iteration showcase draft", draft.iterationType, draft.versionBuildLabel, "Elysia Iteration Showcase"], summary: draft.whatChanged || draft.summary })),
    ...localDrafts.sandboxDrafts.map((draft) => ({ id: draft.id, title: draft.title || "Untitled sandbox request", labels: ["sandbox request draft", `network: ${draft.networkNeeded}`, `files: ${draft.fileAccessNeeded}`], summary: draft.codePurpose }))
  ].filter((draft) => matchesSearch([draft.title, draft.summary, ...draft.labels], filters.search) && matchesStatus(draft.labels, filters.status) && matchesSafety(draft.labels, filters.safety) && (filters.category === "All" || draft.labels.includes(filters.category)));
  const total = localDrafts.postDrafts.length + localDrafts.postRequests.length + localDrafts.repoDrafts.length + localDrafts.iterationDrafts.length + localDrafts.sandboxDrafts.length;
  return <section className="section-card" id="commune-local-drafts">
    <p className="eyebrow">Local drafts and pending review requests</p>
    <h2>Saved in this browser only</h2>
    {total === 0 ? <p>Drafts and post requests saved in this browser will appear here.</p> : null}
    <div className="commune-draft-grid">
      {draftCards.map((draft) => <article key={draft.id}><h3>{draft.title}</h3><StatusBadges labels={draft.labels} /><p>{draft.summary}</p>{"tags" in draft && typeof draft.tags === "string" && <TagChips tags={draft.tags} />}</article>)}
    </div>
    {total > 0 && !draftCards.length && <p className="commune-empty-state">No local drafts match the active filters.</p>}
  </section>;
}

function CommuneSideChannelPanel() {
  return <section className="section-card commune-info-grid">
    <article>
      <p className="eyebrow">Live chat side channel</p>
      <h2>Most community discussion belongs in room posts and replies.</h2>
      <p>Governed realtime chat remains available as a side channel for signed-in public/community conversation. It has no private DMs, no file uploads, and no code execution.</p>
      <Link className="button-link" to="/commune/realtime">Open live room chat</Link>
    </article>
    <article>
      <p className="eyebrow">Code and sandbox paths</p>
      <h2>Coding Cornucopia and sandbox handoff stay focused.</h2>
      <p>Use Coding Cornucopia for inert review documents, manual snapshots, static diagnostics, and governed sandbox requests. The browser page does not install dependencies, clone repositories, open a terminal, or call Local Elysia.</p>
      <div className="button-row"><Link className="button-link" to="/commune/coding-cornucopia/review">Coding workbench</Link><Link className="button-link" to="/commune/coding-cornucopia/sandbox-request">Sandbox request</Link></div>
    </article>
  </section>;
}

function FoundationStatusPanel() {
  return <>
    <section className="section-card commune-info-grid">
      <article>
        <p className="eyebrow">Local mode remains available</p>
        <h2>What works even without account tables</h2>
        <ul><li>Create post drafts.</li><li>Save post requests locally.</li><li>Create repository showcase drafts.</li><li>Request code sandbox as local draft.</li><li>Export drafts as Markdown/JSON.</li></ul>
      </article>
      <article>
        <p className="eyebrow">Live foundation status</p>
        <h2>Account-backed mode when migrations are active</h2>
        <ul><li>Public posts after moderation.</li><li>Comments, saved posts, follows, uploads, and troubleshooting rooms.</li><li>Repository showcases and sandbox review requests.</li><li>Supabase tables, RLS policies, moderator/admin roles, moderation queue, abuse controls, upload policies, and audit logs.</li></ul>
      </article>
    </section>
    <section className="section-card commune-info-grid">
      <article><p className="eyebrow">Canonical account-backed paths</p><h2>Tables this page writes first</h2><div className="commune-badge-row">{["commune_posts", "commune_comments", "commune_threads", "user_saved_commune_posts", "user_followed_commune_threads", "commune_repository_showcases", "commune_research_notes", "commune_sandbox_review_requests", "commune_reports", "commune_media"].map((table) => <span key={table}>{table}</span>)}</div><p>Older compatibility tables are left in place for existing data and admin queues, but new page flows prefer these canonical paths where possible.</p></article>
      <article><p className="eyebrow">Prepared support structures</p><h2>Review and moderation foundations</h2><div className="commune-badge-row">{futureSupportTables.map((table) => <span key={table}>{table}</span>)}</div></article>
    </section>
    <section className="section-card commune-info-grid" id="commune-moderation-doctrine">
      <article><p className="eyebrow">Moderation Doctrine</p><h2>Moderation must handle</h2><p>Spam, harassment, malware, secret leakage, private data exposure, copyright violations, unsafe code, scams/job fraud, impersonation, off-topic floods, AI-generated spam, doxxing, and sensitive ecological location exposure.</p><h3>Available actions/foundations</h3><StatusBadges labels={["report", "hide", "lock thread", "remove post", "request redaction", "mark official", "mark community", "mark unreviewed", "block upload", "security hold", "admin review"]} /><h3>Trust labels</h3><StatusBadges labels={["Official", "Community", "Unreviewed", "Needs redaction", "Security hold", "Resolved", "Archived", "Blocked"]} /></article>
      <article><p className="eyebrow">Media, chat, jobs, and official notices</p><h2>Boundaries for public rooms</h2><p><strong>Media uploads:</strong> not public by default. Public display requires file type limits, size limits, moderation, attribution/copyright prompts, malware scanning where possible, private-data warnings, storage policies, and abuse controls.</p><p><strong>Collaborative rooms and chat:</strong> prepared, not launched. Public write access needs moderation, rate limits, reporting, blocking, room roles, invite controls, retention policy, and no private Elysia memory sharing by default.</p><p><strong>Job posts:</strong> require clear organization/contact, clear role type, clear paid/volunteer status, pay/rate or honest explanation if unpaid, location/remote status, no misleading roles, no sensitive personal data requests in public comments, and scam/moderator review.</p><p><strong>Official Updates:</strong> restricted to authorized Elysia Ecobotics administrators. Community users must not impersonate official release, security, or governance notices.</p><h3>Code/repo labels</h3><StatusBadges labels={["No code execution", "Snippet only", "Repo showcase only", "Manifest present", "Manifest not reviewed", "License unclear", "Sandbox required", "Security review needed", "Blocked"]} /></article>
    </section>
  </>;
}

function codeWorkbenchPath(postType: CommunePostType) {
  return postType === "troubleshooting" ? "/commune/troubleshooting-grove/review" : "/commune/coding-cornucopia/review";
}

function AttachedCodeSnippets({ snippets, authorUsername, signedIn, postType, onMessage }: { snippets: CommuneCodeSnippet[]; authorUsername?: string | null; signedIn: boolean; postType: CommunePostType; onMessage: (message: string) => void }) {
  if (!snippets.length) return null;
  const isTroubleshooting = postType === "troubleshooting";
  const isMediaGarden = isMediaGardenVisualCodePost(postType);
  const sandboxCapable = isSandboxCapableCodePost(postType);
  const workbenchPath = sandboxCapable ? codeWorkbenchPath(postType) : "";
  return <div className="commune-code-section">
    <p className="eyebrow">{isTroubleshooting ? "Code attached for troubleshooting" : isMediaGarden ? "Visual code attached to this Media Garden post" : "Code attached to this post"}</p>
    <p className="commune-media-attribution">{isTroubleshooting ? "Reproduction snippet" : isMediaGarden ? "Visual/read-only code snippet" : "Coding Cornucopia snippet"} attached by {authorLink(authorUsername)}.</p>
    <p className="boundary-note">{isTroubleshooting ? "Troubleshooting code should be a minimal redacted reproduction. Proposed fixes do not overwrite this public snapshot unless the original post author accepts them. Sandbox runs require explicit governed snapshots and do not create trust, approval, or Marketplace readiness." : isMediaGarden ? `${mediaGardenCodeSafetyCopy} ${mediaGardenCodePrivateDataCopy}` : "Code is inert public text. Proposed revisions do not overwrite this public snapshot unless the original post author accepts them. Sandbox runs require explicit governed snapshots and do not create trust, approval, or Marketplace readiness."}</p>
    <div className="commune-code-list">
      {snippets.map((snippet) => <article className="commune-code-preview" key={snippet.id}>
        <div className="addon-card__topline"><strong>{inertCodeSnippetLabel(snippet.language ?? "")}</strong><span>{sandboxCapable ? `${snippet.file_name ?? "snippet"} · current accepted snapshot v${snippet.accepted_version_number ?? 1}` : snippet.file_name ?? "visual snippet"}</span></div>
        {sandboxCapable && snippet.accepted_revision_summary && <p className="boundary-note">Accepted revision: {snippet.accepted_revision_summary}</p>}
        <CodeWorkspaceEditor value={snippet.code_text} language={snippet.language} readOnly minHeight="260px" />
        {sandboxCapable && <DiagnosticsList diagnostics={runStaticCodingDiagnostics({ language: snippet.language, fileName: snippet.file_name, code: snippet.code_text })} />}
        <div className="button-row"><button type="button" onClick={() => copyText(snippet.code_text, onMessage)}>Copy snippet</button>{sandboxCapable && <><Link className="button-link" to={`${workbenchPath}?post=${snippet.post_id}&snippet=${snippet.id}`}>{isTroubleshooting ? "Open troubleshooting workbench" : "Open Coding Workbench"}</Link>{signedIn && <Link className="button-link" to={`${workbenchPath}?post=${snippet.post_id}&snippet=${snippet.id}&mode=propose`}>{isTroubleshooting ? "Propose fix" : "Propose edit"}</Link>}<Link className="button-link" to={`${workbenchPath}?post=${snippet.post_id}&snippet=${snippet.id}&mode=proposals`}>{isTroubleshooting ? "View proposed fixes" : "View proposals"}</Link></>}</div>
        {sandboxCapable && <CodingSandboxRunPanel snapshotId={snippet.accepted_revision_id ?? snippet.id} sourceType="commune_post_snippet" sourceId={snippet.id} postId={snippet.post_id} language={snippet.language ?? "text"} fileName={snippet.file_name} code={snippet.code_text} signedIn={signedIn} runLabel="Run in sandbox" />}
        <p className="boundary-note">{isMediaGarden ? "Media Garden code is shown as visual/read-only material. The website did not execute this snippet, and visibility is not a trust label." : <>Code is shown for discussion only. The website did not execute this snippet. {isTroubleshooting ? "Accepted fixes" : "Accepted revisions"} preserve version history and proposer attribution; rejected proposals leave this public code unchanged.</>}</p>
      </article>)}
    </div>
  </div>;
}

function TroubleshootingResolutionControls({ post, troubleshooting, comments, userId, isModerator, onMessage, onChanged }: { post: CommunePost; troubleshooting?: TroubleshootingMetadata | null; comments: CommuneComment[]; userId?: string | null; isModerator: boolean; onMessage: (message: string) => void; onChanged: () => Promise<void> }) {
  const [status, setStatus] = useState<TroubleshootingStatus>(troubleshooting?.troubleshooting_status ?? "open");
  const [summary, setSummary] = useState(troubleshooting?.accepted_summary ?? "");
  const [resolutionKind, setResolutionKind] = useState<TroubleshootingResolutionKind>(troubleshooting?.accepted_resolution_kind ?? "manual_note");
  const [commentId, setCommentId] = useState(troubleshooting?.accepted_comment_id ?? "");
  const canManage = Boolean(troubleshooting && userId && (isModerator || troubleshooting.author_user_id === userId || post.user_id === userId));
  useEffect(() => {
    setStatus(troubleshooting?.troubleshooting_status ?? "open");
    setSummary(troubleshooting?.accepted_summary ?? "");
    setResolutionKind(troubleshooting?.accepted_resolution_kind ?? "manual_note");
    setCommentId(troubleshooting?.accepted_comment_id ?? "");
  }, [troubleshooting?.accepted_comment_id, troubleshooting?.accepted_resolution_kind, troubleshooting?.accepted_summary, troubleshooting?.troubleshooting_status]);
  if (!troubleshooting) return <p className="boundary-note">This legacy troubleshooting post has no structured sidecar record yet. It still remains public and moderator-governed through the Commune post/thread model.</p>;
  if (!canManage) return <p className="boundary-note">The original poster controls accepted fixes and status changes. Moderators can still enforce safety through moderation controls.</p>;
  async function updateStatusOnly() {
    const result = await updateTroubleshootingStatus({ postId: post.id, status, summary });
    onMessage(cleanCommuneMessage(result.message, "Troubleshooting status could not be updated until the structured workflow migration is active."));
    if (result.ok) await onChanged();
  }
  async function saveResolution() {
    const result = await markTroubleshootingResolved({ postId: post.id, resolutionKind, summary, commentId: commentId || null, status: resolutionKind === "workaround" ? "workaround_found" : "resolved" });
    onMessage(cleanCommuneMessage(result.message, "Troubleshooting resolution could not be saved until the structured workflow migration is active."));
    if (result.ok) await onChanged();
  }
  return <div className="commune-troubleshooting-controls">
    <p className="eyebrow">Author resolution controls</p>
    <p className="boundary-note">Use these controls to record support progress without changing the public reproduction snippet unless a proposed fix is accepted in the workbench. Sandbox success remains evidence, not approval.</p>
    <div className="commune-form-grid">
      <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as TroubleshootingStatus)}>{troubleshootingStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label><span>Accepted resolution kind</span><select value={resolutionKind} onChange={(event) => setResolutionKind(event.target.value as TroubleshootingResolutionKind)}>{troubleshootingResolutionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label><span>Resolved by comment optional</span><select value={commentId} onChange={(event) => setCommentId(event.target.value)}><option value="">No comment selected</option>{comments.map((item) => <option key={item.id} value={item.id}>{(item.body || "Comment").slice(0, 80)}</option>)}</select></label>
      <label className="wide-field"><span>Accepted fix/workaround summary</span><textarea rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Short public summary of the accepted workaround, fix, or requested next step." /></label>
    </div>
    <div className="button-row"><button type="button" onClick={() => void updateStatusOnly()}>Update status</button><button type="button" onClick={() => void saveResolution()}>Record accepted fix/workaround</button></div>
  </div>;
}

function TroubleshootingDetail({ post, troubleshooting, parsedBody, comments, userId, isModerator, onMessage, onChanged }: { post: CommunePost; troubleshooting?: TroubleshootingMetadata | null; parsedBody: ReturnType<typeof splitPostSections>; comments: CommuneComment[]; userId?: string | null; isModerator: boolean; onMessage: (message: string) => void; onChanged: () => Promise<void> }) {
  const section = (...headings: string[]) => explicitFormSectionValue(parsedBody, ...headings);
  const environment = section("Environment");
  const value = (metadataValue?: string | null, ...fallbackHeadings: string[]) => metadataText(metadataValue) || (fallbackHeadings.length ? section(...fallbackHeadings) : "");
  const issueType = value(troubleshooting?.issue_type, "Issue type") || "other";
  const status = value(troubleshooting?.troubleshooting_status, "Issue status") || "open";
  const fields: RoomNativeField[] = [
    ["Issue type", issueType.replace(/_/g, " ")],
    ["Status", status.replace(/_/g, " ")],
    ["Affected area", value(troubleshooting?.affected_area, "Affected area")],
    ["Operating system", value(troubleshooting?.environment_os) || formLineValue(environment, "OS")],
    ["Browser / app", value(troubleshooting?.environment_browser) || formLineValue(environment, "Browser/app")],
    ["Elysia version", value(troubleshooting?.app_version) || formLineValue(environment, "Elysia version")],
    ["Environment notes", value(troubleshooting?.environment_notes, "Environment notes")],
    ["Steps to reproduce / tried", value(troubleshooting?.steps_to_reproduce, "Steps to reproduce / tried", "Steps tried / reproduce")],
    ["Expected result", value(troubleshooting?.expected_result, "Expected behavior")],
    ["Actual result", value(troubleshooting?.actual_result, "Actual behavior")],
    ["Error message", value(troubleshooting?.error_message, "Error message")],
    ["Redacted logs", value(troubleshooting?.redacted_logs, "Redacted logs")],
    ["Known workaround", value(troubleshooting?.workaround, "Known workaround")]
  ].map(([heading, body]) => ({ heading, body })).filter((field) => field.body);
  return <div className="commune-troubleshooting-detail">
    <p className="eyebrow">Troubleshooting Grove detail</p>
    <div className="commune-info-grid">
      <article className="commune-repo-identity-card">
        <h3>{post.title}</h3>
        <dl className="mini-facts">
          <div><dt>Issue type</dt><dd>{issueType.replace(/_/g, " ")}</dd></div>
          <div><dt>Status</dt><dd>{status.replace(/_/g, " ")}</dd></div>
          <div><dt>Affected area</dt><dd>{value(troubleshooting?.affected_area, "Affected area") || "Not supplied"}</dd></div>
          <div><dt>Environment</dt><dd>{[value(troubleshooting?.environment_os, "OS"), value(troubleshooting?.environment_browser, "Browser/app"), value(troubleshooting?.app_version, "Elysia version optional")].filter(Boolean).join(" · ") || "Not supplied"}</dd></div>
        </dl>
      </article>
      <WarningCallout title="Troubleshooting safety boundary"><p>Troubleshooting Grove is public diagnostic support. Logs, snippets, links, and screenshots must be redacted before sharing. Sandbox diagnostics are evidence only; they do not prove safety, trust, compatibility, or Marketplace readiness.</p></WarningCallout>
    </div>
    <RoomNativeDetails label="Structured issue report" fields={fields} />
    {troubleshooting?.accepted_summary && <article className="commune-room-native-field commune-troubleshooting-resolution"><h3>Accepted fix / workaround</h3><p>{troubleshooting.accepted_summary}</p><p className="boundary-note">{troubleshooting.accepted_resolution_kind?.replace(/_/g, " ") ?? "resolution"} · recorded {troubleshooting.accepted_at ? new Date(troubleshooting.accepted_at).toLocaleString() : "time unavailable"}</p></article>}
    <TroubleshootingResolutionControls post={post} troubleshooting={troubleshooting} comments={comments} userId={userId} isModerator={isModerator} onMessage={onMessage} onChanged={onChanged} />
  </div>;
}


function JobPostReviewControls({ jobPost, postId, isModerator, onMessage, onChanged }: { jobPost?: JobPostMetadata | null; postId: string; isModerator: boolean; onMessage: (message: string) => void; onChanged: () => Promise<void> }) {
  const [applicationStatus, setApplicationStatus] = useState<JobPostApplicationStatus>(jobPost?.application_status ?? "open");
  const [reviewStatus, setReviewStatus] = useState<JobPostAntiScamReviewStatus>(jobPost?.anti_scam_review_status ?? "not_reviewed");
  const [publicCorrectionNote, setPublicCorrectionNote] = useState(jobPost?.public_correction_note ?? "");
  useEffect(() => {
    setApplicationStatus(jobPost?.application_status ?? "open");
    setReviewStatus(jobPost?.anti_scam_review_status ?? "not_reviewed");
    setPublicCorrectionNote(jobPost?.public_correction_note ?? "");
  }, [jobPost?.anti_scam_review_status, jobPost?.application_status, jobPost?.public_correction_note]);
  if (!jobPost) return <p className="boundary-note">This legacy Job Post has no structured sidecar record yet. It still remains public and moderator-governed through the Commune post/thread model.</p>;
  async function saveApplicationStatus() {
    const result = await updateJobPostApplicationStatus({ jobPostId: jobPost?.id, postId, applicationStatus, publicCorrectionNote });
    onMessage(cleanCommuneMessage(result.message, "Job Post listing status could not be updated until the structured workflow migration is active."));
    if (result.ok) await onChanged();
  }
  async function saveReviewStatus() {
    const result = await updateJobPostReviewStatus({ jobPostId: jobPost?.id, postId, antiScamReviewStatus: reviewStatus, publicCorrectionNote });
    onMessage(cleanCommuneMessage(result.message, "Job Post anti-scam review state could not be updated until the structured workflow migration is active."));
    if (result.ok) await onChanged();
  }
  return <div className="commune-troubleshooting-controls commune-job-review-controls">
    <p className="eyebrow">Job Post controls</p>
    <p className="boundary-note">Listing status is public. Anti-scam review states are reviewer/admin controlled. Private admin notes stay out of public profiles and public detail pages.</p>
    <div className="commune-form-grid">
      <label><span>Application status</span><select value={applicationStatus} onChange={(event) => setApplicationStatus(event.target.value as JobPostApplicationStatus)}>{jobApplicationStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      {isModerator && <label><span>Anti-scam review</span><select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as JobPostAntiScamReviewStatus)}>{jobAntiScamStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
      <label className="wide-field"><span>Public correction / clarification note</span><textarea rows={3} value={publicCorrectionNote} onChange={(event) => setPublicCorrectionNote(event.target.value)} placeholder="Public-safe correction or clarification, if needed." /></label>
      {isModerator && <p className="wide-field boundary-note">Hidden reviewer notes belong in Admin Review history, not the public Job Post metadata table. Use public correction notes only when the note is safe for readers.</p>}
    </div>
    <div className="button-row"><button type="button" onClick={() => void saveApplicationStatus()}>Save listing status</button>{isModerator && <button type="button" onClick={() => void saveReviewStatus()}>Save anti-scam review</button>}</div>
  </div>;
}

function JobPostDetail({ post, jobPost, parsedBody, isModerator, onMessage, onChanged }: { post: CommunePost; jobPost?: JobPostMetadata | null; parsedBody: ReturnType<typeof splitPostSections>; isModerator: boolean; onMessage: (message: string) => void; onChanged: () => Promise<void> }) {
  const section = (...headings: string[]) => explicitFormSectionValue(parsedBody, ...headings);
  const value = (metadataValue?: string | null, ...fallbackHeadings: string[]) => metadataText(metadataValue) || (fallbackHeadings.length ? section(...fallbackHeadings) : "");
  const adminApplicationClarification = String(jobPost?.private_application_note ?? "").trim();
  const fields: RoomNativeField[] = [
    ["Role summary", value(jobPost?.role_summary, "Role summary")],
    ["Compensation clarity", value(jobPost?.compensation_clarity, "Compensation clarity")],
    ["Location details", value(jobPost?.location_text, "Location details")],
    ["Time commitment", value(jobPost?.time_commitment, "Time commitment")],
    ["Deadline", value(jobPost?.deadline, "Deadline")],
    ["Contact / application path", value(jobPost?.contact_path, "Contact path")],
    ["Requirements / skills", value(jobPost?.requirements_skills, "Requirements / skills")],
    ["Safety notes", value(jobPost?.safety_notes, "Job safety notes")],
    ["Public correction / clarification", value(jobPost?.public_correction_note, "Public correction note")]
  ].map(([heading, body]) => ({ heading, body })).filter((field) => field.body);
  return <div className="commune-job-detail">
    <p className="eyebrow">Job Post detail</p>
    <div className="commune-info-grid">
      <article className="commune-repo-identity-card">
        <h3>{value(jobPost?.role_title, "Role title") || post.title}</h3>
        <dl className="mini-facts">
          <div><dt>Organization / project</dt><dd>{value(jobPost?.organization_project, "Organization / project") || "Not supplied"}</dd></div>
          <div><dt>Role type</dt><dd>{jobRoleLabel(jobPost?.role_type || section("Role type"))}</dd></div>
          <div><dt>Pay / volunteer</dt><dd>{jobPaidStatusLabel(jobPost?.paid_volunteer_status || section("Paid / volunteer status"))}</dd></div>
          <div><dt>Location</dt><dd>{jobLocationModeLabel(jobPost?.location_mode || section("Location / remote / hybrid"))}</dd></div>
          <div><dt>Status</dt><dd>{jobApplicationStatusLabel(jobPost?.application_status || section("Application status"))}</dd></div>
          <div><dt>Anti-scam review</dt><dd>{jobAntiScamStatusLabel(jobPost?.anti_scam_review_status || section("Anti-scam review"))}</dd></div>
        </dl>
      </article>
      <WarningCallout title="Public opportunity boundary"><p>Job Posts are public, admin-approved opportunity listings and public questions. They are not private applications, resume/CV intake, payroll, contracts, identity verification, or Work With private request storage.</p></WarningCallout>
    </div>
    <RoomNativeDetails label="Structured job listing" fields={fields} className="commune-job-native-details" />
    <WarningCallout title="Anti-scam and privacy safety"><p>Do not share SSNs, bank details, identity documents, resumes/CVs, private addresses, private phone numbers, tax forms, contracts, private application packets, Work With uploads, or sensitive personal data in public Job Post comments. Use a safe public contact path or the private Work With intake when appropriate.</p></WarningCallout>
    <section className="commune-room-native-field commune-job-work-with"><h3>Private application path</h3><p>{jobPrivateApplicationSystemNotice}</p>{adminApplicationClarification && <p className="boundary-note">Admin clarification: {adminApplicationClarification}</p>}<div className="button-row"><Link className="button-link" to="/work-with-elysia-ecobotics">Open Work With Elysia Ecobotics</Link></div></section>
    <JobPostReviewControls jobPost={jobPost} postId={post.id} isModerator={isModerator} onMessage={onMessage} onChanged={onChanged} />
  </div>;
}

function ResearchNotesReviewControls({ researchNote, postId, isModerator, onMessage, onChanged }: { researchNote?: ResearchNotesMetadata | null; postId: string; isModerator: boolean; onMessage: (message: string) => void; onChanged: () => Promise<void> }) {
  const [reviewStatus, setReviewStatus] = useState<ResearchReviewStatus>(researchNote?.review_status ?? "submitted");
  const [correctionNote, setCorrectionNote] = useState(researchNote?.correction_note ?? "");
  useEffect(() => {
    setReviewStatus(researchNote?.review_status ?? "submitted");
    setCorrectionNote(researchNote?.correction_note ?? "");
  }, [researchNote?.correction_note, researchNote?.review_status]);
  if (!researchNote) return <p className="boundary-note">This legacy Research Notes post has no structured sidecar record yet. It still remains public and moderator-governed through the Commune post/thread model.</p>;
  if (!isModerator) return <p className="boundary-note">Research-specific review labels are assigned by Commune reviewers. Comments, reports, and public discussion remain separate from evidence review state.</p>;
  async function saveReviewStatus() {
    const result = await updateResearchNotesReviewStatus({ researchNoteId: researchNote?.id, postId, reviewStatus, correctionNote });
    onMessage(cleanCommuneMessage(result.message, "Research Notes review state could not be updated until the structured workflow migration is active."));
    if (result.ok) await onChanged();
  }
  return <div className="commune-troubleshooting-controls commune-research-review-controls">
    <p className="eyebrow">Research review controls</p>
    <p className="boundary-note">Reviewer labels request citation, clarification, source repair, or overclaim correction. They do not erase the public post; public moderation controls remain separate.</p>
    <div className="commune-form-grid">
      <label><span>Review status</span><select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as ResearchReviewStatus)}>{researchReviewStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="wide-field"><span>Public correction / clarification note</span><textarea rows={3} value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} placeholder="Public note only. Keep private reviewer notes in the review/history systems." /></label>
    </div>
    <div className="button-row"><button type="button" onClick={() => void saveReviewStatus()}>Save Research Notes review state</button></div>
  </div>;
}

function safePublicHref(value?: string | null) {
  try {
    const url = new URL(String(value ?? ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function ResearchNotesDetail({ post, researchNote, parsedBody, isModerator, onMessage, onChanged }: { post: CommunePost; researchNote?: ResearchNotesMetadata | null; parsedBody: ReturnType<typeof splitPostSections>; isModerator: boolean; onMessage: (message: string) => void; onChanged: () => Promise<void> }) {
  const section = (...headings: string[]) => explicitFormSectionValue(parsedBody, ...headings);
  const value = (metadataValue?: string | null, ...fallbackHeadings: string[]) => metadataText(metadataValue) || (fallbackHeadings.length ? section(...fallbackHeadings) : "");
  const sourceLinks = researchNote?.source_links?.length ? researchNote.source_links : section("Source links").split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  const livingLibraryHref = safePublicHref(value(researchNote?.living_library_source_link, "Living Library source link"));
  const fields: RoomNativeField[] = [
    ["Evidence summary", value(researchNote?.evidence_summary, "Evidence summary")],
    ["Observation", value(researchNote?.observation, "Observation")],
    ["Interpretation", value(researchNote?.interpretation, "Interpretation")],
    ["Uncertainty", value(researchNote?.uncertainty, "Uncertainty")],
    ["Citation notes", value(researchNote?.citation_notes, "Citation notes")],
    ["Context / discussion", value(researchNote?.context_discussion)],
    ["Geographic scope", value(researchNote?.geographic_scope, "Geographic scope")],
    ["Method type", value(researchNote?.method_type, "Method type")],
    ["Data type", value(researchNote?.data_type, "Data type")],
    ["Ethics / sensitivity note", value(researchNote?.ethics_note, "Ethics / sensitivity note")],
    ["Correction / clarification note", value(researchNote?.correction_note)]
  ].map(([heading, body]) => ({ heading, body })).filter((field) => field.body);
  return <div className="commune-research-detail">
    <p className="eyebrow">Research Notes detail</p>
    <div className="commune-info-grid">
      <article className="commune-repo-identity-card">
        <h3>{value(researchNote?.research_question, "Research question / topic") || post.title}</h3>
        <dl className="mini-facts">
          <div><dt>Domain</dt><dd>{value(researchNote?.domain, "Domain") || "Not specified"}</dd></div>
          <div><dt>Evidence strength</dt><dd>{researchEvidenceLabel(researchNote?.evidence_strength || section("Evidence strength / confidence") || section("Confidence / evidence strength"))}</dd></div>
          <div><dt>Review state</dt><dd>{researchReviewStatusLabel(researchNote?.review_status)}</dd></div>
          <div><dt>Subsystem</dt><dd>{value(researchNote?.ecological_subsystem, "Ecological subsystem") || "Not specified"}</dd></div>
        </dl>
        <div className="button-row">{livingLibraryHref && <a className="button-link" href={livingLibraryHref} target="_blank" rel="noreferrer">Open Living Library source link</a>}</div>
      </article>
      <WarningCallout title="Research Notes boundary"><p>Research Notes separate evidence, observation, interpretation, and uncertainty. They are public research discussion, not Official Updates, Living Library source records, certification, or private research storage.</p></WarningCallout>
    </div>
    <RoomNativeDetails label="Evidence-aware fields" fields={fields} className="commune-research-native-details" />
    {sourceLinks.length > 0 && <article className="commune-room-native-field commune-research-sources"><h3>Source links</h3><div className="button-row">{sourceLinks.map((link) => {
      const href = safePublicHref(link);
      return href ? <a className="button-link" href={href} target="_blank" rel="noreferrer" key={href}>{href}</a> : <span className="boundary-note" key={link}>{link}</span>;
    })}</div><p className="boundary-note">Source links are public references only. The site does not verify full-text rights, hidden data, or Living Library authority automatically.</p></article>}
    <WarningCallout title="Research safety"><p>Do not expose private participant data, sensitive ecological locations, copyrighted full-text papers without rights, private local Elysia data, credentials, local paths, or hidden review notes. Evidence strength is a review aid, not a truth badge.</p></WarningCallout>
    <ResearchNotesReviewControls researchNote={researchNote} postId={post.id} isModerator={isModerator} onMessage={onMessage} onChanged={onChanged} />
  </div>;
}

function RepositoryShowcaseDetail({ post, showcase, parsedBody }: { post: CommunePost; showcase?: RepositoryShowcaseMetadata | null; parsedBody: ReturnType<typeof splitPostSections> }) {
  const section = (...headings: string[]) => explicitFormSectionValue(parsedBody, ...headings);
  const value = (metadataValue?: string | null, ...fallbackHeadings: string[]) => metadataText(metadataValue) || (fallbackHeadings.length ? section(...fallbackHeadings) : "");
  const adminGuidancePost = isRepositoryShowcaseGuidancePost(post) && !showcase;
  if (adminGuidancePost) {
    return <div className="commune-repository-detail commune-repository-guidance-detail">
      <p className="eyebrow">Repository Showcase guidance</p>
      <section className="commune-official-identity">
        <h3>Admin guidance post</h3>
        <p>{repositoryShowcaseGuidanceBoundaryCopy}</p>
        <StatusBadges labels={["Repository Showcase guidance", "Admin guidance post", "Policy/template", "Not a trust signal"]} />
      </section>
      <WarningCallout title="Repository Showcase guidance boundary"><p>This post explains how to share repositories safely. It is not a repository approval, compatibility review, Marketplace listing, install recommendation, trust signal, signing/versioning decision, selected-artifact sandbox approval, or Developer Forge review.</p></WarningCallout>
      <p className="boundary-note">No repository metadata sidecar is attached to this guidance post. Repository listings still require a public HTTP(S) repository URL and separate review.</p>
    </div>;
  }
  const repositoryUrl = value(showcase?.repository_url, "Repository URL") || post.repository_url || "";
  const safeHref = (() => { try { const url = new URL(repositoryUrl); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; } })();
  const riskFlags = showcase?.risk_flags?.length ? showcase.risk_flags : section("Risk warnings").split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
  const sandboxStatus = showcase?.sandbox_review_status ?? (showcase?.sandbox_review_requested ? "requested" : "not_requested");
  const sandboxHref = "/commune/repository-showcase/sandbox-request?post=" + encodeURIComponent(post.id) + (showcase?.id ? "&showcase=" + encodeURIComponent(showcase.id) : "");
  return <div className="commune-repository-detail">
    <p className="eyebrow">Repository Showcase detail</p>
    <div className="commune-info-grid">
      <article className="commune-repo-identity-card">
        <h3>{value(showcase?.project_name) || post.title}</h3>
        <dl className="mini-facts">
          <div><dt>Provider</dt><dd>{value(showcase?.provider, "Provider") || "Unknown"}</dd></div>
          <div><dt>Branch</dt><dd>{value(showcase?.default_branch, "Branch") || "Not supplied"}</dd></div>
          <div><dt>Commit</dt><dd>{value(showcase?.commit_sha, "Commit") || "Not supplied"}</dd></div>
          <div><dt>License</dt><dd>{value(showcase?.license, "License notes") || "Not verified"}</dd></div>
          <div><dt>Manifest</dt><dd>{value(showcase?.manifest_status, "Manifest status") || "No manifest checked"}</dd></div>
          <div><dt>Elysia compatibility</dt><dd>{value(showcase?.elysia_compatibility, "Compatibility notes") || "Unknown"}</dd></div>
        </dl>
        {safeHref && <a className="button-link" href={safeHref} target="_blank" rel="noreferrer">Open repository reference</a>}
      </article>
      <WarningCallout title="Repository trust boundary"><p>This showcase is metadata and discussion only. The website did not clone, install, build, run, auto-train on, validate, license-check, or approve this repository. Developer Forge and Marketplace review remain separate.</p></WarningCallout>
    </div>
    {value(showcase?.short_description) && <article className="commune-room-native-field"><h3>Description</h3><p>{value(showcase?.short_description)}</p></article>}
    {value(showcase?.readme_preview, "README preview") && <article className="commune-room-native-field"><h3>README preview</h3><pre className="commune-repo-text-block">{truncateRepositoryText(value(showcase?.readme_preview, "README preview"))}</pre></article>}
    {value(showcase?.file_tree_preview, "File tree summary") && <article className="commune-room-native-field"><h3>File tree preview</h3><pre className="commune-repo-text-block">{truncateRepositoryText(value(showcase?.file_tree_preview, "File tree summary"), 9000)}</pre></article>}
    {value(showcase?.screenshot_notes_or_urls, "Screenshots / notes") && <article className="commune-room-native-field"><h3>Screenshot notes / URLs</h3><p>{value(showcase?.screenshot_notes_or_urls, "Screenshots / notes")}</p></article>}
    <div className="commune-repo-risk-row">
      <p className="eyebrow">Risk flags</p>
      {riskFlags.length ? <StatusBadges labels={riskFlags} /> : <p className="boundary-note">No risk flags selected. This does not mean the repository is safe.</p>}
    </div>
    <section className="commune-sandbox-card commune-repo-sandbox-summary">
      <div className="addon-card__topline"><strong>Repository sandbox review</strong><span>{sandboxStatus.replace(/_/g, " ")}</span></div>
      <p className="boundary-note">Repository Showcase sandbox review runs only a selected artifact/snippet that you paste. It does not clone, install, build, test, or trust the full repository.</p>
      <div className="button-row"><Link className="button-link" to={sandboxHref}>{showcase?.sandbox_review_requested ? "Open sandbox review" : "Request sandbox review"}</Link></div>
    </section>
  </div>;
}

function ElysiaIterationShowcaseDetail({ post, iteration, parsedBody }: { post: CommunePost; iteration?: ElysiaIterationShowcaseMetadata | null; parsedBody: ReturnType<typeof splitPostSections> }) {
  const section = (...headings: string[]) => explicitFormSectionValue(parsedBody, ...headings);
  const value = (metadataValue?: string | null, ...fallbackHeadings: string[]) => metadataText(metadataValue) || (fallbackHeadings.length ? section(...fallbackHeadings) : "");
  const importedString = (key: string) => {
    const raw = iteration?.imported_metadata?.[key];
    return typeof raw === "string" ? raw.trim() : "";
  };
  const relatedSource = value(iteration?.related_repo_url, "Related repo / source URL") || post.repository_url || "";
  const safeHref = (() => { try { const url = new URL(relatedSource); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; } })();
  const forgeHref = (() => { try { const url = new URL(iteration?.developer_forge_link ?? ""); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; } })();
  const marketplaceHref = (() => { try { const url = new URL(iteration?.marketplace_link ?? ""); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; } })();
  const pullHref = (() => { try { const url = new URL(iteration?.pull_request_url ?? ""); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; } })();
  const riskFlags = iteration?.risk_flags?.length ? iteration.risk_flags : section("Risk flags").split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
  const sandboxStatus = iteration?.sandbox_review_status ?? (iteration?.sandbox_review_requested ? "requested" : "not_requested");
  const sandboxHref = "/commune/elysia-iteration-showcase/sandbox-request?post=" + encodeURIComponent(post.id) + (iteration?.id ? "&iteration=" + encodeURIComponent(iteration.id) : "");
  const readmePreview = importedString("readme_preview");
  return <div className="commune-repository-detail commune-iteration-detail">
    <p className="eyebrow">Elysia Iteration Showcase detail</p>
    <div className="commune-info-grid">
      <article className="commune-repo-identity-card">
        <h3>{value(iteration?.iteration_type, "Iteration type") || "Iteration progress"}</h3>
        <dl className="mini-facts">
          <div><dt>Version/build</dt><dd>{value(iteration?.version_build_label, "Version / build label") || "Not supplied"}</dd></div>
          <div><dt>Testing status</dt><dd>{value(iteration?.testing_status) || "not_tested"}</dd></div>
          <div><dt>Provider</dt><dd>{value(iteration?.provider) || "Unknown"}</dd></div>
          <div><dt>Branch</dt><dd>{value(iteration?.branch) || "Not supplied"}</dd></div>
          <div><dt>Commit</dt><dd>{value(iteration?.commit_sha) || "Not supplied"}</dd></div>
          <div><dt>Release tag</dt><dd>{value(iteration?.release_tag) || "Not supplied"}</dd></div>
        </dl>
        <div className="button-row">
          {safeHref && <a className="button-link" href={safeHref} target="_blank" rel="noreferrer">Open public source reference</a>}
          {pullHref && <a className="button-link" href={pullHref} target="_blank" rel="noreferrer">Open pull request reference</a>}
        </div>
      </article>
      <WarningCallout title="Progress showcase boundary"><p>Elysia Iteration Showcase is public progress, demo, screenshot, UI, add-on preview, and design-development context. It is not an Official Update, security advisory, release certification, compatibility proof, Developer Forge approval, Marketplace readiness, installability claim, or trust label.</p></WarningCallout>
    </div>
    {value(iteration?.what_changed, "What changed") && <article className="commune-room-native-field"><h3>What changed</h3><p>{value(iteration?.what_changed, "What changed")}</p></article>}
    {value(iteration?.why_it_matters, "Why it matters") && <article className="commune-room-native-field"><h3>Why it matters</h3><p>{value(iteration?.why_it_matters, "Why it matters")}</p></article>}
    {value(iteration?.known_limitations, "Known limitations") && <article className="commune-room-native-field"><h3>Known limitations</h3><p>{value(iteration?.known_limitations, "Known limitations")}</p></article>}
    {value(iteration?.next_step, "Next step") && <article className="commune-room-native-field"><h3>Next step</h3><p>{value(iteration?.next_step, "Next step")}</p></article>}
    {value(iteration?.compatibility_note) && <article className="commune-room-native-field"><h3>Compatibility note</h3><p>{value(iteration?.compatibility_note)}</p></article>}
    {value(iteration?.redaction_notes) && <article className="commune-room-native-field"><h3>Redaction note</h3><p>{value(iteration?.redaction_notes)}</p></article>}
    {readmePreview && <article className="commune-room-native-field"><h3>Public GitHub metadata preview</h3><pre className="commune-repo-text-block">{truncateRepositoryText(readmePreview, 5000)}</pre></article>}
    {(forgeHref || marketplaceHref) && <article className="commune-room-native-field"><h3>Related ecosystem references</h3><p className="boundary-note">These links are references only. They do not mean Developer Forge approval, Marketplace approval, installation safety, compatibility, or production readiness.</p><div className="button-row">{forgeHref && <a className="button-link" href={forgeHref} target="_blank" rel="noreferrer">Open Developer Forge reference</a>}{marketplaceHref && <a className="button-link" href={marketplaceHref} target="_blank" rel="noreferrer">Open Marketplace reference</a>}</div></article>}
    <div className="commune-repo-risk-row">
      <p className="eyebrow">Iteration risk/context flags</p>
      {riskFlags.length ? <StatusBadges labels={riskFlags} /> : <p className="boundary-note">No risk flags selected. This does not mean the iteration is safe, official, complete, compatible, or ready.</p>}
    </div>
    <section className="commune-sandbox-card commune-repo-sandbox-summary">
      <div className="addon-card__topline"><strong>Elysia Iteration Showcase sandbox review</strong><span>{sandboxStatus.replace(/_/g, " ")}</span></div>
      <p className="boundary-note">Sandbox review for this room runs only a selected artifact/snippet/config/manifest pasted into the review route. It does not clone, install, build, test, run, trust, or approve the full repository or iteration.</p>
      <div className="button-row"><Link className="button-link" to={sandboxHref}>{iteration?.sandbox_review_requested ? "Open selected-artifact review" : "Request selected-artifact review"}</Link></div>
    </section>
  </div>;
}

function officialTypeLabel(value?: string | null) {
  return officialUpdateTypeOptions.find((option) => option.value === value)?.label ?? (value ? value.replace(/_/g, " ") : "Official statement");
}

function officialLinkButtons(official?: OfficialUpdateMetadata | null) {
  const links = [...(official?.related_links ?? [])];
  if (official?.related_repo_url && !links.some((link) => link.url === official.related_repo_url)) links.push({ label: "Related repository/source", url: official.related_repo_url });
  return links.flatMap((link, index) => {
    try {
      const url = new URL(link.url);
      if (!["http:", "https:"].includes(url.protocol)) return [];
      return <a className="button-link" key={`${link.url}-${index}`} href={url.href} target="_blank" rel="noreferrer">{link.label || url.hostname}</a>;
    } catch { return []; }
  });
}

function OfficialCodeSnippetCard({ snippet, isAdmin, onMessage, onChanged }: { snippet: OfficialUpdateCodeSnippet; isAdmin: boolean; onMessage: (message: string) => void; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ language: snippet.language || "text", fileName: snippet.file_name || "", contextNote: snippet.context_note || "", codeText: snippet.code_text, correctionNote: snippet.correction_note || "" });
  async function save() {
    const result = await updateOfficialCodeSnippet({ id: snippet.id, officialUpdateId: snippet.official_update_id, postId: snippet.post_id, language: draft.language, fileName: draft.fileName, contextNote: draft.contextNote, codeText: draft.codeText, correctionNote: draft.correctionNote });
    onMessage(result.message);
    if (result.ok) { setEditing(false); await onChanged(); }
  }
  async function hide() {
    const result = await updateOfficialCodeSnippet({ id: snippet.id, officialUpdateId: snippet.official_update_id, postId: snippet.post_id, language: draft.language, fileName: draft.fileName, contextNote: draft.contextNote, codeText: draft.codeText, correctionNote: draft.correctionNote || "Official code snippet removed from public display.", publicVisible: false });
    onMessage(result.message);
    if (result.ok) await onChanged();
  }
  return <article className="commune-code-preview commune-official-code-card">
    <div className="addon-card__topline"><strong>{inertCodeSnippetLabel(snippet.language)}</strong><span>{snippet.file_name || "official-snippet"}</span></div>
    {snippet.context_note && <p className="boundary-note">{snippet.context_note}</p>}
    {snippet.edited_at && <p className="boundary-note">Code snippet updated on {new Date(snippet.edited_at).toLocaleString()}.</p>}
    {snippet.correction_note && <p className="boundary-note">Correction note: {snippet.correction_note}</p>}
    <CodeWorkspaceEditor value={snippet.code_text} language={snippet.language} readOnly minHeight="260px" />
    <div className="button-row"><button type="button" onClick={() => copyText(snippet.code_text, onMessage)}>Copy official code</button>{isAdmin && <button type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel code edit" : "Edit official code"}</button>}</div>
    <p className="boundary-note">Official code example — read-only public record. No Coding Workbench, no sandbox run, no proposal flow, no package install, and no Local Elysia execution are available from Official Update.</p>
    {editing && <div className="commune-form-grid commune-official-edit-panel">
      <label><span>Language</span><select value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })}>{codingLanguageOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label><span>Filename</span><input value={draft.fileName} onChange={(event) => setDraft({ ...draft, fileName: event.target.value })} /></label>
      <label className="wide-field"><span>Context note</span><input value={draft.contextNote} onChange={(event) => setDraft({ ...draft, contextNote: event.target.value })} /></label>
      <label className="wide-field"><span>Correction note</span><input value={draft.correctionNote} onChange={(event) => setDraft({ ...draft, correctionNote: event.target.value })} placeholder="Public correction reason for this official code change" /></label>
      <label className="wide-field"><span>Code</span><CodeWorkspaceEditor value={draft.codeText} language={draft.language} onChange={(codeText) => setDraft({ ...draft, codeText })} minHeight="260px" /></label>
      <div className="button-row"><button className="button-primary" type="button" onClick={() => void save()}>Save code correction</button><button type="button" onClick={() => void hide()}>Remove from public display</button></div>
    </div>}
  </article>;
}

function OfficialCodeSnippets({ officialUpdate, officialCodeSnippets, fallbackSnippets, isAdmin, onMessage, onChanged }: { officialUpdate?: OfficialUpdateMetadata | null; officialCodeSnippets: OfficialUpdateCodeSnippet[]; fallbackSnippets: CommuneCodeSnippet[]; isAdmin: boolean; onMessage: (message: string) => void; onChanged: () => Promise<void> }) {
  const [newSnippet, setNewSnippet] = useState({ language: "text", fileName: "", contextNote: "", codeText: "", correctionNote: "" });
  async function addSnippet() {
    if (!officialUpdate) return onMessage("Apply the Official Update structured migration before adding official code snippets.");
    const result = await createOfficialCodeSnippet({ officialUpdateId: officialUpdate.id, postId: officialUpdate.post_id, language: newSnippet.language, fileName: newSnippet.fileName, contextNote: newSnippet.contextNote, codeText: newSnippet.codeText, correctionNote: newSnippet.correctionNote });
    onMessage(result.message);
    if (result.ok) { setNewSnippet({ language: "text", fileName: "", contextNote: "", codeText: "", correctionNote: "" }); await onChanged(); }
  }
  if (!officialCodeSnippets.length && !fallbackSnippets.length && !isAdmin) return null;
  return <section className="commune-code-section commune-official-code-section">
    <p className="eyebrow">Official read-only code</p>
    <p className="commune-media-attribution">Code examples are attached to this Official Update by Elysia Ecobotics Official.</p>
    <p className="boundary-note">Official code is view/copy only for public users. This room never exposes Coding Workbench, sandbox runs, proposal flows, community editing, package installs, or Send to Elysia behavior.</p>
    <div className="commune-code-list">{officialCodeSnippets.map((snippet) => <OfficialCodeSnippetCard key={snippet.id} snippet={snippet} isAdmin={isAdmin} onMessage={onMessage} onChanged={onChanged} />)}{fallbackSnippets.map((snippet) => <article className="commune-code-preview commune-official-code-card" key={snippet.id}><div className="addon-card__topline"><strong>{inertCodeSnippetLabel(snippet.language ?? "")}</strong><span>{snippet.file_name ?? "official-snippet"}</span></div><CodeWorkspaceEditor value={snippet.code_text} language={snippet.language} readOnly minHeight="260px" /><div className="button-row"><button type="button" onClick={() => copyText(snippet.code_text, onMessage)}>Copy official code</button></div><p className="boundary-note">Legacy official code snippet rendered read-only. No workbench, sandbox, diagnostics, proposal, or public edit controls are exposed for Official Update.</p></article>)}</div>
    {isAdmin && officialUpdate && <div className="commune-form-grid commune-official-edit-panel"><p className="wide-field boundary-note">Admin-only: add another official code example. It will be read-only for the public and audit-recorded.</p><label><span>Language</span><select value={newSnippet.language} onChange={(event) => setNewSnippet({ ...newSnippet, language: event.target.value })}>{codingLanguageOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>Filename</span><input value={newSnippet.fileName} onChange={(event) => setNewSnippet({ ...newSnippet, fileName: event.target.value })} /></label><label className="wide-field"><span>Context note</span><input value={newSnippet.contextNote} onChange={(event) => setNewSnippet({ ...newSnippet, contextNote: event.target.value })} /></label><label className="wide-field"><span>Code</span><CodeWorkspaceEditor value={newSnippet.codeText} language={newSnippet.language} onChange={(codeText) => setNewSnippet({ ...newSnippet, codeText })} minHeight="220px" /></label><label className="wide-field"><span>Correction/audit note</span><input value={newSnippet.correctionNote} onChange={(event) => setNewSnippet({ ...newSnippet, correctionNote: event.target.value })} /></label><button type="button" onClick={() => void addSnippet()}>Add official read-only code</button></div>}
  </section>;
}

function OfficialUpdateAdminPanel({ officialUpdate, postId, onMessage, onChanged }: { officialUpdate: OfficialUpdateMetadata | null; postId: string; onMessage: (message: string) => void; onChanged: () => Promise<void> }) {
  const [draft, setDraft] = useState<{ status: OfficialUpdateStatus; severity: OfficialUpdateSeverity; correctionNote: string }>({ status: officialUpdate?.official_status ?? "published", severity: officialUpdate?.severity ?? "info", correctionNote: officialUpdate?.correction_note ?? "" });
  if (!officialUpdate) return <section className="commune-admin-controls"><p className="eyebrow">Official Update admin</p><p>Structured Official Update metadata is not active for this legacy post yet. Apply the Official Update migration, then repair this post through admin tooling.</p></section>;
  const activeOfficialUpdate = officialUpdate;
  async function act(action: string, patch: Partial<{ commentsEnabled: boolean; pinned: boolean; important: boolean; officialStatus: OfficialUpdateStatus; severity: OfficialUpdateSeverity; correctionNote: string }> = {}) {
    const result = await updateOfficialUpdateMetadata({ officialUpdateId: activeOfficialUpdate.id, postId, action, officialStatus: patch.officialStatus, severity: patch.severity, correctionNote: patch.correctionNote, commentsEnabled: patch.commentsEnabled, pinned: patch.pinned, important: patch.important });
    onMessage(result.message);
    if (result.ok) await onChanged();
  }
  return <section className="commune-admin-controls commune-official-admin-controls">
    <p className="eyebrow">Official Update admin lifecycle</p>
    <div className="commune-form-grid"><label><span>Status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as OfficialUpdateStatus })}>{officialStatusOptions.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select></label><label><span>Severity</span><select value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value as OfficialUpdateSeverity })}>{officialSeverityOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="wide-field"><span>Correction / lifecycle note</span><input value={draft.correctionNote} onChange={(event) => setDraft({ ...draft, correctionNote: event.target.value })} /></label></div>
    <div className="button-row"><button type="button" onClick={() => void act("official_update_updated", { officialStatus: draft.status, severity: draft.severity, correctionNote: draft.correctionNote })}>Save metadata update</button><button type="button" onClick={() => void act(activeOfficialUpdate.pinned ? "official_update_unpinned" : "official_update_pinned", { pinned: !activeOfficialUpdate.pinned })}>{activeOfficialUpdate.pinned ? "Unpin" : "Pin"}</button><button type="button" onClick={() => void act(activeOfficialUpdate.important ? "official_update_unmarked_important" : "official_update_marked_important", { important: !activeOfficialUpdate.important })}>{activeOfficialUpdate.important ? "Remove important" : "Mark important"}</button><button type="button" onClick={() => void act(activeOfficialUpdate.comments_enabled === false ? "comments_unlocked" : "comments_locked", { commentsEnabled: activeOfficialUpdate.comments_enabled === false })}>{activeOfficialUpdate.comments_enabled === false ? "Unlock comments" : "Lock comments"}</button><button type="button" onClick={() => void act("corrected", { correctionNote: draft.correctionNote || "Official Update corrected." })}>Mark corrected</button><button type="button" onClick={() => void act("retracted", { correctionNote: draft.correctionNote || "Official Update retracted." })}>Retract</button><button type="button" onClick={() => void act("archived", { correctionNote: draft.correctionNote || "Official Update archived." })}>Archive</button></div>
    <p className="boundary-note">Admin edits are audit-aware. Correction, retraction, archive, pinning, comment locks, and official code changes create Official Update event rows when the migration is active.</p>
  </section>;
}

function OfficialUpdateDetail({ post, officialUpdate, parsedBody }: { post: CommunePost; officialUpdate?: OfficialUpdateMetadata | null; parsedBody: ReturnType<typeof splitPostSections> }) {
  const summary = metadataText(officialUpdate?.summary);
  const labels = officialUpdate ? ["Official", officialTypeLabel(officialUpdate.update_type), officialUpdate.official_status, officialUpdate.severity, officialUpdate.pinned ? "Pinned" : "", officialUpdate.important ? "Important" : "", officialUpdate.migration_required ? "Migration required" : ""].filter(Boolean) : ["Official", "legacy official update"];
  const legacyFields = roomNativeFormHeadingsByPostType.official_update?.map((heading) => ({ heading, body: explicitFormSectionValue(parsedBody, heading) })) ?? [];
  const officialFields: RoomNativeField[] = officialUpdate ? [
    { heading: "Notice type", body: officialTypeLabel(officialUpdate.update_type) },
    { heading: "Status", body: officialUpdate.official_status.replace(/_/g, " ") },
    { heading: "Severity", body: officialUpdate.severity },
    { heading: "Audience", body: officialUpdate.audience || "public" },
    { heading: "Effective date", body: officialUpdate.effective_date || "Not specified" },
    { heading: "Version / release tag", body: officialUpdate.release_version || "Not specified" },
    { heading: "Affected systems / rooms", body: officialUpdate.affected_systems?.length ? officialUpdate.affected_systems.join(", ") : "Not specified" },
    { heading: "Related room / migration", body: [officialUpdate.related_room_slug, officialUpdate.related_migration].filter(Boolean).join(" · ") || "Not specified" },
    { heading: "Known limitations", body: officialUpdate.known_limitations || "" },
    { heading: "User action required", body: officialUpdate.user_action_required || "" },
    { heading: "Correction / revision note", body: officialUpdate.correction_note || "" }
  ] : legacyFields;
  return <div className="commune-official-detail">
    <section className="commune-official-identity"><p className="eyebrow">Official notice</p><h3>{officialUpdate?.brand_author_name || "Elysia Ecobotics Official"}</h3><p>Brand-authoritative public record from Elysia Ecobotics / EcoSyneva Commons. Community users cannot submit, self-assign, impersonate, or edit Official Updates.</p><StatusBadges labels={labels} /></section>
    {summary && <article className="commune-room-native-field"><h3>Summary</h3><p>{summary}</p></article>}
    <RoomNativeDetails label={officialUpdate ? "Structured official metadata" : "Legacy official update fields"} fields={officialFields} className={officialUpdate ? "commune-official-metadata" : ""} />
    {officialUpdate && officialLinkButtons(officialUpdate).length > 0 && <div className="button-row">{officialLinkButtons(officialUpdate)}</div>}
    <WarningCallout title="Official Update boundary"><p>Official Update is separate from Elysia Iteration Showcase, Repository Showcase, Coding Cornucopia, Developer Forge, and Marketplace approval. Roadmap notes are intentions, not promises. Official code examples are read-only public text, not execution permission.</p></WarningCallout>
  </div>;
}

function PostDetail({ postId }: { postId: string }) {
  const { state, refresh } = useCommuneLoad(undefined, postId);
  const [snippets, setSnippets] = useState<CommuneCodeSnippet[]>([]);
  const [comment, setComment] = useState("");
  const [commentStatus, setCommentStatus] = useState("Comments are public/community conversation once published. First participation may go to review.");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyStatuses, setReplyStatuses] = useState<Record<string, string>>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<CommuneMediaAttachment | null>(null);
  const [report, setReport] = useState<{ type: string; reason: string }>({ type: reportTypes[0], reason: "" });
  const [message, setMessage] = useState("");
  const [locallyDeletedPostId, setLocallyDeletedPostId] = useState<string | null>(null);
  useEffect(() => { setLocallyDeletedPostId(null); }, [postId]);
  const post = locallyDeletedPostId === postId ? null : state.posts[0];
  const thread = state.threads.find((item) => item.post_id === postId) ?? state.threads[0];
  const attachments = state.media.filter((item) => item.post_id === postId && item.visibility_state === "published");
  const officialUpdate = state.officialUpdates.find((item) => item.post_id === postId) ?? null;
  const officialCodeSnippets = state.officialCodeSnippets.filter((item) => item.post_id === postId && item.public_visible !== false);
  const communityVote = state.votePosts.find((item) => item.vote.post_id === postId) ?? null;
  const topLevelComments = state.comments.filter((item) => !item.parent_comment_id);
  const repliesByParent = state.comments.reduce<Record<string, CommuneComment[]>>((groups, item) => {
    if (!item.parent_comment_id) return groups;
    groups[item.parent_comment_id] = [...(groups[item.parent_comment_id] ?? []), item];
    return groups;
  }, {});
  useEffect(() => { void loadCodeSnippets(postId).then((result) => { setSnippets(result.snippets); logCommuneDiagnostics("code-snippets", result.warnings); }); }, [postId]);
  useEffect(() => {
    if (!activeMedia) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveMedia(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeMedia]);
  async function save() { const result = await savePost(postId); setMessage(cleanCommuneMessage(result.message, "Saved posts are not active yet. Try again after account-backed shelves are ready.")); await refresh(); }
  async function follow() { if (!thread) return setMessage("No thread is available yet."); const result = await followThread(thread.id); setMessage(cleanCommuneMessage(result.message, "Followed threads are not active yet.")); await refresh(); }
  async function markRead() { if (!thread) return; const result = await markThreadRead(thread.id); setMessage(cleanCommuneMessage(result.message, "Thread read-state is not active yet.")); await refresh(); }
  async function resolveThreadForComment() {
    if (thread) return thread;
    if (!post) return null;
    const result = await ensureCommuneThreadForPost(post);
    const cleaned = cleanCommuneMessage(result.message, "Comment could not prepare this post discussion thread yet.");
    setCommentStatus(cleaned);
    if (!result.ok || !result.thread) return null;
    return result.thread;
  }
  async function submitThreadComment() {
    setCommentSubmitting(true);
    setCommentStatus("Submitting comment...");
    try {
      const activeThread = await resolveThreadForComment();
      if (!activeThread) return;
      const result = await submitComment({ postId, threadId: activeThread.id, body: comment });
      const cleaned = cleanCommuneMessage(result.message, "Comment could not be submitted. Please refresh and try again.");
      setCommentStatus(cleaned);
      if (result.ok) {
        setComment("");
        await refresh();
      }
    } finally {
      setCommentSubmitting(false);
    }
  }
  async function submitCommentReply(parentCommentId: string) {
    setSubmittingReplyId(parentCommentId);
    setReplyStatuses((current) => ({ ...current, [parentCommentId]: "Submitting reply..." }));
    try {
      const activeThread = await resolveThreadForComment();
      if (!activeThread) {
        setReplyStatuses((current) => ({ ...current, [parentCommentId]: "Reply could not be submitted because this post has no discussion thread yet." }));
        return;
      }
      const body = replyDrafts[parentCommentId] ?? "";
      const result = await submitComment({ postId, threadId: activeThread.id, body, parentCommentId });
      const cleaned = cleanCommuneMessage(result.message, "Reply could not be submitted. Please refresh and try again.");
      setReplyStatuses((current) => ({ ...current, [parentCommentId]: cleaned }));
      if (result.ok) {
        setReplyDrafts((current) => ({ ...current, [parentCommentId]: "" }));
        setActiveReplyId(null);
        await refresh();
      }
    } finally {
      setSubmittingReplyId(null);
    }
  }
  async function reportPost() { const result = await reportCommuneContent({ postId, reportType: report.type, reason: report.reason }); setMessage(cleanCommuneMessage(result.message, "Report routing is being prepared. If urgent, use another trusted contact path.")); setReport({ ...report, reason: "" }); }
  async function reportComment(commentId: string) { const result = await reportCommuneContent({ commentId, reportType: report.type, reason: report.reason || "Reported from post detail comment list." }); setMessage(cleanCommuneMessage(result.message, "Comment report routing is being prepared.")); }
  function renderComment(item: CommuneComment, isReply = false) {
    const replies = repliesByParent[item.id] ?? [];
    return <article className={isReply ? "commune-preview-card commune-reply-card" : "commune-preview-card"} key={item.id}>
      <p>{item.body}</p>
      <p>By {authorLink(item.author_username)} · {item.status}</p>
      <ReactionBar targetType="comment" targetId={item.id} signedIn={state.signedIn} onMessage={setMessage} />
      <div className="button-row"><button type="button" onClick={() => void reportComment(item.id)}>Report comment</button>{!isReply && <button type="button" onClick={() => setActiveReplyId(activeReplyId === item.id ? null : item.id)}>Reply</button>}</div>
      <AdminContentControls targetType="comment" targetId={item.id} isModerator={state.isModerator} onChanged={refresh} onMessage={setMessage} />
      {activeReplyId === item.id && <div className="commune-reply-form"><label><span>Reply to this comment</span><textarea rows={3} value={replyDrafts[item.id] ?? ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [item.id]: event.target.value }))} /></label><button type="button" disabled={submittingReplyId === item.id} onClick={() => void submitCommentReply(item.id)}>{submittingReplyId === item.id ? "Submitting reply..." : "Submit reply"}</button>{replyStatuses[item.id] && <p className="message">{replyStatuses[item.id]}</p>}</div>}
      {replies.length > 0 && <div className="commune-reply-thread">{replies.map((reply) => renderComment(reply, true))}</div>}
    </article>;
  }
  if (!post) return <section className="section-card"><h2>Post not found</h2><p>This post is not public, does not exist, or is still awaiting moderation.</p><p className="boundary-note">Account-backed posts may also be unavailable while Commune backend tables are being prepared.</p><Link className="button-link" to="/commune">Back to Commune</Link></section>;
  const parsedBody = splitPostSections(post.body);
  const troubleshooting = state.troubleshootingPosts.find((item) => item.post_id === post.id) ?? null;
  const researchNote = state.researchNotes.find((item) => item.post_id === post.id) ?? null;
  const jobPost = state.jobPosts.find((item) => item.post_id === post.id) ?? null;
  const repositoryShowcase = state.repositoryShowcases.find((item) => item.post_id === post.id) ?? null;
  const iterationShowcase = state.iterationShowcases.find((item) => item.post_id === post.id) ?? null;
  const isRepositoryShowcase = post.post_type === "repository_showcase";
  const isIterationShowcase = post.post_type === "elysia_iteration_showcase";
  const isOfficialUpdate = post.post_type === "official_update";
  const isCommunityVote = post.post_type === "community_vote";
  const isTroubleshooting = post.post_type === "troubleshooting";
  const isResearchNotes = post.post_type === "research_note";
  const isJobPost = post.post_type === "job_post";
  const commentsLocked = (isOfficialUpdate && officialUpdate?.comments_enabled === false) || (isCommunityVote && communityVote?.vote.allow_comments === false);
  const bodyMarkdown = bodyMarkdownForPost(post);
  const genericRoomNativeDetails = post.post_type === "community_network" ? legacyCommunityNetworkDetails(parsedBody) : [];
  return <>
    <section className={isOfficialUpdate ? "section-card commune-post-detail commune-official-post-detail" : isCommunityVote ? "section-card commune-post-detail commune-vote-post-detail" : "section-card commune-post-detail"}>
      <p className="eyebrow">{post.post_type === "research_note" ? "Research Notes" : post.post_type === "community_vote" ? "Community Voting Room" : post.post_type.replace(/_/g, " ")}</p>
      <h2>{post.title}</h2>
      <p>{isOfficialUpdate ? "By Elysia Ecobotics Official" : <>By {authorLink(post.author_username)}</>}</p>
      <StatusBadges labels={[post.status, post.visibility]} />
      <RoomNativeDetails label="Room-native details" fields={genericRoomNativeDetails} />
      {isRepositoryShowcase && <RepositoryShowcaseDetail post={post} showcase={repositoryShowcase} parsedBody={parsedBody} />}
      {isIterationShowcase && <ElysiaIterationShowcaseDetail post={post} iteration={iterationShowcase} parsedBody={parsedBody} />}
      {isOfficialUpdate && <OfficialUpdateDetail post={post} officialUpdate={officialUpdate} parsedBody={parsedBody} />}
      {isCommunityVote && <CommunityVoteDetail communityVote={communityVote} signedIn={state.signedIn} isAdmin={state.isAdmin} onMessage={setMessage} onChanged={refresh} />}
      {isTroubleshooting && <TroubleshootingDetail post={post} troubleshooting={troubleshooting} parsedBody={parsedBody} comments={state.comments} userId={state.userId} isModerator={state.isModerator} onMessage={setMessage} onChanged={refresh} />}
      {isResearchNotes && <ResearchNotesDetail post={post} researchNote={researchNote} parsedBody={parsedBody} isModerator={state.isModerator} onMessage={setMessage} onChanged={refresh} />}
      {isJobPost && <JobPostDetail post={post} jobPost={jobPost} parsedBody={parsedBody} isModerator={state.isModerator} onMessage={setMessage} onChanged={refresh} />}
      <CommunePostBody body={bodyMarkdown} />
      {attachments.length > 0 && <div className="commune-media-section"><p className="eyebrow">Attached media</p><p className="commune-media-attribution">Attached to this post by {isOfficialUpdate ? "Elysia Ecobotics Official" : authorLink(post.author_username)}.</p><p className="boundary-note">Published attachments are read-only and remain governed by Commune moderation and safety policies.</p><div className="commune-media-grid">{attachments.map((item) => <article className="commune-media-card" key={item.id}>{item.media_kind === "image" && item.signed_url ? <button className="commune-media-image-button" type="button" onClick={() => setActiveMedia(item)}><img src={item.signed_url} alt={`Attached media: ${item.file_name}`} loading="lazy" /></button> : <div className="commune-media-unavailable"><strong>{item.file_name}</strong><p>{item.signed_url ? "This attachment can be opened from its signed public review URL." : "Attachment unavailable or still under review."}</p></div>}<div className="commune-media-meta"><strong>{item.file_name}</strong><span>{item.mime_type ?? item.media_kind}{item.file_size ? ` · ${item.file_size} bytes` : ""}</span></div></article>)}</div></div>}
      {isOfficialUpdate ? <OfficialCodeSnippets officialUpdate={officialUpdate} officialCodeSnippets={officialCodeSnippets} fallbackSnippets={snippets} isAdmin={state.isAdmin} onMessage={setMessage} onChanged={refresh} /> : !isCommunityVote && <AttachedCodeSnippets snippets={snippets} authorUsername={post.author_username} postType={post.post_type} signedIn={state.signedIn} onMessage={setMessage} />}
      <TagChips tags={post.tags} />
      <ReactionBar targetType="post" targetId={post.id} signedIn={state.signedIn} onMessage={setMessage} />
      <div className="button-row"><button type="button" onClick={() => void save()}>{state.savedPostIds.includes(postId) ? "Saved" : "Save post"}</button><button type="button" onClick={() => void follow()}>{thread && state.followedThreadIds.includes(thread.id) ? "Following" : "Follow thread"}</button><button type="button" onClick={() => void markRead()}>Mark read</button></div>
    </section>
    {activeMedia?.signed_url && <div className="commune-media-lightbox" role="dialog" aria-modal="true" aria-label={`Attachment preview: ${activeMedia.file_name}`} onClick={() => setActiveMedia(null)}><div className="commune-media-lightbox-panel" onClick={(event) => event.stopPropagation()}><button className="commune-media-lightbox-close" type="button" onClick={() => setActiveMedia(null)}>Close</button><img src={activeMedia.signed_url} alt={`Attached media: ${activeMedia.file_name}`} /></div></div>}
    <section className="section-card"><p className="eyebrow">Comments</p><h2>Comments and replies</h2><p className="boundary-note">{commentsLocked ? isCommunityVote ? "Comments are disabled for this Community Voting Room vote. Existing public comments remain visible unless moderated, but new public comments are disabled by an administrator." : "Comments are locked for this Official Update. Existing public comments remain visible unless moderated, but new public comments are disabled by an administrator." : state.isAdmin ? "Admin comments publish directly and remain auditable." : "First participation in a post/thread is reviewed. After approval in that thread, later comments and replies can publish directly while remaining reportable and removable."}</p>{!thread && <p className="boundary-note">This published post is missing its discussion thread. Submitting a comment will try to repair the thread with normal account permissions before saving.</p>}{topLevelComments.map((item) => renderComment(item))}{!topLevelComments.length && <p>Moderated comments will appear here once the backend tables are active and replies are approved.</p>}{commentsLocked ? <p className="message">{isCommunityVote ? "Comments are disabled for this Community Voting Room vote." : "Comments are locked for this official update."}</p> : <><label><span>Comment on this post</span><textarea rows={4} value={comment} onChange={(event) => setComment(event.target.value)} /></label><div className="button-row"><button type="button" disabled={commentSubmitting} onClick={() => void submitThreadComment()}>{commentSubmitting ? "Submitting comment..." : "Submit comment"}</button></div></>}<p className="message">{commentStatus}</p></section>
    <section className="section-card"><p className="eyebrow">Report</p><h2>Report this post</h2><p>Reports are reviewed by moderators/administrators. Reporting does not automatically remove content unless urgent automated controls are later added. Ratings do not replace reports or moderation.</p><label><span>Report type</span><select value={report.type} onChange={(event) => setReport({ ...report, type: event.target.value })}>{reportTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label><span>Reason</span><textarea rows={3} value={report.reason} onChange={(event) => setReport({ ...report, reason: event.target.value })} /></label><button type="button" onClick={() => void reportPost()}>Send report</button><p className="message">{message}</p></section>
    {isOfficialUpdate && state.isAdmin && <OfficialUpdateAdminPanel officialUpdate={officialUpdate} postId={post.id} onMessage={setMessage} onChanged={refresh} />}
    <AdminContentControls targetType="post" targetId={post.id} isModerator={state.isModerator} onChanged={refresh} onDeleted={setLocallyDeletedPostId} onMessage={setMessage} />
  </>;
}

function ModerationPanel() {
  const [items, setItems] = useState<CommuneModerationItem[]>([]);
  const [message, setMessage] = useState("Moderation is role-gated. If the backend is not active yet, this panel stays in preview mode.");
  const [reason, setReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CommuneModerationItem | null>(null);
  const refresh = useCallback(async () => {
    const result = await loadCommuneModerationQueue();
    logCommuneDiagnostics("moderation", result.warnings);
    setItems(result.items);
    setMessage(result.warnings.length ? "Moderation is not available for this session. Assigned roles and active backend queues are required." : "Commune moderation queue loaded.");
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function act(item: CommuneModerationItem, action: "approve" | "reject" | "hide" | "archive" | "needs_information" | "escalate") { const result = await moderateCommuneItem(item, action, reason); setMessage(cleanCommuneMessage(result.message, "Moderation action could not be completed because the backend queue is not active yet.")); await refresh(); }
  async function contentAct(item: CommuneModerationItem, action: "flag" | "delete") {
    if (item.kind !== "post" && item.kind !== "comment") return;
    const result = await moderateCommuneContentTarget({ targetType: item.kind, targetId: item.id, action, reason });
    setMessage(cleanCommuneMessage(result.message, "Moderation action could not be completed because the backend queue is not active yet."));
    setDeleteTarget(null);
    await refresh();
  }
  return <section className="section-card"><p className="eyebrow">Role-gated moderation</p><h2>Commune moderation queue</h2><p className="boundary-note">Normal users cannot access RLS-protected pending posts, comments, uploads, reports, or moderation events.</p><label><span>Moderation note</span><input value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="commune-draft-grid">{items.map((item) => <article key={`${item.kind}-${item.id}`}><h3>{item.title}</h3><StatusBadges labels={[item.kind, item.status]} /><p>{item.summary}</p><div className="button-row"><button onClick={() => void act(item, "approve")}>Approve/publish</button><button onClick={() => void act(item, "needs_information")}>Needs info</button><button onClick={() => void act(item, "reject")}>Reject/remove</button><button onClick={() => void act(item, "hide")}>Hide</button><button onClick={() => void act(item, "archive")}>Archive</button><button onClick={() => void act(item, "escalate")}>Escalate</button>{(item.kind === "post" || item.kind === "comment") && <><button type="button" onClick={() => void contentAct(item, "flag")}>Flag for removal</button><button type="button" onClick={() => setDeleteTarget(item)}>Delete</button></>}</div>{deleteTarget?.id === item.id && deleteTarget.kind === item.kind && <div className="commune-delete-confirm"><h3>Delete/remove this Commune content?</h3><p>This removes the item from public views and leaves admin-only History evidence.</p><div className="button-row"><button type="button" onClick={() => void contentAct(item, "delete")}>Yes, delete/remove</button><button type="button" onClick={() => setDeleteTarget(null)}>No, keep it</button></div></div>}</article>)}</div>{!items.length && <p>Moderation items will appear here for authorized roles when account-backed Commune tables are active.</p>}<p className="message">{message}</p></section>;
}

function proposalStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function CodeRevisionProposalWorkspace({ account, onMessage }: { account: { signedIn: boolean; userId: string | null; isModerator: boolean }; onMessage: (message: string) => void }) {
  const location = useLocation();
  const isTroubleshootingWorkbench = /\/commune\/troubleshooting-grove\/review$/.test(location.pathname);
  const proposalNoun = isTroubleshootingWorkbench ? "fix" : "revision";
  const proposalPlural = isTroubleshootingWorkbench ? "proposed fixes" : "revision proposals";
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryPostId = params.get("post");
  const querySnippetId = params.get("snippet");
  const queryProposalId = params.get("proposal");
  const [snippets, setSnippets] = useState<CommuneCodeSnippet[]>([]);
  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(querySnippetId);
  const [proposals, setProposals] = useState<CodeRevisionProposal[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(queryProposalId);
  const [proposalForm, setProposalForm] = useState({ sourceSnippetId: "", codeText: "", language: "text", fileName: "snippet.txt", changeSummary: "", explanation: "" });
  const [decisionNote, setDecisionNote] = useState("");
  const [proposalMessage, setProposalMessage] = useState(isTroubleshootingWorkbench ? "Troubleshooting workbench loads from a public reproduction snippet. Public code stays stable until the original post author accepts a proposed fix." : "Proposal workspace loads from a public Coding Cornucopia post snippet. Public code stays stable until the original post author accepts a revision.");
  const activeSnippet = snippets.find((snippet) => snippet.id === selectedSnippetId) ?? snippets[0] ?? null;
  const selectedProposal = selectedProposalId ? proposals.find((proposal) => proposal.id === selectedProposalId) ?? null : proposals[0] ?? null;
  const proposalDiagnostics = runStaticCodingDiagnostics({ language: proposalForm.language, fileName: proposalForm.fileName, code: proposalForm.codeText });
  const draftDiff = activeSnippet ? buildPatchOrDiffPreview(activeSnippet.code_text, proposalForm.codeText) : null;
  const selectedDiff = selectedProposal ? buildPatchOrDiffPreview(selectedProposal.base_code_text, selectedProposal.proposed_code_text) : null;
  const canDecide = Boolean(selectedProposal && account.userId && selectedProposal.original_author_user_id === account.userId && ["submitted", "needs_changes"].includes(selectedProposal.proposal_status));
  const canWithdraw = Boolean(selectedProposal && account.userId && selectedProposal.proposer_user_id === account.userId && ["draft", "submitted", "needs_changes"].includes(selectedProposal.proposal_status));
  const hasProposalContext = Boolean(queryPostId || queryProposalId);

  const refreshProposals = useCallback(async () => {
    if (!queryPostId && !queryProposalId) return;
    if (queryProposalId) {
      const proposalResult = await listCodeRevisionProposals({ proposalId: queryProposalId });
      logCommuneDiagnostics("code-revision-proposal", proposalResult.warnings);
      setProposals(proposalResult.proposals);
      const proposal = proposalResult.proposals[0];
      if (proposal) {
        const snippetResult = await loadCodeSnippets(proposal.post_id);
        logCommuneDiagnostics("code-revision-proposal-snippet", snippetResult.warnings);
        setSnippets(snippetResult.snippets);
        setSelectedSnippetId(proposal.code_snippet_id);
        setSelectedProposalId(proposal.id);
      } else if (proposalResult.warnings.length) {
        setProposalMessage(isTroubleshootingWorkbench ? "Troubleshooting proposed-fix records are not active yet or this proposal is private to its participants." : "Coding Cornucopia proposal records are not active yet or this proposal is private to its participants.");
      }
      return;
    }
    if (!queryPostId) return;
    const [snippetResult, proposalResult] = await Promise.all([
      loadCodeSnippets(queryPostId),
      listCodeRevisionProposals({ postId: queryPostId, codeSnippetId: querySnippetId ?? undefined })
    ]);
    logCommuneDiagnostics("code-revision-proposals", [...snippetResult.warnings, ...proposalResult.warnings]);
    setSnippets(snippetResult.snippets);
    setProposals(proposalResult.proposals);
    setSelectedSnippetId((current) => current && snippetResult.snippets.some((snippet) => snippet.id === current) ? current : querySnippetId ?? snippetResult.snippets[0]?.id ?? null);
    setSelectedProposalId((current) => current && proposalResult.proposals.some((proposal) => proposal.id === current) ? current : proposalResult.proposals[0]?.id ?? null);
    if (proposalResult.warnings.length) setProposalMessage("Author-controlled proposal records are not active until the latest Coding Cornucopia migration is applied.");
  }, [queryPostId, queryProposalId, querySnippetId]);

  useEffect(() => { void refreshProposals(); }, [refreshProposals]);
  useEffect(() => {
    if (!activeSnippet || proposalForm.sourceSnippetId === activeSnippet.id) return;
    setProposalForm({
      sourceSnippetId: activeSnippet.id,
      codeText: activeSnippet.code_text,
      language: activeSnippet.language ?? "text",
      fileName: activeSnippet.file_name ?? "snippet.txt",
      changeSummary: "",
      explanation: ""
    });
  }, [activeSnippet?.id, activeSnippet?.code_text, activeSnippet?.language, activeSnippet?.file_name, proposalForm.sourceSnippetId]);

  async function submitProposal() {
    if (!activeSnippet) return setProposalMessage(isTroubleshootingWorkbench ? "Choose an attached reproduction snippet before proposing a fix." : "Choose an attached code snippet before proposing a revision.");
    const result = await submitCodeRevisionProposal({
      postId: activeSnippet.post_id,
      codeSnippetId: activeSnippet.id,
      proposedCodeText: proposalForm.codeText,
      language: proposalForm.language,
      fileName: proposalForm.fileName,
      changeSummary: proposalForm.changeSummary,
      explanation: proposalForm.explanation
    });
    setProposalMessage(cleanCommuneMessage(result.message, "Coding Cornucopia proposal storage is not active yet."));
    onMessage(result.message);
    if (result.ok) {
      setSelectedProposalId(result.proposalId ?? null);
      setProposalForm((current) => ({ ...current, changeSummary: "", explanation: "" }));
      await refreshProposals();
    }
  }

  async function decideProposal(decision: "accepted" | "rejected" | "needs_changes" | "hidden_by_moderation") {
    if (!selectedProposal) return;
    const result = await decideCodeRevisionProposal(selectedProposal.id, decision, decisionNote);
    setProposalMessage(cleanCommuneMessage(result.message, "Coding Cornucopia proposal decision storage is not active yet."));
    onMessage(result.message);
    if (result.ok) {
      setDecisionNote("");
      await refreshProposals();
    }
  }

  async function withdrawProposal() {
    if (!selectedProposal) return;
    const result = await withdrawCodeRevisionProposal(selectedProposal.id);
    setProposalMessage(cleanCommuneMessage(result.message, "Coding Cornucopia proposal withdrawal is not active yet."));
    onMessage(result.message);
    if (result.ok) await refreshProposals();
  }

  if (!hasProposalContext) return null;

  return <section className="commune-proposal-workspace">
    <div className="section-heading section-heading--inline">
      <div>
        <p className="eyebrow">{isTroubleshootingWorkbench ? "Troubleshooting workbench" : "Author-controlled revisions"}</p>
        <h3>{isTroubleshootingWorkbench ? "Propose fixes without overwriting the public reproduction" : "Propose changes without overwriting public code"}</h3>
        <p>Community members can submit proposed {proposalPlural}. The original post author accepts, rejects, or asks for changes; moderators enforce safety without silently taking authorship control.</p>
      </div>
      <button type="button" onClick={() => void refreshProposals()}>Refresh proposals</button>
    </div>
    <StatusBadges labels={["stable public snapshot", "proposals only", "author approval", "version history", "sandbox success is not trust"]} />
    <p className="boundary-note">Rejected proposals preserve the original public code. Accepted proposals update the attached snippet and keep proposal attribution/history. Live session edits do not auto-publish.</p>
    {!account.signedIn && <p className="message">Sign in to propose revisions, withdraw your proposal, or decide proposals on your own posts.</p>}
    {!snippets.length && <p className="commune-empty-state">No public code snippet is available for this proposal context yet.</p>}
    {snippets.length > 1 && <label><span>Attached snippet</span><select value={activeSnippet?.id ?? ""} onChange={(event) => setSelectedSnippetId(event.target.value)}>{snippets.map((snippet) => <option key={snippet.id} value={snippet.id}>{snippet.file_name ?? "snippet"} · v{snippet.accepted_version_number ?? 1}</option>)}</select></label>}
    {activeSnippet && <div className="commune-proposal-grid">
      <article className="commune-code-preview">
        <div className="addon-card__topline"><strong>Current accepted snapshot v{activeSnippet.accepted_version_number ?? 1}</strong><span>{activeSnippet.file_name ?? "snippet"}</span></div>
        <CodeWorkspaceEditor value={activeSnippet.code_text} language={activeSnippet.language} readOnly minHeight="280px" />
        <CodingSandboxRunPanel snapshotId={activeSnippet.accepted_revision_id ?? activeSnippet.id} sourceType="commune_post_snippet" sourceId={activeSnippet.id} postId={activeSnippet.post_id} language={activeSnippet.language ?? "text"} fileName={activeSnippet.file_name} code={activeSnippet.code_text} signedIn={account.signedIn} runLabel="Run current accepted snapshot in sandbox" />
        <p className="boundary-note">This is the public code right now. Proposal drafts below do not change it.</p>
      </article>
      <article className="commune-code-preview">
        <div className="addon-card__topline"><strong>{isTroubleshootingWorkbench ? "Proposed fix draft" : "Proposed revision draft"}</strong><span>{proposalForm.fileName || "snippet"}</span></div>
        <div className="commune-form-grid"><label><span>Language</span><select value={normalizeCodingLanguage(proposalForm.language)} onChange={(event) => setProposalForm({ ...proposalForm, language: event.target.value })}>{codingLanguageOptions().map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}</select></label><label><span>Filename</span><input value={proposalForm.fileName} onChange={(event) => setProposalForm({ ...proposalForm, fileName: event.target.value })} /></label><label className="wide-field"><span>Change summary</span><input value={proposalForm.changeSummary} onChange={(event) => setProposalForm({ ...proposalForm, changeSummary: event.target.value })} placeholder="What changed and why?" /></label><label className="wide-field"><span>Optional explanation</span><textarea rows={3} value={proposalForm.explanation} onChange={(event) => setProposalForm({ ...proposalForm, explanation: event.target.value })} /></label></div>
        <CodeWorkspaceEditor value={proposalForm.codeText} language={proposalForm.language} onChange={(value) => setProposalForm({ ...proposalForm, codeText: value })} minHeight="320px" />
        {draftDiff && <StatusBadges labels={[draftDiff.changed ? "changed" : "unchanged", `${draftDiff.oldLineCount} -> ${draftDiff.newLineCount} lines`, `${draftDiff.sizeDelta >= 0 ? "+" : ""}${draftDiff.sizeDelta} chars`]} />}
        <DiagnosticsList diagnostics={proposalDiagnostics} />
        <CodingSandboxRunPanel snapshotId={proposalDraftSnapshotId(activeSnippet.id, proposalForm)} sourceType="commune_post_snippet" sourceId={activeSnippet.id} postId={activeSnippet.post_id} language={proposalForm.language} fileName={proposalForm.fileName} code={proposalForm.codeText} signedIn={account.signedIn} runLabel={isTroubleshootingWorkbench ? "Run proposed fix in sandbox" : "Run proposed revision in sandbox"} />
        <div className="button-row"><button className="button-primary" type="button" disabled={!account.signedIn || !draftDiff?.changed} onClick={() => void submitProposal()}>{isTroubleshootingWorkbench ? "Submit proposed fix" : "Submit proposed revision"}</button><button type="button" onClick={() => setProposalForm({ sourceSnippetId: activeSnippet.id, codeText: activeSnippet.code_text, language: activeSnippet.language ?? "text", fileName: activeSnippet.file_name ?? "snippet.txt", changeSummary: "", explanation: "" })}>Reset to current snapshot</button></div>
        <p className="boundary-note">Run the proposed {proposalNoun} before submitting if you want sandbox evidence. Running does not submit the proposal, update public code, install anything, or mark this code safe.</p>
        <p className="boundary-note">Submitting sends a private signal to the original poster. It does not publish, install, execute, or mark this code safe.</p>
      </article>
    </div>}
    <div className="commune-proposal-grid">
      <article>
        <h3>{isTroubleshootingWorkbench ? "Proposed fixes" : "Revision proposals"}</h3>
        {!proposals.length && <p className="commune-empty-state">No proposals are visible for this snippet yet.</p>}
        {proposals.map((proposal) => <button type="button" className={selectedProposal?.id === proposal.id ? "commune-room-button commune-room-button--active" : "commune-room-button"} key={proposal.id} onClick={() => setSelectedProposalId(proposal.id)}><strong>{proposal.change_summary}</strong><span>{proposalStatusLabel(proposal.proposal_status)} · {proposal.submitted_at ? new Date(proposal.submitted_at).toLocaleString() : "submitted"}</span></button>)}
      </article>
      {selectedProposal && <article className="commune-proposal-detail">
        <div className="addon-card__topline"><strong>{selectedProposal.change_summary}</strong><span>{proposalStatusLabel(selectedProposal.proposal_status)}</span></div>
        <p>{selectedProposal.explanation || "No proposer explanation supplied."}</p>
        {selectedDiff && <StatusBadges labels={[selectedDiff.changed ? "changed" : "unchanged", `${selectedDiff.oldLineCount} -> ${selectedDiff.newLineCount} lines`, `${selectedDiff.sizeDelta >= 0 ? "+" : ""}${selectedDiff.sizeDelta} chars`, selectedProposal.base_snapshot_label ?? "base snapshot"]} />}
        <div className="commune-proposal-compare">
          <article><h4>Original/current base</h4><CodeWorkspaceEditor value={selectedProposal.base_code_text} language={selectedProposal.language} readOnly minHeight="260px" /></article>
          <article><h4>Proposed code</h4><CodeWorkspaceEditor value={selectedProposal.proposed_code_text} language={selectedProposal.language} readOnly minHeight="260px" /></article>
        </div>
        <DiagnosticsList diagnostics={runStaticCodingDiagnostics({ language: selectedProposal.language, fileName: selectedProposal.file_name, code: selectedProposal.proposed_code_text })} />
        <CodingSandboxRunPanel snapshotId={`proposal-${selectedProposal.id}`} sourceType="commune_post_snippet" sourceId={selectedProposal.code_snippet_id} postId={selectedProposal.post_id} language={selectedProposal.language ?? "text"} fileName={selectedProposal.file_name} code={selectedProposal.proposed_code_text} signedIn={account.signedIn} runLabel="Run proposed revision in sandbox" />
        <label><span>Decision note</span><input value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder="Optional note for proposer/history" /></label>
        <div className="button-row">{canDecide && <><button className="button-primary" type="button" onClick={() => void decideProposal("accepted")}>{isTroubleshootingWorkbench ? "Accept fix" : "Accept revision"}</button><button type="button" onClick={() => void decideProposal("needs_changes")}>Ask for changes</button><button type="button" onClick={() => void decideProposal("rejected")}>{isTroubleshootingWorkbench ? "Reject fix" : "Reject revision"}</button></>}{canWithdraw && <button type="button" onClick={() => void withdrawProposal()}>Withdraw my proposal</button>}{account.isModerator && ["submitted", "needs_changes"].includes(selectedProposal.proposal_status) && <button type="button" onClick={() => void decideProposal("hidden_by_moderation")}>Hide unsafe proposal</button>}</div>
        <p className="boundary-note">Author approval is separate from moderator safety enforcement. Sandbox success is evidence, not trust, Marketplace readiness, or approval.</p>
      </article>}
    </div>
    <p className="message">{proposalMessage}</p>
  </section>;
}

function CollaborativeCodeReviewPanel() {
  const location = useLocation();
  const workbenchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const proposalContextActive = Boolean(workbenchParams.get("post") || workbenchParams.get("proposal"));
  const [published, setPublished] = useState<CodeDocument[]>([]);
  const [mine, setMine] = useState<CodeDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<CodeDocumentVersion[]>([]);
  const [annotations, setAnnotations] = useState<CodeAnnotation[]>([]);
  const [session, setSession] = useState<CodeSession | null>(null);
  const [account, setAccount] = useState({ signedIn: false, userId: null as string | null, isModerator: false });
  const [message, setMessage] = useState("Collaborative code review is text for discussion only. It does not run, install, clone, or access local files.");
  const [form, setForm] = useState({ title: "", language: "text", fileName: "review.txt", summary: "", text: "" });
  const [snapshotSummary, setSnapshotSummary] = useState("Manual review snapshot");
  const [annotation, setAnnotation] = useState({ lineStart: 1, lineEnd: 1, comment: "" });
  const [report, setReport] = useState({ reason: codeReviewReportReasons[0], detail: "" });
  const [moderationReason, setModerationReason] = useState("Code review moderation action.");
  const documents = useMemo(() => [...mine, ...published.filter((doc) => !mine.some((owned) => owned.id === doc.id))], [mine, published]);
  const selected = selectedId ? documents.find((document) => document.id === selectedId) ?? null : null;
  const secretWarnings = detectSecretLikeCodeText([form.title, form.fileName, form.summary, form.text].join("\n"));
  const canEditSelected = account.signedIn && (!selected || selected.owner_user_id === account.userId || account.isModerator);

  const refreshDocuments = useCallback(async () => {
    if (proposalContextActive) {
      const accountState = await loadCodeReviewAccount();
      logCommuneDiagnostics("code-review-account", accountState.warnings);
      setAccount({ signedIn: accountState.signedIn, userId: accountState.userId, isModerator: accountState.isModerator });
      return;
    }
    const [publicDocs, myDocs, accountState] = await Promise.all([listPublishedCodeDocuments(), listMyCodeDocuments(), loadCodeReviewAccount()]);
    logCommuneDiagnostics("code-review", [...publicDocs.warnings, ...myDocs.warnings, ...accountState.warnings]);
    setPublished(publicDocs.documents);
    setMine(myDocs.documents);
    setAccount({ signedIn: accountState.signedIn, userId: accountState.userId, isModerator: accountState.isModerator });
    if (publicDocs.warnings.length || myDocs.warnings.length) setMessage("Collaborative code review tables are not active yet. You can still use local code snippets, post drafts, and sandbox request drafts.");
  }, [proposalContextActive]);

  const refreshSelected = useCallback(async (documentId: string) => {
    const [versionResult, annotationResult, sessionResult] = await Promise.all([listDocumentVersions(documentId), listAnnotations(documentId), import("./communeCodeReviewApi").then((api) => api.getCodeSession(documentId))]);
    logCommuneDiagnostics("code-review-detail", [...versionResult.warnings, ...annotationResult.warnings, ...sessionResult.warnings]);
    setVersions(versionResult.versions);
    setAnnotations(annotationResult.annotations);
    setSession(sessionResult.session);
  }, []);

  useEffect(() => { void refreshDocuments(); }, [refreshDocuments]);
  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setForm({ title: selected.title, language: selected.language, fileName: selected.file_name ?? "", summary: selected.summary ?? "", text: selected.current_text });
    void refreshSelected(selected.id);
  }, [selected?.id, refreshSelected]);

  async function saveDocument() {
    const result = selected && canEditSelected ? await updateCodeDocument(selected.id, form) : await createCodeDocument(form);
    setMessage(cleanCommuneMessage(result.message, "Collaborative code review storage is not active yet."));
    if (result.document) setSelectedId(result.document.id);
    await refreshDocuments();
  }

  async function snapshot() {
    if (!selected) return setMessage("Save or choose a document before creating a snapshot.");
    const result = await createDocumentVersion(selected.id, form.text, snapshotSummary);
    setMessage(cleanCommuneMessage(result.message, "Version storage is not active yet."));
    await refreshSelected(selected.id);
  }

  async function submitReview() {
    if (!selected) return setMessage("Save or choose a document before submitting it.");
    const result = await submitCodeDocumentForReview(selected.id);
    setMessage(cleanCommuneMessage(result.message, "Code review submission backend is not active yet."));
    await refreshDocuments();
  }

  async function publishOrModerate(action: "publish" | "archive" | "hide" | "remove") {
    if (!selected) return;
    const result = action === "publish" ? await publishCodeDocument(selected.id, moderationReason) : action === "archive" ? await archiveCodeDocument(selected.id, moderationReason) : action === "hide" ? await hideCodeDocument(selected.id, moderationReason) : await removeCodeDocument(selected.id, moderationReason);
    setMessage(cleanCommuneMessage(result.message, "Code review moderation backend is not active yet."));
    await refreshDocuments();
  }

  async function addAnnotation() {
    if (!selected) return setMessage("Choose a document before annotating.");
    const result = await createAnnotation(selected.id, annotation.lineStart, annotation.lineEnd, annotation.comment);
    setMessage(cleanCommuneMessage(result.message, "Annotation storage is not active yet."));
    if (result.ok) setAnnotation({ lineStart: 1, lineEnd: 1, comment: "" });
    await refreshSelected(selected.id);
  }

  async function annotationAction(item: CodeAnnotation, action: "resolve" | "hide" | "remove" | "report") {
    const result = action === "resolve" ? await resolveAnnotation(item.id) : action === "hide" ? await hideAnnotation(item.id, moderationReason) : action === "remove" ? await removeAnnotation(item.id, moderationReason) : await reportCodeAnnotation(item.id, report.reason, report.detail);
    setMessage(cleanCommuneMessage(result.message, "Annotation action backend is not active yet."));
    if (selected) await refreshSelected(selected.id);
  }

  async function reportDocument() {
    if (!selected) return;
    const result = await reportCodeDocument(selected.id, report.reason, report.detail);
    setMessage(cleanCommuneMessage(result.message, "Code review report backend is not active yet."));
  }

  async function lock(action: "acquire" | "release") {
    if (!selected) return;
    const result = action === "acquire" ? await acquireEditLock(selected.id) : await releaseEditLock(selected.id);
    setMessage(cleanCommuneMessage(result.message, "Edit-lock backend is not active yet."));
    await refreshSelected(selected.id);
  }

  function prepareSandboxFromSelected() {
    if (!selected) return;
    writeStorage<Partial<SandboxRequestInput>>("commune.sandboxHandoffPrefill.v1", {
      source_type: "commune_code_document",
      source_id: selected.id,
      code_document_id: selected.id,
      title: `Sandbox review: ${selected.title}`,
      summary: selected.summary ?? "Collaborative code review document prepared for metadata-only sandbox review.",
      language: selected.language,
      code_text: selected.current_text,
      declared_network_policy: "disabled",
      declared_filesystem_policy: "temporary_workspace_only",
      requested_cpu_limit: "low",
      requested_memory_limit: "256 MB",
      requested_timeout_seconds: 10,
      risk_notes: "Prepared from a Commune code review document. Website did not execute, install, clone, or call Local Elysia.",
      user_acknowledged_no_execution: false,
      user_acknowledged_no_secrets: false,
      user_acknowledged_local_elysia_final_authority: false
    });
  }

  const currentDiagnostics = runStaticCodingDiagnostics({ language: form.language, fileName: form.fileName, code: form.text });

  return <section className="section-card commune-code-review-card" id="commune-code-review">
    <div className="section-heading section-heading--inline"><div><p className="eyebrow">Coding Cornucopia Workbench</p><h2>{proposalContextActive ? "Proposal revision workbench" : "Shared code documents, snapshots, diagnostics, and governed sandbox runs"}</h2><p>{proposalContextActive ? "Current accepted snapshot, proposed revision draft, sandbox diagnostics, and submission stay together here. The general document workbench is separate." : "Code here is text for discussion and review. Real execution is allowed only from explicit snapshots through the configured isolated sandbox service."}</p></div>{proposalContextActive ? <Link className="button-link" to="/commune/coding-cornucopia/review">Open general document workbench</Link> : <button type="button" onClick={() => void refreshDocuments()}>Refresh</button>}</div>
    <StatusBadges labels={["CodeMirror editor", "manual snapshots", "line annotations", "simple edit lock", "static diagnostics", "snapshot sandbox runs", "no terminal"]} />
    <p className="boundary-note">Do not paste credentials, private local Elysia logs, private files, vault data, tokens, or secrets. Coding Cornucopia documents are cloud-hosted community data. Successful sandbox output is evidence, not approval or trust.</p>
    <CodeRevisionProposalWorkspace account={account} onMessage={setMessage} />
    {proposalContextActive ? <section className="commune-proposal-route-note">
      <p className="eyebrow">Separate workspace hidden</p>
      <h3>General documents are not shown on proposal routes</h3>
      <p>The active flow is: current accepted snapshot, proposed revision draft, run proposed revision, then submit proposal. Opening the general document workbench will not submit or overwrite this proposal.</p>
      <Link className="button-link" to="/commune/coding-cornucopia/review">Open general Coding Cornucopia documents</Link>
    </section> : <div className="commune-code-review-layout">
      <aside className="commune-code-doc-list"><h3>Documents</h3>{!documents.length && <p className="commune-empty-state">No code review documents yet.</p>}{documents.map((document) => <button type="button" className={selected?.id === document.id ? "commune-room-button commune-room-button--active" : "commune-room-button"} key={document.id} onClick={() => setSelectedId(document.id)}><strong>{document.title}</strong><span>{document.language} · {document.visibility_state} · {new Date(document.updated_at).toLocaleDateString()}</span></button>)}<button type="button" onClick={() => { setSelectedId(null); setForm({ title: "", language: "text", fileName: "review.txt", summary: "", text: "" }); setVersions([]); setAnnotations([]); setSession(null); }}>New document</button></aside>
      <div className="commune-code-workbench">
        <div className="commune-form-grid"><label><span>Title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label><span>Language</span><select value={normalizeCodingLanguage(form.language)} onChange={(event) => setForm({ ...form, language: event.target.value })}>{codingLanguageOptions().map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}</select></label><label><span>Filename</span><input value={form.fileName} onChange={(event) => setForm({ ...form, fileName: event.target.value })} /></label><label><span>Summary</span><input value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label><label className="wide-field"><span>Code text</span><CodeWorkspaceEditor value={form.text} language={form.language} onChange={(value) => setForm({ ...form, text: value })} minHeight="420px" /></label></div>
        <div className="addon-card__topline"><span>{form.text.length.toLocaleString()}/100,000 characters</span><span>{session?.active_editor_user_id ? `edit lock held until ${session.edit_lock_expires_at ? new Date(session.edit_lock_expires_at).toLocaleTimeString() : "unknown"}` : "no active edit lock"}</span></div>
        {secretWarnings.length > 0 && <WarningCallout title="Secret warning"><p>Review before saving. Flags: {secretWarnings.join(", ")}. Obvious keys/private material are blocked by the save validator.</p></WarningCallout>}
        <div className="button-row"><button className="button-primary" type="button" disabled={!account.signedIn} onClick={() => void saveDocument()}>{selected ? "Save document" : "Create document"}</button><button type="button" disabled={!selected} onClick={() => void submitReview()}>Submit for review</button><button type="button" disabled={!selected} onClick={() => void snapshot()}>Create version snapshot</button><button type="button" disabled={!selected} onClick={() => void lock("acquire")}>Acquire edit lock</button><button type="button" disabled={!selected} onClick={() => void lock("release")}>Release edit lock</button></div>
        <label><span>Snapshot summary</span><input value={snapshotSummary} onChange={(event) => setSnapshotSummary(event.target.value)} /></label>
        {account.isModerator && <div className="commune-moderator-controls"><label><span>Moderation reason</span><input value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} /></label><button type="button" disabled={!selected} onClick={() => void publishOrModerate("publish")}>Publish</button><button type="button" disabled={!selected} onClick={() => void publishOrModerate("archive")}>Archive</button><button type="button" disabled={!selected} onClick={() => void publishOrModerate("hide")}>Hide</button><button type="button" disabled={!selected} onClick={() => void publishOrModerate("remove")}>Remove</button></div>}
        <section className="commune-code-preview"><div className="addon-card__topline"><strong>{getCodingLanguagePolicy(form.language).label}</strong><span>{form.fileName || "untitled"}</span></div><CodeWorkspaceEditor value={form.text} language={form.language} readOnly minHeight="280px" /><DiagnosticsList diagnostics={currentDiagnostics} /><div className="button-row"><button type="button" onClick={() => void copyText(form.text, setMessage)}>Copy code text</button><button type="button" onClick={() => downloadText(`${slug(form.title || "code-review")}.txt`, form.text, "text/plain")}>Export text</button><Link className="button-link" to="/commune/rooms/coding-cornucopia/new">Create Commune code post from this document</Link><Link className="button-link" to="/commune/coding-cornucopia/sandbox-request" onClick={prepareSandboxFromSelected}>Prepare sandbox review request</Link></div><p className="boundary-note">Static diagnostics are local text checks. Create a manual snapshot before asking the configured sandbox to execute anything.</p></section>
        <section className="commune-info-grid"><article><h3>Manual snapshots</h3>{!versions.length && <p>No snapshots yet. Sandbox runs require a saved manual snapshot.</p>}{versions.map((version) => <details key={version.id}><summary>v{version.version_number}: {version.change_summary ?? "Snapshot"}</summary><p>{new Date(version.created_at).toLocaleString()}</p><CodeWorkspaceEditor value={version.snapshot_text} language={form.language} readOnly minHeight="220px" /><div className="button-row"><button type="button" onClick={() => void copyText(version.snapshot_text, setMessage)}>Copy snapshot</button></div><CodingSandboxRunPanel snapshotId={version.id} sourceType="commune_code_version" sourceId={selected?.id ?? null} codeDocumentId={selected?.id ?? null} codeVersionId={version.id} language={form.language} fileName={form.fileName} code={version.snapshot_text} signedIn={account.signedIn} /></details>)}</article><article><h3>Line annotations</h3><div className="commune-form-grid"><label><span>Line start</span><input type="number" min="1" value={annotation.lineStart} onChange={(event) => setAnnotation({ ...annotation, lineStart: Number(event.target.value) })} /></label><label><span>Line end</span><input type="number" min="1" value={annotation.lineEnd} onChange={(event) => setAnnotation({ ...annotation, lineEnd: Number(event.target.value) })} /></label><label className="wide-field"><span>Comment</span><input value={annotation.comment} onChange={(event) => setAnnotation({ ...annotation, comment: event.target.value })} /></label></div><button type="button" disabled={!selected || !account.signedIn} onClick={() => void addAnnotation()}>Add annotation</button>{annotations.map((item) => <article className="review-list-item" key={item.id}><strong>Lines {item.line_start}-{item.line_end}</strong><StatusBadges labels={[item.annotation_status, item.visibility_state]} /><p>{item.comment}</p><div className="button-row"><button type="button" onClick={() => void annotationAction(item, "resolve")}>Resolve</button><button type="button" onClick={() => void annotationAction(item, "report")}>Report annotation</button>{account.isModerator && <><button type="button" onClick={() => void annotationAction(item, "hide")}>Hide</button><button type="button" onClick={() => void annotationAction(item, "remove")}>Remove</button></>}</div></article>)}</article></section>
        <section className="commune-report-panel"><h3>Report document</h3><p>Reports are private to moderators/admins. Reporting does not automatically remove content.</p><label><span>Reason</span><select value={report.reason} onChange={(event) => setReport({ ...report, reason: event.target.value as typeof codeReviewReportReasons[number] })}>{codeReviewReportReasons.map((reason) => <option key={reason} value={reason}>{reason.replace(/_/g, " ")}</option>)}</select></label><label><span>Detail</span><input value={report.detail} onChange={(event) => setReport({ ...report, detail: event.target.value })} /></label><button type="button" disabled={!selected || !account.signedIn} onClick={() => void reportDocument()}>Report code document</button></section>
      </div>
    </div>}
    <p className="message">{message}</p>
    {!account.signedIn && <p className="boundary-note">Sign in to create documents, save snapshots, annotate lines, or report code review content.</p>}
  </section>;
}

function RealtimeFoundationPanel() {
  const [rooms, setRooms] = useState<RealtimeRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [account, setAccount] = useState({ signedIn: false, isModerator: false });
  const [connection, setConnection] = useState<RealtimeConnectionStatus>("loading");
  const [notice, setNotice] = useState("Realtime chat is loading. If Supabase Realtime is unavailable, manual refresh remains available.");
  const [draft, setDraft] = useState("");
  const [reportForms, setReportForms] = useState<Record<string, { reason: string; detail: string }>>({});
  const [moderationReason, setModerationReason] = useState("Moderation action from Commune realtime chat.");
  const [lastSentAt, setLastSentAt] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? rooms[0] ?? null;
  const validation = validateChatMessageInput(draft);
  const secretWarnings = draft.trim() ? detectSecretLikeChatText(draft) : [];
  const slowModeSeconds = activeRoom?.slow_mode_seconds ?? 0;
  const remainingSeconds = activeRoom ? Math.max(0, Math.ceil(((lastSentAt[activeRoom.id] ?? 0) + slowModeSeconds * 1000 - now) / 1000)) : 0;

  const refreshRooms = useCallback(async () => {
    const [roomResult, accountResult] = await Promise.all([listRealtimeRooms(), loadRealtimeAccountState()]);
    logCommuneDiagnostics("realtime-rooms", [...roomResult.warnings, ...accountResult.warnings]);
    setRooms(roomResult.rooms);
    setAccount({ signedIn: accountResult.signedIn, isModerator: accountResult.isModerator });
    setConnection(roomResult.warnings.length ? "backend inactive" : "manual refresh mode");
    setNotice(roomResult.warnings.length ? "Realtime chat tables are not active yet. Forum posts, local drafts, and sandbox requests remain available." : "Choose a room. Messages are public/community cloud data and plain text only.");
    setActiveRoomId((current) => current && roomResult.rooms.some((room) => room.id === current) ? current : roomResult.rooms[0]?.id ?? null);
  }, []);

  const refreshMessages = useCallback(async (roomId: string) => {
    const result = await listRecentMessages(roomId);
    logCommuneDiagnostics("realtime-messages", result.warnings);
    setMessages(result.messages);
    if (result.warnings.length) setNotice("Messages are in manual refresh mode until realtime tables/policies are active for this session.");
  }, []);

  useEffect(() => { void refreshRooms(); }, [refreshRooms]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (activeRoom) void refreshMessages(activeRoom.id); else setMessages([]); }, [activeRoom?.id, refreshMessages]);
  useEffect(() => {
    if (!activeRoom) return undefined;
    const subscription = subscribeToRoomMessages(activeRoom.id, {
      onInsert: (message) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]),
      onStatus: setConnection,
      onError: setNotice
    });
    return () => subscription.unsubscribe();
  }, [activeRoom?.id]);

  async function send() {
    if (!activeRoom) return;
    if (remainingSeconds > 0) return setNotice(`Slow mode is active. Wait ${remainingSeconds} more second${remainingSeconds === 1 ? "" : "s"}.`);
    const result = await sendRealtimeMessage(activeRoom, draft);
    setNotice(cleanCommuneMessage(result.message, "Realtime chat is not active for this session yet."));
    if (result.ok) {
      setDraft("");
      setLastSentAt((current) => ({ ...current, [activeRoom.id]: Date.now() }));
      if (result.row) setMessages((current) => current.some((item) => item.id === result.row?.id) ? current : [...current, result.row as RealtimeMessage]);
      await refreshMessages(activeRoom.id);
    }
  }

  async function report(message: RealtimeMessage) {
    const form = reportForms[message.id] ?? { reason: realtimeReportReasons[0], detail: "" };
    const result = await reportRealtimeMessage(message, form.reason, form.detail);
    setNotice(cleanCommuneMessage(result.message, "Realtime report routing is not active yet."));
    if (result.ok) setReportForms((current) => ({ ...current, [message.id]: { reason: realtimeReportReasons[0], detail: "" } }));
  }

  async function moderate(message: RealtimeMessage, action: "hide" | "remove") {
    const result = action === "hide" ? await hideRealtimeMessage(message.id, moderationReason) : await removeRealtimeMessage(message.id, moderationReason);
    setNotice(cleanCommuneMessage(result.message, "Realtime moderation is not active for this session yet."));
    if (result.ok && activeRoom) await refreshMessages(activeRoom.id);
  }

  return <section className="section-card commune-realtime-card" id="commune-realtime-chat">
    <div className="section-heading section-heading--inline">
      <div><p className="eyebrow">Realtime foundation</p><h2>Governed live chat rooms</h2><p>Realtime Commune messages are cloud-hosted public/community data. Do not post credentials, private local Elysia logs, private files, personal sensitive material, vault data, or secrets.</p></div>
      <button type="button" onClick={() => activeRoom ? void refreshMessages(activeRoom.id) : void refreshRooms()}>Refresh</button>
    </div>
    <StatusBadges labels={["signed-in posting", "plain text only", "no private DMs", "no file uploads", "no code execution", "reportable", "slow mode"]} />
    <div className="commune-chat-layout">
      <aside className="commune-chat-rooms" aria-label="Commune realtime rooms">
        <h3>Rooms</h3>
        {!rooms.length && <p className="commune-empty-state">Realtime rooms will appear here when the Supabase migration and policies are active.</p>}
        {rooms.map((room) => <button type="button" className={activeRoom?.id === room.id ? "commune-room-button commune-room-button--active" : "commune-room-button"} key={room.id} onClick={() => setActiveRoomId(room.id)}><strong>{room.title}</strong><span>{room.posting_mode.replace(/_/g, " ")} · {room.slow_mode_seconds}s slow mode</span></button>)}
      </aside>
      <div className="commune-chat-panel">
        <div className="commune-chat-header"><div><h3>{activeRoom?.title ?? "Realtime rooms not active yet"}</h3><p>{activeRoom?.description ?? "Account-backed realtime chat remains safely inactive until tables and RLS are applied."}</p></div><span className="review-status">{connection}</span></div>
        <p className="boundary-note">No private DMs, no chat file uploads, no HTML rendering, and no execution. Code snippets in chat are text only and are not run by the website.</p>
        <div className="commune-chat-messages" aria-live="polite">
          {!messages.length && <p className="commune-empty-state">No published messages in this room yet.</p>}
          {messages.map((message) => {
            const form = reportForms[message.id] ?? { reason: realtimeReportReasons[0], detail: "" };
            return <article className="commune-chat-message" key={message.id}>
              <div className="addon-card__topline"><strong>{message.author_username ? `@${message.author_username}` : "Community member"}</strong><span>{new Date(message.created_at).toLocaleString()}</span></div>
              <p className="commune-chat-body">{message.body_plain ?? message.body}</p>
              <details><summary>Report message</summary><label><span>Reason</span><select value={form.reason} onChange={(event) => setReportForms((current) => ({ ...current, [message.id]: { ...form, reason: event.target.value } }))}>{realtimeReportReasons.map((reason) => <option key={reason} value={reason}>{reason.replace(/_/g, " ")}</option>)}</select></label><label><span>Optional detail</span><input value={form.detail} onChange={(event) => setReportForms((current) => ({ ...current, [message.id]: { ...form, detail: event.target.value } }))} placeholder="Private to moderators" /></label><button type="button" onClick={() => void report(message)}>Send private report</button></details>
              {account.isModerator && <div className="commune-moderator-controls"><button type="button" onClick={() => void moderate(message, "hide")}>Hide</button><button type="button" onClick={() => void moderate(message, "remove")}>Remove</button></div>}
            </article>;
          })}
        </div>
        {account.isModerator && <label><span>Moderator reason</span><input value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} /></label>}
        <div className="commune-chat-composer">
          <label><span>Plain-text message</span><textarea rows={4} value={draft} maxLength={2000} disabled={!account.signedIn || !activeRoom} onChange={(event) => setDraft(event.target.value)} placeholder={account.signedIn ? "Write safe-to-share public/community text..." : "Sign in to post."} /></label>
          <div className="addon-card__topline"><span>{draft.length}/2000</span><span>{activeRoom ? `${remainingSeconds > 0 ? `${remainingSeconds}s remaining` : `${slowModeSeconds}s slow mode`}` : "No active room"}</span></div>
          {secretWarnings.length > 0 && <p className="message">Remove possible secret/private material before sending: {secretWarnings.join(", ")}.</p>}
          <div className="button-row"><button className="button-primary" type="button" disabled={!account.signedIn || !activeRoom || !validation.ok || remainingSeconds > 0} onClick={() => void send()}>Send message</button><button type="button" onClick={() => setDraft("")}>Clear</button></div>
          {!account.signedIn && <p className="boundary-note">Signed-in users only may post. Everyone sees only published messages allowed by RLS.</p>}
        </div>
      </div>
    </div>
    <p className="message">{notice}</p>
  </section>;
}

function CodeExecutionBoundaryPanel() {
  return <section className="section-card commune-sandbox-card">
    <p className="eyebrow">Code execution sandbox foundation</p>
    <h2>The public website does not execute code.</h2>
    <p>Coding Cornucopia execution requires an explicitly configured isolated sandbox service. Snapshot runs use network-disabled containers, resource limits, filesystem isolation, logging, kill controls, and audit records. Local Elysia remains final authority for local tools and installs.</p>
    <StatusBadges labels={["snapshot only", "no shell", "no npm install", "no package hooks", "no repo clone", "network disabled", "Marketplace separate"]} />
    <Link className="button-link" to="/commune/coding-cornucopia/sandbox-request">Request sandbox review metadata</Link>
  </section>;
}

export default function CommunePage() {
  const { roomSlug, postId } = useParams();
  const location = useLocation();
  const pathParts = useMemo(() => location.pathname.split("/").filter(Boolean), [location.pathname]);
  const mode = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1];
  }, [location.pathname]);
  const isRoomsIndex = pathParts[0] === "commune" && pathParts[1] === "rooms" && pathParts.length === 2;
  const routeRoomSlug = roomSlug ?? (pathParts[0] === "commune" && pathParts[1] === "rooms" && pathParts[2] && !["new", "posts"].includes(pathParts[2])
    ? pathParts[2]
    : pathParts[0] === "commune" && pathParts[2] === "new"
    ? pathParts[1]
    : undefined);
  const effectiveRoomSlug = normalizeCommuneRoomSlug(routeRoomSlug);
  const isRoomNew = Boolean(effectiveRoomSlug) && mode === "new";
  const isRoomPosts = Boolean(effectiveRoomSlug) && mode === "posts" && pathParts[1] === "rooms";
  const routeRoomType = effectiveRoomSlug ? postTypeByRoomSlug.get(effectiveRoomSlug) : undefined;
  const roomPostTypeForLoad = !postId && routeRoomType && (isRoomNew || isRoomPosts || Boolean(effectiveRoomSlug)) ? routeRoomType.backendValue : undefined;
  const { state, refresh } = useCommuneLoad(undefined, postId, roomPostTypeForLoad);
  const localDrafts = useLocalDraftState();
  const [filters, setFilters] = useState<CommuneFilters>({ search: "", category: "All", status: "All", safety: "All" });
  const [categories, setCategories] = useState<CommuneCategory[]>(() => communeFallbackCategories.map((item, index) => ({ ...item, id: item.slug, sort_order: index, is_active: true })));
  useEffect(() => { void loadCategories().then((result) => { setCategories(result.categories); logCommuneDiagnostics("categories", result.warnings); }); }, []);
  const selectedRoom = state.rooms.find((room) => roomSlugCandidates(effectiveRoomSlug).includes(room.slug));
  async function save(id: string) {
    const result = await savePost(id);
    if (isBackendDiagnostic(result.message)) logCommuneDiagnostics("save-post", [result.message]);
    await refresh();
  }

  const routeMode = isRoomsIndex
    ? "rooms-index"
    : /\/commune\/elysia-iteration-showcase\/sandbox-request$/.test(location.pathname)
    ? "iteration-sandbox-review"
    : /\/commune\/repository-showcase\/sandbox-request$/.test(location.pathname)
    ? "repository-sandbox-review"
    : /\/commune\/(coding-cornucopia|code-sharing|troubleshooting-grove)\/review$/.test(location.pathname)
      ? "code-review"
      : /\/commune\/(coding-cornucopia|code-sharing|troubleshooting-grove)\/sandbox-request$/.test(location.pathname)
        ? "sandbox-review"
        : !isRoomNew && ["new", "repository-showcase", "troubleshooting", "sandbox-review", "moderation", "realtime"].includes(mode || "") ? mode : "";
  const activeActionKind = mode === "troubleshooting" ? "troubleshooting" : mode === "repository-showcase" || routeMode === "repository-sandbox-review" ? "repository" : routeMode === "iteration-sandbox-review" ? "sandbox" : routeMode === "sandbox-review" || mode === "sandbox-review" ? "sandbox" : mode === "moderation" ? "moderation" : "";
  const isLobby = !postId && !routeMode && !roomSlug && !effectiveRoomSlug;
  const isRoom = !postId && !routeMode && Boolean(effectiveRoomSlug);
  const roomPageMode: RoomPageMode = isRoomPosts ? "posts" : isRoomNew ? "composer" : "hub";

  return <div className="page-stack commune-page">
    <PageHero eyebrow="Public community" title="The Elysia Commune" brandMark="standard">
      <p>The Commune is the public gathering place for official updates, media blogs, troubleshooting, code sharing, repository showcases, community networking, project updates, research notes, Elysia iteration showcases, and advisory Community Voting Room guidance.</p>
      <p><strong>Share publicly. Redact first. Execute nowhere by default.</strong></p>
    </PageHero>
    <Doctrine />
    {isLobby && <CommuneLobby />}
    {isLobby && <CommuneSearchPanel filters={filters} setFilters={setFilters} />}
    {!isLobby && routeMode !== "rooms-index" && <AccountModePanel signedIn={state.signedIn} isModerator={state.isModerator} accountReady={state.accountReady} activeKind={activeActionKind} />}
    {["new", "troubleshooting", "repository-showcase", "repository-sandbox-review", "iteration-sandbox-review", "sandbox-review", "code-review", "realtime", "moderation"].includes(routeMode) && <CommuneFocusedToolbar />}

    {routeMode === "rooms-index" && <CommuneRoomsIndexPage />}
    {routeMode === "new" && <RoomPickerPanel />}
    {routeMode === "repository-showcase" && <RepositoryShowcaseForm localDrafts={localDrafts} roomId={state.rooms.find((room) => room.slug === "repository-showcase")?.id} onRefresh={refresh} isAdmin={state.isAdmin} />}
    {routeMode === "repository-sandbox-review" && <RepositoryShowcaseSandboxRequestPanel signedIn={state.signedIn} />}
    {routeMode === "iteration-sandbox-review" && <ElysiaIterationSandboxRequestPanel signedIn={state.signedIn} />}
    {mode === "troubleshooting" && <PostComposer defaultType="troubleshooting" defaultRoomId={state.rooms.find((room) => room.slug === "troubleshooting-grove")?.id} troubleshooting localDrafts={localDrafts} categories={categories} onRefresh={refresh} isAdmin={state.isAdmin} />}
    {routeMode === "sandbox-review" && <SandboxDraftPanel localDrafts={localDrafts} />}
    {mode === "moderation" && <ModerationPanel />}
    {mode === "realtime" && <RealtimeFoundationPanel />}
    {routeMode === "code-review" && <CollaborativeCodeReviewPanel />}
    {postId && <PostDetail postId={postId} />}
    {isRoom && effectiveRoomSlug && <RoomPage roomSlug={effectiveRoomSlug} roomId={selectedRoom?.id} posts={state.posts} officialUpdates={state.officialUpdates} troubleshootingPosts={state.troubleshootingPosts} jobPosts={state.jobPosts} researchNotes={state.researchNotes} votePosts={state.votePosts} savedPostIds={state.savedPostIds} onSave={(id) => void save(id)} localDrafts={localDrafts} categories={categories} onRefresh={refresh} signedIn={state.signedIn} isAdmin={state.isAdmin} mode={roomPageMode} />}

    {isLobby && <>
      <RedactionPanel />
      <CommuneRoomsGateway />
      <CommunityFeed posts={state.posts} savedPostIds={state.savedPostIds} onSave={(id) => void save(id)} filters={filters} signedIn={state.signedIn} troubleshootingPosts={state.troubleshootingPosts} jobPosts={state.jobPosts} researchNotes={state.researchNotes} votePosts={state.votePosts} />
      <CommuneSideChannelPanel />
      <LocalDraftStudio localDrafts={localDrafts} filters={filters} />
    </>}
  </div>;
}
