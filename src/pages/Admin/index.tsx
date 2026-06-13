import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import {
  type AddonSubmissionReview,
  type ContentReport,
  type DeveloperProfileReview,
  type DeveloperStatus,
  type LibrarySourceSubmission,
  type ReportStatus,
  type VisibilityState,
  type WorkRoleSubmission,
  loadAddonSubmissions,
  loadAdminAuditLog,
  loadAdminSummary,
  loadContentReports,
  loadDeveloperProfiles,
  loadLibrarySourceSubmissions,
  loadWorkRoleSubmissions,
  updateAddonSubmission,
  updateContentReport,
  updateDeveloperProfileStatus,
  updateLibrarySourceSubmission,
  updateWorkRoleSubmission,
  visibilityStates
} from "../../shared/review/adminModerationClient";
import {
  type AppRole,
  type ReviewDomain,
  type ReviewItem,
  type ReviewStatus,
  assignReviewItemToMe,
  canReviewDomain,
  domainLabels,
  grantRole,
  loadCurrentRoleState,
  loadReviewEvents,
  loadReviewItems,
  loadUserRoles,
  revokeRole,
  updateReviewStatus
} from "../../shared/review/reviewClient";

const adminLinks = [
  ["/admin", "Admin Home"],
  ["/admin/moderation", "Moderation"],
  ["/admin/reports", "Reports"],
  ["/admin/addon-submissions", "Add-ons"],
  ["/admin/developers", "Developers"],
  ["/admin/library-sources", "Sources"],
  ["/admin/work-submissions", "Work"],
  ["/admin/review", "All Review"],
  ["/admin/review/work-with", "Work With"],
  ["/admin/review/stewardship", "Stewardship"],
  ["/admin/review/commune", "Commune"],
  ["/admin/review/living-library", "Living Library"],
  ["/admin/review/marketplace", "Marketplace"],
  ["/admin/review/broken-links", "Broken Links"],
  ["/admin/roles", "Roles"],
  ["/admin/audit", "Audit"]
] as const;

const routeDomains: Record<string, ReviewDomain | undefined> = {
  "/admin/review/work-with": "work_with",
  "/admin/review/stewardship": "stewardship",
  "/admin/review/commune": "commune",
  "/admin/review/living-library": "living_library_source",
  "/admin/review/marketplace": "marketplace",
  "/admin/review/broken-links": "living_library_broken_link"
};

const statusOptions: ReviewStatus[] = ["in_review", "needs_information", "approved", "rejected", "archived"];
const roleOptions: AppRole[] = ["administrator", "moderator", "reviewer", "marketplace_reviewer", "source_reviewer", "commune_moderator", "guardian_reviewer"];

function StatusBadge({ status }: { status: string }) {
  return <span className={`review-status review-status--${status.replace(/_/g, "-")}`}>{status.replace(/_/g, " ")}</span>;
}

function RoleBadge({ role }: { role: string }) {
  return <span className="trust-badge">{role.replace(/_/g, " ")}</span>;
}

