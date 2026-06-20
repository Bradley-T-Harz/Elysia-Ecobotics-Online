import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import {
  createCodeSnippet,
  followThread,
  loadCategories,
  loadCommuneData,
  loadCommuneModerationQueue,
  loadCodeSnippets,
  markThreadRead,
  moderateCommuneItem,
  postTypeOptions,
  reportCommuneContent,
  reportTypes,
  savePost,
  submitCommunePost,
  submitComment,
  submitRepositoryShowcase,
  submitSandboxReview,
  type CommuneComment,
  type CommuneCategory,
  type CommuneCodeSnippet,
  type CommuneModerationItem,
  type CommunePost,
  type CommunePostType,
  type CommuneRoom,
  type CommuneThread
} from "./communeAccountApi";
import { communeFallbackCategories, formatCommuneTag, formatCommuneTags, inertCodeSnippetLabel, parseCommuneTags, scanCommuneTextForSecrets, validateCommuneMediaFile } from "./communeSafety";
import {
  acquireEditLock,
  archiveCodeDocument,
  codeReviewLanguages,
  codeReviewReportReasons,
  createAnnotation,
  createCodeDocument,
  createDocumentVersion,
  detectSecretLikeCodeText,
  hideAnnotation,
  hideCodeDocument,
  listAnnotations,
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
  splitCodeIntoLines,
  submitCodeDocumentForReview,
  updateCodeDocument,
  type CodeAnnotation,
  type CodeDocument,
  type CodeDocumentVersion,
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
    allowedContent: "Public images, videos, demos, artwork notes, project updates, and storytelling drafts.",
    cautions: "Do not upload private documents, faces without consent, sensitive location data, copyrighted media without permission, credentials, or private screenshots.",
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
    name: "Code Sharing",
    purpose: "Snippets, examples, add-on ideas, scripts, and safe development notes.",
    allowedContent: "Small public snippets, examples, design notes, add-on ideas, and review requests.",
    cautions: "Shared code is not trusted and is not executed by the website or Elysia by default.",
    currentStatus: ["Local draft available", "Requires moderation", "Requires sandbox"],
    futureFeatures: "Syntax display, manifest checks, snippet labels, sandbox review requests, and code safety triage."
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
    purpose: "EcoSyneva/Elysia opportunities, community job posts, volunteer calls, research roles, and project needs.",
    allowedContent: "Clear role summaries, paid/volunteer status, project needs, location/remote notes, and contact paths.",
    cautions: "Jobs require anti-scam review, pay/volunteer clarity, location/remote clarity, and no sensitive personal data in public comments.",
    currentStatus: ["Local draft available", "Requires moderation", "Backend enhanced"],
    futureFeatures: "Reviewed job posts, role labels, scam reporting, and pay/volunteer clarity requirements."
  },
  {
    id: "official-update",
    backendValue: "official_update",
    name: "Official Update",
    purpose: "Official Elysia Ecobotics announcements, releases, roadmap notes, and governance updates.",
    allowedContent: "Administrator-authored release notes, roadmap notes, governance updates, and official notices later.",
    cautions: "Admin-only later. Community users must not impersonate official release/security notices.",
    currentStatus: ["Admin-only later", "Requires backend", "No self-assignment"],
    futureFeatures: "Authorized administrator posting, official labels, release/security notice protections, and audit trails."
  },
  {
    id: "research-note",
    backendValue: "research_note",
    name: "Research Note",
    purpose: "Public research notes, evidence summaries, source discussions, ecological observations, and Living Library-linked work.",
    allowedContent: "Evidence summaries, source links, citation notes, uncertainties, ecological observations, and interpretation boundaries.",
    cautions: "Cite sources and separate evidence from interpretation.",
    currentStatus: ["Local draft available", "Requires moderation", "Backend enhanced"],
    futureFeatures: "Evidence strength fields, source cards, Living Library links, and review labels."
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
  }
];

const roomSlugByPostType: Record<CommunePostType, string> = {
  media_garden: "media-garden",
  troubleshooting: "troubleshooting-grove",
  code_sharing: "code-sharing",
  repository_showcase: "repository-showcase",
  community_network: "community-network",
  job_post: "job-post",
  official_update: "official-updates",
  research_note: "research-notes",
  elysia_iteration_showcase: "elysia-iteration-showcase"
};

const postTypeByRoomSlug = new Map(postTypes.map((type) => [roomSlugByPostType[type.backendValue], type]));

function roomPathForType(type: CommunePostTypeCard) {
  return `/commune/rooms/${roomSlugByPostType[type.backendValue]}`;
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
  "Needs review"
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
const safetyFilters = ["All", "No code execution", "Requires moderation", "Requires backend", "Requires sandbox", "Admin-only later"];
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
  return [
    `# ${draft.title || "Untitled repository showcase"}`,
    "",
    `Provider: ${draft.provider}`,
    `Repository URL: ${draft.repoUrl}`,
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
    "Draft only. This page does not fetch, clone, or validate the repository."
  ].join("\n");
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
  return <Link to={`/commons/@${encodeURIComponent(username)}`}>@{username}</Link>;
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
      <p>Do not upload secrets, private Elysia memory, private logs, .env files, credentials, personal documents, or unredacted customer/user data. Public posts are not private support tickets. Anything drafted here should be safe to be public.</p>
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
        <p>Filters apply to the community feed and local drafts. The room list stays complete so every doorway remains visible.</p>
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
  return <section className="section-card" id="commune-rooms"><p className="eyebrow">Rooms</p><h2>Choose a moderated community room</h2><div className="commune-zone-grid">{postTypes.map((type) => <article className="commune-zone-card commune-room-card" key={type.id}><span className="commune-card-sigil" aria-hidden="true">{type.name.slice(0, 1)}</span><h3>{type.name}</h3><p>{type.purpose}</p><p><strong>Allowed:</strong> {type.allowedContent}</p><p><strong>Caution:</strong> {type.cautions}</p><StatusBadges labels={type.currentStatus} /><Link className="button-link" to={roomPathForType(type)}>Enter room</Link></article>)}</div></section>;
}

function RoomPickerPanel() {
  return <section className="section-card" id="commune-room-picker">
    <p className="eyebrow">Start a thread</p>
    <h2>Choose a room before posting</h2>
    <p className="boundary-note">Posts are created from inside their room so the format, safety notes, and context match what you are sharing.</p>
    <div className="commune-zone-grid">{postTypes.map((type) => <article className="commune-zone-card commune-room-card" key={type.id}><span className="commune-card-sigil" aria-hidden="true">{type.name.slice(0, 1)}</span><h3>{type.name}</h3><p>{type.purpose}</p><StatusBadges labels={type.currentStatus} /><Link className="button-link" to={roomPathForType(type)}>Enter room</Link></article>)}</div>
  </section>;
}

