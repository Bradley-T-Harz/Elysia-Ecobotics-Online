import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  loadConversation,
  loadConversations,
  loadMessagingPreferences,
  lookupMessagingRecipient,
  markConversationRead,
  reportConversation,
  requestConversation,
  respondToConversationRequest,
  sendConversationMessage,
  setConversationBlocked,
  setConversationPresentation,
  startSourceLinkedConversation,
  startSupportConversation,
  updateMessagingPreferences,
  type ConversationDetail,
  type ConversationSummary,
  type MessagingPreferences,
  type MessagingRecipient,
} from "./accountCommunicationsApi";

type PanelMessage = { tone: "info" | "error"; text: string };

function formatTime(value: string | null) {
  if (!value) return "No messages yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

function profileLabel(profile: ConversationSummary["counterpart"]) {
  return profile?.displayName || (profile?.handle ? `@${profile.handle}` : "Elysia Ecobotics account");
}

function stateLabel(conversation: ConversationSummary) {
  if (conversation.incomingRequest) return "Waiting for your decision";
  if (conversation.outgoingRequest) return "Request sent";
  if (conversation.state === "active") return conversation.unreadCount ? `${conversation.unreadCount} unread` : "Active";
  if (conversation.state === "nonreplyable") return "Notice · replies closed";
  return conversation.state.replace(/_/g, " ");
}

export default function InboxMessagingPanel({ onCountsChanged }: { onCountsChanged: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFromUrl = searchParams.get("conversation");
  const sourceDomain = searchParams.get("sourceDomain");
  const sourceType = searchParams.get("sourceType");
  const sourceRecordId = searchParams.get("sourceRecord");
  const sourceContextValid = sourceDomain === "code_proposals"
    && sourceType === "commune_code_revision_proposal"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceRecordId ?? "");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [preferences, setPreferences] = useState<MessagingPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [panelMessage, setPanelMessage] = useState<PanelMessage | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(sourceContextValid);
  const [handle, setHandle] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState<MessagingRecipient | null>(null);
  const [reply, setReply] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");

  const selectedId = selectedFromUrl || conversations[0]?.id || null;

  const refresh = useCallback(async () => {
    setLoading(true);
    const [conversationResult, preferenceResult] = await Promise.all([
      loadConversations("all"),
      loadMessagingPreferences(),
    ]);
    setConversations(conversationResult.items);
    setPreferences(preferenceResult.preferences);
    const warning = conversationResult.warning || preferenceResult.warning;
    if (warning) setPanelMessage({ tone: "error", text: warning });
    setLoading(false);
  }, []);

  const refreshDetail = useCallback(async (conversationId: string | null) => {
    if (!conversationId) { setDetail(null); return; }
    const result = await loadConversation(conversationId);
    setDetail(result.detail);
    if (result.warning) setPanelMessage({ tone: "error", text: result.warning });
    if (result.detail) {
      await markConversationRead(conversationId);
      onCountsChanged();
    }
  }, [onCountsChanged]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { void refreshDetail(selectedId); }, [refreshDetail, selectedId]);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      void refresh();
      void refreshDetail(selectedId);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = window.setInterval(onFocus, 45_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(timer);
    };
  }, [refresh, refreshDetail, selectedId]);

  const selectedSummary = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? detail?.conversation ?? null,
    [conversations, detail, selectedId],
  );

  function selectConversation(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set("conversation", id);
    setSearchParams(next, { replace: true });
  }

  async function savePreferences(next: MessagingPreferences) {
    setWorking(true);
    const result = await updateMessagingPreferences(next);
    setPreferences(result.preferences ?? preferences);
    setPanelMessage(result.warning
      ? { tone: "error", text: result.warning }
      : { tone: "info", text: "Private communication preferences saved." });
    setWorking(false);
  }

  async function checkRecipient() {
    setWorking(true);
    const result = await lookupMessagingRecipient(handle);
    setRecipient(result.recipient);
    setPanelMessage(result.warning ? { tone: "error", text: result.warning } : null);
    setWorking(false);
  }

  async function submitConversationRequest() {
    setWorking(true);
    const result = await requestConversation(handle, subject, body);
    if (result.warning || !result.conversationId) {
      setPanelMessage({ tone: "error", text: result.warning ?? "The conversation request could not be created." });
    } else {
      setPanelMessage({ tone: "info", text: "Conversation request sent. The recipient must accept before replies are enabled." });
      setComposeOpen(false); setHandle(""); setSubject(""); setBody(""); setRecipient(null);
      await refresh(); selectConversation(result.conversationId);
    }
    setWorking(false);
  }

  async function submitSupportRequest() {
    setWorking(true);
    const result = await startSupportConversation(subject, body);
    if (result.warning || !result.conversationId) {
      setPanelMessage({ tone: "error", text: result.warning ?? "The support conversation could not be created." });
    } else {
      setPanelMessage({ tone: "info", text: "Your private account-support conversation is in the administrator queue." });
      setSupportOpen(false); setSubject(""); setBody("");
      await refresh(); selectConversation(result.conversationId);
    }
    setWorking(false);
  }

  async function submitSourceConversation() {
    if (!sourceContextValid || !sourceDomain || !sourceType || !sourceRecordId) return;
    setWorking(true);
    const result = await startSourceLinkedConversation({ sourceDomain, sourceType, sourceRecordId, subject, body });
    if (result.warning || !result.conversationId) {
      setPanelMessage({ tone: "error", text: result.warning ?? "The source-linked conversation could not be created." });
    } else {
      setPanelMessage({ tone: "info", text: "A private conversation was opened with the other proposal participant. The proposal remains authoritative." });
      setSourceOpen(false); setSubject(""); setBody("");
      await refresh();
      const next = new URLSearchParams(searchParams);
      next.delete("sourceDomain"); next.delete("sourceType"); next.delete("sourceRecord");
      next.set("conversation", result.conversationId);
      setSearchParams(next, { replace: true });
    }
    setWorking(false);
  }

  async function respond(decision: "accept" | "decline") {
    if (!selectedId) return;
    setWorking(true);
    const warning = await respondToConversationRequest(selectedId, decision);
    setPanelMessage(warning
      ? { tone: "error", text: warning }
      : { tone: "info", text: decision === "accept" ? "Conversation accepted. Replies are now enabled." : "Conversation declined." });
    await refresh(); await refreshDetail(selectedId); onCountsChanged();
    setWorking(false);
  }

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    setWorking(true);
    const warning = await sendConversationMessage(selectedId, reply);
    setPanelMessage(warning ? { tone: "error", text: warning } : { tone: "info", text: "Private reply sent." });
    if (!warning) setReply("");
    await refresh(); await refreshDetail(selectedId); onCountsChanged();
    setWorking(false);
  }

  async function changePresentation(kind: "archive" | "mute") {
    if (!selectedId || !selectedSummary) return;
    setWorking(true);
    const warning = await setConversationPresentation(
      selectedId,
      kind === "archive" ? !selectedSummary.archivedAt : null,
      kind === "mute" ? !selectedSummary.mutedAt : null,
    );
    setPanelMessage(warning ? { tone: "error", text: warning } : { tone: "info", text: `${kind === "archive" ? "Archive" : "Mute"} setting updated.` });
    await refresh(); await refreshDetail(selectedId);
    setWorking(false);
  }

  async function changeBlock() {
    if (!selectedId || !selectedSummary) return;
    setWorking(true);
    const blocked = !selectedSummary.blockedByCurrentUser;
    const warning = await setConversationBlocked(selectedId, blocked);
    setPanelMessage(warning ? { tone: "error", text: warning } : { tone: "info", text: blocked ? "Account blocked. Direct and source-linked conversations were closed." : "Account unblocked. Closed conversations stay closed." });
    await refresh(); await refreshDetail(selectedId); onCountsChanged();
    setWorking(false);
  }

  async function submitReport() {
    if (!selectedId) return;
    setWorking(true);
    const latestOtherMessage = [...(detail?.messages ?? [])].reverse().find((message) => !message.senderSelf);
    const warning = await reportConversation(selectedId, latestOtherMessage?.id ?? null, reportReason, reportDetails);
    setPanelMessage(warning ? { tone: "error", text: warning } : { tone: "info", text: "Report submitted to the case-bound message moderation queue." });
    if (!warning) { setReportOpen(false); setReportDetails(""); }
    setWorking(false);
  }

  return <div className="inbox-messaging-panel">
    <section className="account-messaging-privacy" aria-label="Private messaging privacy">
      <h3>Governed private communication</h3>
      <p>Messages are stored in Supabase and are not end-to-end encrypted. Only participants can normally read them. Moderators can access a reported message only through an assigned, audited case.</p>
      <p>No message grants proposal, review, moderation, economic, or account authority. Attachments, HTML, embeds, and anonymous messages are not supported.</p>
    </section>

    {panelMessage && <p className={panelMessage.tone === "error" ? "warning-callout" : "message"} role="status">{panelMessage.text}</p>}

    {preferences && <details className="account-messaging-preferences">
      <summary>Private communication controls</summary>
      <p>{preferences.ordinaryMessagingEligible ? "Your account is eligible for adult account-to-account messaging." : "Direct account messaging is unavailable under the current participation, age, guardian, lifecycle, or restriction state. Account support and required notices remain separate."}</p>
      <label><input type="checkbox" checked={preferences.receiveDirectRequests} disabled={working || !preferences.ordinaryMessagingEligible} onChange={(event) => void savePreferences({ ...preferences, receiveDirectRequests: event.target.checked })} /> Receive new account-to-account conversation requests</label>
      <label><input type="checkbox" checked={preferences.allowSourceLinkedMessages} disabled={working} onChange={(event) => void savePreferences({ ...preferences, allowSourceLinkedMessages: event.target.checked })} /> Allow messages from participants in a shared source workflow</label>
      <label><input type="checkbox" checked={preferences.receiveOptionalAnnouncements} disabled={working} onChange={(event) => void savePreferences({ ...preferences, receiveOptionalAnnouncements: event.target.checked })} /> Receive optional administrator announcements</label>
    </details>}

    <div className="button-row">
      <button className="button-primary" type="button" onClick={() => { setComposeOpen((open) => !open); setSupportOpen(false); setSourceOpen(false); }} disabled={!preferences?.ordinaryMessagingEligible}>Start a private conversation</button>
      <button type="button" onClick={() => { setSupportOpen((open) => !open); setComposeOpen(false); setSourceOpen(false); }}>Contact account support</button>
      {sourceContextValid && <button type="button" onClick={() => { setSourceOpen((open) => !open); setComposeOpen(false); setSupportOpen(false); }} disabled={!preferences?.ordinaryMessagingEligible}>Message proposal participant</button>}
      <button type="button" onClick={() => void refresh()} disabled={loading}>Refresh conversations</button>
    </div>

    {(composeOpen || supportOpen || sourceOpen) && <form className="account-messaging-compose" onSubmit={(event) => { event.preventDefault(); void (composeOpen ? submitConversationRequest() : sourceOpen ? submitSourceConversation() : submitSupportRequest()); }}>
      <h3>{composeOpen ? "Request a professional conversation" : sourceOpen ? "Message the other proposal participant" : "Start a private account-support thread"}</h3>
      {sourceOpen && <p className="boundary-note">This conversation references the selected code proposal. It does not copy proposal code, change proposal state, or grant proposal decision authority.</p>}
      {composeOpen && <label><span>Public Commons handle</span><div className="account-messaging-handle-row"><input value={handle} maxLength={80} placeholder="@public-handle" onChange={(event) => { setHandle(event.target.value); setRecipient(null); }} required /><button type="button" onClick={() => void checkRecipient()} disabled={working || !handle.trim()}>Check recipient</button></div></label>}
      {composeOpen && recipient && <p className="boundary-note">{recipient.canReceiveRequest ? `${recipient.profile?.displayName || `@${recipient.profile?.handle}`} can receive a request.` : "This account is unavailable for new conversation requests. No private reason is disclosed."}</p>}
      <label><span>Subject</span><input value={subject} maxLength={160} onChange={(event) => setSubject(event.target.value)} required /></label>
      <label><span>Plain-text message</span><textarea value={body} maxLength={8000} rows={7} onChange={(event) => setBody(event.target.value)} required /></label>
      <p className="boundary-note">Do not include secrets, credentials, unnecessary personal information, proposal code, or private attachments.</p>
      <button type="submit" disabled={working || !subject.trim() || !body.trim() || (composeOpen && !recipient?.canReceiveRequest)}>{working ? "Working…" : composeOpen ? "Send conversation request" : sourceOpen ? "Open source-linked conversation" : "Open support conversation"}</button>
    </form>}

    <div className="account-messaging-workspace">
      <aside className="account-messaging-list" aria-label="Private conversations">
        <h3>Conversations</h3>
        {loading && <p>Loading conversations…</p>}
        {!loading && !conversations.length && <p>No private conversations yet.</p>}
        {conversations.map((conversation) => <button type="button" className={conversation.id === selectedId ? "account-messaging-list__item account-messaging-list__item--active" : "account-messaging-list__item"} onClick={() => selectConversation(conversation.id)} key={conversation.id}>
          <strong>{conversation.subject}</strong>
          <span>{profileLabel(conversation.counterpart)}</span>
          <span>{stateLabel(conversation)} · {formatTime(conversation.lastMessageAt)}</span>
        </button>)}
      </aside>

      <section className="account-conversation-detail" aria-live="polite">
        {!selectedId && <div className="account-communications-empty"><h3>Select a conversation</h3><p>Private message bodies appear only after the participant-scoped conversation RPC succeeds.</p></div>}
        {selectedId && !detail && <p>Loading participant-scoped conversation…</p>}
        {detail && <>
          <header><p className="eyebrow">{detail.conversation.type.replace(/_/g, " ")}</p><h3>{detail.conversation.subject}</h3><p>{stateLabel(detail.conversation)}</p></header>
          {detail.conversation.sourceDomain && <p className="boundary-note">Source context: {detail.conversation.sourceDomain.replace(/_/g, " ")} · {detail.conversation.sourceType?.replace(/_/g, " ")}. The source workflow remains authoritative.</p>}
          {!detail.conversation.sourceAvailable && <p className="boundary-note">The linked source is unavailable. This conversation does not recreate source access or authority.</p>}
          {detail.conversation.incomingRequest && <div className="button-row"><button type="button" onClick={() => void respond("accept")} disabled={working}>Accept request</button><button type="button" onClick={() => void respond("decline")} disabled={working}>Decline</button></div>}
          <div className="account-message-thread">
            {detail.messages.map((message) => <article className={message.senderSelf ? "account-message account-message--self" : "account-message"} key={message.id}>
              <p className="account-message__sender">{message.senderSelf ? "You" : message.sender?.displayName || (message.sender?.handle ? `@${message.sender.handle}` : message.senderKind === "administrator" ? "Elysia Ecobotics administrator" : "Former or private account")}</p>
              <p className="account-message__body">{message.body}</p>
              <p className="account-message__time">{formatTime(message.createdAt)}{message.editedAt ? " · edited" : ""}</p>
            </article>)}
          </div>
          {detail.conversation.canReply && <form className="account-message-reply" onSubmit={(event) => { event.preventDefault(); void sendReply(); }}><label><span>Plain-text reply</span><textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={8000} rows={5} required /></label><button type="submit" disabled={working || !reply.trim()}>Send reply</button></form>}
          <div className="button-row account-conversation-controls">
            <button type="button" disabled={working} onClick={() => void changePresentation("archive")}>{detail.conversation.archivedAt ? "Unarchive" : "Archive"}</button>
            <button type="button" disabled={working} onClick={() => void changePresentation("mute")}>{detail.conversation.mutedAt ? "Unmute" : "Mute"}</button>
            {detail.conversation.type !== "system_notice" && detail.conversation.type !== "admin_announcement" && <button type="button" disabled={working} onClick={() => void changeBlock()}>{detail.conversation.blockedByCurrentUser ? "Unblock account" : "Block account"}</button>}
            <button type="button" disabled={working} onClick={() => setReportOpen((open) => !open)}>Report</button>
          </div>
          {reportOpen && <form className="account-message-report" onSubmit={(event) => { event.preventDefault(); void submitReport(); }}><h4>Report this conversation</h4><label><span>Reason</span><select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="threats">Threats</option><option value="hate_or_abuse">Hate or abuse</option><option value="sexual_content">Sexual content</option><option value="privacy_or_pii">Privacy or personal information</option><option value="fraud_or_impersonation">Fraud or impersonation</option><option value="malicious_link">Malicious link</option><option value="other">Other</option></select></label><label><span>Optional details</span><textarea value={reportDetails} maxLength={2000} rows={4} onChange={(event) => setReportDetails(event.target.value)} /></label><button type="submit" disabled={working}>Submit report</button></form>}
          <details><summary>Technical context</summary><dl className="mini-facts"><div><dt>Conversation type</dt><dd>{detail.conversation.type.replace(/_/g, " ")}</dd></div><div><dt>State</dt><dd>{detail.conversation.state}</dd></div><div><dt>Storage</dt><dd>Supabase · participant scoped</dd></div><div><dt>Encryption claim</dt><dd>Not end-to-end encrypted</dd></div></dl></details>
        </>}
      </section>
    </div>
  </div>;
}
