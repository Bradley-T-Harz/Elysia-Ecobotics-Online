import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { loadCurrentRoleState } from "../../shared/review/reviewClient";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import { loadAccountHomebaseCounts, type AccountHomebaseCounts } from "./accountCommunicationsApi";
import { commonsStorageKeys, readLocalStorage } from "./commonsCircleApi";

type SignalHubState = {
  signedIn: boolean;
  isAdmin: boolean;
  canOpenReviewCenter: boolean;
  counts: AccountHomebaseCounts;
  warnings: string[];
};

const emptyCounts: AccountHomebaseCounts = {
  signedIn: false,
  supabaseConfigured: true,
  warnings: [],
  events: { inboxNeedsAttention: 0, inboxUnread: 0, messagesUnread: 0, notificationsUnread: 0 },
  requests: { total: 0, pending: 0, byDomain: {} },
};

type LocalSignalDraft = { status?: string };

function loadBrowserLocalActivity() {
  const stewardship = readLocalStorage<LocalSignalDraft[]>(commonsStorageKeys.stewardshipDrafts, []);
  const contributions = readLocalStorage<unknown[]>(commonsStorageKeys.contributionRequests, []);
  return {
    stewardshipPending: stewardship.filter((draft) => draft.status === "pending_admin_review_local").length,
    contributionDrafts: contributions.length,
  };
}

const signalCategories = [
  {
    title: "Coding & Technical",
    description: "Code collaboration, troubleshooting, technical showcases, and selected-artifact evidence.",
    links: [
      ["Coding proposals", "/commons-circle/signals/coding-proposals"],
      ["Troubleshooting", "/commons-circle/signals/troubleshooting"],
      ["Repository Showcases", "/commons-circle/signals/repository-showcases"],
      ["Iteration Showcases", "/commons-circle/signals/iteration-showcases"],
      ["Selected-artifact sandbox reviews", "/commons-circle/signals/sandbox-reviews"],
    ],
  },
  {
    title: "Research & Work",
    description: "Research, opportunities, private intake, publishing, and marketplace outcomes.",
    links: [
      ["Research Notes", "/commons-circle/signals/research-notes"],
      ["Job Posts", "/commons-circle/signals/job-posts"],
      ["Work With", "/commons-circle/signals/work-with"],
      ["Marketplace and Developer Forge outcomes", "/commons-circle/signals/marketplace-forge"],
    ],
  },
  {
    title: "Stewardship & Official",
    description: "Community voting lifecycle and brand-authoritative Official Update history.",
    links: [
      ["Community Voting Room", "/commons-circle/signals/voting-room"],
      ["Official Updates", "/commons-circle/signals/official-updates"],
    ],
  },
] as const;

