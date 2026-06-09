import { useState } from "react";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";

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

type CommunePostType = {
  id: string;
  name: string;
  purpose: string;
  allowedContent: string;
  cautions: string;
  currentStatus: string[];
  futureFeatures: string;
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

const postTypes: CommunePostType[] = [
  {
    id: "media-garden",
    name: "Media Garden",
    purpose: "Images, videos, demos, artwork, project updates, and public storytelling around Elysia.",
    allowedContent: "Public images, videos, demos, artwork notes, project updates, and storytelling drafts.",
    cautions: "Do not upload private documents, faces without consent, sensitive location data, copyrighted media without permission, credentials, or private screenshots.",
    currentStatus: ["Local draft only", "Requires moderation", "Requires backend"],
    futureFeatures: "Moderated media posts, attribution prompts, file limits, storage policy, and abuse controls."
  },
  {
    id: "troubleshooting-grove",
    name: "Troubleshooting Grove",
    purpose: "Help threads, known issues, install problems, bug reports, and shared learning.",
    allowedContent: "Public bug descriptions, redacted logs, install notes, workaround drafts, and known-issue writeups.",
    cautions: "Redact logs. Do not paste tokens, .env files, local file paths, private machine inventories, or account details.",
    currentStatus: ["Local draft only", "Requires moderation", "Requires backend"],
    futureFeatures: "Moderated threads, issue tags, solved labels, and safe troubleshooting templates."
  },
  {
    id: "code-sharing",
    name: "Code Sharing",
    purpose: "Snippets, examples, add-on ideas, scripts, and safe development notes.",
    allowedContent: "Small public snippets, examples, design notes, add-on ideas, and review requests.",
    cautions: "Shared code is not trusted and is not executed by the website or Elysia by default.",
    currentStatus: ["Local draft only", "Requires moderation", "Requires sandbox"],
    futureFeatures: "Syntax display, manifest checks, snippet labels, sandbox review requests, and code safety triage."
  },
  {
    id: "repository-showcase",
    name: "Repository Showcase",
    purpose: "Public project pages for GitHub, GitLab, Codeberg, Forgejo, or uploaded archives later.",
    allowedContent: "Repo links, pasted README previews, file tree summaries, screenshots, license notes, and compatibility notes.",
    cautions: "A public repo is not automatically safe, compatible, licensed, or free of secrets.",
    currentStatus: ["Local draft only", "Requires moderation", "Requires backend"],
    futureFeatures: "Repo showcase pages, manifest review, compatibility labels, and optional sandbox requests."
  },
  {
    id: "community-network",
    name: "Community Network",
    purpose: "Introductions, collaboration interests, role interests, project circles, and community coordination.",
    allowedContent: "Public introductions, collaboration interests, project circle notes, and role-interest drafts.",
    cautions: "Avoid personal oversharing and private-contact pressure.",
    currentStatus: ["Local draft only", "Requires moderation", "Requires backend"],
    futureFeatures: "Profiles, circles, follows, introductions, and safer contact preferences."
  },
  {
    id: "job-post",
    name: "Job Post",
    purpose: "EcoSyneva/Elysia opportunities, community job posts, volunteer calls, research roles, and project needs.",
    allowedContent: "Clear role summaries, paid/volunteer status, project needs, location/remote notes, and contact paths.",
    cautions: "Jobs require anti-scam review, pay/volunteer clarity, location/remote clarity, and no sensitive personal data in public comments.",
    currentStatus: ["Local draft only", "Requires moderation", "Requires backend"],
    futureFeatures: "Reviewed job posts, role labels, scam reporting, and pay/volunteer clarity requirements."
  },
  {
    id: "official-update",
    name: "Official Update",
    purpose: "Official Elysia Ecobotics announcements, releases, roadmap notes, and governance updates.",
    allowedContent: "Administrator-authored release notes, roadmap notes, governance updates, and official notices later.",
    cautions: "Admin-only later. Community users must not be able to impersonate official release/security notices.",
    currentStatus: ["Admin-only later", "Requires backend"],
    futureFeatures: "Authorized administrator posting, official labels, release/security notice protections, and audit trails."
  },
  {
    id: "research-note",
    name: "Research Note",
    purpose: "Public research notes, evidence summaries, source discussions, ecological observations, and Living Library-linked work.",
    allowedContent: "Evidence summaries, source links, citation notes, uncertainties, ecological observations, and interpretation boundaries.",
    cautions: "Cite sources and separate evidence from interpretation.",
    currentStatus: ["Local draft only", "Requires moderation", "Requires backend"],
    futureFeatures: "Evidence strength fields, source cards, Living Library links, and review labels."
  },
  {
    id: "elysia-iteration-showcase",
    name: "Elysia Iteration Showcase",
    purpose: "Demos, screenshots, version notes, UI updates, add-on previews, and design progress.",
    allowedContent: "Public screenshots, design notes, add-on previews, version notes, and demo summaries.",
    cautions: "Do not expose private prompts, local file paths, credentials, logs, or sealed memory.",
    currentStatus: ["Local draft only", "Requires moderation", "Requires backend"],
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
  "commune_posts", "commune_post_types", "commune_comments", "commune_media", "commune_threads", "commune_chat_messages", "repo_showcases", "repo_showcase_files", "code_snippets", "sandbox_runs", "moderation_reports"
];

const futureSupportTables = [
  "commune_post_saves", "commune_thread_follows", "commune_reactions", "commune_profiles", "commune_room_memberships", "commune_sandbox_requests", "commune_audit_events", "commune_admin_actions", "commune_upload_reviews", "commune_blocklist_terms"
];

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
  void navigator.clipboard.writeText(text).then(() => fallback("Copied Markdown to clipboard."), () => fallback("Clipboard write failed. The Markdown is still exportable."));
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
    "Local draft mode: this was not sent to a live moderator queue."
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

function StatusBadges({ labels }: { labels: string[] }) {
  return <div className="commune-badge-row">{labels.map((label) => <span key={label}>{label}</span>)}</div>;
}

export default function CommunePage() {
  const [postDrafts, setPostDrafts] = useState<PostDraft[]>(() => readStorage(storageKeys.postDrafts, []));
  const [postRequests, setPostRequests] = useState<PostDraft[]>(() => readStorage(storageKeys.postRequests, []));
  const [repoDrafts, setRepoDrafts] = useState<RepoShowcaseDraft[]>(() => readStorage(storageKeys.repoShowcaseDrafts, []));
  const [sandboxDrafts, setSandboxDrafts] = useState<SandboxRequestDraft[]>(() => readStorage(storageKeys.sandboxRequestDrafts, []));
  const [statusMessage, setStatusMessage] = useState("Local draft mode: drafts and requests are stored in this browser for now. Account-backed publishing and moderator review will come later after Supabase tables, RLS, and moderator/admin accounts are designed.");
  const [postForm, setPostForm] = useState(() => ({
    postType: postTypes[0].name,
    title: "",
    summary: "",
    body: "",
    tags: "",
    sourceLinks: "",
    licenseNotes: "",
    redactionNotes: "",
    intendedAudience: "Community review later",
    submitterName: "",
    submitterContact: "",
    checklist: Object.fromEntries(redactionChecklist.map((item) => [item, false])) as Record<string, boolean>
  }));
  const [repoForm, setRepoForm] = useState({
    title: "",
    repoUrl: "",
    provider: "GitHub",
    branch: "",
    commit: "",
    license: "",
    description: "",
    readmePreview: "",
    fileTreePreview: "",
    screenshotNotes: "",
    manifestStatus: "No manifest checked",
    compatibility: "Unknown",
    warnings: [] as string[]
  });
  const [sandboxForm, setSandboxForm] = useState({
    title: "",
    relatedUrl: "",
    codePurpose: "",
    expectedCommand: "",
    dependencies: "",
    networkNeeded: "No",
    fileAccessNeeded: "No",
    estimatedRuntime: "",
    whySandbox: "",
    riskNotes: ""
  });

  function updatePostDrafts(next: PostDraft[]) {
    setPostDrafts(next);
    writeStorage(storageKeys.postDrafts, next);
  }

  function updatePostRequests(next: PostDraft[]) {
    setPostRequests(next);
    writeStorage(storageKeys.postRequests, next);
  }

  function updateRepoDrafts(next: RepoShowcaseDraft[]) {
    setRepoDrafts(next);
    writeStorage(storageKeys.repoShowcaseDrafts, next);
  }

  function updateSandboxDrafts(next: SandboxRequestDraft[]) {
    setSandboxDrafts(next);
    writeStorage(storageKeys.sandboxRequestDrafts, next);
  }

  function buildPost(status: CommuneStatus): PostDraft {
    return {
      ...postForm,
      id: `${status}-${Date.now()}`,
      status,
      createdAt: new Date().toISOString()
    };
  }

  function savePostDraft(status: CommuneStatus) {
    const draft = buildPost(status);
    if (status === "pending_moderator_review_local") {
      updatePostRequests([draft, ...postRequests]);
      setStatusMessage("Post request saved locally as a pending moderator-review draft. Later, requests will be sent to the configured moderator account after the account/review system is built.");
    } else {
      updatePostDrafts([draft, ...postDrafts]);
      setStatusMessage("Commune post draft saved locally in this browser.");
    }
  }

  function saveRepoDraft() {
    const draft: RepoShowcaseDraft = { ...repoForm, id: `repo-${Date.now()}`, createdAt: new Date().toISOString() };
    updateRepoDrafts([draft, ...repoDrafts]);
    setStatusMessage("Repository showcase draft saved locally. No repository was fetched, cloned, or validated remotely.");
  }

  function saveSandboxDraft() {
    const draft: SandboxRequestDraft = { ...sandboxForm, id: `sandbox-${Date.now()}`, createdAt: new Date().toISOString() };
    updateSandboxDrafts([draft, ...sandboxDrafts]);
    setStatusMessage("Sandbox request draft saved locally. No code was executed and no permission was granted.");
  }

  function exportPost(format: "markdown" | "json") {
    const draft = buildPost("draft_local");
    if (format === "markdown") downloadText(`${slug(draft.title)}.md`, postMarkdown(draft), "text/markdown");
    else downloadText(`${slug(draft.title)}.json`, JSON.stringify(draft, null, 2), "application/json");
    setStatusMessage(`Exported current post draft as ${format.toUpperCase()} locally.`);
  }

  function exportRepo(format: "markdown" | "json") {
    const draft: RepoShowcaseDraft = { ...repoForm, id: `repo-preview`, createdAt: new Date().toISOString() };
    if (format === "markdown") downloadText(`${slug(draft.title)}-repo-showcase.md`, repoMarkdown(draft), "text/markdown");
    else downloadText(`${slug(draft.title)}-repo-showcase.json`, JSON.stringify(draft, null, 2), "application/json");
    setStatusMessage(`Exported repository showcase draft as ${format.toUpperCase()} locally.`);
  }

  function exportSandbox(format: "markdown" | "json") {
    const draft: SandboxRequestDraft = { ...sandboxForm, id: `sandbox-preview`, createdAt: new Date().toISOString() };
    if (format === "markdown") downloadText(`${slug(draft.title)}-sandbox-request.md`, sandboxMarkdown(draft), "text/markdown");
    else downloadText(`${slug(draft.title)}-sandbox-request.json`, JSON.stringify(draft, null, 2), "application/json");
    setStatusMessage(`Exported sandbox request draft as ${format.toUpperCase()} locally.`);
  }

  function toggleRepoWarning(label: string) {
    setRepoForm((current) => ({
      ...current,
      warnings: current.warnings.includes(label) ? current.warnings.filter((item) => item !== label) : [...current.warnings, label]
    }));
  }

  return (
    <div className="page-stack commune-page">
      <PageHero eyebrow="Public community" title="The Elysia Commune">
        <p>The Commune is the future public gathering place for official updates, media blogs, troubleshooting, code sharing, repository showcases, community networking, project updates, research notes, and Elysia iteration showcases.</p>
        <p><strong>Share publicly. Redact first. Execute nowhere by default.</strong></p>
      </PageHero>

      <section className="commune-doctrine-grid">
        <WarningCallout title="Share carefully">
          <p>Do not upload secrets, private Elysia memory, private logs, .env files, credentials, personal documents, or unredacted customer/user data. Public posts are not private support tickets. Anything drafted here should be safe to be public.</p>
        </WarningCallout>
        <WarningCallout title="Code execution boundary">
          <p>Community code must not run directly on Supabase, Cloudflare backend, Elysia core, Bradley's machine, or any shared website server. No community code execution is live on this page; users may draft sandbox requests only.</p>
        </WarningCallout>
        <WarningCallout title="Moderator routing">
          <p>Moderator routing is not live yet. A moderator account will be configured later. Until then, post requests are saved locally as drafts/pending review items.</p>
        </WarningCallout>
      </section>

      <section className="section-card commune-status-card">
        <p className="eyebrow">Commune v0.1</p>
        <h2>Community is welcome. Secrets are not.</h2>
        <p>{statusMessage}</p>
        <dl className="mini-facts">
          <div><dt>Live submission</dt><dd>{communeModerationConfig.liveSubmissionEnabled ? "Enabled" : "Not live"}</dd></div>
          <div><dt>Backend queue</dt><dd>{communeModerationConfig.backendReviewQueueEnabled ? "Enabled" : "Not live"}</dd></div>
          <div><dt>Moderator account</dt><dd>{communeModerationConfig.moderatorAccountEmail ?? "Not configured"}</dd></div>
          <div><dt>Administrator account</dt><dd>{communeModerationConfig.administratorAccountEmail ?? "Not configured"}</dd></div>
        </dl>
      </section>

      <section className="section-card">
        <p className="eyebrow">Redaction Checklist</p>
        <h2>Before sharing logs, screenshots, repo notes, or code, redact these.</h2>
        <div className="commune-redaction-grid">
          {["API keys", "tokens", "passwords", "emails", "phone numbers", "addresses", "private local file paths", "machine usernames", "database URLs", "Supabase keys", "Cloudflare tokens", "GitHub tokens", ".env contents", "customer/user records"].map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      <section className="section-card">
        <p className="eyebrow">Commune Zones</p>
        <h2>Post types and boundaries</h2>
        <div className="commune-zone-grid">
          {postTypes.map((type) => (
            <article className="commune-zone-card" key={type.id}>
              <h3>{type.name}</h3>
              <p>{type.purpose}</p>
              <p><strong>Allowed:</strong> {type.allowedContent}</p>
              <p><strong>Caution:</strong> {type.cautions}</p>
              <StatusBadges labels={type.currentStatus} />
              <details><summary>Future features</summary><p>{type.futureFeatures}</p></details>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card commune-composer-card">
        <p className="eyebrow">Post request composer</p>
        <h2>Request to post in The Elysia Commune</h2>
        <p className="boundary-note">Local draft mode: drafts and requests are stored in this browser for now. Account-backed publishing and moderator review will come later after Supabase tables, RLS, and moderator/admin accounts are designed.</p>
        <div className="commune-form-grid">
          <label><span>Post type</span><select value={postForm.postType} onChange={(event) => setPostForm({ ...postForm, postType: event.target.value })}>{postTypes.map((type) => <option key={type.id}>{type.name}</option>)}</select></label>
          <label><span>Title</span><input value={postForm.title} onChange={(event) => setPostForm({ ...postForm, title: event.target.value })} /></label>
          <label><span>Summary</span><input value={postForm.summary} onChange={(event) => setPostForm({ ...postForm, summary: event.target.value })} /></label>
          <label><span>Tags</span><input value={postForm.tags} onChange={(event) => setPostForm({ ...postForm, tags: event.target.value })} placeholder="garden, release, troubleshooting" /></label>
          <label><span>Source links / repo links</span><input value={postForm.sourceLinks} onChange={(event) => setPostForm({ ...postForm, sourceLinks: event.target.value })} /></label>
          <label><span>License or citation notes</span><input value={postForm.licenseNotes} onChange={(event) => setPostForm({ ...postForm, licenseNotes: event.target.value })} /></label>
          <label><span>Privacy/redaction notes</span><input value={postForm.redactionNotes} onChange={(event) => setPostForm({ ...postForm, redactionNotes: event.target.value })} /></label>
          <label><span>Requested status or intended audience</span><input value={postForm.intendedAudience} onChange={(event) => setPostForm({ ...postForm, intendedAudience: event.target.value })} /></label>
          <label><span>Optional submitter name/display name</span><input value={postForm.submitterName} onChange={(event) => setPostForm({ ...postForm, submitterName: event.target.value })} /></label>
          <label><span>Optional submitter contact</span><input value={postForm.submitterContact} onChange={(event) => setPostForm({ ...postForm, submitterContact: event.target.value })} /></label>
          <label className="wide-field"><span>Body/content</span><textarea value={postForm.body} onChange={(event) => setPostForm({ ...postForm, body: event.target.value })} rows={9} /></label>
        </div>
        <div className="commune-checklist">
          {redactionChecklist.map((item) => <label className="checkbox-line" key={item}><input type="checkbox" checked={postForm.checklist[item]} onChange={(event) => setPostForm({ ...postForm, checklist: { ...postForm.checklist, [item]: event.target.checked } })} /><span>{item}</span></label>)}
        </div>
        <div className="button-row">
          <button type="button" onClick={() => savePostDraft("draft_local")}>Save local draft</button>
          <button type="button" className="button-primary" onClick={() => savePostDraft("pending_moderator_review_local")}>Save as post request</button>
          <button type="button" onClick={() => exportPost("markdown")}>Export Markdown</button>
          <button type="button" onClick={() => exportPost("json")}>Export JSON</button>
          <button type="button" onClick={() => copyText(postMarkdown(buildPost("draft_local")), setStatusMessage)}>Copy draft Markdown</button>
        </div>
      </section>

      <section className="section-card commune-repo-card">
        <p className="eyebrow">Repository Showcase Draft</p>
        <h2>Describe a public repo without fetching it.</h2>
        <p>No repo APIs are called. Nothing is cloned. Nothing is remotely validated.</p>
        <div className="commune-form-grid">
          <label><span>Showcase title</span><input value={repoForm.title} onChange={(event) => setRepoForm({ ...repoForm, title: event.target.value })} /></label>
          <label><span>Repo URL</span><input value={repoForm.repoUrl} onChange={(event) => setRepoForm({ ...repoForm, repoUrl: event.target.value })} /></label>
          <label><span>Provider</span><select value={repoForm.provider} onChange={(event) => setRepoForm({ ...repoForm, provider: event.target.value })}>{["GitHub", "GitLab", "Codeberg", "Forgejo", "Uploaded zip later", "Other"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Branch</span><input value={repoForm.branch} onChange={(event) => setRepoForm({ ...repoForm, branch: event.target.value })} /></label>
          <label><span>Commit</span><input value={repoForm.commit} onChange={(event) => setRepoForm({ ...repoForm, commit: event.target.value })} /></label>
          <label><span>License</span><input value={repoForm.license} onChange={(event) => setRepoForm({ ...repoForm, license: event.target.value })} /></label>
          <label><span>Manifest status</span><select value={repoForm.manifestStatus} onChange={(event) => setRepoForm({ ...repoForm, manifestStatus: event.target.value })}>{["No manifest checked", "Manifest missing", "Manifest present", "Manifest validates locally", "Manifest needs review", "Manifest unsafe/blocklisted"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Elysia compatibility</span><select value={repoForm.compatibility} onChange={(event) => setRepoForm({ ...repoForm, compatibility: event.target.value })}>{["Unknown", "Concept only", "Website/resource only", "Add-on candidate", "Local Elysia compatible, unverified", "Local Elysia compatible, reviewed later", "Not compatible"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="wide-field"><span>Short description</span><textarea value={repoForm.description} onChange={(event) => setRepoForm({ ...repoForm, description: event.target.value })} rows={4} /></label>
          <label className="wide-field"><span>README preview pasted by user</span><textarea value={repoForm.readmePreview} onChange={(event) => setRepoForm({ ...repoForm, readmePreview: event.target.value })} rows={5} /></label>
          <label className="wide-field"><span>File tree preview pasted by user</span><textarea value={repoForm.fileTreePreview} onChange={(event) => setRepoForm({ ...repoForm, fileTreePreview: event.target.value })} rows={5} /></label>
          <label className="wide-field"><span>Screenshot notes or URLs</span><textarea value={repoForm.screenshotNotes} onChange={(event) => setRepoForm({ ...repoForm, screenshotNotes: event.target.value })} rows={3} /></label>
        </div>
        <div className="commune-checklist commune-warning-checks">
          {repoWarnings.map((item) => <label className="checkbox-line" key={item}><input type="checkbox" checked={repoForm.warnings.includes(item)} onChange={() => toggleRepoWarning(item)} /><span>{item}</span></label>)}
        </div>
        <div className="button-row"><button type="button" onClick={saveRepoDraft}>Save showcase draft locally</button><button type="button" onClick={() => exportRepo("markdown")}>Export Markdown</button><button type="button" onClick={() => exportRepo("json")}>Export JSON</button><button type="button" onClick={() => copyText(repoMarkdown({ ...repoForm, id: "repo-preview", createdAt: new Date().toISOString() }), setStatusMessage)}>Copy showcase Markdown</button></div>
      </section>

      <section className="section-card commune-sandbox-card">
        <p className="eyebrow">Sandbox Request Draft</p>
        <h2>Request review for future isolated execution.</h2>
        <p className="boundary-note">Sandbox requests are not execution permission. Future execution requires isolated infrastructure, explicit approval, resource limits, no secrets, no private network, no host mounts, logs, and kill controls.</p>
        <div className="commune-form-grid">
          <label><span>Request title</span><input value={sandboxForm.title} onChange={(event) => setSandboxForm({ ...sandboxForm, title: event.target.value })} /></label>
          <label><span>Related post/repo URL</span><input value={sandboxForm.relatedUrl} onChange={(event) => setSandboxForm({ ...sandboxForm, relatedUrl: event.target.value })} /></label>
          <label><span>Expected command</span><input value={sandboxForm.expectedCommand} onChange={(event) => setSandboxForm({ ...sandboxForm, expectedCommand: event.target.value })} /></label>
          <label><span>Dependencies</span><input value={sandboxForm.dependencies} onChange={(event) => setSandboxForm({ ...sandboxForm, dependencies: event.target.value })} /></label>
          <label><span>Network needed?</span><select value={sandboxForm.networkNeeded} onChange={(event) => setSandboxForm({ ...sandboxForm, networkNeeded: event.target.value })}><option>No</option><option>Yes</option></select></label>
          <label><span>File access needed?</span><select value={sandboxForm.fileAccessNeeded} onChange={(event) => setSandboxForm({ ...sandboxForm, fileAccessNeeded: event.target.value })}><option>No</option><option>Yes</option></select></label>
          <label><span>Estimated runtime</span><input value={sandboxForm.estimatedRuntime} onChange={(event) => setSandboxForm({ ...sandboxForm, estimatedRuntime: event.target.value })} /></label>
          <label className="wide-field"><span>Code purpose</span><textarea value={sandboxForm.codePurpose} onChange={(event) => setSandboxForm({ ...sandboxForm, codePurpose: event.target.value })} rows={4} /></label>
          <label className="wide-field"><span>Why sandbox is needed</span><textarea value={sandboxForm.whySandbox} onChange={(event) => setSandboxForm({ ...sandboxForm, whySandbox: event.target.value })} rows={4} /></label>
          <label className="wide-field"><span>Risk notes</span><textarea value={sandboxForm.riskNotes} onChange={(event) => setSandboxForm({ ...sandboxForm, riskNotes: event.target.value })} rows={4} /></label>
        </div>
        <div className="button-row"><button type="button" onClick={saveSandboxDraft}>Save sandbox request draft locally</button><button type="button" onClick={() => exportSandbox("markdown")}>Export Markdown</button><button type="button" onClick={() => exportSandbox("json")}>Export JSON</button><button type="button" onClick={() => copyText(sandboxMarkdown({ ...sandboxForm, id: "sandbox-preview", createdAt: new Date().toISOString() }), setStatusMessage)}>Copy request Markdown</button></div>
      </section>

      <section className="section-card">
        <p className="eyebrow">Local drafts and pending review requests</p>
        <h2>Saved in this browser only</h2>
        {postDrafts.length + postRequests.length + repoDrafts.length + sandboxDrafts.length === 0 ? <p>Drafts and post requests saved in this browser will appear here.</p> : null}
        <div className="commune-draft-grid">
          {postDrafts.map((draft) => <article key={draft.id}><h3>{draft.title || "Untitled post draft"}</h3><StatusBadges labels={[draft.status, draft.postType]} /><p>{draft.summary}</p></article>)}
          {postRequests.map((draft) => <article key={draft.id}><h3>{draft.title || "Untitled post request"}</h3><StatusBadges labels={[draft.status, draft.postType]} /><p>{draft.summary}</p></article>)}
          {repoDrafts.map((draft) => <article key={draft.id}><h3>{draft.title || "Untitled repo showcase"}</h3><StatusBadges labels={["repo showcase draft", draft.provider, draft.manifestStatus]} /><p>{draft.description}</p></article>)}
          {sandboxDrafts.map((draft) => <article key={draft.id}><h3>{draft.title || "Untitled sandbox request"}</h3><StatusBadges labels={["sandbox request draft", `network: ${draft.networkNeeded}`, `files: ${draft.fileAccessNeeded}`]} /><p>{draft.codePurpose}</p></article>)}
        </div>
      </section>

      <section className="section-card commune-info-grid">
        <article>
          <p className="eyebrow">Local mode now</p>
          <h2>What works without a backend</h2>
          <ul><li>Create post drafts.</li><li>Save post requests locally.</li><li>Create repository showcase drafts.</li><li>Request code sandbox as local draft.</li><li>Save/follow draft thread ideas locally later.</li><li>Export drafts as Markdown/JSON.</li></ul>
        </article>
        <article>
          <p className="eyebrow">Future account mode</p>
          <h2>What needs backend design</h2>
          <ul><li>Public posts after moderation.</li><li>Comments, saved posts, follows, uploads, and troubleshooting rooms.</li><li>Repository showcases and sandbox review requests.</li><li>Supabase tables, RLS policies, moderator/admin roles, moderation queue, abuse controls, upload policies, and audit logs.</li></ul>
        </article>
      </section>

      <section className="section-card commune-info-grid">
        <article>
          <p className="eyebrow">Future backend roadmap</p>
          <h2>Planned tables</h2>
          <div className="commune-badge-row">{futureTables.map((table) => <span key={table}>{table}</span>)}</div>
          <p>These are planned/future backend tables. They are not live until Supabase schema, RLS, moderation, and abuse controls are built.</p>
        </article>
        <article>
          <p className="eyebrow">Later support tables</p>
          <h2>Possible support structures</h2>
          <div className="commune-badge-row">{futureSupportTables.map((table) => <span key={table}>{table}</span>)}</div>
        </article>
      </section>

      <section className="section-card commune-info-grid">
        <article>
          <p className="eyebrow">Moderation Doctrine</p>
          <h2>Future moderation must handle</h2>
          <p>Spam, harassment, malware, secret leakage, private data exposure, copyright violations, unsafe code, scams/job fraud, impersonation, off-topic floods, AI-generated spam, doxxing, and sensitive ecological location exposure.</p>
          <h3>Future actions</h3>
          <StatusBadges labels={["report", "hide", "lock thread", "remove post", "request redaction", "mark official", "mark community", "mark unreviewed", "block upload", "security hold", "admin review"]} />
          <h3>Trust labels</h3>
          <StatusBadges labels={["Official", "Community", "Unreviewed", "Needs redaction", "Security hold", "Resolved", "Archived", "Blocked"]} />
        </article>
        <article>
          <p className="eyebrow">Media, chat, jobs, and official notices</p>
          <h2>Boundaries for future rooms</h2>
          <p><strong>Media uploads:</strong> not enabled. Future uploads require file type limits, size limits, moderation, attribution/copyright prompts, malware scanning where possible, private-data warnings, storage policies, and abuse controls.</p>
          <p><strong>Collaborative rooms and chat:</strong> planned, not live. Future rooms need moderation, rate limits, reporting, blocking, room roles, invite controls, retention policy, and no private Elysia memory sharing by default.</p>
          <p><strong>Job posts:</strong> future job posts require clear organization/contact, clear role type, clear paid/volunteer status, pay/rate or honest explanation if unpaid, location/remote status, no misleading roles, no sensitive personal data requests in public comments, and scam/moderator review.</p>
          <p><strong>Official Updates:</strong> restricted to authorized Elysia Ecobotics administrators later. Community users should not be able to impersonate official release, security, or governance notices.</p>
          <h3>Code/repo labels</h3>
          <StatusBadges labels={["No code execution", "Snippet only", "Repo showcase only", "Manifest present", "Manifest not reviewed", "License unclear", "Sandbox required", "Security review needed", "Blocked"]} />
        </article>
      </section>
    </div>
  );
}
