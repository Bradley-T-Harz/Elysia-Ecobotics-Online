import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../shared/auth/useAuth";
import CommonsAvatarViewer from "../../shared/components/CommonsAvatarViewer";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import {
  loadMessagingPreferences,
  newAccountCommunicationClientId,
  requestConversation,
  resolveMessagingDestination,
  type ConversationRequestClientIds,
  type MessagingDestination,
  type MessagingPreferences,
} from "./accountCommunicationsApi";

function normalizePublicHandle(value: string) {
  const handle = value.trim().replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{1,79}$/.test(handle) ? `@${handle}` : "";
}

function newClientIds(): ConversationRequestClientIds {
  return {
    requestId: newAccountCommunicationClientId(),
    messageId: newAccountCommunicationClientId(),
  };
}

function destinationMessage(destination: MessagingDestination) {
  if (destination.state === "existing_active") return "Opening your existing conversation.";
  if (destination.state === "existing_pending_outbound") return "Opening the request that is awaiting a response.";
  if (destination.state === "existing_pending_inbound") return "Opening the incoming request so you can accept or decline it.";
  if (destination.state === "can_request") return "This published Commons Profile can receive a conversation request.";
  return "Private messaging is unavailable for this profile. The reason is intentionally not disclosed.";
}

export default function NewConversationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const initialHandle = useMemo(() => normalizePublicHandle(searchParams.get("recipient") ?? ""), [searchParams]);
  const [handle, setHandle] = useState(initialHandle);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preferences, setPreferences] = useState<MessagingPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesWarning, setPreferencesWarning] = useState<string | null>(null);
  const [destination, setDestination] = useState<MessagingDestination | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const handleInputRef = useRef<HTMLInputElement>(null);
  const clientIdsRef = useRef<ConversationRequestClientIds>(newClientIds());

  useEffect(() => { handleInputRef.current?.focus(); }, []);

  const loadPreferences = useCallback(async () => {
    if (!userId) {
      setPreferences(null);
      setPreferencesWarning(null);
      return;
    }
    setPreferencesLoading(true);
    const result = await loadMessagingPreferences();
    setPreferences(result.preferences);
    setPreferencesWarning(result.warning);
    setPreferencesLoading(false);
  }, [userId]);

  useEffect(() => { void loadPreferences(); }, [loadPreferences]);

  function changeRecipient(update: () => void) {
    clientIdsRef.current = newClientIds();
    setDestination(null);
    setMessage(null);
    update();
  }

  function changeRequestContent(update: () => void) {
    clientIdsRef.current = newClientIds();
    setMessage(null);
    update();
  }

  async function checkRecipient() {
    const normalizedHandle = normalizePublicHandle(handle);
    if (!normalizedHandle) {
      setDestination(null);
      setMessage("Enter one exact published Commons handle, such as @member-handle.");
      return;
    }
    setWorking(true);
    setMessage(null);
    const result = await resolveMessagingDestination(normalizedHandle);
    setWorking(false);
    if (result.warning || !result.destination) {
      setDestination(null);
      setMessage(result.warning ?? "Recipient resolution is temporarily unavailable.");
      return;
    }
    setHandle(normalizedHandle);
    setDestination(result.destination);
    setMessage(destinationMessage(result.destination));
    if (result.destination.state.startsWith("existing_") && result.destination.deepLink) {
      navigate(result.destination.deepLink, { replace: true });
    }
  }

  async function submitRequest() {
    if (destination?.state !== "can_request" || !subject.trim() || !body.trim()) return;
    const normalizedHandle = normalizePublicHandle(handle);
    if (!normalizedHandle || destination.profile?.handle !== normalizedHandle.slice(1)) {
      setDestination(null);
      setMessage("Check the recipient again before sending this request.");
      return;
    }
    setWorking(true);
    const result = await requestConversation(
      normalizedHandle,
      subject,
      body,
      clientIdsRef.current,
    );
    if (result.deepLink) {
      navigate(result.deepLink, { replace: true });
      return;
    }

    // A concurrent request can win after resolution. Re-resolve once so a
    // lost response or uniqueness race opens the authoritative destination.
    const resolved = await resolveMessagingDestination(normalizedHandle);
    setWorking(false);
    if (resolved.destination?.state.startsWith("existing_") && resolved.destination.deepLink) {
      navigate(resolved.destination.deepLink, { replace: true });
      return;
    }
    setMessage(result.warning ?? resolved.warning ?? "The conversation request could not be created.");
  }

  const accountEligible = preferences?.ordinaryMessagingEligible === true;

  return <div className="page-stack commons-circle-page commons-account-communications-page">
    <PageHero eyebrow="Governed private communication" title="Start a private conversation">
      <p>Contact one eligible member by their exact published Commons handle. This page does not provide an account directory or expose private identity.</p>
      <p>A request does not grant proposal, review, moderation, economic, or account authority.</p>
    </PageHero>

    <section className="section-card signal-detail-navigation">
      <div className="section-heading section-heading--inline"><div><p className="eyebrow">Focused Inbox task</p><h2>New conversation request</h2></div><Link className="button-link" to="/commons-circle/signals/inbox?view=messages">Back to Messages</Link></div>
    </section>

    <section className="section-card">
      <AuthPanel
        onMessage={setMessage}
        onAuthChanged={loadPreferences}
        copy={{
          eyebrow: "Website Account",
          title: userId ? "Private messaging account active" : "Sign in to contact this member",
          description: "Messaging belongs to the authenticated Website Account and uses published public Commons handles for safe routing.",
          signedOutText: "No active website session.",
          confirmationPath: `${location.pathname}${location.search}`,
          confirmationCopy: "If confirmation is required, use the confirmation link to return to this exact recipient flow.",
        }}
      />
    </section>

    {!authLoading && userId && <section className="section-card account-messaging-compose">
      <div className="section-heading"><p className="eyebrow">Exact-handle discovery</p><h2>Check one public recipient</h2></div>
      {preferencesLoading ? <p aria-live="polite">Checking your private communication eligibility…</p>
        : preferencesWarning ? <p className="warning-callout" role="status">Messaging preferences are temporarily unavailable. Recipient checks and sending remain disabled until that contract loads safely.</p>
          : preferences && <div className="account-messaging-eligibility">
            <p>{accountEligible ? "Your account is generally eligible for adult account-to-account messaging." : "Direct account messaging is unavailable under the current broad participation or account-safety state."}</p>
            <p>{preferences.receiveDirectRequests ? "Your account currently accepts eligible direct conversation requests." : "Your account does not currently accept new direct conversation requests. You may change this in Messages settings."}</p>
            <p>Blocks and safety restrictions always override preferences. Detailed private reasons are never disclosed.</p>
          </div>}

      <label><span>Exact public Commons handle</span><div className="account-messaging-handle-row">
        <input
          ref={handleInputRef}
          value={handle}
          maxLength={81}
          autoComplete="off"
          spellCheck={false}
          placeholder="@public-handle"
          onChange={(event) => changeRecipient(() => setHandle(event.target.value))}
        />
        <button type="button" onClick={() => void checkRecipient()} disabled={working || !accountEligible || !handle.trim()}>Check recipient</button>
      </div></label>
      <p className="boundary-note">Only an exact published Commons handle is checked. Unknown, private, opted-out, restricted, blocked, self, deleted, and cooldown cases use the same unavailable response.</p>

      {message && <p className={destination?.state === "can_request" ? "message" : "boundary-note"} role="status">{message}</p>}

      {destination?.state === "can_request" && destination.profile && <article className="commons-signal-card account-messaging-recipient-card">
        <CommonsAvatarViewer
          src={destination.profile.avatarUrl}
          alt="Public Commons avatar"
          fallback={(destination.profile.displayName || destination.profile.handle || "C").slice(0, 1).toUpperCase()}
          viewLabel="View public Commons profile picture"
        />
        <div><p className="eyebrow">Published Commons Profile</p><h3>{destination.profile.displayName || `@${destination.profile.handle}`}</h3><p>@{destination.profile.handle}</p>{destination.profile.shortPublicBio && <p>{destination.profile.shortPublicBio}</p>}</div>
      </article>}

      {destination?.state === "can_request" && <form onSubmit={(event) => { event.preventDefault(); void submitRequest(); }}>
        <label><span>Subject</span><input value={subject} maxLength={160} onChange={(event) => changeRequestContent(() => setSubject(event.target.value))} required /></label>
        <label><span>Plain-text first message</span><textarea value={body} maxLength={8000} rows={8} onChange={(event) => changeRequestContent(() => setBody(event.target.value))} required /></label>
        <p className="boundary-note">Do not include credentials, secrets, unnecessary personal information, proposal code, private files, or economic details. Messages are stored in Supabase and are not end-to-end encrypted.</p>
        <button className="button-primary" type="submit" disabled={working || !subject.trim() || !body.trim()}>{working ? "Sending safely…" : "Send conversation request"}</button>
      </form>}
    </section>}

    <WarningCallout title="Privacy-first discovery"><p>This flow does not search display names, list accounts, reveal block or moderation state, or create a conversation before explicit confirmation.</p></WarningCallout>
  </div>;
}
