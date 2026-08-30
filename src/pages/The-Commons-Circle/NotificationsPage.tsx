import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { structurallyEqual, useCoordinatedRefresh } from "../../shared/hooks/useCoordinatedRefresh";
import { safeInternalActionPath } from "../../shared/navigation/safeInternalActionPath";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import {
  loadNotifications,
  markAllAccountNotificationsRead,
  setNotificationArchived,
  setNotificationRead,
  type AccountActorCard,
  type NotificationFilter,
  type NotificationsResult,
} from "./accountCommunicationsApi";

const filters: Array<{ key: NotificationFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "account_security", label: "Account & Security" },
  { key: "community", label: "Community" },
  { key: "work_reviews", label: "Work & Reviews" },
  { key: "marketplace", label: "Marketplace & Economic" },
  { key: "moderation", label: "Moderation" },
  { key: "archived", label: "Archived" },
];

const filterKeys = new Set(filters.map((filter) => filter.key));
const categoryLabels: Record<string, string> = {
  account_security: "Account & security",
  announcements: "Announcements",
  community_mentions: "Community mentions",
  community_replies: "Community replies",
  followed_threads: "Followed threads",
  marketplace: "Marketplace & economic",
  moderation: "Moderation",
  private_messages: "Private messages",
  sandbox: "Sandbox",
  work_reviews: "Work & reviews",
};

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function actorLabel(actor: AccountActorCard | null) {
  if (!actor) return "Elysia Ecobotics system";
  return actor.displayName || (actor.handle ? `@${actor.handle}` : "Account participant");
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

export default function NotificationsPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFilter = searchParams.get("filter") ?? "all";
  const activeFilter: NotificationFilter = filterKeys.has(requestedFilter as NotificationFilter)
    ? requestedFilter as NotificationFilter
    : "all";
  const [loadingMore, setLoadingMore] = useState(false);
  const [workingItem, setWorkingItem] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);

  const loadCurrentFilter = useCallback(() => loadNotifications(activeFilter, null), [activeFilter]);

  const {
    data: result,
    initialLoading: loading,
    backgroundRefreshing,
    busy,
    refresh,
    runExclusive,
    updateData: setResult,
  } = useCoordinatedRefresh<NotificationsResult | null>({
    resourceKey: activeFilter,
    load: loadCurrentFilter,
    initialData: null,
    pollIntervalMs: 45_000,
    pollEnabled: (next) => Boolean(next?.signedIn),
    classify: (next) => !next?.signedIn ? "blocked" : next.warnings.length ? "degraded" : "settled",
    isEqual: structurallyEqual,
  });

  const filterLabel = useMemo(() => filters.find((filter) => filter.key === activeFilter)?.label ?? "All", [activeFilter]);

  function chooseFilter(filter: NotificationFilter) {
    const next = new URLSearchParams(searchParams);
    if (filter === "all") next.delete("filter"); else next.set("filter", filter);
    setSearchParams(next, { replace: true });
  }

  async function mutateNotification(itemId: string, action: () => Promise<string[]>, success: string) {
    setWorkingItem(itemId);
    const warnings = await action();
    setMessages(warnings.length ? warnings : [success]);
    await refresh("mutation");
    setWorkingItem(null);
  }

  async function markAllRead() {
    const category = ["account_security", "marketplace", "moderation", "work_reviews"].includes(activeFilter)
      ? activeFilter
      : null;
    const outcome = await markAllAccountNotificationsRead(category);
    setMessages([outcome.warning ?? `${outcome.count} notification${outcome.count === 1 ? "" : "s"} marked read.`]);
    await refresh("mutation");
  }

  const refreshAfterAuth = useCallback(async () => { await refresh("auth"); }, [refresh]);

  async function loadMore() {
    if (!result?.cursor) return;
    const cursor = result.cursor;
    setLoadingMore(true);
    await runExclusive(async () => {
      const next = await loadNotifications(activeFilter, cursor);
      setResult((current) => current ? {
        ...next,
        items: [...current.items, ...next.items.filter((item) => !current.items.some((existing) => existing.id === item.id))],
      } : next);
    });
    setLoadingMore(false);
  }

  return <div className="page-stack commons-circle-page commons-account-communications-page">
    <PageHero eyebrow="Private account room" title="Notifications">
      <p>Informational updates and outcomes for your Website Account, kept separate from actions in Inbox and specialist work in Review Center.</p>
      <p>A notification reports a source event. It never grants permission, changes a source record, or replaces the authoritative workflow.</p>
    </PageHero>

    <section className="commons-doctrine-grid">
      <WarningCallout title="Safe event summaries"><p>Private proposal code, Work With contents, private messages, economic details, and unrelated personal data are never copied into notification previews.</p></WarningCallout>
      <WarningCallout title="Mandatory notices remain visible"><p>Account, security, legal, guardian, moderation, and other required notices cannot be suppressed by an optional-event preference.</p></WarningCallout>
    </section>

    {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <p className="message" key={`${message}-${index}`}>{message}</p>)}</section>}

    <section className="section-card">
      <div className="section-heading section-heading--inline">
        <div><p className="eyebrow">Website Account</p><h2>Notification access</h2></div>
        <Link className="button-link" to="/commons-circle/signals">Back to Signals</Link>
      </div>
      <AuthPanel
        onMessage={(message) => setMessages((current) => [message, ...current].slice(0, 6))}
        onAuthChanged={refreshAfterAuth}
        copy={{
          eyebrow: "Website Account",
          title: result?.signedIn ? "Private notifications active" : "Sign in to view private notifications",
          description: "Notifications belong to your Website Account and are not public Commons Profile fields.",
          signedOutText: "No active website session.",
          confirmationPath: `${location.pathname}${location.search}`,
          confirmationCopy: "If email confirmation is enabled, open the confirmation link to return to Notifications.",
        }}
      />
    </section>

    {result?.signedIn && <>
      <section className="section-card">
        <div className="section-heading section-heading--inline">
          <div><p className="eyebrow">Informational events</p><h2>{result.counts.notificationsUnread} unread notifications</h2></div>
          <div className="button-row"><button type="button" onClick={() => void refresh("manual")} disabled={busy}>Refresh</button><button type="button" onClick={() => void markAllRead()} disabled={busy || result.counts.notificationsUnread === 0}>Mark all read</button>{backgroundRefreshing && <span className="boundary-note" aria-live="polite">Refreshing quietly…</span>}</div>
        </div>

        <div className="account-communications-tabs" role="tablist" aria-label="Notification views">
          {filters.map((filter) => <button
            className={activeFilter === filter.key ? "button-primary" : ""}
            type="button"
            role="tab"
            aria-selected={activeFilter === filter.key}
            key={filter.key}
            onClick={() => chooseFilter(filter.key)}
          >{filter.label}{filter.key === "unread" && result.counts.notificationsUnread ? ` (${result.counts.notificationsUnread})` : ""}</button>)}
        </div>

        {loading && <p className="commons-empty-state" aria-live="polite">Loading private notifications…</p>}
        {!loading && !result.items.length && <div className="account-communications-empty"><h3>No {filterLabel.toLowerCase()} notifications</h3><p>Authoritative source workflows, Inbox actions, and authorized Review Center queues remain available in their separate surfaces.</p></div>}

        <div className="account-communications-list">
          {result.items.map((item) => {
            const deepLink = item.sourceAvailable ? safeInternalActionPath(item.deepLink) : null;
            const working = workingItem === item.id;
            return <article className={`account-communications-card${item.readAt ? "" : " account-communications-card--unread"}`} key={item.id}>
              <div className="account-communications-card__heading">
                <div><p className="eyebrow">{categoryLabels[item.category] ?? humanize(item.category)}</p><h3>{item.title}</h3></div>
                <span className={`account-state-pill${item.mandatory ? " account-state-pill--priority" : ""}`}>{item.mandatory ? "Required notice" : item.readAt ? "Read" : "Unread"}</span>
              </div>
              <p className="account-communications-actor">From {actorLabel(item.actor)} · {formatTime(item.createdAt)}</p>
              {item.preview && <p>{item.preview}</p>}
              {!item.sourceAvailable && <p className="boundary-note">The source is no longer available. This safe notification record remains understandable without granting missing source access.</p>}
              <div className="button-row">
                {deepLink && <Link className="button-link button-link--primary" to={deepLink}>Open source</Link>}
                <button type="button" disabled={working} onClick={() => void mutateNotification(item.id, () => setNotificationRead(item.id, !item.readAt), item.readAt ? "Marked unread." : "Marked read.")}>{item.readAt ? "Mark unread" : "Mark read"}</button>
                <button type="button" disabled={working} onClick={() => void mutateNotification(item.id, () => setNotificationArchived(item.id, !item.archivedAt), item.archivedAt ? "Returned to Notifications." : "Archived.")}>{item.archivedAt ? "Unarchive" : "Archive"}</button>
              </div>
              <details><summary>Technical context</summary><dl className="mini-facts"><div><dt>Domain</dt><dd>{humanize(item.domain)}</dd></div><div><dt>Event category</dt><dd>{humanize(item.category)}</dd></div><div><dt>Delivery class</dt><dd>{item.mandatory ? "Mandatory" : "Preference-controlled"}</dd></div></dl><p className="boundary-note">This projection reports an event only. The source route performs its own authorization.</p></details>
            </article>;
          })}
        </div>
        {result.cursor && <button type="button" disabled={loadingMore || busy} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load more"}</button>}
      </section>

      <section className="section-card account-notification-preferences"><p className="eyebrow">Account destination</p><h2>Notification Preferences moved to Settings</h2><p>Optional in-app, email, quiet-hours, and preserved legacy signal choices now live in the dedicated Account &amp; Profile Settings destination.</p><Link className="button-link button-link--primary" to="/commons-circle/settings/notifications">Open Notification Preferences</Link></section>
    </>}

    {result?.warnings.length ? <WarningCallout title="Temporary account-data limitation"><p>{result.warnings.join(" ")}</p></WarningCallout> : null}
  </div>;
}
