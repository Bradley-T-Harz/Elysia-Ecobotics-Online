import JobPostFeeWorkspace from "../../shared/economics/JobPostFeeWorkspace";
import { jobPostFeesPath } from "../../shared/economics/jobPostFeeContracts";
import { useCallback, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { structurallyEqual, useCoordinatedRefresh } from "../../shared/hooks/useCoordinatedRefresh";
import { safeInternalActionPath } from "../../shared/navigation/safeInternalActionPath";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import {
  loadRequestsAndReviews,
  type RequestReviewState,
  type RequestReviewsResult,
} from "./accountCommunicationsApi";

const domains = [
  { key: "all", label: "All domains" },
  { key: "code_proposals", label: "Code proposals" },
  { key: "work_with", label: "Work With" },
  { key: "troubleshooting", label: "Troubleshooting" },
  { key: "research_notes", label: "Research Notes" },
  { key: "repository_showcase", label: "Repository Showcase" },
  { key: "iteration_showcase", label: "Iteration Showcase" },
  { key: "job_posts", label: "Job Posts" },
] as const;

const validDomains = new Set(domains.map((domain) => domain.key));

function domainLabel(value: string) {
  return domains.find((domain) => domain.key === value)?.label ?? value.replace(/_/g, " ");
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

export default function RequestsReviewsPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDomain = searchParams.get("domain") ?? "all";
  const domain = validDomains.has(requestedDomain as typeof domains[number]["key"]) ? requestedDomain : "all";
  const requestedState = searchParams.get("state") ?? "all";
  const state: RequestReviewState = ["all", "pending", "resolved"].includes(requestedState) ? requestedState as RequestReviewState : "all";
  const [loadingMore, setLoadingMore] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  const loadCurrentView = useCallback(
    () => loadRequestsAndReviews(state, domain === "all" ? null : domain, null),
    [domain, state],
  );

  const {
    data: result,
    initialLoading: loading,
    backgroundRefreshing,
    busy,
    refresh,
    runExclusive,
    updateData: setResult,
  } = useCoordinatedRefresh<RequestReviewsResult | null>({
    resourceKey: `${state}:${domain}`,
    load: loadCurrentView,
    initialData: null,
    pollIntervalMs: 60_000,
    pollEnabled: (next) => Boolean(next?.signedIn),
    classify: (next) => !next?.signedIn ? "blocked" : next.warnings.length ? "degraded" : "settled",
    isEqual: structurallyEqual,
  });

  const refreshAfterAuth = useCallback(async () => { await refresh("auth"); }, [refresh]);

  async function loadMore() {
    if (!result?.hasMore || !result.cursor) return;
    const cursor = result.cursor;
    setLoadingMore(true);
    await runExclusive(async () => {
      const next = await loadRequestsAndReviews(state, domain === "all" ? null : domain, cursor);
      setResult((current) => current ? {
        ...next,
        items: [...current.items, ...next.items.filter((item) => !current.items.some((existing) => existing.key === item.key))],
      } : next);
    });
    setLoadingMore(false);
  }

  function setFilter(key: "domain" | "state", value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete(key); else next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  return <div className="page-stack commons-circle-page commons-account-communications-page">
    <PageHero eyebrow="Private account room" title="Requests & Reviews">
      <p>Your submitted proposals and account-owned source workflows, shown from their authoritative records.</p>
      <p>This is not your Inbox and it is not the specialist Review Center. Source status remains governed by each domain’s established rules.</p>
    </PageHero>

    <section className="commons-doctrine-grid">
      <WarningCallout title="Your submissions only"><p>This page excludes moderator, administrator, anti-scam, steward, and reviewer queues. Authorized specialist work remains in Review Center.</p></WarningCallout>
      <WarningCallout title="Private bodies stay at the source"><p>Work With messages and files, proposal code and explanations, and other sensitive source fields are not copied into this summary.</p></WarningCallout>
    </section>

    {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <p className="message" key={`${message}-${index}`}>{message}</p>)}</section>}

    <section className="section-card">
      <div className="section-heading section-heading--inline">
        <div><p className="eyebrow">Website Account</p><h2>Source-workflow access</h2></div>
        <Link className="button-link" to="/commons-circle/signals">Back to Signals</Link>
      </div>
      <AuthPanel
        onMessage={(message) => setMessages((current) => [message, ...current].slice(0, 6))}
        onAuthChanged={refreshAfterAuth}
        copy={{
          eyebrow: "Website Account",
          title: result?.signedIn ? "Requests & Reviews active" : "Sign in to view your submissions",
          description: "Only source workflows owned or submitted by the signed-in Website Account appear here.",
          signedOutText: "No active website session.",
          confirmationPath: `${location.pathname}${location.search}`,
          confirmationCopy: "If email confirmation is enabled, open the confirmation link to return to Requests & Reviews.",
        }}
      />
    </section>

    {domain === "job_posts" ? <JobPostFeeWorkspace /> : <section className="section-card"><h2>Job Post fee &amp; assistance status</h2><p>Private fee requests and economic conditions are separate from the content-review summaries below.</p><Link className="button-link" to={jobPostFeesPath}>My Job Post fees &amp; requests</Link></section>}

    {result?.signedIn && <section className="section-card">
      <div className="section-heading section-heading--inline">
        <div><p className="eyebrow">Account-owned workflows</p><h2>{result.counts.pending} pending across {result.counts.total} submissions</h2></div>
        <div className="button-row"><button type="button" onClick={() => void refresh("manual")} disabled={busy}>Refresh</button>{backgroundRefreshing && <span className="boundary-note" aria-live="polite">Refreshing quietly…</span>}</div>
      </div>
      <div className="account-communications-filters">
        <label><span>Status</span><select value={state} onChange={(event) => setFilter("state", event.target.value)}><option value="all">All statuses</option><option value="pending">Pending or needs action</option><option value="resolved">Resolved or closed</option></select></label>
        <label><span>Domain</span><select value={domain} onChange={(event) => setFilter("domain", event.target.value)}>{domains.map((entry) => <option value={entry.key} key={entry.key}>{entry.label}</option>)}</select></label>
      </div>
      <dl className="mini-facts">
        {domains.filter((entry) => entry.key !== "all" && result.counts.byDomain[entry.key]).map((entry) => <div key={entry.key}><dt>{entry.label}</dt><dd>{result.counts.byDomain[entry.key].pending} pending · {result.counts.byDomain[entry.key].total} total</dd></div>)}
      </dl>

      {loading && <p className="commons-empty-state" aria-live="polite">Loading authoritative request states…</p>}
      {!loading && !result.items.length && <div className="account-communications-empty"><h3>No matching source workflows</h3><p>Try another filter, or begin from the appropriate Work With, Commune, Job Post, Research Notes, Repository Showcase, or Iteration Showcase route.</p></div>}

      <div className="account-communications-list">
        {result.items.map((item) => {
          const deepLink = safeInternalActionPath(item.deepLink);
          return <article className={`account-communications-card${item.pending ? " account-communications-card--pending" : ""}`} key={item.key}>
            <div className="account-communications-card__heading">
              <div><p className="eyebrow">{domainLabel(item.domain)}</p><h3>{item.title}</h3></div>
              <span className={`account-state-pill${item.pending ? " account-state-pill--priority" : ""}`}>{item.pending ? "Pending / needs action" : "Resolved / closed"}</span>
            </div>
            <dl className="mini-facts">
              <div><dt>Source status</dt><dd>{statusLabel(item.status)}</dd></div>
              {item.secondaryStatus && <div><dt>Related status</dt><dd>{statusLabel(item.secondaryStatus)}</dd></div>}
              <div><dt>Last updated</dt><dd>{formatTime(item.updatedAt)}</dd></div>
            </dl>
            <div className="button-row">{deepLink ? <Link className="button-link button-link--primary" to={deepLink}>Open source workflow</Link> : <span className="boundary-note">Source link unavailable</span>}</div>
            <details><summary>About this status</summary><p>The source record—not this summary—controls review authority, private content, decisions, publication, and audit history.</p></details>
          </article>;
        })}
      </div>
      {result.hasMore && result.cursor && <button type="button" disabled={loadingMore || busy} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load more"}</button>}
    </section>}

    {result?.warnings.length ? <WarningCallout title="Temporary account-data limitation"><p>{result.warnings.join(" ")}</p></WarningCallout> : null}
  </div>;
}
