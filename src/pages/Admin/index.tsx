import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
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

  return <div className="page-stack admin-page"><PageHero eyebrow="Admin Review" title={title}><p>Review queues are role-gated in the UI and protected by Supabase RLS. Actions write review events for auditability.</p></PageHero><AdminNav />{messages.map((message) => <p className="message" key={message}>{message}</p>)}<section className="two-column admin-review-grid"><div className="section-card"><p className="eyebrow">Queue</p><h2>{items.length} item{items.length === 1 ? "" : "s"}</h2>{items.length === 0 ? <p>No review items are visible for your current role.</p> : items.map((item) => <button className="review-list-item" type="button" key={item.id} onClick={() => setSelected(item.id)}><strong>{item.title || item.source_table}</strong><span>{domainLabels[item.domain]} · {item.source_table}</span><StatusBadge status={item.status} /></button>)}</div><div className="section-card">{selectedItem ? <><p className="eyebrow">Review detail</p><h2>{selectedItem.title || selectedItem.id}</h2><dl className="mini-facts"><div><dt>Domain</dt><dd>{domainLabels[selectedItem.domain]}</dd></div><div><dt>Status</dt><dd><StatusBadge status={selectedItem.status} /></dd></div><div><dt>Source</dt><dd>{selectedItem.source_table}</dd></div><div><dt>Submitted</dt><dd>{selectedItem.submitted_at ?? "Unknown"}</dd></div><div><dt>Private files</dt><dd>{["work_with", "stewardship"].includes(selectedItem.domain) ? "May exist; access is private and RLS-gated." : "None expected"}</dd></div></dl><p>{selectedItem.summary}</p><ReviewActions item={selectedItem} onChanged={(message) => { setMessages((current) => [message, ...current]); void refresh(); }} /></> : <p>Select a review item.</p>}</div></section></div>;
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

export function AdminHomePage() {
  const gate = useRoleGate();
  if (!gate.allowed) return <Unauthorized warnings={gate.warnings} />;
  return <div className="page-stack admin-page"><PageHero eyebrow="Admin" title="Governance Console"><p>Review public website submissions without connecting to private local Elysia memory, files, logs, vaults, passwords, or credentials.</p></PageHero><AdminNav /><section className="section-card"><h2>Your roles</h2><div className="commons-badge-row">{gate.roles.map((role) => <RoleBadge key={role} role={role} />)}</div><p className="boundary-note">Roles are Supabase-backed and RLS-enforced. This page is a review doorway, not a bypass.</p></section><section className="feature-grid feature-grid--three">{(Object.entries(domainLabels).filter(([domain]) => domain !== "contribution") as [ReviewDomain, string][]).map(([domain, label]) => <Link className="feature-card" to={`/admin/review/${domain === "work_with" ? "work-with" : domain === "living_library_source" ? "living-library" : domain === "living_library_broken_link" ? "broken-links" : domain}`} key={domain}><h3>{label}</h3><p>{canReviewDomain(gate.roles, domain) ? "Available for your role." : "Hidden by RLS if unauthorized."}</p></Link>)}</section></div>;
}

export function AdminReviewPage() {
  const { pathname } = useLocation();
  return <ReviewQueue domain={routeDomains[pathname]} />;
}

export function AdminRolesPage() { return <RolesPage />; }
export function AdminAuditPage() { return <AuditPage />; }
