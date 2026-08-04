import { useCallback, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import { loadAccountHomebaseCounts } from "./accountCommunicationsApi";
import InboxMessagingPanel from "./InboxMessagingPanel";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function InboxConversationPage() {
  const location = useLocation();
  const { conversationId = "" } = useParams();
  const [messages, setMessages] = useState<string[]>([]);
  const [authRevision, setAuthRevision] = useState(0);
  const reconcileCounts = useCallback(() => { void loadAccountHomebaseCounts(); }, []);

  if (!UUID_PATTERN.test(conversationId)) {
    return <div className="page-stack commons-circle-page"><PageHero eyebrow="Private conversation" title="Conversation unavailable"><p>The conversation address is invalid or unavailable.</p></PageHero><Link className="button-link" to="/commons-circle/signals/inbox?view=messages">Back to Messages</Link></div>;
  }

  return <div className="page-stack commons-circle-page commons-account-communications-page">
    <PageHero eyebrow="Governed private communication" title="Private conversation">
      <p>This focused view loads message bodies only through the participant-scoped conversation contract.</p>
      <p>Messages are stored in Supabase and are not end-to-end encrypted.</p>
    </PageHero>

    {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <p className="message" key={`${message}-${index}`}>{message}</p>)}</section>}

    <section className="section-card signal-detail-navigation">
      <div className="section-heading section-heading--inline"><div><p className="eyebrow">Focused Inbox task</p><h2>Conversation detail</h2></div><Link className="button-link" to="/commons-circle/signals/inbox?view=messages">Back to Messages</Link></div>
    </section>

    <section className="section-card">
      <AuthPanel
        onMessage={(message) => setMessages((current) => [message, ...current].slice(0, 6))}
        onAuthChanged={async () => { setAuthRevision((value) => value + 1); }}
        copy={{
          eyebrow: "Website Account",
          title: "Private participant access",
          description: "Only an authenticated participant can open this conversation. The route itself grants no access.",
          signedOutText: "Sign in to check participant access.",
          confirmationPath: `${location.pathname}${location.search}`,
          confirmationCopy: "If confirmation is required, use the confirmation link to return to this conversation.",
        }}
      />
    </section>

    <InboxMessagingPanel
      key={`${conversationId}:${authRevision}`}
      conversationId={conversationId}
      onCountsChanged={reconcileCounts}
    />
  </div>;
}
