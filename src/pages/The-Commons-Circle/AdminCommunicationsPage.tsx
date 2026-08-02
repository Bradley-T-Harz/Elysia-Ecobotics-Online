import { useCallback, useEffect, useMemo, useState } from "react";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { loadCurrentRoleState, type AppRole } from "../../shared/review/reviewClient";
import {
  adminSendAccountMessage,
  claimAdminSupportConversation,
  claimMessageModerationCase,
  loadAdminSupportQueue,
  loadConversation,
  loadMessageModerationQueue,
  prepareAdminAnnouncement,
  readReportedMessageEvidence,
  resolveMessageModerationCase,
  sendAdminAnnouncement,
  sendConversationMessage,
  type AdminAnnouncementDraft,
  type AdminSupportItem,
  type ConversationDetail,
  type MessageModerationCase,
  type ReportedMessageEvidence,
} from "./accountCommunicationsApi";

type RoleState = { signedIn: boolean; isAdmin: boolean; roles: AppRole[] };
type StatusMessage = { tone: "info" | "error"; text: string } | null;

const messageKinds = [
  ["admin_message", "Administrator message"],
  ["required_action", "Required action"],
  ["mandatory_notice", "Mandatory account notice"],
  ["system_notice", "System notice"],
] as const;

const resolutions = [
  ["no_action", "No action"],
  ["warning_issued", "Warning issued"],
  ["content_tombstoned", "Reported content tombstoned"],
  ["account_restriction_referred", "Refer account restriction"],
  ["escalated_legal", "Escalate for legal review"],
  ["duplicate", "Duplicate report"],
] as const;

function actorLabel(actor: { handle: string | null; displayName: string | null } | null) {
  return actor?.displayName || (actor?.handle ? `@${actor.handle}` : "Private or former account");
}

function displayTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

function warningText(warning: string | null | undefined, fallback: string) {
  return warning?.trim() || fallback;
}