function PostCard({ post, saved, onSave }: { post: CommunePost; saved: boolean; onSave: (id: string) => void }) {
  return <article className="commune-post-card"><div className="addon-card__topline"><StatusBadges labels={[post.post_type, post.status]} /></div><h3><Link to={`/commune/posts/${post.id}`}>{post.title}</Link></h3><p>{post.excerpt || post.body.slice(0, 180)}</p><p>By {authorLink(post.author_username)} · {post.published_at ? new Date(post.published_at).toLocaleDateString() : "public date unavailable"}</p><TagChips tags={(post.tags ?? []).slice(0, 5)} /><div className="button-row"><Link className="button-link" to={`/commune/posts/${post.id}`}>Read</Link><button type="button" onClick={() => onSave(post.id)}>{saved ? "Saved" : "Save post"}</button></div></article>;
}

function CommunityFeed({ posts, savedPostIds, onSave, filters }: { posts: CommunePost[]; savedPostIds: string[]; onSave: (id: string) => void; filters: CommuneFilters }) {
  const filteredPosts = posts.filter((post) => {
    const type = postTypes.find((item) => item.backendValue === post.post_type);
    const labels = [post.status, post.visibility, type?.name ?? post.post_type, ...(post.tags ?? [])];
    return matchesCategory(type?.name ?? post.post_type, filters.category) && matchesSearch([post.title, post.excerpt ?? "", post.body, ...(post.tags ?? [])], filters.search) && matchesStatus(labels, filters.status) && matchesSafety(labels, filters.safety);
  });
  const emptyCards = postTypes.filter((type) => matchesCategory(type.name, filters.category) && matchesSearch([type.name, type.purpose], filters.search) && matchesStatus([...type.currentStatus, "needs backend"], filters.status) && matchesSafety([...type.currentStatus, type.cautions], filters.safety)).slice(0, 5);
  return <section className="section-card commune-feed" id="commune-feed">
    <p className="eyebrow">Community Feed</p>
    <h2>{filteredPosts.length ? `${filteredPosts.length} published item${filteredPosts.length === 1 ? "" : "s"}` : "No published Commune posts yet"}</h2>
    <p className="boundary-note">Only posts approved/published by moderation are public here. Drafts and pending requests remain private to their owner and reviewers.</p>
    {filteredPosts.length ? <div className="commune-feed-grid">{filteredPosts.map((post) => <PostCard key={post.id} post={post} saved={savedPostIds.includes(post.id)} onSave={onSave} />)}</div> : <div className="commune-feed-grid">{emptyCards.map((type) => <article className="commune-feed-card" key={type.id}><div className="commune-author-sigil" aria-hidden="true">{type.name.slice(0, 1)}</div><p className="eyebrow">{type.name}</p><h3>No {type.name} posts yet.</h3><p>{type.purpose}</p><Link className="button-link" to={roomPathForType(type)}>Enter room</Link></article>)}</div>}
  </section>;
}

function RoomPage({ roomSlug, roomId, posts, savedPostIds, onSave, localDrafts, categories, onRefresh }: { roomSlug: string; roomId?: string; posts: CommunePost[]; savedPostIds: string[]; onSave: (id: string) => void; localDrafts: ReturnType<typeof useLocalDraftState>; categories: CommuneCategory[]; onRefresh: () => Promise<void> }) {
  const type = postTypeByRoomSlug.get(roomSlug);
  const roomPosts = type ? posts.filter((post) => post.post_type === type.backendValue) : [];
  if (!type) {
    return <section className="section-card"><p className="eyebrow">Room</p><h2>Room not found</h2><p>This Commune room is not available yet. Choose another room from the lobby.</p><Link className="button-link" to="/commune">Back to Commune</Link></section>;
  }
  const canDraft = type.backendValue !== "official_update";
  const roomPostComposer = canDraft && !["repository_showcase"].includes(type.backendValue);
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
        {roomPostComposer && <a className="button-link button-link--primary" href="#commune-room-composer">{type.backendValue === "troubleshooting" ? "Create Troubleshooting Post" : `Create ${type.name} Post`}</a>}
        {type.backendValue === "repository_showcase" && <Link className="button-link button-link--primary" to="/commune/repository-showcase">Create Repository Showcase</Link>}
        {type.backendValue === "code_sharing" && <><a className="button-link button-link--primary" href="#commune-room-composer">Draft Code Sharing Post</a><Link className="button-link" to="/commune/code-sharing/review">Open Code Review Workbench</Link><Link className="button-link" to="/commune/sandbox-review">Prepare Sandbox Review Request</Link></>}
        {type.backendValue === "official_update" && <a className="button-link button-link--primary" href="#commune-room-feed">Read official updates</a>}
      </div>
    </section>
    <section className="section-card commune-feed" id="commune-room-feed">
      <p className="eyebrow">{type.name} Posts</p>
      <h2>{roomPosts.length ? `${roomPosts.length} published item${roomPosts.length === 1 ? "" : "s"}` : `No published ${type.name} posts yet`}</h2>
      <p className="boundary-note">This room follows the Commune model: room posts become threads, and replies appear after moderation.</p>
      {roomPosts.length ? <div className="commune-feed-grid">{roomPosts.map((post) => <PostCard key={post.id} post={post} saved={savedPostIds.includes(post.id)} onSave={onSave} />)}</div> : <p className="commune-empty-state">Published posts will appear here after moderation. Start with a careful draft when you are ready.</p>}
    </section>
    {type.backendValue === "repository_showcase" && <section className="section-card commune-repo-card"><p className="eyebrow">Repository Showcase</p><h2>Metadata only, never execution</h2><p>A public repo is not automatically safe, compatible, licensed, or free of secrets. The website does not fetch, clone, build, run, or validate repositories from this room.</p><Link className="button-link button-link--primary" to="/commune/repository-showcase">Open repository showcase form</Link></section>}
    {type.backendValue === "code_sharing" && <section className="section-card commune-sandbox-card"><p className="eyebrow">Code Sharing Tools</p><h2>Review code as text, then request sandbox review only when needed.</h2><p>Code snippets and documents are for discussion. The website does not execute code, open a terminal, install packages, clone repositories, or call Local Elysia.</p><div className="button-row"><Link className="button-link" to="/commune/code-sharing/review">Open Code Review Workbench</Link><Link className="button-link" to="/commune/sandbox-review">Prepare Sandbox Review Request</Link></div></section>}
    {type.backendValue === "official_update" && <section className="section-card"><p className="eyebrow">Official Updates</p><h2>Read-only for community members</h2><p>Official release, security, roadmap, and governance notices are restricted to authorized Elysia Ecobotics administrators. Community users cannot self-assign official publishing authority.</p></section>}
    {roomPostComposer && <div id="commune-room-composer"><PostComposer defaultType={type.backendValue} defaultRoomId={roomId} troubleshooting={type.backendValue === "troubleshooting"} localDrafts={localDrafts} categories={categories} onRefresh={onRefresh} /></div>}
  </>;
}

