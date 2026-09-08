import { useAuth } from "../../shared/auth/useAuth";
import CreatorStudioDoorway from "../../shared/navigation/CreatorStudioDoorway";
import { useAccountDoorways } from "../../shared/navigation/useAccountDoorways";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { loadCurrentRoleState } from "../../shared/review/reviewClient";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import { loadAccountHomebaseCounts, type AccountHomebaseCounts } from "./accountCommunicationsApi";
import { commonsStorageKeys, readLocalStorage } from "./commonsCircleApi";
import { emptyCircleAccessReview, loadCurrentUserCircleAccessReview, type CircleAccessReview } from "./circleApi";

type SignalHubState = {
  signedIn: boolean;
  isAdmin: boolean;
  canOpenReviewCenter: boolean;
  counts: AccountHomebaseCounts;
  circleAccessReview: CircleAccessReview;
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
  const doorways = useAccountDoorways();
  const { accessToken } = useAuth();
  const actor = useRef(accessToken); actor.current = accessToken;
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const [state, setState] = useState<SignalHubState | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [localActivity, setLocalActivity] = useState(loadBrowserLocalActivity);

  const refresh = useCallback(async () => {
    const [roles, counts] = await Promise.all([loadCurrentRoleState(), loadAccountHomebaseCounts()]);
    const accessReview = roles.signedIn && counts.signedIn
      ? await loadCurrentUserCircleAccessReview()
      : { data: emptyCircleAccessReview, warnings: [] };
    const warnings = Array.from(new Set([...roles.warnings, ...counts.warnings, ...accessReview.warnings]));
    if (actor.current !== accessToken) return;
    setLoadedToken(accessToken);
    setState({
      signedIn: roles.signedIn && counts.signedIn,
      isAdmin: roles.isAdmin,
      canOpenReviewCenter: roles.isAdmin || roles.roles.length > 0,
      counts,
      circleAccessReview: accessReview.data,
      warnings,
    });
    setLocalActivity(loadBrowserLocalActivity());
    setMessages(warnings);
  }, [accessToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const counts = state?.counts ?? emptyCounts;
  const circleAccessReview = state?.circleAccessReview ?? emptyCircleAccessReview;

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

    {state?.signedIn && doorways.signedIn && loadedToken === accessToken && <>
      <CreatorStudioDoorway />
      {doorways.economic && <section className="section-card split-callout"><div><p className="eyebrow">Separately assigned economic authority</p><h2>Economic Operations</h2><p>Your private economic tools, readiness and audit records. Community administration and review remain separate.</p></div><Link className="button-link button-link--primary" to="/admin/economic-operations/readiness">Open Economic Operations</Link></section>}
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
            <div className="button-row"><Link className="button-link button-link--primary" to="/commons-circle/signals/inbox">Open Inbox</Link><Link className="button-link" to="/commons-circle/signals/inbox/new">Start a private conversation</Link></div>
          </article>

          <article className="section-card commons-account-room-card signals-primary-card">
            <p className="eyebrow">Mutual connections</p>
            <h3>Your Circle</h3>
            <p>Accept invitations and manage the private list of Commons members who may be selected for Circle-only room posts.</p>
            <p>Circle membership is mutual consent, not following, endorsement, or authority.</p>
            {circleAccessReview.counts.privatePosts > 0 && <p className="boundary-note">{circleAccessReview.counts.formerMembers} former Circle {circleAccessReview.counts.formerMembers === 1 ? "member still has" : "members still have"} access to {circleAccessReview.counts.privatePosts} private {circleAccessReview.counts.privatePosts === 1 ? "post" : "posts"} you own.</p>}
            <div className="button-row"><Link className="button-link button-link--primary" to="/commons-circle/signals/circle">Open Your Circle</Link>{circleAccessReview.counts.privatePosts > 0 && <Link className="button-link" to="/commons-circle/signals/circle#access-review">Review access</Link>}</div>
          </article>

          <article className="section-card commons-account-room-card signals-primary-card">
            <p className="eyebrow">Information &amp; outcomes</p>
            <h3>Notifications</h3>
            <dl className="mini-facts"><MiniFact label="Unread" value={counts.events.notificationsUnread} /></dl>
            <p>See recipient-scoped updates, outcomes, mandatory notices, preferences, and safe links back to authoritative sources.</p>
            <div className="button-row"><Link className="button-link button-link--primary" to="/commons-circle/signals/notifications">Open Notifications</Link><Link className="button-link" to="/commons-circle/settings/notifications">Notification Preferences</Link></div>
          </article>

          <article className="section-card commons-account-room-card signals-primary-card">
            <p className="eyebrow">Account destinations</p>
            <h3>Account &amp; Profile Settings</h3>
            <p>Manage profile appearance, Privacy Lanterns, notification preferences, account security, data, lifecycle, support, and billing destinations.</p>
            <Link className="button-link button-link--primary" to="/commons-circle/settings">Open Account &amp; Profile Settings</Link>
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

          {doorways.isAdmin && <article className="section-card commons-account-room-card signals-primary-card">
            <p className="eyebrow">Administrators only</p>
            <h3>Admin Console</h3>
            <p>Open account governance, communications, moderation, role, and audit tools through their established authorization gates.</p>
            <Link className="button-link button-link--primary" to="/commons-circle/admin-console">Open Admin Console</Link>
          </article>}

          {(doorways.isAdmin || doorways.roles.length > 0) && <article className="section-card commons-account-room-card signals-primary-card">
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
