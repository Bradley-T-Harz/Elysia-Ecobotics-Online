import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDomain = searchParams.get("domain") ?? "all";
  const domain = validDomains.has(requestedDomain as typeof domains[number]["key"]) ? requestedDomain : "all";
  const requestedState = searchParams.get("state") ?? "all";
  const state: RequestReviewState = ["all", "pending", "resolved"].includes(requestedState) ? requestedState as RequestReviewState : "all";
  const [result, setResult] = useState<RequestReviewsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  const refresh = useCallback(async (append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    const next = await loadRequestsAndReviews(state, domain === "all" ? null : domain, append ? result?.cursor ?? null : null);
    setResult((current) => append && current ? {
      ...next,
      items: [...current.items, ...next.items.filter((item) => !current.items.some((existing) => existing.key === item.key))],
    } : next);
    append ? setLoadingMore(false) : setLoading(false);
  }, [domain, result?.cursor, state]);

  useEffect(() => { void refresh(false); }, [domain, state]);

  useEffect(() => {
    if (!result?.signedIn) return;
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(false); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = window.setInterval(onFocus, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(timer);
    };
  }, [refresh, result?.signedIn]);

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
        <Link className="button-link" to="/commons-circle">Back to Commons Circle</Link>
      </div>
      <AuthPanel
        onMessage={(message) => setMessages((current) => [message, ...current].slice(0, 6))}
        onAuthChanged={async () => { await refresh(false); }}
        copy={{
          eyebrow: "Website Account",
          title: result?.signedIn ? "Requests & Reviews active" : "Sign in to view your submissions",
          description: "Only source workflows owned or submitted by the signed-in Website Account appear here.",
          signedOutText: "No active website session.",
          confirmationPath: "/commons-circle/requests-reviews",
          confirmationCopy: "If email confirmation is enabled, open the confirmation link to return to Requests & Reviews.",
        }}
      />
    </section>

    {result?.signedIn && <section className="section-card">
      <div className="section-heading section-heading--inline">
        <div><p className="eyebrow">Account-owned workflows</p><h2>{result.counts.pending} pending across {result.counts.total} submissions</h2></div>
        <button type="button" onClick={() => void refresh(false)} disabled={loading}>Refresh</button>
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
      {result.hasMore && result.cursor && <button type="button" disabled={loadingMore} onClick={() => void refresh(true)}>{loadingMore ? "Loading…" : "Load more"}</button>}
    </section>}

    {result?.warnings.length ? <WarningCallout title="Temporary account-data limitation"><p>{result.warnings.join(" ")}</p></WarningCallout> : null}
  </div>;
}