function MiniFact({ label, value }: { label: string; value: string | number }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

export default function SignalConsolePage() {
  const location = useLocation();
  const [state, setState] = useState<SignalHubState | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [localActivity, setLocalActivity] = useState(loadBrowserLocalActivity);

  const refresh = useCallback(async () => {
    const [roles, counts] = await Promise.all([loadCurrentRoleState(), loadAccountHomebaseCounts()]);
    const warnings = Array.from(new Set([...roles.warnings, ...counts.warnings]));
    setState({
      signedIn: roles.signedIn && counts.signedIn,
      isAdmin: roles.isAdmin,
      canOpenReviewCenter: roles.isAdmin || roles.roles.length > 0,
      counts,
      warnings,
    });
    setLocalActivity(loadBrowserLocalActivity());
    setMessages(warnings);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const counts = state?.counts ?? emptyCounts;

  return <div className="page-stack commons-circle-page commons-signal-console commons-signals-hub">
    <PageHero eyebrow="Commons Circle" title="Signals">
      <p>A compact map of your private account rooms and domain activity. Actions, messages, informational outcomes, submitted workflows, and specialist staff work remain separate.</p>
      <p>This route remains compatible with existing bookmarks and query strings while the new account rooms complete production reconciliation.</p>
    </PageHero>

    {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <p className="message" key={`${message}-${index}`}>{message}</p>)}</section>}

    <section className="section-card">
      <div className="section-heading section-heading--inline">
        <div><p className="eyebrow">Website Account</p><h2>Private signal access</h2></div>
        <Link className="button-link" to="/commons-circle">Back to Commons Circle</Link>
      </div>
      <AuthPanel
        onMessage={(message) => setMessages((current) => [message, ...current].slice(0, 6))}
        onAuthChanged={refresh}
        copy={{
          eyebrow: "Website Account",
          title: state?.signedIn ? "Website Account active" : "Sign in to open your private signal map",
          description: "Signals belongs to your Website Account, not your public Commons Profile or private local Elysia core.",
          signedOutText: "No active website session.",
          confirmationPath: `${location.pathname}${location.search}`,
          confirmationCopy: "If email confirmation is enabled, open the confirmation link to return to Signals.",
        }}
      />
    </section>

    {state?.signedIn && <>
      <section className="section-card">
        <div className="section-heading">
          <p className="eyebrow">Account destinations</p>
          <h2>Choose the room that matches your task</h2>
          <p>Counts come from the exact recipient and source-workflow count contracts; they are not inferred from a shortened activity list.</p>
        </div>
        <div className="commons-homebase-grid signals-primary-grid">
          <article className="section-card commons-account-room-card signals-primary-card">
            <p className="eyebrow">Private actions &amp; communication</p>
            <h3>Inbox &amp; Private Messages</h3>
            <dl className="mini-facts"><MiniFact label="Needs attention" value={counts.events.inboxNeedsAttention} /><MiniFact label="Inbox unread" value={counts.events.inboxUnread} /><MiniFact label="Messages unread" value={counts.events.messagesUnread} /></dl>
            <p>Review account-directed actions, receive conversation requests, and use governed participant-scoped messages.</p>
            <div className="button-row"><Link className="button-link button-link--primary" to="/commons-circle/signals/inbox">Open Inbox</Link><Link className="button-link" to="/commons-circle/signals/inbox?view=messages">Start a private conversation</Link></div>
          </article>

          <article className="section-card commons-account-room-card signals-primary-card">
            <p className="eyebrow">Information &amp; outcomes</p>
            <h3>Notifications</h3>
            <dl className="mini-facts"><MiniFact label="Unread" value={counts.events.notificationsUnread} /></dl>
            <p>See recipient-scoped updates, outcomes, mandatory notices, preferences, and safe links back to authoritative sources.</p>
            <Link className="button-link button-link--primary" to="/commons-circle/signals/notifications">Open Notifications</Link>
          </article>

          <article className="section-card commons-account-room-card signals-primary-card">
            <p className="eyebrow">Your submitted work</p>
            <h3>My Requests &amp; Reviews</h3>
            <dl className="mini-facts"><MiniFact label="Pending" value={counts.requests.pending} /><MiniFact label="Total" value={counts.requests.total} /></dl>
            <p>Track proposals, Work With, Job Posts, Research Notes, and showcases from their authoritative source records.</p>
            <Link className="button-link button-link--primary" to="/commons-circle/signals/requests-reviews">Open Requests &amp; Reviews</Link>
          </article>

          <article className="section-card commons-account-room-card signals-primary-card">
            <p className="eyebrow">Browser-local continuity</p>
            <h3>Local requests and recognition</h3>
            <dl className="mini-facts"><MiniFact label="Stewardship pending" value={localActivity.stewardshipPending} /><MiniFact label="Contribution drafts" value={localActivity.contributionDrafts} /></dl>
            <p>These drafts remain in this browser. They are not authoritative submissions and do not contribute to account-backed request counts.</p>
            <Link className="button-link" to="/commons-circle/setup/stewardship">Review Commons setup</Link>
          </article>

          {state.isAdmin && <article className="section-card commons-account-room-card signals-primary-card">
            <p className="eyebrow">Administrators only</p>
            <h3>Admin Console</h3>
            <p>Open account governance, communications, moderation, role, and audit tools through their established authorization gates.</p>
            <Link className="button-link button-link--primary" to="/commons-circle/admin-console">Open Admin Console</Link>
          </article>}

          {state.canOpenReviewCenter && <article className="section-card commons-account-room-card signals-primary-card">
            <p className="eyebrow">Authorized staff only</p>
            <h3>Review Center</h3>
            <p>Specialist reviewer, moderator, steward, anti-scam, and administrator queues remain role-gated and source-authoritative.</p>
            <Link className="button-link button-link--primary" to="/admin/review">Open Review Center</Link>
          </article>}
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading"><p className="eyebrow">Domain activity</p><h2>Browse focused signal rooms</h2><p>Expand one category, then open only the domain history you need.</p></div>
        <div className="signals-category-list">
          {signalCategories.map((category) => <details className="signals-category" key={category.title}>
            <summary><span><strong>{category.title}</strong><small>{category.description}</small></span><span aria-hidden="true">+</span></summary>
            <nav aria-label={`${category.title} signal rooms`}>
              {category.links.map(([label, path]) => <Link className="signals-category-link" to={path} key={path}><span>{label}</span><span aria-hidden="true">→</span></Link>)}
            </nav>
          </details>)}
        </div>
      </section>

      <section className="commons-doctrine-grid">
        <WarningCallout title="Compatibility without duplication"><p>Informational notification rows now live in Notifications. These signal rooms retain direct-source domain activity and history for parity, not a second notification feed.</p></WarningCallout>
        <WarningCallout title="Authority stays at the source"><p>Inbox items, notifications, messages, counts, and signal-room links never grant proposal, review, moderation, publication, economic, or sandbox authority.</p></WarningCallout>
      </section>
    </>}
  </div>;
}