function AdminNav() {
  return <nav className="admin-nav" aria-label="Admin sections">{adminLinks.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</nav>;
}

function Unauthorized({ warnings }: { warnings: string[] }) {
  return <div className="page-stack admin-page"><PageHero eyebrow="Admin" title="Review access required"><p>Admin and reviewer routes require a signed-in Website Account with an assigned authority role. Membership, stewardship recognition, donation support, developer visibility, or contribution interest does not grant authority.</p></PageHero>{warnings.map((warning) => <p className="message" key={warning}>{warning}</p>)}</div>;
}

function useRoleGate(domain?: ReviewDomain) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const refresh = useCallback(async () => {
    const state = await loadCurrentRoleState();
    setRoles(state.roles);
    setIsAdmin(state.isAdmin);
    setSignedIn(state.signedIn);
    setWarnings(state.warnings);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const allowed = signedIn && (isAdmin || (domain ? canReviewDomain(roles, domain) : roles.length > 0));
  return { roles, isAdmin, signedIn, warnings, allowed, refresh };
}

function ReviewActions({ item, onChanged }: { item: ReviewItem; onChanged: (message: string) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function runStatus(status: ReviewStatus) {
    setBusy(true);
    const result = await updateReviewStatus(item, status, note);
    setBusy(false);
    onChanged(result.ok ? `Marked ${item.title ?? item.id} as ${status}.` : result.warning ?? "Review action failed.");
  }

  async function assign() {
    setBusy(true);
    const result = await assignReviewItemToMe(item);
    setBusy(false);
    onChanged(result.ok ? "Assigned review item to you." : result.warning ?? "Assignment failed.");
  }

  return <div className="review-actions">
    <label><span>Internal note</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason or reviewer note" /></label>
    <div className="button-row"><button type="button" onClick={assign} disabled={busy}>Assign to me</button>{statusOptions.map((status) => <button key={status} type="button" onClick={() => void runStatus(status)} disabled={busy}>{status.replace(/_/g, " ")}</button>)}</div>
  </div>;
}

function ReviewQueue({ domain }: { domain?: ReviewDomain }) {
  const gate = useRoleGate(domain);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await loadReviewItems(domain);
    setItems(result.items);
    setMessages(result.warnings);
  }, [domain]);
  useEffect(() => { if (gate.allowed) void refresh(); }, [gate.allowed, refresh]);

  const selectedItem = items.find((item) => item.id === selected) ?? items[0] ?? null;
  const title = domain ? `${domainLabels[domain]} Review Queue` : "All Review Queues";
  if (!gate.allowed) return <Unauthorized warnings={gate.warnings} />;

  return <div className="page-stack admin-page"><PageHero eyebrow="Admin Review" title={title}><p>Review queues are role-gated in the UI and protected by Supabase RLS. Actions write review events for auditability.</p></PageHero><AdminNav />{messages.map((message) => <p className="message" key={message}>{message}</p>)}<section className="two-column admin-review-grid"><div className="section-card"><p className="eyebrow">Queue</p><h2>{items.length} item{items.length === 1 ? "" : "s"}</h2>{items.length === 0 ? <p>No pending items.</p> : items.map((item) => <button className="review-list-item" type="button" key={item.id} onClick={() => setSelected(item.id)}><strong>{item.title || item.source_table}</strong><span>{domainLabels[item.domain]} · {item.source_table}</span><StatusBadge status={item.status} /></button>)}</div><div className="section-card">{selectedItem ? <><p className="eyebrow">Review detail</p><h2>{selectedItem.title || selectedItem.id}</h2><dl className="mini-facts"><div><dt>Domain</dt><dd>{domainLabels[selectedItem.domain]}</dd></div><div><dt>Status</dt><dd><StatusBadge status={selectedItem.status} /></dd></div><div><dt>Source</dt><dd>{selectedItem.source_table}</dd></div><div><dt>Submitted</dt><dd>{selectedItem.submitted_at ?? "Unknown"}</dd></div><div><dt>Private files</dt><dd>{["work_with", "stewardship"].includes(selectedItem.domain) ? "May exist; access is private and RLS-gated." : "None expected"}</dd></div></dl><p>{selectedItem.summary}</p><ReviewActions item={selectedItem} onChanged={(message) => { setMessages((current) => [message, ...current]); void refresh(); }} /></> : <p>No item selected.</p>}</div></section></div>;
}

function RolesPage() {
  const gate = useRoleGate();
  const [rows, setRows] = useState<{ id: string; user_id: string; role: AppRole; granted_at: string; revoked_at: string | null; reason: string | null }[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [form, setForm] = useState({ userId: "", role: "reviewer" as AppRole, reason: "" });
  const refresh = useCallback(async () => { const result = await loadUserRoles(); setRows(result.rows); setMessages(result.warnings); }, []);
  useEffect(() => { if (gate.isAdmin) void refresh(); }, [gate.isAdmin, refresh]);
  if (!gate.isAdmin) return <Unauthorized warnings={[...gate.warnings, "Role management requires administrator authority."]} />;
  return <div className="page-stack admin-page"><PageHero eyebrow="Admin" title="Role Management"><p>Authority roles are manually assigned and revocable. Membership, stewardship recognition, donation support, developer visibility, or contribution interest does not grant authority.</p></PageHero><AdminNav />{messages.map((message) => <p className="message" key={message}>{message}</p>)}<section className="two-column"><div className="section-card"><h2>Grant role</h2><p className="boundary-note">This UI refuses self-assignment. Use a target user's auth UUID; do not use public usernames as authority identifiers.</p><label><span>User auth UUID</span><input value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} /></label><label><span>Role</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AppRole })}>{roleOptions.map((role) => <option key={role} value={role}>{role.replace(/_/g, " ")}</option>)}</select></label><label><span>Reason</span><input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label><button type="button" className="button-primary" onClick={async () => { const result = await grantRole(form.userId.trim(), form.role, form.reason); setMessages([result.ok ? "Role granted." : result.warning ?? "Role grant failed."]); void refresh(); }}>Grant role</button></div><div className="section-card"><h2>Assigned roles</h2>{rows.map((row) => <article className="review-list-item" key={row.id}><strong>{row.user_id}</strong><RoleBadge role={row.role} /><span>{row.revoked_at ? `Revoked ${row.revoked_at}` : `Granted ${row.granted_at}`}</span>{!row.revoked_at && <button type="button" onClick={async () => { const result = await revokeRole(row.id, "Revoked from admin UI"); setMessages([result.ok ? "Role revoked." : result.warning ?? "Role revoke failed."]); void refresh(); }}>Revoke</button>}</article>)}</div></section></div>;
}

function AuditPage() {
  const gate = useRoleGate();
  const [events, setEvents] = useState<Awaited<ReturnType<typeof loadReviewEvents>>["events"]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  useEffect(() => { if (gate.allowed) void loadReviewEvents().then((result) => { setEvents(result.events); setMessages(result.warnings); }); }, [gate.allowed]);
  if (!gate.allowed) return <Unauthorized warnings={gate.warnings} />;
  return <div className="page-stack admin-page"><PageHero eyebrow="Admin" title="Audit Trail"><p>Review events record submissions, assignments, status changes, and private-review actions where implemented.</p></PageHero><AdminNav />{messages.map((message) => <p className="message" key={message}>{message}</p>)}<section className="section-card"><h2>{events.length} recent event{events.length === 1 ? "" : "s"}</h2>{events.map((event) => <article className="review-list-item" key={event.id}><strong>{event.event_type}</strong><span>{event.created_at}</span><span>{event.from_status ?? "none"} → {event.to_status ?? "none"}</span><p>{event.note}</p></article>)}</section></div>;
}

function AdminSummaryCards() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  useEffect(() => { void loadAdminSummary().then((result) => { setCounts(result.counts); setWarnings(result.warnings); }); }, []);
  const cards = [
    ["Reported content", counts.openReports ?? 0, "/admin/reports"],
    ["Add-on review queue", counts.addonReviews ?? 0, "/admin/addon-submissions"],
    ["Developer verification", counts.developerRequests ?? 0, "/admin/developers"],
    ["Living Library review", counts.librarySources ?? 0, "/admin/library-sources"],
    ["Job/role review", counts.workSubmissions ?? 0, "/admin/work-submissions"],
    ["Shared review items", counts.reviewItems ?? 0, "/admin/review"]
  ] as const;
  return <section className="feature-grid feature-grid--three admin-summary-grid">{cards.map(([label, count, href]) => <Link className="feature-card" to={href} key={label}><span className="admin-count">{count}</span><h3>{label}</h3><p>Open, submitted, or review-needed records visible to your current role.</p></Link>)}{warnings.length > 0 && <article className="feature-card"><h3>Queue setup</h3><p>Some admin summaries are not active until the latest Supabase migrations are applied.</p></article>}</section>;
}

function QueueMessages({ messages }: { messages: string[] }) {
  if (!messages.length) return null;
  return <>{[...new Set(messages)].map((message) => <p className="message" key={message}>{message}</p>)}</>;
}

function ReportActions({ report, onChanged }: { report: ContentReport; onChanged: (message: string) => void }) {
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [note, setNote] = useState(report.reviewer_note ?? "");
  return <div className="review-actions"><label><span>Report status</span><select value={status} onChange={(event) => setStatus(event.target.value as ReportStatus)}>{["submitted", "under_review", "action_taken", "dismissed", "archived"].map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label><label><span>Internal reviewer note</span><input value={note} onChange={(event) => setNote(event.target.value)} /></label><button type="button" onClick={async () => onChanged(await updateContentReport(report.id, status, note))}>Update report</button></div>;
}

function ReportsPage() {
  const gate = useRoleGate();
  const [rows, setRows] = useState<ContentReport[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const refresh = useCallback(async () => { const result = await loadContentReports(); setRows(result.rows); setMessages(result.warnings); }, []);
  useEffect(() => { if (gate.allowed) void refresh(); }, [gate.allowed, refresh]);
  if (!gate.allowed) return <Unauthorized warnings={gate.warnings} />;
  return <div className="page-stack admin-page"><PageHero eyebrow="Admin moderation" title="Reported Content"><p>Reports are private moderation records. Reporting does not automatically remove public content; reviewers decide the outcome.</p></PageHero><AdminNav /><QueueMessages messages={messages} /><section className="section-card"><h2>{rows.length} report{rows.length === 1 ? "" : "s"}</h2>{!rows.length && <p>No pending items.</p>}{rows.map((report) => <article className="review-list-item admin-detail-card" key={report.id}><strong>{report.target_type}: {report.target_id}</strong><StatusBadge status={report.status} /><span>{report.created_at}</span><p><strong>Reason:</strong> {report.reason}</p>{report.details && <p>{report.details}</p>}<ReportActions report={report} onChanged={(message) => { setMessages([message]); void refresh(); }} /></article>)}</section></div>;
}

function DeveloperActions({ profile, onChanged }: { profile: DeveloperProfileReview; onChanged: (message: string) => void }) {
  const [status, setStatus] = useState<DeveloperStatus>(profile.status);
  const [note, setNote] = useState(profile.private_review_note ?? "");
  return <div className="review-actions"><label><span>Developer status</span><select value={status} onChange={(event) => setStatus(event.target.value as DeveloperStatus)}>{["requested", "active", "trusted", "suspended", "revoked"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label><span>Private admin note</span><input value={note} onChange={(event) => setNote(event.target.value)} /></label><button type="button" onClick={async () => onChanged(await updateDeveloperProfileStatus(profile.id, status, note))}>Update developer</button></div>;
}

function DevelopersPage() {
  const gate = useRoleGate("marketplace");
  const [rows, setRows] = useState<DeveloperProfileReview[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const refresh = useCallback(async () => { const result = await loadDeveloperProfiles(); setRows(result.rows); setMessages(result.warnings); }, []);
  useEffect(() => { if (gate.allowed) void refresh(); }, [gate.allowed, refresh]);
  if (!gate.allowed) return <Unauthorized warnings={gate.warnings} />;
  return <div className="page-stack admin-page"><PageHero eyebrow="Admin review" title="Developer Verification"><p>Developer verification is review status only. Developers cannot self-set trusted, suspended, revoked, or reviewer authority.</p></PageHero><AdminNav /><QueueMessages messages={messages} /><section className="section-card"><h2>{rows.length} developer profile{rows.length === 1 ? "" : "s"}</h2>{!rows.length && <p>No pending items.</p>}{rows.map((profile) => <article className="review-list-item admin-detail-card" key={profile.id}><strong>{profile.display_name || profile.developer_slug}</strong><StatusBadge status={profile.status} /><p>{profile.bio}</p><dl className="mini-facts"><div><dt>User</dt><dd>{profile.user_id}</dd></div><div><dt>Website</dt><dd>{profile.website_url ?? "none"}</dd></div><div><dt>GitHub</dt><dd>{profile.github_url ?? "none"}</dd></div><div><dt>Private contact</dt><dd>{profile.contact_email ? "available to reviewers" : "none"}</dd></div></dl><DeveloperActions profile={profile} onChanged={(message) => { setMessages([message]); void refresh(); }} /></article>)}</section></div>;
}

function AddonSubmissionActions({ submission, onChanged }: { submission: AddonSubmissionReview; onChanged: (message: string) => void }) {
  const [status, setStatus] = useState(submission.status);
  const [note, setNote] = useState(submission.reviewer_note ?? "");
  return <div className="review-actions"><label><span>Submission status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{["pending", "changes_requested", "approved", "rejected", "security_hold", "withdrawn", "published"].map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label><label><span>Private reviewer note</span><input value={note} onChange={(event) => setNote(event.target.value)} /></label><button type="button" onClick={async () => onChanged(await updateAddonSubmission(submission.id, status, note))}>Update add-on submission</button></div>;
}

function AddonSubmissionsPage() {
  const gate = useRoleGate("marketplace");
  const [rows, setRows] = useState<AddonSubmissionReview[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const refresh = useCallback(async () => { const result = await loadAddonSubmissions(); setRows(result.rows); setMessages(result.warnings); }, []);
  useEffect(() => { if (gate.allowed) void refresh(); }, [gate.allowed, refresh]);
  if (!gate.allowed) return <Unauthorized warnings={gate.warnings} />;
  return <div className="page-stack admin-page"><PageHero eyebrow="Admin review" title="Developer Forge Add-on Submissions"><p>Reviewers may inspect manifests, validation status, permission requests, private package metadata, and scan summaries. Approval does not install anything locally.</p></PageHero><AdminNav /><QueueMessages messages={messages} /><section className="section-card"><h2>{rows.length} add-on submission{rows.length === 1 ? "" : "s"}</h2>{!rows.length && <p>No pending items.</p>}{rows.map((submission) => <article className="review-list-item admin-detail-card" key={submission.id}><strong>{submission.draft?.addon_name ?? submission.id}</strong><StatusBadge status={submission.status} /><p>{submission.review_summary}</p><dl className="mini-facts"><div><dt>Slug</dt><dd>{submission.draft?.addon_slug ?? "unknown"}</dd></div><div><dt>Version</dt><dd>{submission.draft?.version ?? "unknown"}</dd></div><div><dt>Validation</dt><dd>{submission.draft?.validation_status ?? "not available"}</dd></div><div><dt>Packages</dt><dd>{submission.packages?.length ?? 0} private file metadata row(s)</dd></div></dl><details><summary>Manifest preview</summary><pre className="admin-json-preview">{JSON.stringify(submission.draft?.manifest_json ?? {}, null, 2)}</pre></details>{submission.packages?.map((pkg) => <p className="boundary-note" key={pkg.id}>{pkg.original_filename} · {pkg.sha256 ?? "no hash"} · {pkg.scan_status ?? "not scanned"} · {pkg.scan_summary ?? "No scan summary"}</p>)}<AddonSubmissionActions submission={submission} onChanged={(message) => { setMessages([message]); void refresh(); }} /></article>)}</section></div>;
}

function VisibilityActions({ id, initialStatus, initialNote, onSave, onChanged }: { id: string; initialStatus: VisibilityState; initialNote?: string | null; onSave: (id: string, status: VisibilityState, note: string) => Promise<string>; onChanged: (message: string) => void }) {
  const [status, setStatus] = useState<VisibilityState>(initialStatus);
  const [note, setNote] = useState(initialNote ?? "");
  return <div className="review-actions"><label><span>Visibility state</span><select value={status} onChange={(event) => setStatus(event.target.value as VisibilityState)}>{visibilityStates.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label><span>Reviewer note</span><input value={note} onChange={(event) => setNote(event.target.value)} /></label><button type="button" onClick={async () => onChanged(await onSave(id, status, note))}>Save status</button></div>;
}

function LibrarySourcesPage() {
  const gate = useRoleGate("living_library_source");
  const [rows, setRows] = useState<LibrarySourceSubmission[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const refresh = useCallback(async () => { const result = await loadLibrarySourceSubmissions(); setRows(result.rows); setMessages(result.warnings); }, []);
  useEffect(() => { if (gate.allowed) void refresh(); }, [gate.allowed, refresh]);
  if (!gate.allowed) return <Unauthorized warnings={gate.warnings} />;
  return <div className="page-stack admin-page"><PageHero eyebrow="Admin review" title="Living Library Source Review"><p>Source review checks official URLs, licensing, privacy, provenance, and public-benefit fit before publication.</p></PageHero><AdminNav /><QueueMessages messages={messages} /><section className="section-card"><h2>{rows.length} source submission{rows.length === 1 ? "" : "s"}</h2>{!rows.length && <p>No pending items.</p>}{rows.map((row) => <article className="review-list-item admin-detail-card" key={row.id}><strong>{row.title}</strong><StatusBadge status={row.status} /><p>{row.notes}</p><p>{row.official_url ?? "No official URL provided."}</p><VisibilityActions id={row.id} initialStatus={row.status} initialNote={row.reviewer_note} onSave={async (id, status, note) => { const message = await updateLibrarySourceSubmission(id, status, note); void refresh(); return message; }} onChanged={(message) => setMessages([message])} /></article>)}</section></div>;
}

function WorkSubmissionsPage() {
  const gate = useRoleGate("work_with");
  const [rows, setRows] = useState<WorkRoleSubmission[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const refresh = useCallback(async () => { const result = await loadWorkRoleSubmissions(); setRows(result.rows); setMessages(result.warnings); }, []);
  useEffect(() => { if (gate.allowed) void refresh(); }, [gate.allowed, refresh]);
  if (!gate.allowed) return <Unauthorized warnings={gate.warnings} />;
  return <div className="page-stack admin-page"><PageHero eyebrow="Admin review" title="Work and Role Submissions"><p>Work and role submissions are private review records. They do not create employment, reviewer authority, moderator authority, or paid status by themselves.</p></PageHero><AdminNav /><QueueMessages messages={messages} /><section className="section-card"><h2>{rows.length} work/role submission{rows.length === 1 ? "" : "s"}</h2>{!rows.length && <p>No pending items.</p>}{rows.map((row) => <article className="review-list-item admin-detail-card" key={row.id}><strong>{row.display_name ?? row.role_type}</strong><StatusBadge status={row.status} /><p>{row.summary}</p><p className="boundary-note">Private contact is visible to authorized reviewers only: {row.contact_email ? "provided" : "not provided"}</p><VisibilityActions id={row.id} initialStatus={row.status} initialNote={row.reviewer_note} onSave={async (id, status, note) => { const message = await updateWorkRoleSubmission(id, status, note); void refresh(); return message; }} onChanged={(message) => setMessages([message])} /></article>)}</section></div>;
}

function CombinedAuditPage() {
  const gate = useRoleGate();
  const [events, setEvents] = useState<Awaited<ReturnType<typeof loadReviewEvents>>["events"]>([]);
  const [adminEvents, setAdminEvents] = useState<Awaited<ReturnType<typeof loadAdminAuditLog>>["rows"]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  useEffect(() => {
    if (!gate.allowed) return;
    void Promise.all([loadReviewEvents(), loadAdminAuditLog()]).then(([review, admin]) => {
      setEvents(review.events);
      setAdminEvents(admin.rows);
      setMessages([...review.warnings, ...admin.warnings]);
    });
  }, [gate.allowed]);
  if (!gate.allowed) return <Unauthorized warnings={gate.warnings} />;
  return <div className="page-stack admin-page"><PageHero eyebrow="Admin" title="Audit Trail"><p>Review events and admin moderation events are internal governance records.</p></PageHero><AdminNav /><QueueMessages messages={messages} /><section className="two-column"><div className="section-card"><h2>Review events</h2>{events.map((event) => <article className="review-list-item" key={event.id}><strong>{event.event_type}</strong><span>{event.created_at}</span><span>{event.from_status ?? "none"} → {event.to_status ?? "none"}</span><p>{event.note}</p></article>)}</div><div className="section-card"><h2>Admin audit log</h2>{adminEvents.map((event) => <article className="review-list-item" key={event.id}><strong>{event.action}</strong><span>{event.target_type}: {event.target_id ?? "none"}</span><span>{event.created_at}</span></article>)}</div></section></div>;
}

export function AdminHomePage() {
  const gate = useRoleGate();
  if (!gate.allowed) return <Unauthorized warnings={gate.warnings} />;
  return <div className="page-stack admin-page"><PageHero eyebrow="Admin" title="Governance Console"><p>Review public website submissions without connecting to private local Elysia memory, files, logs, vaults, passwords, or credentials.</p></PageHero><AdminNav /><section className="section-card"><h2>Your roles</h2><div className="commons-badge-row">{gate.roles.map((role) => <RoleBadge key={role} role={role} />)}</div><p className="boundary-note">Roles are Supabase-backed and RLS-enforced. Badges, membership, donations, developer profiles, and contribution interest do not grant authority.</p></section><AdminSummaryCards /><section className="feature-grid feature-grid--three">{(Object.entries(domainLabels).filter(([domain]) => domain !== "contribution") as [ReviewDomain, string][]).map(([domain, label]) => <Link className="feature-card" to={`/admin/review/${domain === "work_with" ? "work-with" : domain === "living_library_source" ? "living-library" : domain === "living_library_broken_link" ? "broken-links" : domain}`} key={domain}><h3>{label}</h3><p>{canReviewDomain(gate.roles, domain) ? "Available for your role." : "Hidden by RLS if unauthorized."}</p></Link>)}</section><section className="section-card"><p className="eyebrow">Content visibility states</p><h2>Moderation lifecycle</h2><div className="commons-badge-row">{visibilityStates.map((state) => <span key={state}>{state}</span>)}</div><p className="boundary-note">Drafts are owner-only. Submitted items are owner plus reviewer/admin. Published items may be public. Flagged, hidden, removed, archived, and revoked content is restricted unless a public notice is intentionally shown.</p></section></div>;
}

export function AdminReviewPage() {
  const { pathname } = useLocation();
  return <ReviewQueue domain={routeDomains[pathname]} />;
}

export function AdminRolesPage() { return <RolesPage />; }
export function AdminAuditPage() { return <CombinedAuditPage />; }
export function AdminReportsPage() { return <ReportsPage />; }
export function AdminDevelopersPage() { return <DevelopersPage />; }
export function AdminAddonSubmissionsPage() { return <AddonSubmissionsPage />; }
export function AdminLibrarySourcesPage() { return <LibrarySourcesPage />; }
export function AdminWorkSubmissionsPage() { return <WorkSubmissionsPage />; }