function useCommuneLoad(roomSlug?: string, postId?: string) {
  const [state, setState] = useState({ rooms: [] as CommuneRoom[], posts: [] as CommunePost[], comments: [] as CommuneComment[], threads: [] as CommuneThread[], savedPostIds: [] as string[], followedThreadIds: [] as string[], signedIn: false, isModerator: false, accountReady: false });
  const refresh = useCallback(async () => {
    const result = await loadCommuneData(roomSlug, postId);
    logCommuneDiagnostics("load", [...result.account.warnings, ...result.warnings]);
    setState({ rooms: result.rooms, posts: result.posts, comments: result.comments, threads: result.threads, savedPostIds: result.savedPostIds, followedThreadIds: result.followedThreadIds, signedIn: result.account.signedIn, isModerator: result.account.isModerator, accountReady: !result.warnings.some(isBackendDiagnostic) });
  }, [roomSlug, postId]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { state, refresh };
}

function useLocalDraftState() {
  const [postDrafts, setPostDrafts] = useState<PostDraft[]>(() => readStorage(storageKeys.postDrafts, []));
  const [postRequests, setPostRequests] = useState<PostDraft[]>(() => readStorage(storageKeys.postRequests, []));
  const [repoDrafts, setRepoDrafts] = useState<RepoShowcaseDraft[]>(() => readStorage(storageKeys.repoShowcaseDrafts, []));
  const [sandboxDrafts, setSandboxDrafts] = useState<SandboxRequestDraft[]>(() => readStorage(storageKeys.sandboxRequestDrafts, []));

  return {
    postDrafts,
    postRequests,
    repoDrafts,
    sandboxDrafts,
    updatePostDrafts(next: PostDraft[]) { setPostDrafts(next); writeStorage(storageKeys.postDrafts, next); },
    updatePostRequests(next: PostDraft[]) { setPostRequests(next); writeStorage(storageKeys.postRequests, next); },
    updateRepoDrafts(next: RepoShowcaseDraft[]) { setRepoDrafts(next); writeStorage(storageKeys.repoShowcaseDrafts, next); },
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

function PostComposer({ defaultType = "media_garden" as CommunePostType, defaultRoomId, troubleshooting = false, localDrafts, categories, onRefresh }: { defaultType?: CommunePostType; defaultRoomId?: string; troubleshooting?: boolean; localDrafts: ReturnType<typeof useLocalDraftState>; categories: CommuneCategory[]; onRefresh?: () => Promise<void> }) {
  const [form, setForm] = useState({ postType: defaultType, categorySlug: categories[0]?.slug ?? "general", roomId: defaultRoomId || "", title: "", summary: "", body: "", tags: "", links: "", repositoryUrl: "", os: "", browser: "", version: "", stepsTried: "", codeLanguage: "", codeFileName: "", codeText: "", stepsCodeAck: false, acknowledgement: false, sandboxRequested: false });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("Signed-in users can submit posts for moderation. Local draft/export is available even when backend review is not active.");
  const secretScan = scanCommuneTextForSecrets([form.title, form.body, form.codeFileName, form.codeText, form.repositoryUrl].join("\n"));
  const fileValidation = file ? validateCommuneMediaFile(file) : null;
  const selectedPostTypeLabel = postTypeOptions.find((type) => type.value === form.postType)?.label ?? form.postType;
  const normalizedTags = parseCommuneTags(form.tags);

  useEffect(() => {
    setForm((current) => current.postType === defaultType && current.roomId === (defaultRoomId || "") ? current : { ...current, postType: defaultType, roomId: defaultRoomId || "" });
  }, [defaultType, defaultRoomId]);

  function build(status: CommuneStatus): PostDraft {
    const codeBlock = form.codeText ? ["", `## Inert code snippet (${inertCodeSnippetLabel(form.codeLanguage)})`, "", "```" + inertCodeSnippetLabel(form.codeLanguage), form.codeText, "```", "", "Code is shown for discussion only. Do not run code you do not trust."].join("\n") : "";
    const bodyBase = troubleshooting ? [form.body, "", `OS: ${form.os}`, `Browser: ${form.browser}`, `Elysia version: ${form.version}`, `Steps tried: ${form.stepsTried}`].join("\n") : form.body;
    const body = `${bodyBase}${codeBlock}`;
    return {
      id: `${status}-${Date.now()}`,
      postType: postTypeOptions.find((type) => type.value === form.postType)?.label ?? form.postType,
      title: form.title,
      summary: form.summary || body.slice(0, 180),
      body,
      tags: normalizedTags.map(formatCommuneTag).join(", "),
      sourceLinks: [form.links, form.repositoryUrl].filter(Boolean).join(", "),
      licenseNotes: "",
      redactionNotes: troubleshooting ? "Troubleshooting content should be redacted before sharing." : "",
      intendedAudience: "Community review",
      submitterName: "",
      submitterContact: "",
      checklist: Object.fromEntries(routeAcknowledgements.map((item) => [item, form.acknowledgement])) as Record<string, boolean>,
      status,
      createdAt: new Date().toISOString()
    };
  }

  function saveLocal(status: CommuneStatus) {
    const draft = build(status);
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
      setMessage("Acknowledge that code snippets are inert text and not execution permission before submitting code.");
      return;
    }
    const bodyBase = troubleshooting ? [form.body, "", `OS: ${form.os}`, `Browser: ${form.browser}`, `Elysia version: ${form.version}`, `Steps tried: ${form.stepsTried}`].join("\n") : form.body;
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
    <h2>{troubleshooting ? "Troubleshooting post" : "Create a moderated Commune post"}</h2>
    <p className="boundary-note">Uploads are part of Elysia Ecobotics Online, not private local Elysia. Do not upload private local Elysia memory, logs, vault data, credentials, .env files, API keys, identity documents, or unredacted sensitive information.</p>
    <p className="boundary-note">Posting in: {selectedPostTypeLabel}</p>
    <div className="commune-form-grid">
      <label><span>Title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label><span>Summary</span><input value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
      <label><span>Tags</span><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Add tags like #wetlands, #qgis, local-ai" /></label>
      <label><span>Links</span><input value={form.links} onChange={(event) => setForm({ ...form, links: event.target.value })} /></label>
      <label><span>Repository URL optional</span><input value={form.repositoryUrl} onChange={(event) => setForm({ ...form, repositoryUrl: event.target.value })} /></label>
      <label><span>Attachment optional</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      {troubleshooting && <><label><span>OS</span><input value={form.os} onChange={(event) => setForm({ ...form, os: event.target.value })} /></label><label><span>Browser</span><input value={form.browser} onChange={(event) => setForm({ ...form, browser: event.target.value })} /></label><label><span>Elysia version optional</span><input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} /></label><label><span>Steps tried</span><input value={form.stepsTried} onChange={(event) => setForm({ ...form, stepsTried: event.target.value })} /></label></>}
      <label className="wide-field"><span>Body</span><textarea rows={8} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
      <label><span>Code language optional</span><input value={form.codeLanguage} onChange={(event) => setForm({ ...form, codeLanguage: event.target.value })} placeholder="typescript, bash, python..." /></label>
      <label><span>Code filename optional</span><input value={form.codeFileName} onChange={(event) => setForm({ ...form, codeFileName: event.target.value })} /></label>
      <label className="wide-field"><span>Inert code snippet optional</span><textarea rows={7} value={form.codeText} onChange={(event) => setForm({ ...form, codeText: event.target.value })} placeholder="Displayed as text only. The website will not execute it." /></label>
    </div>
    <p className="boundary-note">Use hashtags, commas, or simple words. Tags help people find posts later.</p>
    <TagChips tags={normalizedTags} />
    {secretScan.warnings.length > 0 && <WarningCallout title="Secret warning"><p>{secretScan.blocked ? "Submission is blocked until private/secret material is removed." : "Review this content carefully before sharing."} Flags: {secretScan.warnings.join(", ")}.</p></WarningCallout>}
    {fileValidation && <p className={fileValidation.ok ? "boundary-note" : "message"}>{fileValidation.message}</p>}
    {form.codeText && <section className="commune-code-preview"><div className="addon-card__topline"><strong>{inertCodeSnippetLabel(form.codeLanguage)}</strong><span>{form.codeFileName || "snippet"}</span></div><pre><code>{form.codeText}</code></pre><p className="boundary-note">Code is shown for discussion only. Do not run code you do not trust.</p></section>}
    <div className="commune-checklist">{routeAcknowledgements.map((item) => <label className="checkbox-line" key={item}><input type="checkbox" checked={form.acknowledgement} onChange={(event) => setForm({ ...form, acknowledgement: event.target.checked })} /><span>{item}</span></label>)}<label className="checkbox-line"><input type="checkbox" checked={form.stepsCodeAck} onChange={(event) => setForm({ ...form, stepsCodeAck: event.target.checked })} /><span>Any code snippet is inert text for discussion only. It is not execution permission.</span></label><label className="checkbox-line"><input type="checkbox" checked={form.sandboxRequested} onChange={(event) => setForm({ ...form, sandboxRequested: event.target.checked })} /><span>Request sandbox review for repository/code metadata. This is not execution permission.</span></label></div>
    <div className="button-row"><button type="button" className="button-primary" onClick={() => void submit()}>Submit for moderation</button><button type="button" onClick={() => saveLocal("draft_local")}>Save local draft</button><button type="button" onClick={() => saveLocal("pending_moderator_review_local")}>Save local request</button><button type="button" onClick={() => downloadText(`${slug(form.title)}.md`, postMarkdown(build("draft_local")), "text/markdown")}>Export Markdown</button><button type="button" onClick={() => copyText(postMarkdown(build("draft_local")), setMessage)}>Copy Markdown</button><Link className="button-link" to="/commune">Back to Commune</Link></div>
    <p className="message">{message}</p>
  </section>;
}

function RepositoryShowcaseForm({ localDrafts }: { localDrafts: ReturnType<typeof useLocalDraftState> }) {
  const [form, setForm] = useState({ title: "", repoUrl: "", provider: "GitHub", branch: "", commit: "", license: "", description: "", readmePreview: "", fileTreePreview: "", screenshotNotes: "", manifestStatus: "No manifest checked", compatibility: "Unknown", warnings: [] as string[], sandboxRequested: false });
  const [message, setMessage] = useState("Repository showcases are metadata only. The website does not fetch, clone, build, run, or execute repository code.");

  function draft(): RepoShowcaseDraft {
    return { ...form, id: `repo-${Date.now()}`, createdAt: new Date().toISOString() };
  }

  function saveLocal() {
    const next = draft();
    localDrafts.updateRepoDrafts([next, ...localDrafts.repoDrafts]);
    setMessage("Repository showcase draft saved locally. No repository was fetched, cloned, or validated remotely.");
  }

  async function submit() {
    const result = await submitRepositoryShowcase({ repositoryUrl: form.repoUrl, projectName: form.title, projectSummary: form.description || form.readmePreview, sandboxRequested: form.sandboxRequested });
    if (result.ok) setMessage(result.message);
    else if (isBackendDiagnostic(result.message)) { saveLocal(); setMessage("Saved locally in this browser. Repository showcase review queue is not active yet."); }
    else setMessage(result.message);
  }

  function toggleWarning(label: string) {
    setForm((current) => ({ ...current, warnings: current.warnings.includes(label) ? current.warnings.filter((item) => item !== label) : [...current.warnings, label] }));
  }

  return <section className="section-card commune-repo-card" id="commune-repository-showcase">
    <p className="eyebrow">Repository Showcase</p>
    <h2>Show a repository without running it</h2>
    <p>No repo APIs are called. Nothing is cloned. Nothing is remotely validated.</p>
    <div className="commune-form-grid">
      <label><span>Showcase title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label><span>Repo URL</span><input value={form.repoUrl} onChange={(event) => setForm({ ...form, repoUrl: event.target.value })} /></label>
      <label><span>Provider</span><select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })}>{["GitHub", "GitLab", "Codeberg", "Forgejo", "Uploaded zip later", "Other"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Branch</span><input value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value })} /></label>
      <label><span>Commit</span><input value={form.commit} onChange={(event) => setForm({ ...form, commit: event.target.value })} /></label>
      <label><span>License</span><input value={form.license} onChange={(event) => setForm({ ...form, license: event.target.value })} /></label>
      <label><span>Manifest status</span><select value={form.manifestStatus} onChange={(event) => setForm({ ...form, manifestStatus: event.target.value })}>{["No manifest checked", "Manifest missing", "Manifest present", "Manifest validates locally", "Manifest needs review", "Manifest unsafe/blocklisted"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Elysia compatibility</span><select value={form.compatibility} onChange={(event) => setForm({ ...form, compatibility: event.target.value })}>{["Unknown", "Concept only", "Website/resource only", "Add-on candidate", "Local Elysia compatible, unverified", "Local Elysia compatible, reviewed later", "Not compatible"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="wide-field"><span>Short description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} /></label>
      <label className="wide-field"><span>README preview pasted by user</span><textarea value={form.readmePreview} onChange={(event) => setForm({ ...form, readmePreview: event.target.value })} rows={5} /></label>
      <label className="wide-field"><span>File tree preview pasted by user</span><textarea value={form.fileTreePreview} onChange={(event) => setForm({ ...form, fileTreePreview: event.target.value })} rows={5} /></label>
      <label className="wide-field"><span>Screenshot notes or URLs</span><textarea value={form.screenshotNotes} onChange={(event) => setForm({ ...form, screenshotNotes: event.target.value })} rows={3} /></label>
      <label className="checkbox-line wide-field"><input type="checkbox" checked={form.sandboxRequested} onChange={(event) => setForm({ ...form, sandboxRequested: event.target.checked })} /><span>Also request future sandbox review. This does not grant execution permission.</span></label>
    </div>
    <div className="commune-checklist commune-warning-checks">{repoWarnings.map((item) => <label className="checkbox-line" key={item}><input type="checkbox" checked={form.warnings.includes(item)} onChange={() => toggleWarning(item)} /><span>{item}</span></label>)}</div>
    <div className="button-row"><button className="button-primary" type="button" onClick={() => void submit()}>Submit showcase for review</button><button type="button" onClick={saveLocal}>Save showcase draft locally</button><button type="button" onClick={() => downloadText(`${slug(form.title)}-repo-showcase.md`, repoMarkdown(draft()), "text/markdown")}>Export Markdown</button><button type="button" onClick={() => downloadText(`${slug(form.title)}-repo-showcase.json`, JSON.stringify(draft(), null, 2), "application/json")}>Export JSON</button><button type="button" onClick={() => copyText(repoMarkdown(draft()), setMessage)}>Copy showcase Markdown</button><Link className="button-link" to="/commune">Back</Link></div>
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

function LocalDraftStudio({ localDrafts, filters }: { localDrafts: ReturnType<typeof useLocalDraftState>; filters: CommuneFilters }) {
  const draftCards = [
    ...localDrafts.postDrafts.map((draft) => ({ id: draft.id, title: draft.title || "Untitled post draft", labels: [draft.status, draft.postType, draft.tags], summary: draft.summary, tags: draft.tags })),
    ...localDrafts.postRequests.map((draft) => ({ id: draft.id, title: draft.title || "Untitled post request", labels: [draft.status, draft.postType, draft.tags], summary: draft.summary, tags: draft.tags })),
    ...localDrafts.repoDrafts.map((draft) => ({ id: draft.id, title: draft.title || "Untitled repo showcase", labels: ["repo showcase draft", draft.provider, draft.manifestStatus, "Repository Showcase"], summary: draft.description })),
    ...localDrafts.sandboxDrafts.map((draft) => ({ id: draft.id, title: draft.title || "Untitled sandbox request", labels: ["sandbox request draft", `network: ${draft.networkNeeded}`, `files: ${draft.fileAccessNeeded}`], summary: draft.codePurpose }))
  ].filter((draft) => matchesSearch([draft.title, draft.summary, ...draft.labels], filters.search) && matchesStatus(draft.labels, filters.status) && matchesSafety(draft.labels, filters.safety) && (filters.category === "All" || draft.labels.includes(filters.category)));
  const total = localDrafts.postDrafts.length + localDrafts.postRequests.length + localDrafts.repoDrafts.length + localDrafts.sandboxDrafts.length;
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
      <h2>Code review and sandbox handoff stay focused.</h2>
      <p>Use Code Sharing for inert review documents and sandbox request metadata. The website does not run code, install dependencies, clone repositories, or call Local Elysia.</p>
      <div className="button-row"><Link className="button-link" to="/commune/code-sharing/review">Code review workbench</Link><Link className="button-link" to="/commune/sandbox-review">Sandbox request</Link></div>
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
      <article><p className="eyebrow">Canonical account-backed paths</p><h2>Tables this page writes first</h2><div className="commune-badge-row">{["commune_posts", "commune_comments", "commune_threads", "user_saved_commune_posts", "user_followed_commune_threads", "commune_repository_showcases", "commune_sandbox_review_requests", "commune_reports", "commune_media"].map((table) => <span key={table}>{table}</span>)}</div><p>Older compatibility tables are left in place for existing data and admin queues, but new page flows prefer these canonical paths where possible.</p></article>
      <article><p className="eyebrow">Prepared support structures</p><h2>Review and moderation foundations</h2><div className="commune-badge-row">{futureSupportTables.map((table) => <span key={table}>{table}</span>)}</div></article>
    </section>
    <section className="section-card commune-info-grid" id="commune-moderation-doctrine">
      <article><p className="eyebrow">Moderation Doctrine</p><h2>Moderation must handle</h2><p>Spam, harassment, malware, secret leakage, private data exposure, copyright violations, unsafe code, scams/job fraud, impersonation, off-topic floods, AI-generated spam, doxxing, and sensitive ecological location exposure.</p><h3>Available actions/foundations</h3><StatusBadges labels={["report", "hide", "lock thread", "remove post", "request redaction", "mark official", "mark community", "mark unreviewed", "block upload", "security hold", "admin review"]} /><h3>Trust labels</h3><StatusBadges labels={["Official", "Community", "Unreviewed", "Needs redaction", "Security hold", "Resolved", "Archived", "Blocked"]} /></article>
      <article><p className="eyebrow">Media, chat, jobs, and official notices</p><h2>Boundaries for public rooms</h2><p><strong>Media uploads:</strong> not public by default. Public display requires file type limits, size limits, moderation, attribution/copyright prompts, malware scanning where possible, private-data warnings, storage policies, and abuse controls.</p><p><strong>Collaborative rooms and chat:</strong> prepared, not launched. Public write access needs moderation, rate limits, reporting, blocking, room roles, invite controls, retention policy, and no private Elysia memory sharing by default.</p><p><strong>Job posts:</strong> require clear organization/contact, clear role type, clear paid/volunteer status, pay/rate or honest explanation if unpaid, location/remote status, no misleading roles, no sensitive personal data requests in public comments, and scam/moderator review.</p><p><strong>Official Updates:</strong> restricted to authorized Elysia Ecobotics administrators. Community users must not impersonate official release, security, or governance notices.</p><h3>Code/repo labels</h3><StatusBadges labels={["No code execution", "Snippet only", "Repo showcase only", "Manifest present", "Manifest not reviewed", "License unclear", "Sandbox required", "Security review needed", "Blocked"]} /></article>
    </section>
  </>;
}

function PostDetail({ postId }: { postId: string }) {
  const { state, refresh } = useCommuneLoad(undefined, postId);
  const [snippets, setSnippets] = useState<CommuneCodeSnippet[]>([]);
  const [comment, setComment] = useState("");
  const [report, setReport] = useState<{ type: string; reason: string }>({ type: reportTypes[0], reason: "" });
  const [message, setMessage] = useState("");
  const post = state.posts[0];
  const thread = state.threads.find((item) => item.post_id === postId) ?? state.threads[0];
  useEffect(() => { void loadCodeSnippets(postId).then((result) => { setSnippets(result.snippets); logCommuneDiagnostics("code-snippets", result.warnings); }); }, [postId]);
  async function save() { const result = await savePost(postId); setMessage(cleanCommuneMessage(result.message, "Saved posts are not active yet. Try again after account-backed shelves are ready.")); await refresh(); }
  async function follow() { if (!thread) return setMessage("No thread is available yet."); const result = await followThread(thread.id); setMessage(cleanCommuneMessage(result.message, "Followed threads are not active yet.")); await refresh(); }
  async function markRead() { if (!thread) return; const result = await markThreadRead(thread.id); setMessage(cleanCommuneMessage(result.message, "Thread read-state is not active yet.")); await refresh(); }
  async function submitReply() { if (!thread) return setMessage("No thread is available for this post yet."); const result = await submitComment({ postId, threadId: thread.id, body: comment }); setMessage(cleanCommuneMessage(result.message, "Comment saved locally is not available here yet. Backend moderation is being prepared.")); setComment(""); await refresh(); }
  async function reportPost() { const result = await reportCommuneContent({ postId, reportType: report.type, reason: report.reason }); setMessage(cleanCommuneMessage(result.message, "Report routing is being prepared. If urgent, use another trusted contact path.")); setReport({ ...report, reason: "" }); }
  async function reportComment(commentId: string) { const result = await reportCommuneContent({ commentId, reportType: report.type, reason: report.reason || "Reported from post detail comment list." }); setMessage(cleanCommuneMessage(result.message, "Comment report routing is being prepared.")); }
  if (!post) return <section className="section-card"><h2>Post not found</h2><p>This post is not public, does not exist, or is still awaiting moderation.</p><p className="boundary-note">Account-backed posts may also be unavailable while Commune backend tables are being prepared.</p><Link className="button-link" to="/commune">Back to Commune</Link></section>;
  return <><section className="section-card commune-post-detail"><p className="eyebrow">{post.post_type.replace(/_/g, " ")}</p><h2>{post.title}</h2><p>By {authorLink(post.author_username)}</p><StatusBadges labels={[post.status, post.visibility]} /><p>{post.body}</p><TagChips tags={post.tags} /><div className="button-row"><button type="button" onClick={() => void save()}>{state.savedPostIds.includes(postId) ? "Saved" : "Save post"}</button><button type="button" onClick={() => void follow()}>{thread && state.followedThreadIds.includes(thread.id) ? "Following" : "Follow thread"}</button><button type="button" onClick={() => void markRead()}>Mark read</button></div></section>{snippets.length > 0 && <section className="section-card"><p className="eyebrow">Code snippets</p><h2>Inert display only</h2>{snippets.map((snippet) => <article className="commune-code-preview" key={snippet.id}><div className="addon-card__topline"><strong>{inertCodeSnippetLabel(snippet.language ?? "")}</strong><span>{snippet.file_name ?? "snippet"}</span></div><pre><code>{snippet.code_text}</code></pre><div className="button-row"><button type="button" onClick={() => copyText(snippet.code_text, setMessage)}>Copy snippet</button></div><p className="boundary-note">Code is shown for discussion only. Do not run code you do not trust. The website did not execute this snippet.</p></article>)}</section>}<section className="section-card"><p className="eyebrow">Comments</p><h2>Replies after moderation</h2>{state.comments.map((item) => <article className="commune-preview-card" key={item.id}><p>{item.body}</p><p>By {authorLink(item.author_username)} · {item.status}</p><button type="button" onClick={() => void reportComment(item.id)}>Report comment</button></article>)}{!state.comments.length && <p>Moderated comments will appear here once the backend tables are active and replies are approved.</p>}<label><span>Reply</span><textarea rows={4} value={comment} onChange={(event) => setComment(event.target.value)} /></label><button type="button" onClick={() => void submitReply()}>Submit comment for moderation</button></section><section className="section-card"><p className="eyebrow">Report</p><h2>Report this post</h2><p>Reports are reviewed by moderators/administrators. Reporting does not automatically remove content unless urgent automated controls are later added.</p><label><span>Report type</span><select value={report.type} onChange={(event) => setReport({ ...report, type: event.target.value })}>{reportTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label><span>Reason</span><textarea rows={3} value={report.reason} onChange={(event) => setReport({ ...report, reason: event.target.value })} /></label><button type="button" onClick={() => void reportPost()}>Send report</button><p className="message">{message}</p></section></>;
}

function ModerationPanel() {
  const [items, setItems] = useState<CommuneModerationItem[]>([]);
  const [message, setMessage] = useState("Moderation is role-gated. If the backend is not active yet, this panel stays in preview mode.");
  const [reason, setReason] = useState("");
  const refresh = useCallback(async () => {
    const result = await loadCommuneModerationQueue();
    logCommuneDiagnostics("moderation", result.warnings);
    setItems(result.items);
    setMessage(result.warnings.length ? "Moderation is not available for this session. Assigned roles and active backend queues are required." : "Commune moderation queue loaded.");
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function act(item: CommuneModerationItem, action: "approve" | "reject" | "hide" | "archive" | "needs_information" | "escalate") { const result = await moderateCommuneItem(item, action, reason); setMessage(cleanCommuneMessage(result.message, "Moderation action could not be completed because the backend queue is not active yet.")); await refresh(); }
  return <section className="section-card"><p className="eyebrow">Role-gated moderation</p><h2>Commune moderation queue</h2><p className="boundary-note">Normal users cannot access RLS-protected pending posts, comments, uploads, reports, or moderation events.</p><label><span>Moderation note</span><input value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="commune-draft-grid">{items.map((item) => <article key={`${item.kind}-${item.id}`}><h3>{item.title}</h3><StatusBadges labels={[item.kind, item.status]} /><p>{item.summary}</p><div className="button-row"><button onClick={() => void act(item, "approve")}>Approve/publish</button><button onClick={() => void act(item, "needs_information")}>Needs info</button><button onClick={() => void act(item, "reject")}>Reject/remove</button><button onClick={() => void act(item, "hide")}>Hide</button><button onClick={() => void act(item, "archive")}>Archive</button><button onClick={() => void act(item, "escalate")}>Escalate</button></div></article>)}</div>{!items.length && <p>Moderation items will appear here for authorized roles when account-backed Commune tables are active.</p>}<p className="message">{message}</p></section>;
}

function CollaborativeCodeReviewPanel() {
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
  const lines = splitCodeIntoLines(form.text);
  const secretWarnings = detectSecretLikeCodeText([form.title, form.fileName, form.summary, form.text].join("\n"));
  const canEditSelected = account.signedIn && (!selected || selected.owner_user_id === account.userId || account.isModerator);

  const refreshDocuments = useCallback(async () => {
    const [publicDocs, myDocs, accountState] = await Promise.all([listPublishedCodeDocuments(), listMyCodeDocuments(), loadCodeReviewAccount()]);
    logCommuneDiagnostics("code-review", [...publicDocs.warnings, ...myDocs.warnings, ...accountState.warnings]);
    setPublished(publicDocs.documents);
    setMine(myDocs.documents);
    setAccount({ signedIn: accountState.signedIn, userId: accountState.userId, isModerator: accountState.isModerator });
    if (publicDocs.warnings.length || myDocs.warnings.length) setMessage("Collaborative code review tables are not active yet. You can still use local code snippets, post drafts, and sandbox request drafts.");
  }, []);

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

  return <section className="section-card commune-code-review-card" id="commune-code-review">
    <div className="section-heading section-heading--inline"><div><p className="eyebrow">Collaborative Code Review</p><h2>Shared code documents for review, not execution</h2><p>Code here is text for discussion and review only. It is not executed, installed, cloned, fetched, or run by the website.</p></div><button type="button" onClick={() => void refreshDocuments()}>Refresh</button></div>
    <StatusBadges labels={["text review only", "manual snapshots", "line annotations", "simple edit lock", "reportable", "no terminal", "no run button"]} />
    <p className="boundary-note">Do not paste credentials, private local Elysia logs, private files, vault data, tokens, or secrets. Code review documents are cloud-hosted community data. Local Elysia remains final runtime/sandbox authority.</p>
    <div className="commune-code-review-layout">
      <aside className="commune-code-doc-list"><h3>Documents</h3>{!documents.length && <p className="commune-empty-state">No code review documents yet.</p>}{documents.map((document) => <button type="button" className={selected?.id === document.id ? "commune-room-button commune-room-button--active" : "commune-room-button"} key={document.id} onClick={() => setSelectedId(document.id)}><strong>{document.title}</strong><span>{document.language} · {document.visibility_state} · {new Date(document.updated_at).toLocaleDateString()}</span></button>)}<button type="button" onClick={() => { setSelectedId(null); setForm({ title: "", language: "text", fileName: "review.txt", summary: "", text: "" }); setVersions([]); setAnnotations([]); setSession(null); }}>New document</button></aside>
      <div className="commune-code-workbench">
        <div className="commune-form-grid"><label><span>Title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label><span>Language</span><select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}>{codeReviewLanguages.map((language) => <option key={language} value={language}>{language}</option>)}</select></label><label><span>Filename</span><input value={form.fileName} onChange={(event) => setForm({ ...form, fileName: event.target.value })} /></label><label><span>Summary</span><input value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label><label className="wide-field"><span>Code text</span><textarea rows={12} maxLength={100000} value={form.text} onChange={(event) => setForm({ ...form, text: event.target.value })} placeholder="Paste review text only. The website will not execute it." /></label></div>
        <div className="addon-card__topline"><span>{form.text.length.toLocaleString()}/100,000 characters</span><span>{session?.active_editor_user_id ? `edit lock held until ${session.edit_lock_expires_at ? new Date(session.edit_lock_expires_at).toLocaleTimeString() : "unknown"}` : "no active edit lock"}</span></div>
        {secretWarnings.length > 0 && <WarningCallout title="Secret warning"><p>Review before saving. Flags: {secretWarnings.join(", ")}. Obvious keys/private material are blocked by the save validator.</p></WarningCallout>}
        <div className="button-row"><button className="button-primary" type="button" disabled={!account.signedIn} onClick={() => void saveDocument()}>{selected ? "Save document" : "Create document"}</button><button type="button" disabled={!selected} onClick={() => void submitReview()}>Submit for review</button><button type="button" disabled={!selected} onClick={() => void snapshot()}>Create version snapshot</button><button type="button" disabled={!selected} onClick={() => void lock("acquire")}>Acquire edit lock</button><button type="button" disabled={!selected} onClick={() => void lock("release")}>Release edit lock</button></div>
        <label><span>Snapshot summary</span><input value={snapshotSummary} onChange={(event) => setSnapshotSummary(event.target.value)} /></label>
        {account.isModerator && <div className="commune-moderator-controls"><label><span>Moderation reason</span><input value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} /></label><button type="button" disabled={!selected} onClick={() => void publishOrModerate("publish")}>Publish</button><button type="button" disabled={!selected} onClick={() => void publishOrModerate("archive")}>Archive</button><button type="button" disabled={!selected} onClick={() => void publishOrModerate("hide")}>Hide</button><button type="button" disabled={!selected} onClick={() => void publishOrModerate("remove")}>Remove</button></div>}
        <section className="commune-code-preview"><div className="addon-card__topline"><strong>{form.language}</strong><span>{form.fileName || "untitled"}</span></div><pre><code>{lines.map((line, index) => `${String(index + 1).padStart(4, " ")}  ${line}`).join("\n")}</code></pre><div className="button-row"><button type="button" onClick={() => void copyText(form.text, setMessage)}>Copy code text</button><button type="button" onClick={() => downloadText(`${slug(form.title || "code-review")}.txt`, form.text, "text/plain")}>Export text</button><Link className="button-link" to="/commune/rooms/code-sharing">Create Commune code post from this document</Link><Link className="button-link" to="/commune/sandbox-review" onClick={prepareSandboxFromSelected}>Prepare sandbox review request</Link></div><p className="boundary-note">The links above create metadata/posting paths only. They do not execute code or grant sandbox permission.</p></section>
        <section className="commune-info-grid"><article><h3>Manual snapshots</h3>{!versions.length && <p>No snapshots yet.</p>}{versions.map((version) => <details key={version.id}><summary>v{version.version_number}: {version.change_summary ?? "Snapshot"}</summary><p>{new Date(version.created_at).toLocaleString()}</p><pre className="admin-json-preview">{version.snapshot_text}</pre><button type="button" onClick={() => void copyText(version.snapshot_text, setMessage)}>Copy snapshot</button></details>)}</article><article><h3>Line annotations</h3><div className="commune-form-grid"><label><span>Line start</span><input type="number" min="1" value={annotation.lineStart} onChange={(event) => setAnnotation({ ...annotation, lineStart: Number(event.target.value) })} /></label><label><span>Line end</span><input type="number" min="1" value={annotation.lineEnd} onChange={(event) => setAnnotation({ ...annotation, lineEnd: Number(event.target.value) })} /></label><label className="wide-field"><span>Comment</span><input value={annotation.comment} onChange={(event) => setAnnotation({ ...annotation, comment: event.target.value })} /></label></div><button type="button" disabled={!selected || !account.signedIn} onClick={() => void addAnnotation()}>Add annotation</button>{annotations.map((item) => <article className="review-list-item" key={item.id}><strong>Lines {item.line_start}-{item.line_end}</strong><StatusBadges labels={[item.annotation_status, item.visibility_state]} /><p>{item.comment}</p><div className="button-row"><button type="button" onClick={() => void annotationAction(item, "resolve")}>Resolve</button><button type="button" onClick={() => void annotationAction(item, "report")}>Report annotation</button>{account.isModerator && <><button type="button" onClick={() => void annotationAction(item, "hide")}>Hide</button><button type="button" onClick={() => void annotationAction(item, "remove")}>Remove</button></>}</div></article>)}</article></section>
        <section className="commune-report-panel"><h3>Report document</h3><p>Reports are private to moderators/admins. Reporting does not automatically remove content.</p><label><span>Reason</span><select value={report.reason} onChange={(event) => setReport({ ...report, reason: event.target.value as typeof codeReviewReportReasons[number] })}>{codeReviewReportReasons.map((reason) => <option key={reason} value={reason}>{reason.replace(/_/g, " ")}</option>)}</select></label><label><span>Detail</span><input value={report.detail} onChange={(event) => setReport({ ...report, detail: event.target.value })} /></label><button type="button" disabled={!selected || !account.signedIn} onClick={() => void reportDocument()}>Report code document</button></section>
      </div>
    </div>
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
    <p>Future execution requires isolated sandbox workers, resource limits, network controls, filesystem isolation, logging, kill controls, and explicit user/admin approval. Local Elysia remains final authority for local tools and installs.</p>
    <StatusBadges labels={["no shell", "no npm install", "no package hooks", "no repo clone", "no dependency execution", "metadata review only"]} />
    <Link className="button-link" to="/commune/sandbox-review">Request sandbox review metadata</Link>
  </section>;
}

export default function CommunePage() {
  const { roomSlug, postId } = useParams();
  const location = useLocation();
  const mode = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1];
  }, [location.pathname]);
  const { state, refresh } = useCommuneLoad(roomSlug, postId);
  const localDrafts = useLocalDraftState();
  const [filters, setFilters] = useState<CommuneFilters>({ search: "", category: "All", status: "All", safety: "All" });
  const [categories, setCategories] = useState<CommuneCategory[]>(() => communeFallbackCategories.map((item, index) => ({ ...item, id: item.slug, sort_order: index, is_active: true })));
  useEffect(() => { void loadCategories().then((result) => { setCategories(result.categories); logCommuneDiagnostics("categories", result.warnings); }); }, []);
  const selectedRoom = state.rooms.find((room) => room.slug === roomSlug);
  async function save(id: string) {
    const result = await savePost(id);
    if (isBackendDiagnostic(result.message)) logCommuneDiagnostics("save-post", [result.message]);
    await refresh();
  }

  const routeMode = location.pathname.endsWith("/commune/code-sharing/review") ? "code-review" : ["new", "repository-showcase", "troubleshooting", "sandbox-review", "moderation", "realtime"].includes(mode || "") ? mode : "";
  const activeActionKind = mode === "troubleshooting" ? "troubleshooting" : mode === "repository-showcase" ? "repository" : mode === "sandbox-review" ? "sandbox" : mode === "moderation" ? "moderation" : "";
  const isLobby = !postId && !routeMode && !roomSlug;
  const isRoom = !postId && !routeMode && Boolean(roomSlug);

  return <div className="page-stack commune-page">
    <PageHero eyebrow="Public community" title="The Elysia Commune">
      <p>The Commune is the public gathering place for official updates, media blogs, troubleshooting, code sharing, repository showcases, community networking, project updates, research notes, and Elysia iteration showcases.</p>
      <p><strong>Share publicly. Redact first. Execute nowhere by default.</strong></p>
    </PageHero>
    <Doctrine />
    {isLobby && <CommuneLobby />}
    {isLobby && <CommuneSearchPanel filters={filters} setFilters={setFilters} />}
    {!isLobby && <AccountModePanel signedIn={state.signedIn} isModerator={state.isModerator} accountReady={state.accountReady} activeKind={activeActionKind} />}
    {["new", "troubleshooting", "repository-showcase", "sandbox-review", "code-review", "realtime", "moderation"].includes(routeMode) && <CommuneFocusedToolbar />}

    {mode === "new" && <RoomPickerPanel />}
    {mode === "repository-showcase" && <RepositoryShowcaseForm localDrafts={localDrafts} />}
    {mode === "troubleshooting" && <PostComposer defaultType="troubleshooting" defaultRoomId={state.rooms.find((room) => room.slug === "troubleshooting-grove")?.id} troubleshooting localDrafts={localDrafts} categories={categories} onRefresh={refresh} />}
    {mode === "sandbox-review" && <SandboxDraftPanel localDrafts={localDrafts} />}
    {mode === "moderation" && <ModerationPanel />}
    {mode === "realtime" && <RealtimeFoundationPanel />}
    {routeMode === "code-review" && <CollaborativeCodeReviewPanel />}
    {postId && <PostDetail postId={postId} />}
    {isRoom && roomSlug && <RoomPage roomSlug={roomSlug} roomId={selectedRoom?.id} posts={state.posts} savedPostIds={state.savedPostIds} onSave={(id) => void save(id)} localDrafts={localDrafts} categories={categories} onRefresh={refresh} />}

    {isLobby && <>
      <RedactionPanel />
      <RoomCards />
      <CommunityFeed posts={state.posts} savedPostIds={state.savedPostIds} onSave={(id) => void save(id)} filters={filters} />
      <CommuneSideChannelPanel />
      <LocalDraftStudio localDrafts={localDrafts} filters={filters} />
    </>}
  </div>;
}
