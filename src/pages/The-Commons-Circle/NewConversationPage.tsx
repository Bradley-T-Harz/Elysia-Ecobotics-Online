import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../shared/auth/useAuth";
import CommonsAvatarViewer from "../../shared/components/CommonsAvatarViewer";
import PageHero from "../../shared/components/PageHero";
import {
  friendlyIdentityError,
  searchMessagingPublicProfiles,
} from "../../shared/participation/participationClient";
import type { MessagingPublicProfileSearchItem } from "../../shared/participation/participationTypes";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import {
  loadConversations,
  loadMessagingPreferences,
  newAccountCommunicationClientId,
  requestConversation,
  resolveMessagingDestination,
  type ConversationRequestClientIds,
  type ConversationSummary,
  type MessagingDestination,
  type MessagingPreferences,
} from "./accountCommunicationsApi";
import InboxSectionNavigation from "./InboxSectionNavigation";

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
  return "This profile is unavailable for a new private conversation.";
}

function profileLabel(profile: MessagingPublicProfileSearchItem) {
  return profile.displayName || `@${profile.handle}`;
}

export default function NewConversationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, accessToken, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const initialHandle = useMemo(() => normalizePublicHandle(searchParams.get("recipient") ?? ""), [searchParams]);
  const [query, setQuery] = useState(initialHandle);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preferences, setPreferences] = useState<MessagingPreferences | null>(null);
  const [recentConversations, setRecentConversations] = useState<ConversationSummary[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [initialWarning, setInitialWarning] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<readonly MessagingPublicProfileSearchItem[]>([]);
  const [destination, setDestination] = useState<MessagingDestination | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const clientIdsRef = useRef<ConversationRequestClientIds>(newClientIds());

  useEffect(() => { inputRef.current?.focus(); }, []);

  const loadInitialState = useCallback(async () => {
    if (!userId) {
      setPreferences(null);
      setRecentConversations([]);
      setInitialWarning(null);
      return;
    }
    setInitialLoading(true);
    const [preferenceResult, conversationResult] = await Promise.all([
      loadMessagingPreferences(),
      loadConversations("all"),
    ]);
    setPreferences(preferenceResult.preferences);
    setRecentConversations(conversationResult.items);
    setInitialWarning(preferenceResult.warning || conversationResult.warning || null);
    setInitialLoading(false);
  }, [userId]);

  useEffect(() => { void loadInitialState(); }, [loadInitialState]);

  const recentContacts = useMemo(() => {
    const seen = new Set<string>();
    return recentConversations.flatMap((conversation) => {
      const profile = conversation.counterpart;
      if (!profile?.handle || seen.has(profile.handle)) return [];
      seen.add(profile.handle);
      return [{
        handle: profile.handle,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        shortPublicBio: profile.shortPublicBio ?? null,
      } satisfies MessagingPublicProfileSearchItem];
    }).slice(0, 6);
  }, [recentConversations]);

  function beginDifferentCompose(update: () => void) {
    clientIdsRef.current = newClientIds();
    setDestination(null);
    setSearchResults([]);
    setMessage(null);
    update();
  }

  function changeRequestContent(update: () => void) {
    clientIdsRef.current = newClientIds();
    setMessage(null);
    update();
  }

  async function resolveRecipient(publicHandle: string) {
    const normalizedHandle = normalizePublicHandle(publicHandle);
    if (!normalizedHandle) {
      setDestination(null);
      setMessage("Enter a valid published Commons handle.");
      return;
    }
    if (preferences?.currentPublicHandle === normalizedHandle.slice(1)) {
      setDestination(null);
      setMessage("This is your profile. Use Messaging settings to manage your account preferences.");
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
    setQuery(normalizedHandle);
    setSearchResults([]);
    setDestination(result.destination);
    setMessage(destinationMessage(result.destination));
    if (result.destination.state.startsWith("existing_") && result.destination.deepLink) {
      navigate(result.destination.deepLink, { replace: true });
    }
  }

  async function searchOrCheckRecipient() {
    if (!preferences?.canSearchPublishedProfiles) {
      setMessage("Published-profile search is unavailable for this account. Open Messaging settings for the available account action.");
      return;
    }
    const exactHandle = normalizePublicHandle(query);
    if (query.trim().startsWith("@") && exactHandle) {
      await resolveRecipient(exactHandle);
      return;
    }
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 3) {
      setSearchResults([]);
      setDestination(null);
      setMessage("Type at least three characters, or enter an exact @handle.");
      return;
    }
    if (!accessToken) {
      setMessage("Sign in before searching published Commons Profiles.");
      return;
    }
    setWorking(true);
    setDestination(null);
    setMessage(null);
    try {
      const result = await searchMessagingPublicProfiles(accessToken, normalizedQuery);
      setSearchResults(result.items);
      setMessage(result.items.length
        ? "Choose one published profile. Messaging availability is checked only after selection."
        : "No published Commons Profiles matched that search.");
    } catch (error) {
      setSearchResults([]);
      setMessage(friendlyIdentityError(error));
    } finally {
      setWorking(false);
    }
  }

  async function submitRequest() {
    if (destination?.state !== "can_request" || !subject.trim() || !body.trim()) return;
    const normalizedHandle = normalizePublicHandle(query);
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

    const resolved = await resolveMessagingDestination(normalizedHandle);
    setWorking(false);
    if (resolved.destination?.state.startsWith("existing_") && resolved.destination.deepLink) {
      navigate(resolved.destination.deepLink, { replace: true });
      return;
    }
    setMessage(result.warning ?? resolved.warning ?? "The conversation request could not be created.");
  }

  return <div className="page-stack commons-circle-page commons-account-communications-page">
    <PageHero eyebrow="Governed private communication" title="Start a private conversation">
      <p>Search published public Commons Profiles, or enter one exact @handle. Selecting a profile checks the governed destination without exposing private account state.</p>
    </PageHero>

    <section className="section-card">
      <AuthPanel
        onMessage={setMessage}
        onAuthChanged={loadInitialState}
        copy={{
          eyebrow: "Website Account",
          title: userId ? "Private messaging account active" : "Sign in to contact this member",
          description: "Messaging belongs to the authenticated Website Account and uses published public Commons profiles for safe routing.",
          signedOutText: "No active website session.",
          confirmationPath: `${location.pathname}${location.search}`,
          confirmationCopy: "If confirmation is required, use the confirmation link to return to this exact recipient flow.",
        }}
      />
    </section>

    <InboxSectionNavigation />

    {!authLoading && userId && <section className="section-card account-messaging-compose account-messaging-discovery">
      <div className="section-heading"><p className="eyebrow">Published Commons Profiles</p><h2>Find a recipient</h2></div>
      {initialLoading ? <p aria-live="polite">Checking your messaging capabilities…</p>
        : initialWarning ? <p className="warning-callout" role="status">Messaging state is temporarily unavailable. Search and sending remain disabled until it loads safely.</p>
          : preferences && <div className="account-messaging-eligibility">
            <p>{preferences.canInitiateDirectConversation
              ? "Your account may start governed conversations with eligible published profiles."
              : preferences.canSearchPublishedProfiles
                ? "You may search published profiles. Starting a new conversation requires controlled messaging access."
                : "Published-profile search is unavailable for this account."}</p>
            {!preferences.acceptsIncomingDirectRequests && preferences.canInitiateDirectConversation
              && <p className="message">You are not accepting new conversation requests, but you may still contact eligible public profiles.</p>}
            {!preferences.canInitiateDirectConversation
              && <Link className="button-link" to="/commons-circle/signals/inbox/settings">Open Messaging settings</Link>}
          </div>}

      <form className="account-messaging-search" onSubmit={(event) => { event.preventDefault(); void searchOrCheckRecipient(); }}>
        <label>
          <span>Search public profiles or enter an exact @handle</span>
          <div className="account-messaging-handle-row">
            <input
              ref={inputRef}
              value={query}
              maxLength={80}
              autoComplete="off"
              spellCheck={false}
              placeholder="Name or @public-handle"
              onChange={(event) => beginDifferentCompose(() => setQuery(event.target.value))}
            />
            <button type="submit" disabled={working || !preferences?.canSearchPublishedProfiles || !query.trim()}>{working ? "Checking…" : "Search or check"}</button>
          </div>
        </label>
      </form>

      {recentContacts.length > 0 && <div className="account-messaging-profile-results" aria-label="Recent private-message contacts">
        <h3>Recent contacts</h3>
        <div className="account-messaging-profile-results__grid">
          {recentContacts.map((profile) => <button type="button" className="account-messaging-profile-result" key={profile.handle} onClick={() => void resolveRecipient(`@${profile.handle}`)} disabled={working}>
            <CommonsAvatarViewer src={profile.avatarUrl} alt="" fallback={profileLabel(profile).slice(0, 1).toUpperCase()} viewLabel={`View ${profileLabel(profile)} profile picture`} />
            <span><strong>{profileLabel(profile)}</strong><small>@{profile.handle}</small></span>
          </button>)}
        </div>
      </div>}

      {searchResults.length > 0 && <div className="account-messaging-profile-results" aria-label="Published Commons Profile search results">
        <h3>Published profile results</h3>
        <div className="account-messaging-profile-results__grid">
          {searchResults.map((profile) => <button type="button" className="account-messaging-profile-result" key={profile.handle} onClick={() => void resolveRecipient(`@${profile.handle}`)} disabled={working}>
            <CommonsAvatarViewer src={profile.avatarUrl} alt="" fallback={profileLabel(profile).slice(0, 1).toUpperCase()} viewLabel={`View ${profileLabel(profile)} profile picture`} />
            <span><strong>{profileLabel(profile)}</strong><small>@{profile.handle}</small>{profile.shortPublicBio && <small>{profile.shortPublicBio}</small>}</span>
          </button>)}
        </div>
      </div>}

      {message && <p className={destination?.state === "can_request" ? "message" : "boundary-note"} role="status">{message}</p>}

      {destination?.state === "can_request" && destination.profile && <article className="commons-signal-card account-messaging-recipient-card">
        <CommonsAvatarViewer
          src={destination.profile.avatarUrl}
          alt="Public Commons avatar"
          fallback={(destination.profile.displayName || destination.profile.handle || "C").slice(0, 1).toUpperCase()}
          viewLabel="View public Commons profile picture"
        />
        <div><p className="eyebrow">Selected published profile</p><h3>{destination.profile.displayName || `@${destination.profile.handle}`}</h3><p>@{destination.profile.handle}</p>{destination.profile.shortPublicBio && <p>{destination.profile.shortPublicBio}</p>}</div>
      </article>}

      {destination?.state === "can_request" && <form onSubmit={(event) => { event.preventDefault(); void submitRequest(); }}>
        <label><span>Subject</span><input value={subject} maxLength={160} onChange={(event) => changeRequestContent(() => setSubject(event.target.value))} required /></label>
        <label><span>Plain-text first message</span><textarea value={body} maxLength={8000} rows={7} onChange={(event) => changeRequestContent(() => setBody(event.target.value))} required /></label>
        <p className="boundary-note">Messages are stored in Supabase and are not end-to-end encrypted. Do not include credentials, secrets, unnecessary personal information, private files, proposal code, or protected economic details.</p>
        <button className="button-primary" type="submit" disabled={working || !subject.trim() || !body.trim()}>{working ? "Sending safely…" : "Send conversation request"}</button>
      </form>}

      <details className="account-messaging-help">
        <summary>How private messaging works</summary>
        <p>Search requires at least three characters and returns at most eight published public profiles. Results do not claim that a member accepts requests. The destination check applies participation, recipient preference, block, cooldown, and account-safety rules using one generic unavailable response.</p>
        <p>A message never grants proposal, review, moderation, economic, or account authority.</p>
      </details>
    </section>}
  </div>;
}
