import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../shared/auth/useAuth";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import {
  loadMessagingPreferences,
  updateMessagingPreferences,
  type MessagingPreferences,
} from "./accountCommunicationsApi";

export default function MessagingSettingsPage() {
  const location = useLocation();
  const { userId, loading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<MessagingPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    if (!userId) {
      setPreferences(null);
      setMessage(null);
      return;
    }
    setLoading(true);
    const result = await loadMessagingPreferences();
    setPreferences(result.preferences);
    setMessage(result.warning);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void loadPreferences(); }, [loadPreferences]);

  async function save(next: MessagingPreferences) {
    const previous = preferences;
    setWorking(true);
    setMessage(null);
    setPreferences(next);
    const result = await updateMessagingPreferences(next);
    setPreferences(result.preferences ?? previous);
    setMessage(result.warning ?? "Messaging settings saved.");
    setWorking(false);
  }

  const status = !userId ? "Sign-in required"
    : preferences?.ownerMessagingStatus === "enabled" ? "Messaging available"
      : preferences?.ownerMessagingStatus === "beta_access_required" ? "Controlled messaging access required"
        : preferences?.ownerMessagingStatus === "temporarily_unavailable" ? "Messaging temporarily unavailable"
          : "Messaging account needs attention";

  return <div className="page-stack commons-circle-page commons-account-communications-page">
    <PageHero eyebrow="Private communication" title="Messaging settings">
      <p>Choose which governed conversation requests your Website Account accepts. These preferences do not grant source, review, moderation, or economic authority.</p>
    </PageHero>

    <section className="section-card signal-detail-navigation">
      <div className="section-heading section-heading--inline">
        <div><p className="eyebrow">Inbox settings</p><h2>{status}</h2></div>
        <div className="button-row">
          <Link className="button-link" to="/commons-circle/signals/inbox?view=messages">Back to Messages</Link>
          <Link className="button-link button-link--primary" to="/commons-circle/signals/inbox/new">Start a conversation</Link>
        </div>
      </div>
    </section>

    <section className="section-card">
      <AuthPanel
        onMessage={setMessage}
        onAuthChanged={loadPreferences}
        copy={{
          eyebrow: "Website Account",
          title: userId ? "Private messaging account active" : "Sign in to manage messaging",
          description: "Messaging preferences belong to your private Website Account.",
          signedOutText: "No active website session.",
          confirmationPath: `${location.pathname}${location.search}`,
          confirmationCopy: "If confirmation is required, return to these messaging settings afterward.",
        }}
      />
    </section>

    {!authLoading && userId && <section className="section-card account-messaging-preferences">
      <div className="section-heading"><p className="eyebrow">Your choices</p><h2>Conversation permissions</h2></div>
      {loading && <p aria-live="polite">Loading messaging settings…</p>}
      {!loading && preferences && <>
        <dl className="mini-facts">
          <div><dt>Published-profile search</dt><dd>{preferences.canSearchPublishedProfiles ? "Available" : "Unavailable"}</dd></div>
          <div><dt>Start new conversations</dt><dd>{preferences.canInitiateDirectConversation ? "Available" : "Unavailable"}</dd></div>
          <div><dt>Incoming requests</dt><dd>{preferences.acceptsIncomingDirectRequests ? "Enabled" : "Disabled"}</dd></div>
          <div><dt>Existing conversations</dt><dd>{preferences.canUseExistingConversations ? "Available" : "Unavailable"}</dd></div>
          <div><dt>Launch mode</dt><dd>{preferences.messagingLaunchMode === "controlled_beta" ? "Controlled beta" : preferences.messagingLaunchMode === "general_availability" ? "General availability" : "Disabled"}</dd></div>
        </dl>
        {preferences.ownerMessagingStatus === "beta_access_required" && <>
          <p>Your account can search published profiles, but it is not enrolled for controlled messaging access.</p>
          <div className="button-row"><Link className="button-link" to="/commons-circle/signals/inbox?view=messages">Contact account support</Link></div>
        </>}
        {preferences.ownerMessagingStatus === "account_attention_required" && <>
          <p>Your Website Account needs attention before private messaging can be used.</p>
          <div className="button-row"><Link className="button-link" to="/commons-circle/setup">Open account setup</Link></div>
        </>}
        {preferences.ownerMessagingStatus === "restricted_or_unavailable" && <p>Messaging is unavailable for this account. Contact account support if you believe this is unexpected.</p>}
        {preferences.ownerMessagingStatus === "temporarily_unavailable" && <p>New messaging is temporarily disabled. Existing participant conversations remain governed separately.</p>}
        {!preferences.acceptsIncomingDirectRequests && preferences.canInitiateDirectConversation
          && <p className="message">You are not accepting new conversation requests, but you may still contact eligible public profiles.</p>}
        <label>
          <input
            type="checkbox"
            checked={preferences.receiveDirectRequests}
            disabled={working || !preferences.canInitiateDirectConversation}
            onChange={(event) => void save({ ...preferences, receiveDirectRequests: event.target.checked })}
          />
          Allow eligible members to send me conversation requests
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.allowSourceLinkedMessages}
            disabled={working}
            onChange={(event) => void save({ ...preferences, allowSourceLinkedMessages: event.target.checked })}
          />
          Allow source-linked conversations from participants in a shared workflow
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.receiveOptionalAnnouncements}
            disabled={working}
            onChange={(event) => void save({ ...preferences, receiveOptionalAnnouncements: event.target.checked })}
          />
          Receive optional administrator announcements
        </label>
        <p className="boundary-note">Blocks, participation rules, account safety restrictions, source authority, and mandatory notices continue to override user preferences where applicable. Private reasons are not displayed here.</p>
      </>}
      {message && <p className="message" role="status">{message}</p>}
    </section>}

    <WarningCallout title="Private communication boundary">
      <p>Messages are stored in Supabase and are not end-to-end encrypted. Do not send credentials, secrets, unnecessary personal information, private files, proposal code, or protected economic details.</p>
    </WarningCallout>
  </div>;
}
