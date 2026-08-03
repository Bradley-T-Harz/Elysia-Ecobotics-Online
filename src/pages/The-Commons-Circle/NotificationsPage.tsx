import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { structurallyEqual, useCoordinatedRefresh } from "../../shared/hooks/useCoordinatedRefresh";
import { safeInternalActionPath } from "../../shared/navigation/safeInternalActionPath";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import {
  loadAccountEventPreferences,
  loadNotifications,
  markAllAccountNotificationsRead,
  setNotificationArchived,
  setNotificationRead,
  updateAccountEventPreference,
  type AccountActorCard,
  type AccountEventPreference,
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
const mandatoryCategories = new Set(["account_security", "moderation"]);
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

function preferenceCategoryLabel(category: string) {
  return categoryLabels[category] ?? humanize(category);
}

export default function NotificationsPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFilter = searchParams.get("filter") ?? "all";
  const activeFilter: NotificationFilter = filterKeys.has(requestedFilter as NotificationFilter)
    ? requestedFilter as NotificationFilter
    : "all";
  const [preferences, setPreferences] = useState<AccountEventPreference[]>([]);
  const [taxonomyVersion, setTaxonomyVersion] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [workingItem, setWorkingItem] = useState<string | null>(null);
  const [workingPreference, setWorkingPreference] = useState<string | null>(null);
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

  const refreshPreferences = useCallback(async () => {
    const next = await loadAccountEventPreferences();
    if (next.warning) setMessages((current) => [next.warning as string, ...current].slice(0, 6));
    if (next.result) {
      setPreferences(next.result.preferences);
      setTaxonomyVersion(next.result.taxonomyVersion);
    }
  }, []);

  useEffect(() => { if (result?.signedIn) void refreshPreferences(); }, [refreshPreferences, result?.signedIn]);

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

  function patchPreference(category: string, patch: Partial<AccountEventPreference>) {
    setPreferences((current) => current.map((preference) => preference.category === category ? { ...preference, ...patch } : preference));
  }

  async function savePreference(preference: AccountEventPreference) {
    setWorkingPreference(preference.category);
    const outcome = await updateAccountEventPreference(preference);
    setMessages([outcome.warning ?? `${preferenceCategoryLabel(preference.category)} preferences saved.`]);
    if (outcome.preference) patchPreference(preference.category, outcome.preference);
    else await refreshPreferences();
    setWorkingPreference(null);
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

      <section className="section-card account-notification-preferences">
        <div className="section-heading"><p className="eyebrow">Delivery preferences · taxonomy v{taxonomyVersion || 1}</p><h2>Choose optional in-app and email delivery</h2><p>Read state, archive state, source authorization, and private-message consent are separate controls. Quiet hours delay optional email in UTC; they do not hide in-app events.</p></div>
        <div className="account-notification-preference-list">
          {preferences.map((preference) => <article key={preference.category}>
            <div><h3>{preferenceCategoryLabel(preference.category)}</h3>{mandatoryCategories.has(preference.category) && <p className="boundary-note">Mandatory events in this category remain visible and may still be delivered.</p>}</div>
            <label className="checkbox-line"><input type="checkbox" checked={preference.inAppEnabled} onChange={(event) => patchPreference(preference.category, { inAppEnabled: event.target.checked })} /><span>Optional in-app events</span></label>
            <label className="checkbox-line"><input type="checkbox" checked={preference.emailEnabled} onChange={(event) => patchPreference(preference.category, { emailEnabled: event.target.checked })} /><span>Optional email delivery</span></label>
            <div className="account-notification-quiet-hours">
              <label><span>Quiet hours start (UTC)</span><input type="time" value={preference.quietHoursStart?.slice(0, 5) ?? ""} onChange={(event) => patchPreference(preference.category, { quietHoursStart: event.target.value || null, quietHoursEnd: event.target.value ? preference.quietHoursEnd ?? "08:00" : null })} /></label>
              <label><span>Quiet hours end (UTC)</span><input type="time" value={preference.quietHoursEnd?.slice(0, 5) ?? ""} onChange={(event) => patchPreference(preference.category, { quietHoursEnd: event.target.value || null, quietHoursStart: event.target.value ? preference.quietHoursStart ?? "22:00" : null })} /></label>
            </div>
            <button type="button" disabled={workingPreference === preference.category} onClick={() => void savePreference(preference)}>{workingPreference === preference.category ? "Saving…" : "Save preference"}</button>
          </article>)}
        </div>
        {!preferences.length && <p className="commons-empty-state">Notification preferences are unavailable until the account-event migration is active. No source workflow or mandatory notice was changed.</p>}
      </section>
    </>}

    {result?.warnings.length ? <WarningCallout title="Temporary account-data limitation"><p>{result.warnings.join(" ")}</p></WarningCallout> : null}
  </div>;
}
