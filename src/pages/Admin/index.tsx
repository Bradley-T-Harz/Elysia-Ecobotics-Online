import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { safeCommuneLinkHref } from "../../shared/communeLinks";
import {
  hideAnnotation,
  hideCodeDocument,
  listCodeReports,
  removeAnnotation,
  removeCodeDocument,
  updateCodeReportStatus,
  type CodeReport
} from "../The-Elysia-Commune/communeCodeReviewApi";
import {
  hideRealtimeMessage,
  listRealtimeReports,
  removeRealtimeMessage,
  updateRealtimeReportStatus,
  updateRoomPostingMode,
  updateRoomSlowMode,
  type RealtimePostingMode,
  type RealtimeReport,
  type RealtimeRoom
} from "../The-Elysia-Commune/communeRealtimeApi";
import {
  buildLocalHandoffBundle,
  listSandboxRequestsForReview,
  reviewSandboxRequest,
  validateSandboxRequestInput,
  type SandboxRequestAction
} from "../The-Elysia-Commune/communeSandboxHandoffApi";
import { type SandboxRequestRecord } from "../../shared/sandbox/sandboxHandoffTypes";
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
  publishAddonSubmission,
  revokeMarketplacePublication,
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
  type ReviewQueueFilter,
  type ReviewStatus,
  type StewardshipReceiptEvidence,
  addInternalReviewComment,
  assignReviewItemToMe,
  activeReviewStatuses,
  canReviewDomain,
  domainLabels,
  grantRole,
  loadCurrentRoleState,
  loadReviewEvents,
  loadReviewItems,
  loadStewardshipReceiptEvidence,
  loadUserRoles,
  recoverRejectedCommuneReviewSubject,
  revokeRole,
  restoreCommuneReviewSubject,
  updateReviewStatus
} from "../../shared/review/reviewClient";
import {
  createReviewedBadgeCredit,
  grantBadgeToUser,
  loadBadgeAdministration,
  loadBadgeAdministrationTimeline,
  restoreBadgeForUser,
  revokeBadgeCredit,
  revokeBadgeFromUser,
  type BadgeAdministrationTimeline,
  type BadgeAwardAdmin,
  type BadgeDefinitionAdmin,
  type BadgeRuleAdmin
} from "../../shared/review/badgeAdminClient";

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
  ["/admin/badges", "Badges"],
  ["/admin/audit", "Audit"],
  ["/admin/economic-operations", "Economic Operations"]
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
const reviewQueueFilters: { value: ReviewQueueFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "history", label: "History" },
  { value: "moderated", label: "Moderated" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" }
];
const roleOptions: AppRole[] = ["administrator", "moderator", "reviewer", "marketplace_reviewer", "source_reviewer", "commune_moderator", "guardian_reviewer"];

function StatusBadge({ status }: { status: string }) {
  return <span className={`review-status review-status--${status.replace(/_/g, "-")}`}>{status.replace(/_/g, " ")}</span>;
}

function RoleBadge({ role }: { role: string }) {
  return <span className="trust-badge">{role.replace(/_/g, " ")}</span>;
}

function AdminChipRow({ labels }: { labels: string[] }) {
  return <div className="commons-badge-row">{labels.map((label) => <span key={label}>{label.replace(/_/g, " ")}</span>)}</div>;
}

function AdminNav() {
  return <nav className="admin-nav" aria-label="Admin sections">{adminLinks.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</nav>;
}

function reviewQueueTitle(filter: ReviewQueueFilter) {
  if (filter === "active") return "Active review queue";
  if (filter === "moderated") return "Moderated content recovery";
  if (filter === "archived") return "Admin-selected archive";
  if (filter === "all") return "All review records";
  return "Admin review history";
}

function reviewQueueEmptyText(filter: ReviewQueueFilter) {
  if (filter === "active") return "No active review items need action.";
  if (filter === "moderated") return "No flagged, hidden, or removed Commune items match this view.";
  if (filter === "archived") return "No admin-selected archive items match this view.";
  return "No history items match this view.";
}

function canRestoreCommuneItem(item: ReviewItem) {
  return item.domain === "commune" && ["commune_posts", "commune_comments"].includes(item.source_table) && item.status === "approved" && ["flagged", "flagged_for_removal", "hidden", "hidden_from_public", "removed", "removed_by_moderator", "soft_deleted_by_moderator", "deleted_by_admin"].includes(item.moderation_state ?? "");
}

function canRecoverRejectedCommuneItem(item: ReviewItem) {
  return item.domain === "commune" && ["commune_posts", "commune_comments"].includes(item.source_table) && item.status === "rejected" && Boolean(item.content_status);
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
  const [decisionReason, setDecisionReason] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  async function runStatus(status: ReviewStatus) {
    if (status === "rejected" && !confirmReject) {
      setConfirmReject(true);
      return;
    }
    setBusy(true);
    const result = await updateReviewStatus(item, status, decisionReason);
    const privateResult = result.ok && privateNote.trim() ? await addInternalReviewComment(item.id, privateNote) : { ok: true as const };
    setBusy(false);
    setConfirmReject(false);
    if (result.ok && privateResult.ok) {
      setPrivateNote("");
      onChanged(result.message ?? `Marked ${item.title ?? item.id} as ${status}.`);
    } else onChanged(result.ok ? privateResult.warning ?? "The review decision completed, but the protected reviewer note could not be saved." : result.warning ?? "Review action failed.");
  }

  async function assign() {
    setBusy(true);
    const result = await assignReviewItemToMe(item);
    setBusy(false);
    onChanged(result.ok ? "Assigned review item to you." : result.warning ?? "Assignment failed.");
  }

  return <div className="review-actions">
    <label><span>Decision reason (visible to submitter)</span><input value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Explain the decision without private investigation details" /></label>
    <label><span>Private reviewer note</span><textarea rows={3} value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} placeholder="Internal only; protected by reviewer RLS" /></label>
    <p className="boundary-note">Decision reasons may be shown to the submitter. Private notes are stored only in the RLS-protected review-comments path and never in public Job Post metadata.</p>
    <div className="button-row"><button type="button" onClick={assign} disabled={busy}>Assign to me</button>{statusOptions.map((status) => <button key={status} type="button" onClick={() => void runStatus(status)} disabled={busy}>{status.replace(/_/g, " ")}</button>)}</div>
    {confirmReject && <div className="warning-callout">
      <strong>Reject and remove this submitted item?</strong>
      <p>{item.source_table === "commune_posts" ? "Rejecting this post removes it from the Commune review/public workflow. The current website role policies support a non-public moderator removal rather than a hard delete." : "Rejecting a submitted review item is a destructive workflow decision. Continue only if this item should leave the active review path."}</p>
      <div className="button-row"><button type="button" className="button-primary" onClick={() => void runStatus("rejected")} disabled={busy}>Yes, reject/remove</button><button type="button" onClick={() => setConfirmReject(false)} disabled={busy}>No, keep it</button></div>
    </div>}
  </div>;
}

