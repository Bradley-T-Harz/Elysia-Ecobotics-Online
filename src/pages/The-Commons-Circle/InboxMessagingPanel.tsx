import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { structurallyEqual, useCoordinatedRefresh } from "../../shared/hooks/useCoordinatedRefresh";
import {
  loadConversation,
  loadConversations,
  loadMessagingPreferences,
  markConversationRead,
  reportConversation,
  respondToConversationRequest,
  sendConversationMessage,
  setConversationBlocked,
  setConversationPresentation,
  startSourceLinkedConversation,
  startSupportConversation,
  type ConversationDetail,
  type ConversationSummary,
  type MessagingPreferences,
} from "./accountCommunicationsApi";

type PanelMessage = { tone: "info" | "error"; text: string };

type MessagingWorkspace = {
  conversations: ConversationSummary[];
  detail: ConversationDetail | null;
  preferences: MessagingPreferences | null;
  warning: string | null;
};

const emptyMessagingWorkspace: MessagingWorkspace = {
  conversations: [],
  detail: null,
  preferences: null,
  warning: null,
};

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

export default function InboxMessagingPanel({
  onCountsChanged,
  conversationId = null,
}: {
  onCountsChanged: () => void;
  conversationId?: string | null;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedFromUrl = conversationId ?? searchParams.get("conversation");
  const sourceDomain = searchParams.get("sourceDomain");
  const sourceType = searchParams.get("sourceType");
  const sourceRecordId = searchParams.get("sourceRecord");
  const sourceContextValid = sourceDomain === "code_proposals"
    && sourceType === "commune_code_revision_proposal"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceRecordId ?? "");
  const [working, setWorking] = useState(false);
  const [panelMessage, setPanelMessage] = useState<PanelMessage | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(sourceContextValid);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const acknowledgedReadRef = useRef(new Map<string, string>());

  const loadMessagingWorkspace = useCallback(async (): Promise<MessagingWorkspace> => {
    const [conversationResult, preferenceResult] = await Promise.all([
      loadConversations("all"),
      loadMessagingPreferences(),
    ]);
    const selectedConversationId = selectedFromUrl || null;
    const detailResult = selectedConversationId
      ? await loadConversation(selectedConversationId)
      : { detail: null, warning: null };
    return {
      conversations: conversationResult.items,
      detail: detailResult.detail,
      preferences: preferenceResult.preferences,
      warning: conversationResult.warning || preferenceResult.warning || detailResult.warning,
    };
  }, [selectedFromUrl]);

  const {
    data: workspace,
    phase,
    initialLoading: loading,
    backgroundRefreshing,
    busy,
    refresh,
    runExclusive,
    updateData: setWorkspace,
  } = useCoordinatedRefresh<MessagingWorkspace>({
    resourceKey: selectedFromUrl ?? "conversation-list",
    load: loadMessagingWorkspace,
    initialData: emptyMessagingWorkspace,
    pollIntervalMs: 45_000,
    pollEnabled: true,
    classify: (next) => next.warning ? "degraded" : "settled",
    isEqual: structurallyEqual,
  });

  const conversations = workspace.conversations;
  const detail = workspace.detail;
  const preferences = workspace.preferences;
  const selectedId = selectedFromUrl || null;

  useEffect(() => {
    if (!workspace.warning) return;
    setPanelMessage({ tone: "error", text: workspace.warning });
  }, [workspace.warning]);

  const selectedSummary = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? detail?.conversation ?? null,
    [conversations, detail, selectedId],
  );

  useEffect(() => {
    if (!selectedId || !detail || !selectedSummary || selectedSummary.unreadCount <= 0) return;
    if (document.visibilityState !== "visible" || phase === "initialLoading" || phase === "backgroundRefreshing") return;
    const newestIncomingMessage = [...detail.messages].reverse().find((message) => !message.senderSelf && !message.deletedAt);
    if (!newestIncomingMessage || acknowledgedReadRef.current.get(selectedId) === newestIncomingMessage.id) return;
    acknowledgedReadRef.current.set(selectedId, newestIncomingMessage.id);
    void runExclusive(async () => {
      const warning = await markConversationRead(selectedId);
      if (warning) {
        acknowledgedReadRef.current.delete(selectedId);
        setPanelMessage({ tone: "error", text: warning });
        return;
      }
      setWorkspace((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) => conversation.id === selectedId
          ? { ...conversation, unreadCount: 0 }
          : conversation),
        detail: current.detail?.conversation.id === selectedId
          ? { ...current.detail, conversation: { ...current.detail.conversation, unreadCount: 0 } }
          : current.detail,
      }));
      onCountsChanged();
    });
  }, [detail, onCountsChanged, phase, runExclusive, selectedId, selectedSummary, setWorkspace]);

  function selectConversation(id: string) {
    navigate(`/commons-circle/signals/inbox/conversations/${id}`);
  }

  async function runMessagingOperation<T>(operation: () => Promise<T>) {
    let result!: T;
    await runExclusive(async () => { result = await operation(); });
    return result;
  }

  async function submitSupportRequest() {
    setWorking(true);
    const result = await runMessagingOperation(() => startSupportConversation(subject, body));
    if (result.warning || !result.conversationId) {
      setPanelMessage({ tone: "error", text: result.warning ?? "The support conversation could not be created." });
    } else {
      setPanelMessage({ tone: "info", text: "Your private account-support conversation is in the administrator queue." });
      setSupportOpen(false); setSubject(""); setBody("");
      selectConversation(result.conversationId);
    }
    setWorking(false);
  }

  async function submitSourceConversation() {
    if (!sourceContextValid || !sourceDomain || !sourceType || !sourceRecordId) return;
    setWorking(true);
    const result = await runMessagingOperation(() => startSourceLinkedConversation({ sourceDomain, sourceType, sourceRecordId, subject, body }));
    if (result.warning || !result.conversationId) {
      setPanelMessage({ tone: "error", text: result.warning ?? "The source-linked conversation could not be created." });
    } else {
      setPanelMessage({ tone: "info", text: "A private conversation was opened with the other proposal participant. The proposal remains authoritative." });
      setSourceOpen(false); setSubject(""); setBody("");
      selectConversation(result.conversationId);
    }
    setWorking(false);
  }

  async function respond(decision: "accept" | "decline") {
    if (!selectedId) return;
    setWorking(true);
    const warning = await runMessagingOperation(() => respondToConversationRequest(selectedId, decision));
    setPanelMessage(warning
      ? { tone: "error", text: warning }
      : { tone: "info", text: decision === "accept" ? "Conversation accepted. Replies are now enabled." : "Conversation declined." });
    await refresh("mutation"); onCountsChanged();
    setWorking(false);
  }

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    setWorking(true);
    const warning = await runMessagingOperation(() => sendConversationMessage(selectedId, reply));
    setPanelMessage(warning ? { tone: "error", text: warning } : { tone: "info", text: "Private reply sent." });
    if (!warning) setReply("");
    await refresh("mutation"); onCountsChanged();
    setWorking(false);
  }

  async function changePresentation(kind: "archive" | "mute") {
    if (!selectedId || !selectedSummary) return;
    setWorking(true);
    const warning = await runMessagingOperation(() => setConversationPresentation(
      selectedId,
      kind === "archive" ? !selectedSummary.archivedAt : null,
      kind === "mute" ? !selectedSummary.mutedAt : null,
    ));
    setPanelMessage(warning ? { tone: "error", text: warning } : { tone: "info", text: `${kind === "archive" ? "Archive" : "Mute"} setting updated.` });
    await refresh("mutation");
    setWorking(false);
  }

  async function changeBlock() {
    if (!selectedId || !selectedSummary) return;
    setWorking(true);
    const blocked = !selectedSummary.blockedByCurrentUser;
    const warning = await runMessagingOperation(() => setConversationBlocked(selectedId, blocked));
    setPanelMessage(warning ? { tone: "error", text: warning } : { tone: "info", text: blocked ? "Account blocked. Direct and source-linked conversations were closed." : "Account unblocked. Closed conversations stay closed." });
    await refresh("mutation"); onCountsChanged();
    setWorking(false);
  }

  async function submitReport() {
    if (!selectedId) return;
    setWorking(true);
    const latestOtherMessage = [...(detail?.messages ?? [])].reverse().find((message) => !message.senderSelf);
    const warning = await runMessagingOperation(() => reportConversation(selectedId, latestOtherMessage?.id ?? null, reportReason, reportDetails));
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

    {preferences && <section className="account-messaging-preferences">
      <h3>Messaging status</h3>
      <p>{preferences.canInitiateDirectConversation
        ? "New governed conversation requests are available."
        : preferences.canUseExistingConversations
          ? "Existing participant conversations remain available; new requests require messaging access."
          : "Messaging is unavailable for this account."}</p>
      {!preferences.acceptsIncomingDirectRequests && preferences.canInitiateDirectConversation
        && <p>You are not accepting new conversation requests, but you may still contact eligible public profiles.</p>}
    </section>}

    <div className="button-row">
      <button type="button" onClick={() => { setSupportOpen((open) => !open); setSourceOpen(false); }}>Contact account support</button>
      {sourceContextValid && <button type="button" onClick={() => { setSourceOpen((open) => !open); setSupportOpen(false); }} disabled={!preferences?.canInitiateDirectConversation}>Message proposal participant</button>}
      <button type="button" onClick={() => void refresh("manual")} disabled={busy}>Refresh conversations</button>
      {backgroundRefreshing && <span className="boundary-note" aria-live="polite">Refreshing quietly…</span>}
    </div>

    {(supportOpen || sourceOpen) && <form className="account-messaging-compose" onSubmit={(event) => { event.preventDefault(); void (sourceOpen ? submitSourceConversation() : submitSupportRequest()); }}>
      <h3>{sourceOpen ? "Message the other proposal participant" : "Start a private account-support thread"}</h3>
      {sourceOpen && <p className="boundary-note">This conversation references the selected code proposal. It does not copy proposal code, change proposal state, or grant proposal decision authority.</p>}
      <label><span>Subject</span><input value={subject} maxLength={160} onChange={(event) => setSubject(event.target.value)} required /></label>
      <label><span>Plain-text message</span><textarea value={body} maxLength={8000} rows={7} onChange={(event) => setBody(event.target.value)} required /></label>
      <p className="boundary-note">Do not include secrets, credentials, unnecessary personal information, proposal code, or private attachments.</p>
      <button type="submit" disabled={working || !subject.trim() || !body.trim()}>{working ? "Working…" : sourceOpen ? "Open source-linked conversation" : "Open support conversation"}</button>
    </form>}

    <div className="account-messaging-workspace">
      <aside className="account-messaging-list" aria-label="Private conversations">
        <h3>Conversations</h3>
        {!loading && conversations.length > 0 && <dl className="mini-facts">
          <div><dt>Incoming requests</dt><dd>{conversations.filter((item) => item.incomingRequest).length}</dd></div>
          <div><dt>Requests sent</dt><dd>{conversations.filter((item) => item.outgoingRequest).length}</dd></div>
          <div><dt>Recent contacts</dt><dd>{conversations.filter((item) => item.state === "active" && item.counterpart).length}</dd></div>
        </dl>}
        {loading && <p>Loading conversations…</p>}
        {!loading && !conversations.length && <p>No private conversations yet.</p>}
        {conversations.map((conversation) => <button type="button" className={conversation.id === selectedId ? "account-messaging-list__item account-messaging-list__item--active" : "account-messaging-list__item"} onClick={() => selectConversation(conversation.id)} key={conversation.id}>
          <strong>{conversation.subject}</strong>
          <span>{profileLabel(conversation.counterpart)}</span>
          <span>{stateLabel(conversation)} · {formatTime(conversation.lastMessageAt)}</span>
        </button>)}
      </aside>

      {selectedId && <section className="account-conversation-detail" aria-live="polite">
        {selectedId && !detail && <p>Loading participant-scoped conversation…</p>}
        {detail && <>
          <header><p className="eyebrow">{detail.conversation.type.replace(/_/g, " ")}</p><h3>{detail.conversation.subject}</h3><p>{stateLabel(detail.conversation)}</p></header>
          {detail.conversation.outgoingRequest && <p className="boundary-note">Request awaiting response. The recipient must accept before participant replies are enabled.</p>}
          {detail.conversation.incomingRequest && <p className="boundary-note">This member is requesting a private conversation. Accept or decline before replying.</p>}
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
      </section>}
    </div>
  </div>;
}
