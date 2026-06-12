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
import { communeFallbackCategories, inertCodeSnippetLabel, scanCommuneTextForSecrets, validateCommuneMediaFile } from "./communeSafety";

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

const futureTables = [
  "commune_categories",
  "commune_posts",
  "commune_post_types",
  "commune_comments",
  "commune_media",
  "commune_threads",
  "commune_chat_messages",
  "repo_showcases",
  "repo_showcase_files",
  "code_snippets",
  "sandbox_runs",
  "moderation_reports"
];

const futureSupportTables = [
  "commune_post_saves",
  "commune_thread_follows",
  "commune_reactions",
  "commune_profiles",
  "commune_room_memberships",
  "commune_sandbox_requests",
  "commune_audit_events",
  "commune_admin_actions",
  "commune_upload_reviews",
  "commune_blocklist_terms"
];

const roomLinks = [
  ["general-commune", "General Commune"],
  ["troubleshooting-grove", "Troubleshooting Grove"],
  ["code-sharing", "Code Sharing"],
  ["repository-showcase", "Repository Showcase"],
  ["living-library-help", "Living Library Help"],
  ["marketplace-addons-help", "Marketplace/Add-ons Help"],
  ["elysia-installation-help", "Elysia Installation Help"]
] as const;

const statusFilters = ["All", "Published", "Local drafts", "Pending review", "Repository showcases", "Sandbox requests", "Needs backend"];
const safetyFilters = ["All", "No code execution", "Requires moderation", "Requires backend", "Requires sandbox", "Admin-only later"];
const communeActions = [
  { label: "Request to post", href: "/commune/new", kind: "post" },
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

function normalize(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ");
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
      <h2>Browse rooms, search posts, draft something safe to share, or prepare a repository/sandbox review request.</h2>
      <p>The Commune is where Elysia Ecobotics members can gather around public updates, troubleshooting, research notes, repository showcases, add-on ideas, and ecological/technical work. Everything here should be safe to make public. Redact first. Code executes nowhere by default.</p>
    </div>
    <CommuneActionNav activeKind="" />
    <div className="commune-action-row"><a className="button-link" href="#commune-rooms">Browse rooms</a><a className="button-link" href="#commune-local-drafts">View local drafts</a></div>
  </section>;
}

function CommuneSearchPanel({ filters, setFilters }: { filters: CommuneFilters; setFilters: (filters: CommuneFilters) => void }) {
  return <section className="section-card commune-search-panel" id="commune-search">
    <div className="section-heading section-heading--inline">
      <div>
        <p className="eyebrow">Search and filters</p>
        <h2>Find the right room before the page gets long.</h2>
        <p>Filters apply to room/type cards, the community feed, and local drafts. They do not fake published posts.</p>
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

function RoomCards({ rooms }: { rooms: CommuneRoom[] }) {
  const source = rooms.length ? rooms : roomLinks.map(([slugValue, name]) => ({ id: slugValue, slug: slugValue, name, description: "Account-backed room is being prepared. Local draft tools remain available.", room_type: slugValue, requires_moderation: true }));
  return <section className="section-card" id="commune-rooms"><p className="eyebrow">Rooms</p><h2>Moderated community spaces</h2><div className="commune-zone-grid">{source.map((room) => <article className="commune-zone-card commune-room-card" key={room.slug}><span className="commune-card-sigil" aria-hidden="true">{room.name.slice(0, 1)}</span><h3>{room.name}</h3><p>{room.description || "Moderated Commune room."}</p><StatusBadges labels={[room.room_type, room.requires_moderation ? "requires moderation" : "open"]} /><Link className="button-link" to={`/commune/rooms/${room.slug}`}>Open room</Link></article>)}</div></section>;
}

function PostCard({ post, saved, onSave }: { post: CommunePost; saved: boolean; onSave: (id: string) => void }) {
  return <article className="commune-post-card"><div className="addon-card__topline"><StatusBadges labels={[post.post_type, post.status]} /></div><h3><Link to={`/commune/posts/${post.id}`}>{post.title}</Link></h3><p>{post.excerpt || post.body.slice(0, 180)}</p><p>By {authorLink(post.author_username)} · {post.published_at ? new Date(post.published_at).toLocaleDateString() : "public date unavailable"}</p><div className="tag-row">{(post.tags ?? []).slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}</div><div className="button-row"><Link className="button-link" to={`/commune/posts/${post.id}`}>Read</Link><button type="button" onClick={() => onSave(post.id)}>{saved ? "Saved" : "Save post"}</button></div></article>;
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
    {filteredPosts.length ? <div className="commune-feed-grid">{filteredPosts.map((post) => <PostCard key={post.id} post={post} saved={savedPostIds.includes(post.id)} onSave={onSave} />)}</div> : <div className="commune-feed-grid">{emptyCards.map((type) => <article className="commune-feed-card" key={type.id}><div className="commune-author-sigil" aria-hidden="true">{type.name.slice(0, 1)}</div><p className="eyebrow">{type.name}</p><h3>No {type.name} posts yet.</h3><p>{type.purpose}</p><a className="button-link" href={type.backendValue === "repository_showcase" ? "#commune-repository-showcase" : "#commune-post-composer"}>{type.backendValue === "repository_showcase" ? "Prepare request" : "Draft one"}</a></article>)}</div>}
  </section>;
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
    {!accountReady && <p className="boundary-note">Account-backed Commune features are being prepared. Local draft and export tools remain available.</p>}
    <CommuneActionNav activeKind={activeKind} includeModeration={isModerator} />
  </section>;
}

function PostComposer({ defaultType = "media_garden" as CommunePostType, defaultRoomId, troubleshooting = false, localDrafts, categories, onRefresh }: { defaultType?: CommunePostType; defaultRoomId?: string; troubleshooting?: boolean; localDrafts: ReturnType<typeof useLocalDraftState>; categories: CommuneCategory[]; onRefresh?: () => Promise<void> }) {
  const [form, setForm] = useState({ postType: defaultType, categorySlug: categories[0]?.slug ?? "general", roomId: defaultRoomId || "", title: "", summary: "", body: "", tags: "", links: "", repositoryUrl: "", os: "", browser: "", version: "", stepsTried: "", codeLanguage: "", codeFileName: "", codeText: "", stepsCodeAck: false, acknowledgement: false, sandboxRequested: false });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("Signed-in users can submit posts for moderation. Local draft/export is available even when backend review is not active.");
  const secretScan = scanCommuneTextForSecrets([form.title, form.body, form.codeFileName, form.codeText, form.repositoryUrl].join("\n"));
  const fileValidation = file ? validateCommuneMediaFile(file) : null;

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
      tags: form.tags,
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
    <p className="eyebrow">Request to post</p>
    <h2>{troubleshooting ? "Troubleshooting post" : "Create a moderated Commune post"}</h2>
    <p className="boundary-note">Uploads are part of Elysia Ecobotics Online, not private local Elysia. Do not upload private local Elysia memory, logs, vault data, credentials, .env files, API keys, identity documents, or unredacted sensitive information.</p>
    <div className="commune-form-grid">
      <label><span>Post type</span><select value={form.postType} onChange={(event) => setForm({ ...form, postType: event.target.value as CommunePostType })}>{postTypeOptions.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      <label><span>Category</span><select value={form.categorySlug} onChange={(event) => setForm({ ...form, categorySlug: event.target.value })}>{categories.map((category) => <option key={category.slug} value={category.slug}>{category.title}</option>)}</select></label>
      <label><span>Title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label><span>Summary</span><input value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
      <label><span>Tags</span><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></label>
      <label><span>Links</span><input value={form.links} onChange={(event) => setForm({ ...form, links: event.target.value })} /></label>
      <label><span>Repository URL optional</span><input value={form.repositoryUrl} onChange={(event) => setForm({ ...form, repositoryUrl: event.target.value })} /></label>
      <label><span>Attachment optional</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      {troubleshooting && <><label><span>OS</span><input value={form.os} onChange={(event) => setForm({ ...form, os: event.target.value })} /></label><label><span>Browser</span><input value={form.browser} onChange={(event) => setForm({ ...form, browser: event.target.value })} /></label><label><span>Elysia version optional</span><input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} /></label><label><span>Steps tried</span><input value={form.stepsTried} onChange={(event) => setForm({ ...form, stepsTried: event.target.value })} /></label></>}
      <label className="wide-field"><span>Body</span><textarea rows={8} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
      <label><span>Code language optional</span><input value={form.codeLanguage} onChange={(event) => setForm({ ...form, codeLanguage: event.target.value })} placeholder="typescript, bash, python..." /></label>
      <label><span>Code filename optional</span><input value={form.codeFileName} onChange={(event) => setForm({ ...form, codeFileName: event.target.value })} /></label>
      <label className="wide-field"><span>Inert code snippet optional</span><textarea rows={7} value={form.codeText} onChange={(event) => setForm({ ...form, codeText: event.target.value })} placeholder="Displayed as text only. The website will not execute it." /></label>
    </div>
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
  const [form, setForm] = useState({ title: "", relatedUrl: "", codePurpose: "", expectedCommand: "", dependencies: "", networkNeeded: "No", fileAccessNeeded: "No", estimatedRuntime: "", whySandbox: "", riskNotes: "" });
  const [message, setMessage] = useState("Sandbox requests are not execution permission. Future execution requires isolated infrastructure, explicit approval, resource limits, no secrets, no private network, no host mounts, logs, and kill controls.");

  function draft(): SandboxRequestDraft {
    return { ...form, id: `sandbox-${Date.now()}`, createdAt: new Date().toISOString() };
  }

  function saveLocal() {
    const next = draft();
    localDrafts.updateSandboxDrafts([next, ...localDrafts.sandboxDrafts]);
    setMessage("Sandbox request draft saved locally. No code was executed and no permission was granted.");
  }

  async function submit() {
    const result = await submitSandboxReview({ requestTitle: form.title, repositoryUrl: form.relatedUrl, scope: form.whySandbox, riskNotes: form.riskNotes, permissions: form.dependencies.split(/[,\n]/).map((item) => item.trim()).filter(Boolean) });
    if (result.ok) setMessage(result.message);
    else if (isBackendDiagnostic(result.message)) { saveLocal(); setMessage("Saved locally in this browser. Sandbox review queue is not active yet."); }
    else setMessage(result.message);
  }

  return <section className="section-card commune-sandbox-card" id="commune-sandbox-review">
    <p className="eyebrow">Sandbox Request Draft</p>
    <h2>Request review for future isolated execution.</h2>
    <p className="boundary-note">Sandbox requests are not execution permission. Future execution requires isolated infrastructure, explicit approval, resource limits, no secrets, no private network, no host mounts, logs, and kill controls.</p>
    <div className="commune-form-grid">
      <label><span>Request title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label><span>Related post/repo URL</span><input value={form.relatedUrl} onChange={(event) => setForm({ ...form, relatedUrl: event.target.value })} /></label>
      <label><span>Expected command</span><input value={form.expectedCommand} onChange={(event) => setForm({ ...form, expectedCommand: event.target.value })} /></label>
      <label><span>Dependencies / declared permissions</span><input value={form.dependencies} onChange={(event) => setForm({ ...form, dependencies: event.target.value })} /></label>
      <label><span>Network needed?</span><select value={form.networkNeeded} onChange={(event) => setForm({ ...form, networkNeeded: event.target.value })}><option>No</option><option>Yes</option></select></label>
      <label><span>File access needed?</span><select value={form.fileAccessNeeded} onChange={(event) => setForm({ ...form, fileAccessNeeded: event.target.value })}><option>No</option><option>Yes</option></select></label>
      <label><span>Estimated runtime</span><input value={form.estimatedRuntime} onChange={(event) => setForm({ ...form, estimatedRuntime: event.target.value })} /></label>
      <label className="wide-field"><span>Code purpose</span><textarea value={form.codePurpose} onChange={(event) => setForm({ ...form, codePurpose: event.target.value })} rows={4} /></label>
      <label className="wide-field"><span>Why sandbox is needed</span><textarea value={form.whySandbox} onChange={(event) => setForm({ ...form, whySandbox: event.target.value })} rows={4} /></label>
      <label className="wide-field"><span>Risk notes</span><textarea value={form.riskNotes} onChange={(event) => setForm({ ...form, riskNotes: event.target.value })} rows={4} /></label>
    </div>
    <div className="button-row"><button className="button-primary" type="button" onClick={() => void submit()}>Submit sandbox review request</button><button type="button" onClick={saveLocal}>Save sandbox request draft locally</button><button type="button" onClick={() => downloadText(`${slug(form.title)}-sandbox-request.md`, sandboxMarkdown(draft()), "text/markdown")}>Export Markdown</button><button type="button" onClick={() => downloadText(`${slug(form.title)}-sandbox-request.json`, JSON.stringify(draft(), null, 2), "application/json")}>Export JSON</button><button type="button" onClick={() => copyText(sandboxMarkdown(draft()), setMessage)}>Copy request Markdown</button></div>
    <p className="message">{message}</p>
  </section>;
}

function LocalDraftStudio({ localDrafts, filters }: { localDrafts: ReturnType<typeof useLocalDraftState>; filters: CommuneFilters }) {
  const draftCards = [
    ...localDrafts.postDrafts.map((draft) => ({ id: draft.id, title: draft.title || "Untitled post draft", labels: [draft.status, draft.postType], summary: draft.summary })),
    ...localDrafts.postRequests.map((draft) => ({ id: draft.id, title: draft.title || "Untitled post request", labels: [draft.status, draft.postType], summary: draft.summary })),
    ...localDrafts.repoDrafts.map((draft) => ({ id: draft.id, title: draft.title || "Untitled repo showcase", labels: ["repo showcase draft", draft.provider, draft.manifestStatus, "Repository Showcase"], summary: draft.description })),
    ...localDrafts.sandboxDrafts.map((draft) => ({ id: draft.id, title: draft.title || "Untitled sandbox request", labels: ["sandbox request draft", `network: ${draft.networkNeeded}`, `files: ${draft.fileAccessNeeded}`], summary: draft.codePurpose }))
  ].filter((draft) => matchesSearch([draft.title, draft.summary, ...draft.labels], filters.search) && matchesStatus(draft.labels, filters.status) && matchesSafety(draft.labels, filters.safety) && (filters.category === "All" || draft.labels.includes(filters.category)));
  const total = localDrafts.postDrafts.length + localDrafts.postRequests.length + localDrafts.repoDrafts.length + localDrafts.sandboxDrafts.length;
  return <section className="section-card" id="commune-local-drafts">
    <p className="eyebrow">Local drafts and pending review requests</p>
    <h2>Saved in this browser only</h2>
    {total === 0 ? <p>Drafts and post requests saved in this browser will appear here.</p> : null}
    <div className="commune-draft-grid">
      {draftCards.map((draft) => <article key={draft.id}><h3>{draft.title}</h3><StatusBadges labels={draft.labels} /><p>{draft.summary}</p></article>)}
    </div>
    {total > 0 && !draftCards.length && <p className="commune-empty-state">No local drafts match the active filters.</p>}
  </section>;
}

function FutureBackendPanel() {
  return <>
    <section className="section-card commune-info-grid">
      <article>
        <p className="eyebrow">Local mode now</p>
        <h2>What works without a backend</h2>
        <ul><li>Create post drafts.</li><li>Save post requests locally.</li><li>Create repository showcase drafts.</li><li>Request code sandbox as local draft.</li><li>Export drafts as Markdown/JSON.</li></ul>
      </article>
      <article>
        <p className="eyebrow">Future account mode</p>
        <h2>Progressive enhancement</h2>
        <ul><li>Public posts after moderation.</li><li>Comments, saved posts, follows, uploads, and troubleshooting rooms.</li><li>Repository showcases and sandbox review requests.</li><li>Supabase tables, RLS policies, moderator/admin roles, moderation queue, abuse controls, upload policies, and audit logs.</li></ul>
      </article>
    </section>
    <section className="section-card commune-info-grid">
      <article><p className="eyebrow">Future backend roadmap</p><h2>Planned tables</h2><div className="commune-badge-row">{futureTables.map((table) => <span key={table}>{table}</span>)}</div><p>These are planned/future backend tables. They are not live until Supabase schema, RLS, moderation, and abuse controls are built.</p></article>
      <article><p className="eyebrow">Later support tables</p><h2>Possible support structures</h2><div className="commune-badge-row">{futureSupportTables.map((table) => <span key={table}>{table}</span>)}</div></article>
    </section>
    <section className="section-card commune-info-grid" id="commune-moderation-doctrine">
      <article><p className="eyebrow">Moderation Doctrine</p><h2>Future moderation must handle</h2><p>Spam, harassment, malware, secret leakage, private data exposure, copyright violations, unsafe code, scams/job fraud, impersonation, off-topic floods, AI-generated spam, doxxing, and sensitive ecological location exposure.</p><h3>Future actions</h3><StatusBadges labels={["report", "hide", "lock thread", "remove post", "request redaction", "mark official", "mark community", "mark unreviewed", "block upload", "security hold", "admin review"]} /><h3>Trust labels</h3><StatusBadges labels={["Official", "Community", "Unreviewed", "Needs redaction", "Security hold", "Resolved", "Archived", "Blocked"]} /></article>
      <article><p className="eyebrow">Media, chat, jobs, and official notices</p><h2>Boundaries for future rooms</h2><p><strong>Media uploads:</strong> not public by default. Future public display requires file type limits, size limits, moderation, attribution/copyright prompts, malware scanning where possible, private-data warnings, storage policies, and abuse controls.</p><p><strong>Collaborative rooms and chat:</strong> planned, not live. Future rooms need moderation, rate limits, reporting, blocking, room roles, invite controls, retention policy, and no private Elysia memory sharing by default.</p><p><strong>Job posts:</strong> future job posts require clear organization/contact, clear role type, clear paid/volunteer status, pay/rate or honest explanation if unpaid, location/remote status, no misleading roles, no sensitive personal data requests in public comments, and scam/moderator review.</p><p><strong>Official Updates:</strong> restricted to authorized Elysia Ecobotics administrators later. Community users should not impersonate official release, security, or governance notices.</p><h3>Code/repo labels</h3><StatusBadges labels={["No code execution", "Snippet only", "Repo showcase only", "Manifest present", "Manifest not reviewed", "License unclear", "Sandbox required", "Security review needed", "Blocked"]} /></article>
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
  if (!post) return <section className="section-card"><h2>Post not found</h2><p>This post is not public, does not exist, or is still awaiting moderation.</p><p className="boundary-note">Account-backed posts may also be unavailable while Commune backend tables are being prepared.</p><Link className="button-link" to="/commune">Back to Commune</Link></section>;
  return <><section className="section-card commune-post-detail"><p className="eyebrow">{post.post_type.replace(/_/g, " ")}</p><h2>{post.title}</h2><p>By {authorLink(post.author_username)}</p><StatusBadges labels={[post.status, post.visibility]} /><p>{post.body}</p><div className="tag-row">{(post.tags ?? []).map((tag) => <span key={tag}>{tag}</span>)}</div><div className="button-row"><button type="button" onClick={() => void save()}>{state.savedPostIds.includes(postId) ? "Saved" : "Save post"}</button><button type="button" onClick={() => void follow()}>{thread && state.followedThreadIds.includes(thread.id) ? "Following" : "Follow thread"}</button><button type="button" onClick={() => void markRead()}>Mark read</button></div></section>{snippets.length > 0 && <section className="section-card"><p className="eyebrow">Code snippets</p><h2>Inert display only</h2>{snippets.map((snippet) => <article className="commune-code-preview" key={snippet.id}><div className="addon-card__topline"><strong>{inertCodeSnippetLabel(snippet.language ?? "")}</strong><span>{snippet.file_name ?? "snippet"}</span></div><pre><code>{snippet.code_text}</code></pre><p className="boundary-note">Code is shown for discussion only. Do not run code you do not trust. The website did not execute this snippet.</p></article>)}</section>}<section className="section-card"><p className="eyebrow">Comments</p><h2>Replies after moderation</h2>{state.comments.map((item) => <article className="commune-preview-card" key={item.id}><p>{item.body}</p><p>By {authorLink(item.author_username)} · {item.status}</p></article>)}{!state.comments.length && <p>Moderated comments will appear here once the backend tables are active and replies are approved.</p>}<label><span>Reply</span><textarea rows={4} value={comment} onChange={(event) => setComment(event.target.value)} /></label><button type="button" onClick={() => void submitReply()}>Submit comment for moderation</button></section><section className="section-card"><p className="eyebrow">Report</p><h2>Report this post</h2><p>Reports are reviewed by moderators/administrators. Reporting does not automatically remove content unless urgent automated controls are later added.</p><label><span>Report type</span><select value={report.type} onChange={(event) => setReport({ ...report, type: event.target.value })}>{reportTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label><span>Reason</span><textarea rows={3} value={report.reason} onChange={(event) => setReport({ ...report, reason: event.target.value })} /></label><button type="button" onClick={() => void reportPost()}>Send report</button><p className="message">{message}</p></section></>;
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

function RealtimeFoundationPanel() {
  return <section className="section-card commune-realtime-card">
    <p className="eyebrow">Realtime foundation</p>
    <h2>Live chat is prepared, not launched.</h2>
    <p>Realtime community rooms need moderation, rate limits, report tools, retention rules, and private-data warnings before public write access is treated as safe.</p>
    <StatusBadges labels={["plain text only", "no private DMs", "no file uploads", "reportable", "moderation required", "rate limits required"]} />
    <p className="boundary-note">The `commune_realtime_messages` table foundation is private-safe by RLS, but this page intentionally presents it as future infrastructure until moderation/rate limits are fully configured.</p>
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

  const routeMode = ["new", "repository-showcase", "troubleshooting", "sandbox-review", "moderation", "realtime"].includes(mode || "") ? mode : "";
  const activeActionKind = mode === "new" ? "post" : mode === "troubleshooting" ? "troubleshooting" : mode === "repository-showcase" ? "repository" : mode === "sandbox-review" ? "sandbox" : mode === "moderation" ? "moderation" : "";

  return <div className="page-stack commune-page">
    <PageHero eyebrow="Public community" title="The Elysia Commune">
      <p>The Commune is the public gathering place for official updates, media blogs, troubleshooting, code sharing, repository showcases, community networking, project updates, research notes, and Elysia iteration showcases.</p>
      <p><strong>Share publicly. Redact first. Execute nowhere by default.</strong></p>
    </PageHero>
    <Doctrine />
    {!postId && !routeMode && <CommuneLobby />}
    {!postId && !routeMode && <CommuneSearchPanel filters={filters} setFilters={setFilters} />}
    <AccountModePanel signedIn={state.signedIn} isModerator={state.isModerator} accountReady={state.accountReady} activeKind={activeActionKind} />
    {["new", "troubleshooting", "repository-showcase", "sandbox-review"].includes(routeMode) && <CommuneFocusedToolbar />}

    {mode === "new" && <PostComposer defaultRoomId={selectedRoom?.id} localDrafts={localDrafts} categories={categories} onRefresh={refresh} />}
    {mode === "repository-showcase" && <RepositoryShowcaseForm localDrafts={localDrafts} />}
    {mode === "troubleshooting" && <PostComposer defaultType="troubleshooting" defaultRoomId={state.rooms.find((room) => room.slug === "troubleshooting-grove")?.id} troubleshooting localDrafts={localDrafts} categories={categories} onRefresh={refresh} />}
    {mode === "sandbox-review" && <SandboxDraftPanel localDrafts={localDrafts} />}
    {mode === "moderation" && <ModerationPanel />}
    {mode === "realtime" && <RealtimeFoundationPanel />}
    {postId && <PostDetail postId={postId} />}

    {!postId && !routeMode && <>
      <RedactionPanel />
      <RoomCards rooms={state.rooms} />
      <ZoneCatalog filters={filters} />
      {roomSlug && <section className="section-card"><p className="eyebrow">Room</p><h2>{selectedRoom?.name ?? roomSlug}</h2><p>{selectedRoom?.description ?? "Account-backed room is being prepared. Local draft tools remain available."}</p></section>}
      <CommunityFeed posts={state.posts} savedPostIds={state.savedPostIds} onSave={(id) => void save(id)} filters={filters} />
      <PostComposer defaultRoomId={selectedRoom?.id} localDrafts={localDrafts} categories={categories} onRefresh={refresh} />
      <RepositoryShowcaseForm localDrafts={localDrafts} />
      <SandboxDraftPanel localDrafts={localDrafts} />
      <RealtimeFoundationPanel />
      <CodeExecutionBoundaryPanel />
      <LocalDraftStudio localDrafts={localDrafts} filters={filters} />
      <FutureBackendPanel />
    </>}
  </div>;
}