function StewardshipReceiptReview({ item }: { item: ReviewItem }) {
  const [evidence, setEvidence] = useState<StewardshipReceiptEvidence | null>(null);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEvidence(null);
    setMessage("");
    setLoaded(false);
  }, [item.id]);

  if (item.domain !== "stewardship" || item.source_table !== "stewardship_recognition_requests") return null;

  async function openPrivateProof() {
    setBusy(true);
    const result = await loadStewardshipReceiptEvidence(item);
    setBusy(false);
    setLoaded(true);
    setEvidence(result.evidence);
    setMessage(result.warning ?? (result.evidence ? "Private proof metadata loaded for this reviewer session." : "No private receipt/proof is attached to this request."));
  }

  return <section className="review-actions" aria-labelledby="stewardship-private-proof-title">
    <h3 id="stewardship-private-proof-title">Private stewardship proof</h3>
    <p className="boundary-note">Receipt/proof files remain in a private storage bucket. Only an authorized stewardship reviewer can request a short-lived access link; no storage path or public URL is rendered.</p>
    <div className="button-row"><button type="button" onClick={() => void openPrivateProof()} disabled={busy}>{busy ? "Checking private proof…" : evidence ? "Refresh 5-minute access link" : "Load private proof"}</button>{evidence && <a className="button-link" href={evidence.signedUrl} target="_blank" rel="noreferrer">Open private proof (5-minute link)</a>}</div>
    {loaded && <p className="boundary-note">{message}</p>}
    {evidence && <dl className="mini-facts"><div><dt>File</dt><dd>{evidence.displayName}</dd></div><div><dt>Type</dt><dd>{evidence.mimeType}</dd></div><div><dt>Size</dt><dd>{evidence.sizeBytes === null ? "Not recorded" : `${evidence.sizeBytes.toLocaleString()} bytes`}</dd></div><div><dt>SHA-256</dt><dd>{evidence.sha256Prefix ? `${evidence.sha256Prefix}…` : "Not recorded"}</dd></div><div><dt>Redaction</dt><dd>{evidence.redactionStatus.replace(/_/g, " ")}</dd></div><div><dt>Access</dt><dd>Private, reviewer-only, expires in {evidence.expiresInSeconds / 60} minutes</dd></div></dl>}
  </section>;
}