export default function AdminCommunicationsPage() {
  const [roleState, setRoleState] = useState<RoleState>({ signedIn: false, isAdmin: false, roles: [] });
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [supportItems, setSupportItems] = useState<AdminSupportItem[]>([]);
  const [supportDetail, setSupportDetail] = useState<ConversationDetail | null>(null);
  const [supportReply, setSupportReply] = useState("");
  const [moderationCases, setModerationCases] = useState<MessageModerationCase[]>([]);
  const [evidence, setEvidence] = useState<ReportedMessageEvidence | null>(null);
  const [resolution, setResolution] = useState("no_action");
  const [legalHold, setLegalHold] = useState(false);
  const [direct, setDirect] = useState({ handle: "", subject: "", body: "", kind: "admin_message" });
  const [announcement, setAnnouncement] = useState({ subject: "", body: "", audienceKind: "explicit_opted_in_handles", handles: "" });
  const [announcementDraft, setAnnouncementDraft] = useState<AdminAnnouncementDraft | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [working, setWorking] = useState(false);

  const canModerateMessages = useMemo(() => roleState.isAdmin || roleState.roles.some((role) => role === "moderator" || role === "commune_moderator"), [roleState]);

  const refresh = useCallback(async () => {
    const roles = await loadCurrentRoleState();
    const next = { signedIn: roles.signedIn, isAdmin: roles.isAdmin, roles: roles.roles };
    setRoleState(next);
    if (next.isAdmin) {
      const support = await loadAdminSupportQueue();
      setSupportItems(support.items);
      if (support.warning) setStatus({ tone: "error", text: support.warning });
    } else {
      setSupportItems([]);
    }
    if (next.isAdmin || next.roles.some((role) => role === "moderator" || role === "commune_moderator")) {
      const queue = await loadMessageModerationQueue();
      setModerationCases(queue.items);
      if (queue.warning) setStatus({ tone: "error", text: queue.warning });
    } else {
      setModerationCases([]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function run(action: () => Promise<string | null>, success: string, after?: () => Promise<void>) {
    setWorking(true);
    setStatus(null);
    const warning = await action();
    if (warning) setStatus({ tone: "error", text: warning });
    else {
      setStatus({ tone: "info", text: success });
      if (after) await after();
    }
    setWorking(false);
    return !warning;
  }

  async function sendDirect() {
    setWorking(true);
    setStatus(null);
    const result = await adminSendAccountMessage(direct);
    if (result.warning) setStatus({ tone: "error", text: result.warning });
    else {
      setStatus({ tone: "info", text: "The governed administrator conversation was created for the selected account." });
      setDirect({ handle: "", subject: "", body: "", kind: "admin_message" });
    }
    setWorking(false);
  }

  async function claimSupport(item: AdminSupportItem) {
    const ok = await run(
      () => claimAdminSupportConversation(item.conversationId),
      "Support conversation assigned to you.",
      refresh,
    );
    if (!ok) return;
    const result = await loadConversation(item.conversationId);
    if (result.warning || !result.detail) setStatus({ tone: "error", text: warningText(result.warning, "The assigned support conversation could not be opened.") });
    else setSupportDetail(result.detail);
  }

  async function replyToSupport() {
    if (!supportDetail || !supportReply.trim()) return;
    const conversationId = supportDetail.conversation.id;
    const ok = await run(() => sendConversationMessage(conversationId, supportReply), "Private support reply sent.");
    if (!ok) return;
    setSupportReply("");
    const result = await loadConversation(conversationId);
    if (result.detail) setSupportDetail(result.detail);
  }

  async function claimCase(item: MessageModerationCase) {
    const ok = await run(() => claimMessageModerationCase(item.caseId), "Moderation case assigned to you.", refresh);
    if (!ok) return;
    const result = await readReportedMessageEvidence(item.caseId);
    if (result.warning || !result.evidence) setStatus({ tone: "error", text: warningText(result.warning, "Reported evidence could not be opened.") });
    else setEvidence(result.evidence);
  }

  async function resolveCase() {
    if (!evidence) return;
    const ok = await run(
      () => resolveMessageModerationCase(evidence.caseId, resolution, legalHold),
      "The report was resolved and the reporter received the governed outcome notice.",
      refresh,
    );
    if (ok) setEvidence(null);
  }

  async function prepareAnnouncement() {
    setWorking(true);
    setStatus(null);
    const result = await prepareAdminAnnouncement({
      subject: announcement.subject,
      body: announcement.body,
      audienceKind: announcement.audienceKind,
      handles: announcement.handles.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean),
    });
    if (result.warning || !result.draft) setStatus({ tone: "error", text: warningText(result.warning, "No eligible opted-in recipients matched this audience.") });
    else {
      setAnnouncementDraft(result.draft);
      setConfirmation("");
      setStatus({ tone: "info", text: "Audience preview frozen for 30 minutes. Review the exact count and type the confirmation phrase to send." });
    }
    setWorking(false);
  }

  async function sendAnnouncement() {
    if (!announcementDraft) return;
    const ok = await run(
      () => sendAdminAnnouncement(announcementDraft.draftId, announcementDraft.recipientCount, confirmation),
      `Announcement delivered to ${announcementDraft.recipientCount} opted-in accounts.`,
    );
    if (ok) {
      setAnnouncementDraft(null);
      setConfirmation("");
      setAnnouncement({ subject: "", body: "", audienceKind: "explicit_opted_in_handles", handles: "" });
    }
  }

  const allowed = roleState.isAdmin || canModerateMessages;

  return <div className="page-stack commons-circle-page admin-communications-page">
    <PageHero eyebrow="Private governance" title="Account Communications">
      <p>Governed support, administrator notices, opted-in announcements, and report-bound private-message moderation.</p>
      <p>Messages communicate with an account. They never grant proposal, review, moderation, economic, or account authority.</p>
    </PageHero>

    {status && <div className={status.tone === "error" ? "error-box" : "message"} role="status">{status.text}</div>}
    {!loaded && <section className="section-card"><h2>Checking communication authority…</h2></section>}

    {loaded && !roleState.signedIn && <section className="section-card">
      <h2>Sign in required</h2>
      <AuthPanel onMessage={(text) => setStatus({ tone: "info", text })} onAuthChanged={refresh} copy={{
        eyebrow: "Website Account",
        title: "Sign in to governed communications",
        description: "The backend rechecks administrator and moderator roles for every operation.",
        signedOutText: "No active website session.",
        confirmationPath: "/commons-circle/admin-communications",
        confirmationCopy: "After confirming your account, return to this protected route.",
      }} />
    </section>}

    {loaded && roleState.signedIn && !allowed && <section className="section-card">
      <h2>Communication authority required</h2>
      <p>Only administrators may communicate with accounts or audiences. Only administrators and assigned message moderators may open reported-message cases.</p>
      <WarningCallout title="Review roles remain separate"><p>Generic reviewer, Marketplace reviewer, source reviewer, and guardian reviewer roles do not grant private-message access or mass-messaging authority.</p></WarningCallout>
    </section>}

    {loaded && allowed && <>
      <WarningCallout title="Least-privilege private communication"><p>Normal conversation contents are participant-only. Moderators see only the reported message after claiming its case, and every evidence access is audited. Messages are stored in Supabase and are not end-to-end encrypted.</p></WarningCallout>

      {roleState.isAdmin && <section className="section-card account-admin-communications">
        <p className="eyebrow">Individual account</p><h2>Send governed administrator message</h2>
        <div className="form-grid">
          <label><span>Public handle</span><input value={direct.handle} onChange={(event) => setDirect({ ...direct, handle: event.target.value })} placeholder="@public-handle" /></label>
          <label><span>Message class</span><select value={direct.kind} onChange={(event) => setDirect({ ...direct, kind: event.target.value })}>{messageKinds.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label className="wide-field"><span>Subject</span><input maxLength={160} value={direct.subject} onChange={(event) => setDirect({ ...direct, subject: event.target.value })} /></label>
          <label className="wide-field"><span>Private plain-text message</span><textarea rows={6} maxLength={8000} value={direct.body} onChange={(event) => setDirect({ ...direct, body: event.target.value })} /></label>
        </div>
        <p className="boundary-note">Required, mandatory, and system notices are unsuppressible. Ordinary administrator messages remain informational. The recipient is resolved only from a public-safe handle.</p>
        <button type="button" className="button-primary" disabled={working || !direct.handle.trim() || !direct.subject.trim() || !direct.body.trim()} onClick={() => void sendDirect()}>Send to one account</button>
      </section>}

      {roleState.isAdmin && <section className="section-card account-admin-communications">
        <p className="eyebrow">Account support</p><h2>Claimed-response queue</h2>
        {!supportItems.length && <p className="commons-empty-state">No open account-support conversations.</p>}
        <div className="account-admin-queue">{supportItems.map((item) => <article key={item.conversationId}>
          <h3>{item.subject}</h3><p>{actorLabel(item.requester)} · priority {item.priority} · {item.status.replace(/_/g, " ")}</p>
          <button type="button" disabled={working || (item.status === "assigned" && !item.assignedToCurrentUser)} onClick={() => void claimSupport(item)}>{item.assignedToCurrentUser ? "Open assigned thread" : "Claim and open"}</button>
        </article>)}</div>
        {supportDetail && <div className="account-conversation-detail">
          <h3>{supportDetail.conversation.subject}</h3>
          <div className="account-message-thread">{supportDetail.messages.map((message) => <article className={`account-message${message.senderSelf ? " account-message--self" : ""}`} key={message.id}>
            <p className="account-message__sender">{message.senderSelf ? "You" : actorLabel(message.sender)}</p><p className="account-message__body">{message.deletedAt ? "Message removed." : message.body}</p><p className="account-message__time">{displayTime(message.createdAt)}</p>
          </article>)}</div>
          <label><span>Private support reply</span><textarea rows={5} maxLength={8000} value={supportReply} onChange={(event) => setSupportReply(event.target.value)} /></label>
          <button type="button" className="button-primary" disabled={working || !supportReply.trim()} onClick={() => void replyToSupport()}>Send support reply</button>
        </div>}
      </section>}

      {roleState.isAdmin && <section className="section-card account-admin-communications">
        <p className="eyebrow">Opted-in audience</p><h2>Prepare administrator announcement</h2>
        <div className="form-grid">
          <label><span>Audience</span><select value={announcement.audienceKind} onChange={(event) => { setAnnouncement({ ...announcement, audienceKind: event.target.value }); setAnnouncementDraft(null); }}><option value="explicit_opted_in_handles">Named opted-in handles</option><option value="all_opted_in_adults">All opted-in eligible adults</option><option value="administrators">Opted-in administrators</option></select></label>
          {announcement.audienceKind === "explicit_opted_in_handles" && <label><span>Handles, comma or space separated</span><input value={announcement.handles} onChange={(event) => { setAnnouncement({ ...announcement, handles: event.target.value }); setAnnouncementDraft(null); }} /></label>}
          <label className="wide-field"><span>Subject</span><input maxLength={160} value={announcement.subject} onChange={(event) => { setAnnouncement({ ...announcement, subject: event.target.value }); setAnnouncementDraft(null); }} /></label>
          <label className="wide-field"><span>Private plain-text message</span><textarea rows={6} maxLength={8000} value={announcement.body} onChange={(event) => { setAnnouncement({ ...announcement, body: event.target.value }); setAnnouncementDraft(null); }} /></label>
        </div>
        <button type="button" disabled={working || !announcement.subject.trim() || !announcement.body.trim()} onClick={() => void prepareAnnouncement()}>Preview exact audience</button>
        {announcementDraft && <div className="account-announcement-confirmation">
          <h3>Confirm delivery to {announcementDraft.recipientCount} accounts</h3><p>{announcementDraft.safePreview}</p><p>Preview expires {displayTime(announcementDraft.expiresAt)}.</p>
          <label><span>Type <strong>{announcementDraft.confirmationPhrase}</strong></span><input autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          <button type="button" className="button-primary" disabled={working || confirmation !== announcementDraft.confirmationPhrase} onClick={() => void sendAnnouncement()}>Send exactly {announcementDraft.recipientCount}</button>
        </div>}
      </section>}

      {canModerateMessages && <section className="section-card account-admin-communications">
        <p className="eyebrow">Case-bound safety review</p><h2>Reported private messages</h2>
        {!moderationCases.length && <p className="commons-empty-state">No open private-message reports.</p>}
        <div className="account-admin-queue">{moderationCases.map((item) => <article key={item.caseId}>
          <h3>{item.reasonCode.replace(/_/g, " ")}</h3><p>{actorLabel(item.reporter)} · {item.status.replace(/_/g, " ")} · {displayTime(item.createdAt)}</p>
          <button type="button" disabled={working || (!roleState.isAdmin && item.status === "assigned" && !item.assignedToCurrentUser)} onClick={() => void claimCase(item)}>{item.assignedToCurrentUser ? "Open audited evidence" : "Claim case"}</button>
        </article>)}</div>
        {evidence && <div className="account-reported-evidence">
          <h3>Reported evidence: {evidence.conversation.subject}</h3><p>{evidence.scopeNotice}</p>
          <dl className="mini-facts"><div><dt>Reason</dt><dd>{evidence.reasonCode.replace(/_/g, " ")}</dd></div><div><dt>Conversation type</dt><dd>{evidence.conversation.type.replace(/_/g, " ")}</dd></div><div><dt>Status</dt><dd>{evidence.status.replace(/_/g, " ")}</dd></div></dl>
          {evidence.details && <p><strong>Reporter context:</strong> {evidence.details}</p>}
          {evidence.reportedMessage ? <article className="account-message"><p className="account-message__sender">Reported {evidence.reportedMessage.senderKind.replace(/_/g, " ")} message</p><p className="account-message__body">{evidence.reportedMessage.deletedAt ? "Message removed." : evidence.reportedMessage.body}</p><p className="account-message__time">{displayTime(evidence.reportedMessage.createdAt)}</p></article> : <p>No individual message was selected; unrelated thread history remains hidden.</p>}
          <div className="form-grid"><label><span>Resolution</span><select value={resolution} onChange={(event) => setResolution(event.target.value)}>{resolutions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="checkbox-line"><input type="checkbox" checked={legalHold} onChange={(event) => setLegalHold(event.target.checked)} /><span>Preserve under legal hold</span></label></div>
          <button type="button" className="button-primary" disabled={working} onClick={() => void resolveCase()}>Resolve audited case</button>
        </div>}
      </section>}
    </>}

    <div className="button-row"><a className="button-link" href="/commons-circle/admin-console">Back to Admin Console</a><a className="button-link" href="/admin/review">Open Review Center</a></div>
  </div>;
}
