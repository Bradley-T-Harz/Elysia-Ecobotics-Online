import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { structurallyEqual, useCoordinatedRefresh } from "../../shared/hooks/useCoordinatedRefresh";
import { safeInternalActionPath } from "../../shared/navigation/safeInternalActionPath";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import {
  loadAccountHomebaseCounts,
  loadInbox,
  setInboxItemArchived,
  setInboxItemRead,
  type InboxItem,
  type InboxResult,
  type InboxView,
} from "./accountCommunicationsApi";
import InboxMessagingPanel from "./InboxMessagingPanel";

type InboxTab = InboxView | "sent";
type PriorityFilter = "all" | "high" | "standard";

const tabs: Array<{ key: InboxTab; label: string }> = [
  { key: "attention", label: "Needs attention" },
  { key: "messages", label: "Messages" },
  { key: "sent", label: "Sent" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
];

const domainLabels: Record<string, string> = {
  code_proposals: "Code proposals",
  work_with: "Work With",
  moderation: "Moderation",
  account: "Account",
  conversations: "Messages",
};

const inboxDomains = ["code_proposals", "work_with", "moderation", "account", "conversations"];

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

function actorLabel(item: InboxItem) {
  return item.actor?.displayName || (item.actor?.handle ? `@${item.actor.handle}` : "Elysia Ecobotics system");
}

function itemState(item: InboxItem) {
  if (item.supersededAt) return "No longer requires action";
  if (item.completedAt) return "Completed at the source";
  if (item.archivedAt) return "Archived";
  return item.readAt ? "Read · action remains open" : "Unread · action remains open";
}

export default function InboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<InboxTab>(() => searchParams.get("view") === "messages" ? "messages" : "attention");
  const [domain, setDomain] = useState("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [workingItem, setWorkingItem] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);

  const loadCurrentView = useCallback(async () => {
    if (activeTab === "sent") {
      const counts = await loadAccountHomebaseCounts();
      return {
        signedIn: counts.signedIn,
        supabaseConfigured: counts.supabaseConfigured,
        warnings: counts.warnings,
        items: [],
        counts: counts.events,
        cursor: null,
      } satisfies InboxResult;
    }
    return loadInbox(activeTab, domain === "all" ? null : domain, null);
  }, [activeTab, domain]);

  const {
    data: result,
    initialLoading: loading,
    backgroundRefreshing,
    busy,
    refresh,
    runExclusive,
    updateData: setResult,
  } = useCoordinatedRefresh<InboxResult | null>({
    resourceKey: `${activeTab}:${domain}`,
    load: loadCurrentView,
    initialData: null,
    pollIntervalMs: 45_000,
    pollEnabled: (next) => Boolean(next?.signedIn && activeTab !== "messages"),
    classify: (next) => !next?.signedIn ? "blocked" : next.warnings.length ? "degraded" : "settled",
    isEqual: structurallyEqual,
  });

  const visibleItems = useMemo(() => (result?.items ?? []).filter((item) => {
    if (priority === "high") return item.priority >= 75;
    if (priority === "standard") return item.priority < 75;
    return true;
  }), [priority, result?.items]);

  async function mutateItem(itemId: string, action: () => Promise<string[]>, success: string) {
    setWorkingItem(itemId);
    const warnings = await action();
    setMessages(warnings.length ? warnings : [success]);
    await refresh("mutation");
    setWorkingItem(null);
  }

  const refreshCounts = useCallback(async () => {
    const counts = await loadAccountHomebaseCounts();
    setResult((current) => current ? { ...current, counts: counts.events, warnings: [...current.warnings, ...counts.warnings] } : current);
  }, [setResult]);

  const refreshAfterAuth = useCallback(async () => { await refresh("auth"); }, [refresh]);

  async function loadMore() {
    if (!result?.cursor || activeTab === "sent" || activeTab === "messages") return;
    const cursor = result.cursor;
    setLoadingMore(true);
    await runExclusive(async () => {
      const next = await loadInbox(activeTab, domain === "all" ? null : domain, cursor);
      setResult((current) => current ? {
        ...next,
        items: [...current.items, ...next.items.filter((item) => !current.items.some((existing) => existing.id === item.id))],
      } : next);
    });
    setLoadingMore(false);
  }

  return <div className="page-stack commons-circle-page commons-account-communications-page">
    <PageHero eyebrow="Private account room" title="Inbox">
      <p>Private actions and governed account conversations, kept separate from informational notifications and specialist review queues.</p>
      <p>An Inbox item points to its authoritative source. Reading, archiving, or opening it never grants authority or changes the source workflow.</p>
    </PageHero>

    <section className="commons-doctrine-grid">
      <WarningCallout title="Action, not authorization"><p>Proposal decisions still require the original author’s established source route and database authority. The Inbox cannot approve code by itself.</p></WarningCallout>
      <WarningCallout title="Private by account"><p>Only the signed-in recipient can list these projections. Proposal code, explanations, Work With bodies, private files, and economic details are not copied into previews.</p></WarningCallout>
    </section>

    {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <p className="message" key={`${message}-${index}`}>{message}</p>)}</section>}

    <section className="section-card">
      <div className="section-heading section-heading--inline">
        <div><p className="eyebrow">Website Account</p><h2>Inbox access</h2></div>
        <Link className="button-link" to="/commons-circle">Back to Commons Circle</Link>
      </div>
      <AuthPanel
        onMessage={(message) => setMessages((current) => [message, ...current].slice(0, 6))}
        onAuthChanged={refreshAfterAuth}
        copy={{
          eyebrow: "Website Account",
          title: result?.signedIn ? "Private Inbox active" : "Sign in to open your private Inbox",
          description: "Inbox items belong to your Website Account, not your public Commons Profile.",
          signedOutText: "No active website session.",
          confirmationPath: "/commons-circle/inbox",
          confirmationCopy: "If email confirmation is enabled, open the confirmation link to return to your Inbox.",
        }}
      />
    </section>

    {result?.signedIn && <section className="section-card">
      <div className="section-heading section-heading--inline">
        <div><p className="eyebrow">Private actions</p><h2>{result.counts.inboxNeedsAttention} items need attention</h2></div>
        <div className="button-row"><button className="button-primary" type="button" onClick={() => {
          setActiveTab("messages");
          const next = new URLSearchParams(searchParams);
          next.set("view", "messages");
          setSearchParams(next, { replace: true });
        }}>Start a private conversation</button><button type="button" onClick={() => void refresh("manual")} disabled={busy}>Refresh</button>{backgroundRefreshing && <span className="boundary-note" aria-live="polite">Refreshing quietly…</span>}</div>
      </div>
      <dl className="mini-facts">
        <div><dt>Needs attention</dt><dd>{result.counts.inboxNeedsAttention}</dd></div>
        <div><dt>Inbox unread</dt><dd>{result.counts.inboxUnread}</dd></div>
        <div><dt>Message unread</dt><dd>{result.counts.messagesUnread}</dd></div>
      </dl>

      <div className="account-communications-tabs" role="tablist" aria-label="Inbox views">
        {tabs.map((tab) => <button
          className={activeTab === tab.key ? "button-primary" : ""}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.key}
          key={tab.key}
          onClick={() => {
            setActiveTab(tab.key);
            setDomain("all");
            const next = new URLSearchParams(searchParams);
            if (tab.key === "messages") next.set("view", "messages");
            else next.delete("view");
            setSearchParams(next, { replace: true });
          }}
        >{tab.label}{tab.key === "attention" ? ` (${result.counts.inboxNeedsAttention})` : tab.key === "messages" && result.counts.messagesUnread ? ` (${result.counts.messagesUnread})` : ""}</button>)}
      </div>

      {activeTab === "sent" ? <div className="account-communications-empty">
        <h3>Sent source workflows live in Requests &amp; Reviews</h3>
        <p>Proposals, Work With requests, Job Posts, Research Notes, Repository Showcases, and Iteration Showcases remain authoritative in their own systems.</p>
        <Link className="button-link button-link--primary" to="/commons-circle/requests-reviews">Open Requests &amp; Reviews</Link>
      </div> : activeTab === "messages" ? <InboxMessagingPanel onCountsChanged={refreshCounts} /> : <>
        <div className="account-communications-filters">
          <label><span>Domain</span><select value={domain} onChange={(event) => setDomain(event.target.value)}><option value="all">All domains</option>{inboxDomains.map((value) => <option value={value} key={value}>{domainLabels[value] ?? humanize(value)}</option>)}</select></label>
          <label><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as PriorityFilter)}><option value="all">All priorities</option><option value="high">High priority</option><option value="standard">Standard priority</option></select></label>
        </div>

        {loading && <p className="commons-empty-state" aria-live="polite">Loading private Inbox items…</p>}
        {!loading && !visibleItems.length && <div className="account-communications-empty">
          <h3>{activeTab === "attention" ? "Nothing needs your attention" : activeTab === "completed" ? "No completed actions yet" : "No archived items"}</h3>
          <p>Source workflows, notifications, and staff review queues remain available in their separate account and review surfaces.</p>
        </div>}

        <div className="account-communications-list">
          {visibleItems.map((item) => {
            const deepLink = item.sourceAvailable ? safeInternalActionPath(item.deepLink) : null;
            const working = workingItem === item.id;
            return <article className={`account-communications-card${item.readAt ? "" : " account-communications-card--unread"}`} key={item.id}>
              <div className="account-communications-card__heading">
                <div><p className="eyebrow">{domainLabels[item.domain] ?? humanize(item.domain)}</p><h3>{item.title}</h3></div>
                <span className={`account-state-pill${item.priority >= 75 ? " account-state-pill--priority" : ""}`}>{itemState(item)}</span>
              </div>
              <p className="account-communications-actor">From {actorLabel(item)} · {formatTime(item.createdAt)}</p>
              {item.preview && <p>{item.preview}</p>}
              {!item.sourceAvailable && <p className="boundary-note">The source is no longer available. This safe record remains so the Inbox state is understandable; no missing source authority is inferred.</p>}
              <div className="button-row">
                {deepLink && <Link className="button-link button-link--primary" to={deepLink}>{humanize(item.actionKind)}</Link>}
                <button type="button" disabled={working} onClick={() => void mutateItem(item.id, () => setInboxItemRead(item.id, !item.readAt), item.readAt ? "Marked unread." : "Marked read.")}>{item.readAt ? "Mark unread" : "Mark read"}</button>
                <button type="button" disabled={working} onClick={() => void mutateItem(item.id, () => setInboxItemArchived(item.id, !item.archivedAt), item.archivedAt ? "Returned to Inbox." : "Archived from the active Inbox.")}>{item.archivedAt ? "Unarchive" : "Archive"}</button>
              </div>
              <details><summary>Technical context</summary><dl className="mini-facts"><div><dt>Domain</dt><dd>{humanize(item.domain)}</dd></div><div><dt>Category</dt><dd>{humanize(item.category)}</dd></div><div><dt>Item kind</dt><dd>{humanize(item.kind)}</dd></div></dl><p className="boundary-note">This context describes the projection only. The linked source rechecks authorization.</p></details>
            </article>;
          })}
        </div>
        {result.cursor && <button type="button" disabled={loadingMore || busy} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load more"}</button>}
      </>}
    </section>}

    {result?.warnings.length ? <WarningCallout title="Temporary account-data limitation"><p>{result.warnings.join(" ")}</p></WarningCallout> : null}
  </div>;
}