function CommuneRecoveryActions({ item, onChanged }: { item: ReviewItem; onChanged: (message: string) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function restore() {
    setBusy(true);
    const result = await restoreCommuneReviewSubject(item, note || "Restored public visibility from admin recovery view.");
    setBusy(false);
    onChanged(result.ok ? result.message ?? "Commune content restored to public visibility. Review history was preserved." : result.warning ?? "Restore action failed.");
  }

  return <div className="review-actions">
    <p className="boundary-note">Review status and moderation state are separate. Restoring public visibility does not erase review history.</p>
    <label><span>Restore note</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason for restoring visibility" /></label>
    <div className="button-row"><button type="button" className="button-primary" onClick={() => void restore()} disabled={busy}>Restore to public</button><button type="button" onClick={() => onChanged("Kept hidden. No public visibility change was made.")} disabled={busy}>Keep hidden</button></div>
  </div>;
}

function CommuneRejectedRecoveryActions({ item, onChanged }: { item: ReviewItem; onChanged: (message: string) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function recover(action: "reopen_review" | "approve_and_restore") {
    setBusy(true);
    const result = await recoverRejectedCommuneReviewSubject(item, action, note);
    setBusy(false);
    if (!result.ok) {
      onChanged(result.warning ?? "Rejected recovery action failed.");
      return;
    }
    onChanged(result.message ?? (action === "reopen_review"
      ? "Rejected Commune item reopened for review. It remains non-public."
      : "Rejected Commune item approved and restored. Original rejection history was preserved."));
  }

  return <div className="review-actions">
    <p className="boundary-note">Rejected recovery is a review reconsideration workflow. Reopening or approving this item preserves the original rejection in history.</p>
    <p className="boundary-note">Rejected content is not restored automatically. Reopen review to reconsider it, or approve and restore if the rejection was mistaken.</p>
    <label><span>Reconsideration note</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason for reopening or approving after rejection" /></label>
    <div className="button-row"><button type="button" onClick={() => void recover("reopen_review")} disabled={busy}>Reopen review</button><button type="button" className="button-primary" onClick={() => void recover("approve_and_restore")} disabled={busy}>Approve and restore</button><button type="button" onClick={() => onChanged("Kept rejected. No state changed.")} disabled={busy}>Keep rejected</button></div>
  </div>;
}

function JobOpportunityReviewPanel({ item }: { item: ReviewItem }) {
  const opportunity = item.job_post_case;
  if (!opportunity) return <StewardshipReceiptReview item={item} />;
  return <section className="admin-job-opportunity-case" aria-labelledby="admin-job-opportunity-case-title">
    <p className="eyebrow">Joined Job Post case</p>
    <h3 id="admin-job-opportunity-case-title">{opportunity.title}</h3>
    <p className="boundary-note">The generic post and structured sidecar are presented as one case. Underlying review records and their audit history remain intact.</p>
    {opportunity.legacyAmbiguity && <WarningCallout title="Legacy listing"><p>This record predates the v2 opportunity model. Do not infer missing poster, compensation, time, or application-route details; request clarification where the legacy record is ambiguous.</p></WarningCallout>}
    <dl className="mini-facts">
      <div><dt>Organization</dt><dd>{opportunity.organization}</dd></div>
      <div><dt>Opportunity type</dt><dd>{opportunity.opportunityType}</dd></div>
      <div><dt>Poster type</dt><dd>{opportunity.posterType}</dd></div>
      <div><dt>Compensation status</dt><dd>{opportunity.compensationStatus}</dd></div>
      <div><dt>Compensation terms</dt><dd>{opportunity.compensation}</dd></div>
      <div><dt>Work arrangement</dt><dd>{opportunity.workArrangement}</dd></div>
      <div><dt>Time structure</dt><dd>{opportunity.timeStructure}</dd></div>
      <div><dt>Location</dt><dd>{opportunity.location}</dd></div>
      <div><dt>Application route</dt><dd>{opportunity.applicationRoute}</dd></div>
      <div><dt>Application destination</dt><dd>{opportunity.applicationDestination}</dd></div>
      <div><dt>Organization website</dt><dd>{opportunity.organizationWebsite}</dd></div>
    </dl>
    <details open><summary>Opportunity description and reviewer context</summary><p><strong>Summary:</strong> {opportunity.roleSummary}</p><p><strong>Requirements:</strong> {opportunity.requirements}</p><p><strong>Safety notes:</strong> {opportunity.safetyNotes}</p></details>
    <section className="admin-job-risk-flags"><h4>Advisory review signals</h4>{opportunity.flags.length ? opportunity.flags.map((flag) => <article className={`review-list-item review-risk-${flag.severity}`} key={flag.code}><strong>{flag.severity.replace(/_/g, " ")} · {flag.code.replace(/_/g, " ")}</strong><p>{flag.message}</p></article>) : <p>No configured text/relationship signals fired. This is not verification or proof of safety.</p>}<p className="boundary-note">Signals prioritize human review; they are not automated legal conclusions, scam findings, or rejection decisions.</p></section>
    {item.related_review_item_ids && item.related_review_item_ids.length > 1 && <p className="boundary-note">Joined review records: {item.related_review_item_ids.join(", ")}</p>}
    {item.internal_comments?.length ? <details><summary>Protected reviewer notes ({item.internal_comments.length})</summary>{item.internal_comments.map((comment) => <article className="review-list-item" key={comment.id}><p>{comment.body}</p><span>{comment.created_at}</span></article>)}</details> : <p className="boundary-note">No protected reviewer notes recorded for this case.</p>}
  </section>;
}

function ReviewQueue({ domain }: { domain?: ReviewDomain }) {
  const gate = useRoleGate(domain);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewQueueFilter>("active");

  const refresh = useCallback(async () => {
    const result = await loadReviewItems(domain, filter);
    setItems(result.items);
    setMessages(result.warnings);
  }, [domain, filter]);
  useEffect(() => { if (gate.allowed) void refresh(); }, [gate.allowed, refresh]);

  const selectedItem = items.find((item) => item.id === selected) ?? items[0] ?? null;
  const title = domain ? `${domainLabels[domain]} Review Queue` : "All Review Queues";
  const canActOnSelected = selectedItem ? activeReviewStatuses.includes(selectedItem.status) : false;
  const canRestoreSelected = selectedItem ? canRestoreCommuneItem(selectedItem) : false;
  const canRecoverRejectedSelected = selectedItem ? canRecoverRejectedCommuneItem(selectedItem) : false;
  const rejectedCommuneSourceMissing = selectedItem ? selectedItem.domain === "commune" && ["commune_posts", "commune_comments"].includes(selectedItem.source_table) && selectedItem.status === "rejected" && !selectedItem.content_status : false;
  if (!gate.allowed) return <Unauthorized warnings={gate.warnings} />;

  return <div className="page-stack admin-page"><PageHero eyebrow="Admin Review" title={title}><p>Review queues are role-gated in the UI and protected by Supabase RLS. Active queues show only items that still need action; History keeps reviewed evidence out of the working queue.</p></PageHero><AdminNav />{messages.map((message) => <p className="message" key={message}>{message}</p>)}<section className="section-card"><p className="eyebrow">Queue view</p><h2>{reviewQueueTitle(filter)}</h2><div className="button-row">{reviewQueueFilters.map((item) => <button key={item.value} type="button" className={filter === item.value ? "button-primary" : ""} onClick={() => { setFilter(item.value); setSelected(null); }}>{item.label}</button>)}</div><p className="boundary-note">Archive is an admin-selected saved state. History is the chronological review and moderation record. Review status and moderation state are separate, so approved content can later be hidden, flagged, removed, or restored without rewriting the original decision.</p></section><section className="two-column admin-review-grid"><div className="section-card"><p className="eyebrow">Queue</p><h2>{items.length} item{items.length === 1 ? "" : "s"}</h2>{items.length === 0 ? <p>{reviewQueueEmptyText(filter)}</p> : items.map((item) => <button className="review-list-item" type="button" key={item.id} onClick={() => setSelected(item.id)}><strong>{item.title || item.source_table}</strong><span>{domainLabels[item.domain]} · {item.job_post_case ? "joined opportunity case" : item.source_table}</span><StatusBadge status={item.status} />{item.moderation_state && <StatusBadge status={`moderation_${item.moderation_state}`} />}</button>)}</div><div className="section-card">{selectedItem ? <><p className="eyebrow">Review detail</p><h2>{selectedItem.title || selectedItem.id}</h2><dl className="mini-facts"><div><dt>Domain</dt><dd>{domainLabels[selectedItem.domain]}</dd></div><div><dt>Review status</dt><dd><StatusBadge status={selectedItem.status} /></dd></div><div><dt>Moderation state</dt><dd>{selectedItem.moderation_state ? <StatusBadge status={selectedItem.moderation_state} /> : "Not separately tracked"}</dd></div><div><dt>Public visibility</dt><dd>{selectedItem.public_visibility === "public" ? "public" : selectedItem.public_visibility === "not_public" ? "not public" : "unknown"}</dd></div><div><dt>Source</dt><dd>{selectedItem.source_table}</dd></div><div><dt>Source id</dt><dd>{selectedItem.source_id}</dd></div><div><dt>Submitted</dt><dd>{selectedItem.submitted_at ?? "Unknown"}</dd></div><div><dt>Updated</dt><dd>{selectedItem.content_updated_at ?? selectedItem.reviewed_at ?? "Unknown"}</dd></div><div><dt>Private files</dt><dd>{["work_with", "stewardship"].includes(selectedItem.domain) ? "May exist; access is private and RLS-gated." : "None expected"}</dd></div></dl><p>{selectedItem.content_preview || selectedItem.summary}</p><JobOpportunityReviewPanel item={selectedItem} />{selectedItem.content_links?.length ? <section className="commune-links-list" aria-label="Submitted links"><h3>Submitted links</h3><ul>{selectedItem.content_links.map((link, index) => { const href = safeCommuneLinkHref(link); return <li key={`${link}-${index}`}>{href ? <a href={href} target="_blank" rel="noreferrer">{link}</a> : <span>{link}</span>}</li>; })}</ul></section> : null}{selectedItem.moderation_reason && <p className="boundary-note">Moderation reason: {selectedItem.moderation_reason}</p>}{rejectedCommuneSourceMissing && <p className="boundary-note">Source content not found; this rejected record is history only.</p>}{canActOnSelected ? <ReviewActions item={selectedItem} onChanged={(message) => { setMessages((current) => [message, ...current]); void refresh(); }} /> : <p className="boundary-note">This item is in admin history. It is not part of the active queue; use review events and audit logs for the timeline.</p>}{canRestoreSelected && <CommuneRecoveryActions item={selectedItem} onChanged={(message) => { setMessages((current) => [message, ...current]); void refresh(); }} />}{canRecoverRejectedSelected && <CommuneRejectedRecoveryActions item={selectedItem} onChanged={(message) => { setMessages((current) => [message, ...current]); void refresh(); }} />}</> : <p>No item selected.</p>}</div></section></div>;
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

function BadgesPage() {
  const gate = useRoleGate();
  const [definitions, setDefinitions] = useState<BadgeDefinitionAdmin[]>([]);
  const [rules, setRules] = useState<BadgeRuleAdmin[]>([]);
  const [awards, setAwards] = useState<BadgeAwardAdmin[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [manualForm, setManualForm] = useState({ userId: "", badgeKey: "", reason: "" });
  const [actionReason, setActionReason] = useState("");
  const [manualRestoreOverride, setManualRestoreOverride] = useState(false);
  const [creditForm, setCreditForm] = useState({
    userId: "", creditType: "", creditAmount: 1 as 1 | 2,
    contributionType: "", contributionId: "", reviewItemId: "",
    distinctSubjectKey: "", isMajor: false, notes: ""
  });
  const [timelineForm, setTimelineForm] = useState({ userId: "", badgeKey: "" });
  const [timeline, setTimeline] = useState<BadgeAdministrationTimeline | null>(null);
  const refresh = useCallback(async () => {
    const result = await loadBadgeAdministration();
    setDefinitions(result.definitions);
    setRules(result.rules);
    setAwards(result.awards);
    setMessages(result.warnings);
    setManualForm((current) => ({ ...current, badgeKey: current.badgeKey || result.definitions[0]?.badge_key || "" }));
    setCreditForm((current) => ({ ...current, creditType: current.creditType || result.rules.find((rule) => rule.required_credit_type)?.required_credit_type || "" }));
  }, []);
  const refreshTimeline = useCallback(async () => {
    const result = await loadBadgeAdministrationTimeline(timelineForm.userId.trim(), timelineForm.badgeKey);
    setTimeline(result.timeline);
    setMessages(result.warnings);
  }, [timelineForm]);
  useEffect(() => { if (gate.isAdmin) void refresh(); }, [gate.isAdmin, refresh]);
  if (!gate.isAdmin) return <Unauthorized warnings={[...gate.warnings, "Badge management requires administrator authority."]} />;

  const creditOptions = [...new Map(
    rules
      .filter((rule): rule is BadgeRuleAdmin & { required_credit_type: string } => Boolean(rule.required_credit_type && rule.required_credit_type !== "account_membership"))
      .map((rule) => [rule.required_credit_type, rule])
  ).values()];

  return <div className="page-stack admin-page">
    <PageHero eyebrow="Admin" title="Badge Management"><p>Record reviewed evidence, grant, revoke, restore, and inspect recognition through audited backend functions. Badges never create roles, moderation authority, Marketplace approval, governance power, paid status, or trust by themselves.</p></PageHero>
    <AdminNav />
    {messages.map((message) => <p className="message" key={message}>{message}</p>)}
    <section className="two-column">
      <div className="section-card">
        <h2>Manual badge grant</h2>
        <p className="boundary-note">Use a target account auth UUID. Self-awards are refused by both this client and the database function. Every successful grant writes badge audit evidence.</p>
        <label><span>Target user auth UUID</span><input value={manualForm.userId} onChange={(event) => setManualForm({ ...manualForm, userId: event.target.value })} /></label>
        <label><span>Badge</span><select value={manualForm.badgeKey} onChange={(event) => setManualForm({ ...manualForm, badgeKey: event.target.value })}><option value="">Choose a badge</option>{definitions.map((definition) => <option key={definition.badge_key} value={definition.badge_key}>{definition.name} · {definition.award_mode ?? "governed"}</option>)}</select></label>
        <label><span>Audited reason</span><textarea value={manualForm.reason} onChange={(event) => setManualForm({ ...manualForm, reason: event.target.value })} /></label>
        <button className="button-primary" type="button" onClick={async () => {
          const result = await grantBadgeToUser(manualForm.userId.trim(), manualForm.badgeKey, manualForm.reason);
          setMessages([result.ok ? "Badge granted through the audited administrator operation." : result.warning ?? "Badge grant failed."]);
          if (result.ok) { setManualForm((current) => ({ ...current, reason: "" })); void refresh(); }
        }}>Grant badge</button>
      </div>
      <div className="section-card">
        <h2>Active definitions</h2>
        {!definitions.length && <p>No active badge definitions were returned.</p>}
        {definitions.map((definition) => <article className="review-list-item" key={definition.badge_key}><strong>{definition.name}</strong><span>{definition.badge_key} · {definition.category ?? "uncategorized"}</span><span>{definition.award_mode ?? "governed"}{definition.is_manual_only ? " · manual only" : ""}</span><p>{definition.description}</p></article>)}
      </div>
    </section>
    <section className="two-column">
      <div className="section-card">
        <h2>Record reviewed contribution evidence</h2>
        <p className="boundary-note">This is the authoritative producer for review-triggered badge credits. It records a reviewed contribution; it does not grant a role, accept payment, approve Marketplace publication, or treat ordinary moderation approval as merit.</p>
        <label><span>Target user auth UUID</span><input value={creditForm.userId} onChange={(event) => setCreditForm({ ...creditForm, userId: event.target.value })} /></label>
        <label><span>Credit type</span><select value={creditForm.creditType} onChange={(event) => setCreditForm({ ...creditForm, creditType: event.target.value })}><option value="">Choose a governed credit</option>{creditOptions.map((rule) => <option key={rule.required_credit_type} value={rule.required_credit_type}>{rule.required_credit_type.replace(/_/g, " ")} · {rule.badge_slug}</option>)}</select></label>
        <label><span>Credit amount</span><select value={creditForm.creditAmount} onChange={(event) => setCreditForm({ ...creditForm, creditAmount: Number(event.target.value) as 1 | 2 })}><option value="1">1 · ordinary reviewed contribution</option><option value="2">2 · substantial reviewed contribution</option></select></label>
        <label><span>Evidence/source table type</span><input placeholder="for example living_library_source_suggestions" value={creditForm.contributionType} onChange={(event) => setCreditForm({ ...creditForm, contributionType: event.target.value })} /></label>
        <label><span>Evidence/source UUID</span><input value={creditForm.contributionId} onChange={(event) => setCreditForm({ ...creditForm, contributionId: event.target.value })} /></label>
        <label><span>Approved review-item UUID (optional for administrator)</span><input value={creditForm.reviewItemId} onChange={(event) => setCreditForm({ ...creditForm, reviewItemId: event.target.value })} /></label>
        <label><span>Distinct person/project key (only where the rule requires it)</span><input value={creditForm.distinctSubjectKey} onChange={(event) => setCreditForm({ ...creditForm, distinctSubjectKey: event.target.value })} /></label>
        <label className="checkbox-line"><input type="checkbox" checked={creditForm.isMajor} onChange={(event) => setCreditForm({ ...creditForm, isMajor: event.target.checked })} /><span>Reviewed as a major contribution under the displayed rule</span></label>
        <label><span>Private review note</span><textarea value={creditForm.notes} onChange={(event) => setCreditForm({ ...creditForm, notes: event.target.value })} /></label>
        <button className="button-primary" type="button" onClick={async () => {
          const result = await createReviewedBadgeCredit({
            targetUserId: creditForm.userId.trim(),
            creditType: creditForm.creditType,
            creditAmount: creditForm.creditAmount,
            contributionType: creditForm.contributionType.trim(),
            contributionId: creditForm.contributionId.trim(),
            reviewItemId: creditForm.reviewItemId.trim() || undefined,
            isMajor: creditForm.isMajor,
            distinctSubjectKey: creditForm.distinctSubjectKey.trim() || undefined,
            notes: creditForm.notes
          });
          setMessages([result.ok ? `Reviewed badge credit recorded${result.creditEventId ? ` as ${result.creditEventId}` : ""}; qualification was evaluated server-side.` : result.warning ?? "Badge credit failed."]);
          if (result.ok) { setCreditForm((current) => ({ ...current, contributionId: "", reviewItemId: "", distinctSubjectKey: "", isMajor: false, notes: "" })); void refresh(); }
        }}>Record reviewed credit</button>
      </div>
      <div className="section-card">
        <h2>Active qualification rules</h2>
        <p className="boundary-note">These thresholds are recognition rules only. “Major” is a reviewed evidence classification, never a payment amount, hosted-credit balance, or social rank.</p>
        {!rules.length && <p>No active badge rules were returned.</p>}
        {rules.map((rule) => <article className="review-list-item" key={`${rule.badge_slug}-${rule.rule_type}-${rule.required_credit_type ?? "none"}`}><strong>{rule.badge_slug.replace(/_/g, " ")}</strong><span>{rule.rule_type.replace(/_/g, " ")}{rule.required_credit_type ? ` · ${rule.required_credit_type.replace(/_/g, " ")}` : ""}</span><span>{rule.required_count ? `count ${rule.required_count}` : ""}{rule.required_credit_sum ? ` sum ${rule.required_credit_sum}` : ""}{rule.distinct_subject_min ? ` · ${rule.distinct_subject_min} distinct subjects` : ""}{rule.requires_major ? " · major shortcut reviewed" : ""}</span><p>{rule.description ?? "No rule description supplied."}</p></article>)}
      </div>
    </section>
    <section className="section-card">
      <h2>Recent badge awards</h2>
      <p className="boundary-note">This administrator view omits private evidence payloads. Revocation creates durable suppression so automatic evaluation cannot immediately recreate the award.</p>
      <label><span>Reason for the next revoke or restore action</span><textarea value={actionReason} onChange={(event) => setActionReason(event.target.value)} /></label>
      {!awards.filter((award) => !award.revoked_at).length && <p>No active badge awards were returned.</p>}
      {awards.filter((award) => !award.revoked_at).map((award) => <article className="review-list-item admin-detail-card" key={award.id}><strong>{award.badge_key}</strong><span>Target: {award.user_id}</span><span>{award.award_source ?? "unspecified source"} · {award.visibility}</span><span>Awarded {award.awarded_at}</span><button type="button" onClick={async () => {
        if (!window.confirm(`Revoke ${award.badge_key} from this target and create durable suppression?`)) return;
        const result = await revokeBadgeFromUser(award.user_id, award.badge_key, actionReason);
        setMessages([result.ok ? "Badge revoked and automatic re-award suppressed." : result.warning ?? "Badge revocation failed."]);
        if (result.ok) { setActionReason(""); void refresh(); }
      }}>Revoke badge</button></article>)}
    </section>
    <section className="section-card">
      <h2>Per-account award, evidence, suppression, and audit history</h2>
      <p className="boundary-note">This bounded lookup exposes private evidence only to the administrator RPC. Public badge views remain column-minimized. Search by auth UUID; optionally narrow to one badge.</p>
      <div className="commune-form-grid">
        <label><span>Target user auth UUID</span><input value={timelineForm.userId} onChange={(event) => setTimelineForm({ ...timelineForm, userId: event.target.value })} /></label>
        <label><span>Badge filter</span><select value={timelineForm.badgeKey} onChange={(event) => setTimelineForm({ ...timelineForm, badgeKey: event.target.value })}><option value="">All badges and credits</option>{definitions.map((definition) => <option key={definition.badge_key} value={definition.badge_key}>{definition.name}</option>)}</select></label>
      </div>
      <div className="button-row"><button className="button-primary" type="button" onClick={() => void refreshTimeline()}>Load private badge history</button></div>
      {timeline && <div className="two-column admin-review-grid">
        <div>
          <h3>Awards ({timeline.awards.length})</h3>
          {!timeline.awards.length && <p>No matching award history.</p>}
          {timeline.awards.map((award) => <article className="review-list-item admin-detail-card" key={award.id}><strong>{award.badge_key}</strong><span>{award.award_source ?? "unspecified"} · {award.visibility}</span><span>{award.revoked_at ? `Revoked ${award.revoked_at}` : `Active since ${award.awarded_at}`}</span><p>{award.award_reason ?? "No award reason recorded."}</p><span>Evidence: {award.evidence_type ?? "none"} · {award.evidence_id ?? "none"}</span>{award.revoked_reason && <p>Revocation: {award.revoked_reason}</p>}</article>)}
          <h3>Suppressions ({timeline.suppressions.length})</h3>
          {timeline.suppressions.map((suppression) => <article className="review-list-item admin-detail-card" key={suppression.id}><strong>{suppression.badge_key}</strong><span>{suppression.lifted_at ? `Lifted ${suppression.lifted_at}` : `Active since ${suppression.suppressed_at}`}</span><p>{suppression.reason ?? "No suppression reason recorded."}</p>{suppression.lift_reason && <p>Lift reason: {suppression.lift_reason}</p>}{!suppression.lifted_at && <><label className="checkbox-line"><input type="checkbox" checked={manualRestoreOverride} onChange={(event) => setManualRestoreOverride(event.target.checked)} /><span>Explicit manual override if current evidence does not qualify (manual-only badges restore manually regardless)</span></label><button type="button" onClick={async () => {
            if (!window.confirm(`Lift suppression and restore or re-evaluate ${suppression.badge_key}?`)) return;
            const result = await restoreBadgeForUser(timeline.targetUserId, suppression.badge_key, actionReason, manualRestoreOverride);
            setMessages([result.ok ? result.restored ? "Badge suppression lifted and recognition restored." : "Suppression lifted; current evidence did not requalify the badge." : result.warning ?? "Badge restore failed."]);
            if (result.ok) { setActionReason(""); setManualRestoreOverride(false); void refresh(); void refreshTimeline(); }
          }}>Restore or re-evaluate badge</button></>}</article>)}
        </div>
        <div>
          <h3>Reviewed credit events ({timeline.credits.length})</h3>
          {!timeline.credits.length && <p>No matching reviewed credit evidence.</p>}
          {timeline.credits.map((credit) => <article className="review-list-item admin-detail-card" key={credit.id}><strong>{credit.credit_type.replace(/_/g, " ")} · {credit.credit_amount}</strong><span>{credit.contribution_type} · {credit.contribution_id}</span><span>{credit.review_item_id ? `Review item ${credit.review_item_id}` : "Administrator-reviewed direct evidence"}</span><span>{credit.is_major ? "Major contribution evidence" : "Ordinary contribution evidence"}{credit.distinct_subject_key ? ` · subject ${credit.distinct_subject_key}` : ""}</span><p>{credit.notes}</p>{credit.revoked_at ? <p>Revoked {credit.revoked_at}: {credit.revoked_reason ?? "No reason recorded."}</p> : <button type="button" onClick={async () => {
            if (!window.confirm(`Revoke badge credit ${credit.id} and re-evaluate rule awards?`)) return;
            const result = await revokeBadgeCredit(credit.id, actionReason);
            setMessages([result.ok ? "Badge credit revoked and affected rule awards re-evaluated." : result.warning ?? "Badge-credit revocation failed."]);
            if (result.ok) { setActionReason(""); void refresh(); void refreshTimeline(); }
          }}>Revoke credit and re-evaluate</button>}</article>)}
          <h3>Audit events ({timeline.auditEvents.length})</h3>
          {timeline.auditEvents.map((event) => <article className="review-list-item admin-detail-card" key={event.id}><strong>{event.action.replace(/_/g, " ")}</strong><span>{event.created_at} · actor {event.actor_user_id ?? "system"}</span><span>{event.badge_slug ?? "credit/rule event"}{event.credit_event_id ? ` · credit ${event.credit_event_id}` : ""}</span><pre className="admin-json-preview">{JSON.stringify(event.metadata, null, 2)}</pre></article>)}
        </div>
      </div>}
    </section>
  </div>;
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

function RealtimeChatModerationPanel() {
  const [reports, setReports] = useState<RealtimeReport[]>([]);
  const [rooms, setRooms] = useState<RealtimeRoom[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [note, setNote] = useState("Realtime chat moderation action.");
  const [roomSettings, setRoomSettings] = useState<Record<string, { mode: RealtimePostingMode; slow: string }>>({});
  const refresh = useCallback(async () => {
    const result = await listRealtimeReports();
    setReports(result.reports);
    setRooms(result.rooms);
    setMessages(result.warnings);
    const settings: Record<string, { mode: RealtimePostingMode; slow: string }> = {};
    for (const room of result.rooms) settings[room.id] = { mode: room.posting_mode, slow: String(room.slow_mode_seconds) };
    setRoomSettings(settings);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function moderate(report: RealtimeReport, action: "hide" | "remove" | "dismiss" | "action_taken") {
    let message = "Report updated.";
    if (action === "hide" && report.message) message = (await hideRealtimeMessage(report.message.id, note)).message;
    if (action === "remove" && report.message) message = (await removeRealtimeMessage(report.message.id, note)).message;
    if (action === "dismiss") message = (await updateRealtimeReportStatus(report.id, "dismissed", note)).message;
    if (action === "action_taken") message = (await updateRealtimeReportStatus(report.id, "action_taken", note)).message;
    setMessages([message]);
    await refresh();
  }

  async function saveRoom(room: RealtimeRoom) {
    const settings = roomSettings[room.id] ?? { mode: room.posting_mode, slow: String(room.slow_mode_seconds) };
    const slow = await updateRoomSlowMode(room.id, Number(settings.slow));
    const mode = await updateRoomPostingMode(room.id, settings.mode);
    setMessages([slow.message, mode.message]);
    await refresh();
  }

  return <section className="section-card"><p className="eyebrow">Commune realtime moderation</p><h2>Reported chat messages</h2><p className="boundary-note">Realtime reports are private moderation records. Hidden and removed messages must not be visible publicly. Chat stays plain text only: no DMs, no file uploads, no code execution.</p><QueueMessages messages={messages} /><label><span>Private reviewer note</span><input value={note} onChange={(event) => setNote(event.target.value)} /></label><div className="two-column"><div>{!reports.length && <p>No pending realtime chat reports.</p>}{reports.map((report) => <article className="review-list-item admin-detail-card" key={report.id}><strong>{report.room?.title ?? "Realtime room"}: {report.reason.replace(/_/g, " ")}</strong><StatusBadge status={report.report_status} /><span>{report.created_at}</span><p>{report.detail ?? "No additional detail supplied."}</p><p className="boundary-note">Message status: {report.message?.visibility_state ?? "message unavailable"}</p>{report.message && <pre className="admin-json-preview">{report.message.body_plain ?? report.message.body}</pre>}<div className="button-row"><button type="button" disabled={!report.message} onClick={() => void moderate(report, "hide")}>Hide message</button><button type="button" disabled={!report.message} onClick={() => void moderate(report, "remove")}>Remove message</button><button type="button" onClick={() => void moderate(report, "action_taken")}>Mark action taken</button><button type="button" onClick={() => void moderate(report, "dismiss")}>Dismiss report</button></div></article>)}</div><div><h3>Room controls</h3>{!rooms.length && <p className="boundary-note">Realtime rooms are not active until the latest migration and RLS policies are applied.</p>}{rooms.map((room) => { const settings = roomSettings[room.id] ?? { mode: room.posting_mode, slow: String(room.slow_mode_seconds) }; return <article className="review-list-item" key={room.id}><strong>{room.title}</strong><span>{room.slug}</span><label><span>Posting mode</span><select value={settings.mode} onChange={(event) => setRoomSettings((current) => ({ ...current, [room.id]: { ...settings, mode: event.target.value as RealtimePostingMode } }))}>{["open_signed_in", "members_only", "read_only", "moderated", "disabled"].map((mode) => <option key={mode} value={mode}>{mode.replace(/_/g, " ")}</option>)}</select></label><label><span>Slow mode seconds</span><input type="number" min="0" max="3600" value={settings.slow} onChange={(event) => setRoomSettings((current) => ({ ...current, [room.id]: { ...settings, slow: event.target.value } }))} /></label><button type="button" onClick={() => void saveRoom(room)}>Save room controls</button></article>; })}</div></div></section>;
}

function CodeReviewModerationPanel() {
  const [reports, setReports] = useState<CodeReport[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [note, setNote] = useState("Code review moderation action.");
  const refresh = useCallback(async () => { const result = await listCodeReports(); setReports(result.reports); setMessages(result.warnings); }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function moderate(report: CodeReport, action: "hide" | "remove" | "dismiss" | "action_taken") {
    let message = "Report updated.";
    if (action === "hide" && report.document_id) message = (await hideCodeDocument(report.document_id, note)).message;
    if (action === "remove" && report.document_id) message = (await removeCodeDocument(report.document_id, note)).message;
    if (action === "hide" && report.annotation_id) message = (await hideAnnotation(report.annotation_id, note)).message;
    if (action === "remove" && report.annotation_id) message = (await removeAnnotation(report.annotation_id, note)).message;
    if (action === "dismiss") message = (await updateCodeReportStatus(report.id, "dismissed", note)).message;
    if (action === "action_taken") message = (await updateCodeReportStatus(report.id, "action_taken", note)).message;
    setMessages([message]);
    await refresh();
  }
  return <section className="section-card"><p className="eyebrow">Commune code review moderation</p><h2>Reported code documents and annotations</h2><p className="boundary-note">Code review reports are private moderation records. Documents are text for review only: no run button, terminal, repository clone, dependency install, or local Elysia access.</p><QueueMessages messages={messages} /><label><span>Private reviewer note</span><input value={note} onChange={(event) => setNote(event.target.value)} /></label>{!reports.length && <p>No pending code review reports.</p>}{reports.map((report) => { const label = report.document?.title ?? (report.annotation ? "Code annotation" : "Code review item"); return <article className="review-list-item admin-detail-card" key={report.id}><strong>{label}: {report.reason.replace(/_/g, " ")}</strong><StatusBadge status={report.report_status} /><span>{report.created_at}</span><p>{report.detail ?? "No additional detail supplied."}</p>{report.document && <><p className="boundary-note">Document status: {report.document.visibility_state} · {report.document.review_status}</p><pre className="admin-json-preview">{report.document.current_text}</pre></>}{report.annotation && <><p className="boundary-note">Annotation lines {report.annotation.line_start}-{report.annotation.line_end} · {report.annotation.visibility_state}</p><pre className="admin-json-preview">{report.annotation.comment}</pre></>}<div className="button-row"><button type="button" disabled={!report.document_id && !report.annotation_id} onClick={() => void moderate(report, "hide")}>Hide target</button><button type="button" disabled={!report.document_id && !report.annotation_id} onClick={() => void moderate(report, "remove")}>Remove target</button><button type="button" onClick={() => void moderate(report, "action_taken")}>Mark action taken</button><button type="button" onClick={() => void moderate(report, "dismiss")}>Dismiss report</button></div></article>; })}</section>;
}

function SandboxHandoffReviewPanel() {
  const [requests, setRequests] = useState<SandboxRequestRecord[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("Reviewer feedback for Local Elysia handoff readiness.");
  const [privateNote, setPrivateNote] = useState("Private reviewer note. Do not export this to handoff bundles.");
  const [preview, setPreview] = useState("");
  const refresh = useCallback(async () => { const result = await listSandboxRequestsForReview(); setRequests(result.requests); setMessages(result.warnings); }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function run(request: SandboxRequestRecord, action: SandboxRequestAction) {
    const result = await reviewSandboxRequest(request.id, action, feedback, privateNote);
    setMessages([result.message]);
    await refresh();
  }

  async function previewBundle(request: SandboxRequestRecord) {
    const result = await buildLocalHandoffBundle(request);
    setPreview(result.ok ? result.json : result.message);
  }

  return <section className="section-card"><p className="eyebrow">Sandbox handoff review</p><h2>Local Elysia handoff requests</h2><p className="boundary-note">Reviewer approval here prepares metadata export only. It is not execution approval, does not call Local Elysia, and must not include private reviewer notes in handoff bundles.</p><QueueMessages messages={messages} /><div className="commune-form-grid"><label><span>Developer-facing feedback</span><input value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label><label><span>Private reviewer note</span><input value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} /></label></div>{!requests.length && <p>No pending sandbox handoff requests.</p>}{requests.map((request) => { const validation = validateSandboxRequestInput(request); return <article className="review-list-item admin-detail-card" key={request.id}><strong>{request.title}</strong><StatusBadge status={request.request_status} /><StatusBadge status={request.review_status} /><AdminChipRow labels={[`risk: ${validation.risk_level}`, request.handoff_status, request.source_type]} /><dl className="mini-facts"><div><dt>Source</dt><dd>{request.source_id ?? request.code_document_id ?? "manual"}</dd></div><div><dt>Language</dt><dd>{request.language ?? "unspecified"}</dd></div><div><dt>Expected command</dt><dd>{request.expected_command ?? "none"}</dd></div><div><dt>Dependencies</dt><dd>{request.declared_dependencies?.join(", ") || "none"}</dd></div><div><dt>Network</dt><dd>{request.declared_network_policy} {request.declared_network_domains?.join(", ")}</dd></div><div><dt>Filesystem</dt><dd>{request.declared_filesystem_policy} {request.declared_file_scopes?.join(", ")}</dd></div></dl><p>{request.summary ?? request.risk_notes ?? "No summary supplied."}</p><p className="boundary-note">Acknowledgements: no execution {String(request.user_acknowledged_no_execution)} · no secrets {String(request.user_acknowledged_no_secrets)} · Local Elysia final authority {String(request.user_acknowledged_local_elysia_final_authority)}</p>{validation.errors.map((item) => <p className="message" key={item.code}>{item.message}</p>)}{validation.warnings.map((item) => <p className="boundary-note" key={item.code}>{item.message}</p>)}{request.code_text && <pre className="admin-json-preview">{request.code_text}</pre>}<div className="button-row"><button type="button" onClick={() => void run(request, "request_changes")}>Request changes</button><button type="button" disabled={!validation.ok} onClick={() => void run(request, "approve_for_local_handoff")}>Approve for local handoff</button><button type="button" onClick={() => void run(request, "reject")}>Reject</button><button type="button" onClick={() => void run(request, "security_hold")}>Security hold</button><button type="button" onClick={() => void run(request, "revoke_handoff")}>Revoke handoff</button><button type="button" onClick={() => void run(request, "archive")}>Archive</button><button type="button" disabled={request.request_status !== "approved_for_local_handoff" || request.review_status !== "approved"} onClick={() => void previewBundle(request)}>Preview export bundle</button></div></article>; })}{preview && <pre className="admin-json-preview">{preview}</pre>}</section>;
}

function ReportsPage() {
  const gate = useRoleGate();
  const [rows, setRows] = useState<ContentReport[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const refresh = useCallback(async () => { const result = await loadContentReports(); setRows(result.rows); setMessages(result.warnings); }, []);
  useEffect(() => { if (gate.allowed) void refresh(); }, [gate.allowed, refresh]);
  if (!gate.allowed) return <Unauthorized warnings={gate.warnings} />;
  return <div className="page-stack admin-page"><PageHero eyebrow="Admin moderation" title="Reported Content"><p>Reports are private moderation records. Reporting does not automatically remove public content; reviewers decide the outcome.</p></PageHero><AdminNav /><QueueMessages messages={messages} /><section className="section-card"><h2>{rows.length} report{rows.length === 1 ? "" : "s"}</h2>{!rows.length && <p>No pending items.</p>}{rows.map((report) => <article className="review-list-item admin-detail-card" key={report.id}><strong>{report.target_type}: {report.target_id}</strong><StatusBadge status={report.status} /><span>{report.created_at}</span><p><strong>Reason:</strong> {report.reason}</p>{report.details && <p>{report.details}</p>}<ReportActions report={report} onChanged={(message) => { setMessages([message]); void refresh(); }} /></article>)}</section><SandboxHandoffReviewPanel /><CodeReviewModerationPanel /><RealtimeChatModerationPanel /></div>;
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
  const [developerFeedback, setDeveloperFeedback] = useState(submission.reviewer_feedback ?? "");
  const [privateNote, setPrivateNote] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [revocation, setRevocation] = useState({ reason: "security_issue", publicNotice: "", severity: "warning", privateNote: "", versionId: "" });
  const listing = submission.listing;
  const latestVersion = submission.versions?.find((version) => !version.revoked_at) ?? submission.versions?.[0] ?? null;
  const canPublish = submission.status === "approved" || submission.status === "published";

  async function publish() {
    setPublishing(true);
    const message = await publishAddonSubmission(submission.id, privateNote);
    setPublishing(false);
    onChanged(message);
  }

  async function revoke(versionId?: string | null) {
    if (!listing) return onChanged("Publish this add-on before revoking a Marketplace listing or version.");
    const message = await revokeMarketplacePublication({ listingId: listing.id, versionId, reason: revocation.reason, publicNotice: revocation.publicNotice, severity: revocation.severity, privateNote: revocation.privateNote });
    onChanged(message);
  }

  return <div className="review-actions admin-marketplace-actions">
    <label><span>Submission status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{["pending", "changes_requested", "approved", "rejected", "security_hold", "withdrawn", "published"].map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
    <label><span>Developer-facing feedback</span><input value={developerFeedback} onChange={(event) => setDeveloperFeedback(event.target.value)} placeholder="Visible to submitter" /></label>
    <label><span>Private reviewer note</span><input value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} placeholder="Internal only; never public" /></label>
    <div className="button-row"><button type="button" onClick={async () => onChanged(await updateAddonSubmission(submission.id, status, developerFeedback, privateNote))}>Update review state</button><button type="button" className="button-primary" disabled={!canPublish || publishing} onClick={() => void publish()}>{publishing ? "Publishing..." : "Publish approved version"}</button></div>
    <p className="boundary-note">Approval and publication are separate reviewer actions. Publishing creates a Marketplace catalog listing only; it does not install, enable, execute, sign, or trust the package locally.</p>
    <details className="admin-revoke-panel"><summary>Revoke listing/version</summary><div className="forge-form-grid"><label><span>Reason</span><select value={revocation.reason} onChange={(event) => setRevocation({ ...revocation, reason: event.target.value })}>{["security_issue", "malware_or_suspicious", "license_issue", "false_claims", "broken_package", "policy_violation", "developer_request", "compatibility_break", "other"].map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label><label><span>Severity</span><select value={revocation.severity} onChange={(event) => setRevocation({ ...revocation, severity: event.target.value })}>{["info", "warning", "high", "critical"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="wide-field"><span>Public notice</span><input value={revocation.publicNotice} onChange={(event) => setRevocation({ ...revocation, publicNotice: event.target.value })} placeholder="Public revocation notice, no private reviewer notes" /></label><label className="wide-field"><span>Private revocation note</span><input value={revocation.privateNote} onChange={(event) => setRevocation({ ...revocation, privateNote: event.target.value })} placeholder="Internal evidence pointer or reviewer note" /></label></div><div className="button-row"><button type="button" disabled={!listing} onClick={() => void revoke(null)}>Revoke listing</button><button type="button" disabled={!listing || !latestVersion} onClick={() => void revoke(latestVersion?.id)}>Revoke current version</button></div></details>
  </div>;
}

function PackageFacts({ pkg }: { pkg: NonNullable<AddonSubmissionReview["packages"]>[number] }) {
  const fileName = pkg.file_name ?? pkg.original_filename ?? "unnamed package";
  const fileSize = pkg.file_size ?? pkg.file_size_bytes;
  const inspection = pkg.archive_inspection_json && Object.keys(pkg.archive_inspection_json).length ? pkg.archive_inspection_json as NonNullable<typeof pkg.archive_inspection_json> : null;
  const manifestSummary = inspection?.manifest_summary as { addon_id?: string } | undefined;
  const fileInventory = Array.isArray(inspection?.file_inventory) ? inspection.file_inventory.slice(0, 20) : [];
  return <article className="review-list-item admin-package-card"><strong>{fileName}</strong><dl className="mini-facts"><div><dt>Size</dt><dd>{fileSize ? `${fileSize} bytes` : "unknown"}</dd></div><div><dt>SHA-256</dt><dd>{pkg.sha256 ?? "missing"}</dd></div><div><dt>Scan</dt><dd>{pkg.scan_status ?? "not scanned"}</dd></div><div><dt>Signature</dt><dd>{pkg.signature_status ?? "unsigned"}</dd></div><div><dt>Storage</dt><dd>{pkg.storage_path ? "private package path recorded" : "no storage path"}</dd></div></dl>{pkg.scan_summary && <p>{pkg.scan_summary}</p>}{inspection && <details><summary>Archive inspection result</summary><dl className="mini-facts"><div><dt>Status</dt><dd>{String(inspection.status ?? "unknown")}</dd></div><div><dt>Risk</dt><dd>{String(inspection.risk_level ?? "unknown")}</dd></div><div><dt>Files</dt><dd>{Array.isArray(inspection.file_inventory) ? inspection.file_inventory.length : 0}</dd></div><div><dt>Manifest</dt><dd>{manifestSummary?.addon_id ?? "not available"}</dd></div></dl><p>{String(inspection.summary ?? "Archive inspection summary unavailable.")}</p>{fileInventory.length > 0 && <ul>{fileInventory.map((file) => <li key={file.path}>{file.path} · {file.size ?? 0} bytes</li>)}</ul>}{Array.isArray(inspection.errors) && inspection.errors.length > 0 && <p className="message">Blocking archive issues: {inspection.errors.length}</p>}{Array.isArray(inspection.warnings) && inspection.warnings.length > 0 && <p className="boundary-note">Archive warnings: {inspection.warnings.length}</p>}</details>}<p className="boundary-note">Review metadata only. The website does not execute package code, package scripts, build hooks, dependencies, or shell commands. Static/archive inspection does not prove safety.</p></article>;
}

function SubmissionPermissionFacts({ submission }: { submission: AddonSubmissionReview }) {
  type PermissionFact = {
    id?: string;
    permission_key?: string;
    reason?: string | null;
    scope_json?: Record<string, unknown> | null;
    risk_acknowledged?: boolean;
  };
  const permissions = (submission.snapshot?.permissions_snapshot?.length ? submission.snapshot.permissions_snapshot : submission.permissions ?? []) as PermissionFact[];
  if (!permissions.length) return <p className="boundary-note">No permission declarations recorded.</p>;
  return <>{permissions.map((permission, index) => {
    const key = typeof permission.id === "string" ? permission.id : `${permission.permission_key ?? "permission"}-${index}`;
    const label = typeof permission.permission_key === "string" ? permission.permission_key : "Unlabeled permission";
    const reason = typeof permission.reason === "string" && permission.reason.trim() ? permission.reason : "No developer reason supplied.";
    const scope = permission.scope_json && typeof permission.scope_json === "object" ? permission.scope_json : {};
    return <article className="review-list-item" key={key}><strong>{label}</strong><span>{permission.risk_acknowledged ? "risk acknowledged" : "risk not acknowledged"}</span><p>{reason}</p><pre className="admin-json-preview">{JSON.stringify(scope, null, 2)}</pre></article>;
  })}</>;
}

function MarketplacePublicationPanel({ submission }: { submission: AddonSubmissionReview }) {
  const listing = submission.listing;
  return <details open={Boolean(listing)}><summary>Marketplace publication status</summary>{listing ? <div><dl className="mini-facts"><div><dt>Listing</dt><dd>{listing.slug}</dd></div><div><dt>Status</dt><dd><StatusBadge status={listing.listing_status} /></dd></div><div><dt>Current version</dt><dd>{listing.current_version ?? "none"}</dd></div><div><dt>Published</dt><dd>{listing.published_at ?? "not published"}</dd></div><div><dt>Revoked</dt><dd>{listing.revoked_at ? `${listing.revoked_at}: ${listing.revocation_reason ?? "no reason"}` : "no"}</dd></div></dl>{submission.versions?.map((version) => <article className="review-list-item" key={version.id}><strong>Version {version.version}</strong><StatusBadge status={version.review_status ?? "unknown"} /><span>{version.signature_status}</span><span>{version.revoked_at ? `Revoked: ${version.revocation_reason ?? "no reason"}` : "Install intent eligible if listing is published and not revoked"}</span></article>)}{submission.publicationEvents?.length ? <details><summary>Private publication event trail</summary>{submission.publicationEvents.map((event) => <article className="review-list-item" key={event.id}><strong>{event.action}</strong><span>{event.created_at}</span><p>{event.note ?? "No private note."}</p></article>)}</details> : <p className="boundary-note">No publication events recorded yet.</p>}</div> : <p className="boundary-note">No Marketplace listing has been published from this submission yet.</p>}</details>;
}

function AddonSubmissionsPage() {
  const gate = useRoleGate("marketplace");
  const [rows, setRows] = useState<AddonSubmissionReview[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const refresh = useCallback(async () => { const result = await loadAddonSubmissions(); setRows(result.rows); setMessages(result.warnings); }, []);
  useEffect(() => { if (gate.allowed) void refresh(); }, [gate.allowed, refresh]);
  if (!gate.allowed) return <Unauthorized warnings={gate.warnings} />;
  return <div className="page-stack admin-page">
    <PageHero eyebrow="Admin review" title="Developer Forge Add-on Submissions">
      <p>Reviewers may inspect manifests, validation status, permission requests, private package metadata, and scan summaries. Approval does not install anything locally.</p>
    </PageHero>
    <AdminNav />
    <QueueMessages messages={messages} />
    <section className="section-card">
      <h2>{rows.length} add-on submission{rows.length === 1 ? "" : "s"}</h2>
      {!rows.length && <p>No pending items.</p>}
      {rows.map((submission) => {
        const preview = submission.snapshot?.marketplace_preview_snapshot ?? {};
        const previewPermissions = Array.isArray(preview.permissions) ? preview.permissions.join(", ") : submission.draft?.permission_summary ?? "No summary";
        return <article className="review-list-item admin-detail-card admin-addon-inspection" key={submission.id}>
          <div className="addon-card__topline">
            <strong>{(preview.addon_name as string | undefined) ?? submission.draft?.addon_name ?? submission.id}</strong>
            <StatusBadge status={submission.status} />
          </div>
          <p>{submission.review_summary ?? (preview.summary as string | undefined) ?? submission.draft?.short_summary ?? "No summary supplied."}</p>
          <dl className="mini-facts">
            <div><dt>Slug</dt><dd>{(preview.addon_slug as string | undefined) ?? submission.draft?.addon_slug ?? "unknown"}</dd></div>
            <div><dt>Version</dt><dd>{(submission.snapshot?.manifest_snapshot?.version as string | undefined) ?? submission.draft?.version ?? "unknown"}</dd></div>
            <div><dt>Developer</dt><dd>{submission.developer?.display_name ?? submission.submitted_by}</dd></div>
            <div><dt>Validation</dt><dd>{submission.draft?.validation_status ?? "not available"}</dd></div>
            <div><dt>Risk</dt><dd>{(preview.risk_level as string | undefined) ?? submission.draft?.risk_level ?? "unknown"}</dd></div>
            <div><dt>Packages</dt><dd>{submission.packages?.length ?? 0} private metadata row(s)</dd></div>
          </dl>
          <details open>
            <summary>Immutable review snapshot</summary>
            {submission.snapshot ? <div>
              <dl className="mini-facts">
                <div><dt>Snapshot</dt><dd>{submission.snapshot.id}</dd></div>
                <div><dt>Created</dt><dd>{submission.snapshot.created_at}</dd></div>
                <div><dt>Package SHA-256</dt><dd>{submission.snapshot.package_sha256 ?? "not recorded"}</dd></div>
                <div><dt>Signature</dt><dd>{submission.snapshot.signature_status ?? "unsigned"}</dd></div>
              </dl>
              <p className="boundary-note">Review and Marketplace publication use this frozen snapshot when available. Later draft edits must be submitted as an explicit revision.</p>
            </div> : <p className="boundary-note">No immutable snapshot row is available. This may be a legacy submission from before the snapshot migration; apply the latest Supabase SQL before relying on publication.</p>}
          </details>
          <details>
            <summary>Manifest JSON</summary>
            <pre className="admin-json-preview">{JSON.stringify(submission.snapshot?.manifest_snapshot ?? submission.draft?.manifest_json ?? {}, null, 2)}</pre>
          </details>
          <details>
            <summary>Permissions and risk reasons</summary>
            <SubmissionPermissionFacts submission={submission} />
          </details>
          <details>
            <summary>Validation and compatibility</summary>
            {submission.snapshot?.validation_snapshot?.length ? submission.snapshot.validation_snapshot.map((result, index) => <article className="review-list-item" key={`${result.code}-${index}`}><strong>{result.severity}: {result.code}</strong><p>{result.message}</p><span>{result.field_path ?? "manifest"}</span></article>) : submission.validationResults?.length ? submission.validationResults.map((result) => <article className="review-list-item" key={result.id}><strong>{result.severity}: {result.code}</strong><p>{result.message}</p><span>{result.field_path ?? "manifest"}</span></article>) : <p className="boundary-note">No validation rows recorded.</p>}
            {submission.compatibilityResults?.length ? submission.compatibilityResults.map((result) => <article className="review-list-item" key={result.id}><strong>{result.status}</strong><span>{result.elysia_version ?? "unknown Elysia version"}</span><p>{[...(result.warnings ?? []), ...(result.errors ?? [])].join(" · ") || "No compatibility details recorded."}</p></article>) : <p className="boundary-note">No compatibility rows recorded.</p>}
          </details>
          <details open>
            <summary>Private package inspection</summary>
            {submission.packages?.length ? submission.packages.map((pkg) => <PackageFacts pkg={pkg} key={pkg.id} />) : <p className="boundary-note">No private package metadata has been uploaded for this submission.</p>}
          </details>
          <details>
            <summary>Marketplace preview</summary>
            <article className="addon-card">
              <div className="addon-card__topline">
                <strong>{(preview.addon_name as string | undefined) ?? submission.draft?.addon_name ?? "Untitled add-on"}</strong>
                <span>{(submission.snapshot?.manifest_snapshot?.version as string | undefined) ?? submission.draft?.version ?? "0.1.0"}</span>
              </div>
              <p>{(preview.summary as string | undefined) ?? submission.draft?.short_summary ?? "No summary supplied."}</p>
              <dl className="mini-facts">
                <div><dt>Category</dt><dd>{(preview.category as string | undefined) ?? submission.draft?.category ?? "uncategorized"}</dd></div>
                <div><dt>License</dt><dd>{(submission.snapshot?.manifest_snapshot?.license as string | undefined) ?? submission.draft?.license ?? "missing"}</dd></div>
                <div><dt>Permissions</dt><dd>{previewPermissions}</dd></div>
                <div><dt>Signature</dt><dd>{submission.snapshot?.signature_status ?? submission.packages?.[0]?.signature_status ?? "unsigned"}</dd></div>
              </dl>
              <p className="boundary-note">Preview only. Static scan does not prove safety. Marketplace publication still creates only a catalog entry and install intent surface.</p>
            </article>
          </details>
          <MarketplacePublicationPanel submission={submission} />
          <AddonSubmissionActions submission={submission} onChanged={(message) => { setMessages([message]); void refresh(); }} />
        </article>;
      })}
    </section>
  </div>;
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
export function AdminBadgesPage() { return <BadgesPage />; }
export function AdminAuditPage() { return <CombinedAuditPage />; }
export function AdminReportsPage() { return <ReportsPage />; }
export function AdminDevelopersPage() { return <DevelopersPage />; }
export function AdminAddonSubmissionsPage() { return <AddonSubmissionsPage />; }
export function AdminLibrarySourcesPage() { return <LibrarySourcesPage />; }
export function AdminWorkSubmissionsPage() { return <WorkSubmissionsPage />; }
