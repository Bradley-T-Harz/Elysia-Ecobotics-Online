import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { loadSignalConsole, markAllNotificationsRead, markNotificationRead, type CodeProposalSignalPreview, type CodeProposalSignalStatus, type NotificationPreview, type SignalConsoleData } from "./commonsCircleApi";

function signalCategory(signal: NotificationPreview) {
  const text = `${signal.notification_type ?? ""} ${signal.source_type ?? ""}`;
  if (/code_revision|proposal/i.test(text)) return "Coding Cornucopia";
  if (/sandbox/i.test(text)) return "Sandbox";
  if (/comment|reply|thread/i.test(text)) return "Commune";
  if (/marketplace|addon/i.test(text)) return "Marketplace";
  if (/forge/i.test(text)) return "Developer Forge";
  if (/review|moderation|report/i.test(text)) return "Review";
  return "Commons";
}

function statusLabel(signal: NotificationPreview) {
  if (signal.read_at) return "read";
  if (/needs_changes/i.test(signal.notification_type ?? "")) return "needs changes";
  if (/accepted/i.test(signal.notification_type ?? "")) return "accepted";
  if (/rejected/i.test(signal.notification_type ?? "")) return "rejected";
  return "unread";
}

function proposalStatusLabel(status: CodeProposalSignalStatus) {
  const labels: Record<CodeProposalSignalStatus, string> = {
    draft: "draft",
    submitted: "submitted",
    needs_changes: "needs changes",
    accepted: "accepted",
    rejected: "rejected",
    withdrawn: "withdrawn",
    hidden_by_moderation: "hidden by moderation"
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

function proposalTime(proposal: CodeProposalSignalPreview) {
  return proposal.submitted_at || proposal.created_at || proposal.updated_at || null;
}

function SignalCard({ signal, onRead }: { signal: NotificationPreview; onRead: (id: string) => void }) {
  return <article className={signal.read_at ? "commons-signal-card" : "commons-signal-card commons-signal-card--unread"}>
    <div className="addon-card__topline"><strong>{signal.title}</strong><span>{signal.created_at ? new Date(signal.created_at).toLocaleString() : "recent"}</span></div>
    <div className="commons-signal-meta"><span>{signalCategory(signal)}</span><span>{statusLabel(signal)}</span><span>{signal.notification_type?.replace(/_/g, " ") ?? "account signal"}</span></div>
    <p>{signal.body || "A Commons Circle signal needs your attention."}</p>
    <div className="button-row"><button type="button" disabled={Boolean(signal.read_at)} onClick={() => onRead(signal.id)}>{signal.read_at ? "Read" : "Mark read"}</button>{signal.action_url && <a className="button-link" href={signal.action_url}>Open signal action</a>}</div>
  </article>;
}

function ProposalSignalCard({ proposal, currentUserId, context }: { proposal: CodeProposalSignalPreview; currentUserId: string | null; context: "review" | "submitted" | "recent" }) {
  const isAuthor = proposal.original_author_user_id === currentUserId;
  const isProposer = proposal.proposer_user_id === currentUserId;
  const isTroubleshooting = proposal.source_room === "troubleshooting_grove";
  const roleLabel = isAuthor && isProposer
    ? "You are both author and proposer"
    : isAuthor
      ? "Needs original-author decision"
      : isProposer
        ? "Submitted by you"
        : "Proposal activity";
  const heading = proposal.change_summary || (isTroubleshooting ? "Troubleshooting Grove proposed fix" : "Coding Cornucopia revision proposal");
  const created = proposalTime(proposal);
  return <article className={["commons-signal-card", ["submitted", "needs_changes"].includes(proposal.proposal_status) ? "commons-signal-card--unread" : ""].filter(Boolean).join(" ")}>
    <div className="addon-card__topline"><strong>{heading}</strong><span>{created ? new Date(created).toLocaleString() : "recent"}</span></div>
    <div className="commons-signal-meta">
      <span>{isTroubleshooting ? "Troubleshooting Grove proposed fix" : "Coding Cornucopia proposal"}</span>
      <span>{proposalStatusLabel(proposal.proposal_status)}</span>
      <span>{roleLabel}</span>
      <span>{context === "review" ? "Needs my review" : context === "submitted" ? "My submitted proposals" : "Recent activity"}</span>
    </div>
    <p>{proposal.explanation || (isTroubleshooting ? "A proposed troubleshooting fix is connected to this Website Account. The public reproduction snippet changes only after the original post author accepts it." : "A proposed code revision is connected to this Website Account. Public code changes only after the original post author accepts the proposal.")}</p>
    {proposal.post_title && <p className="boundary-note">Linked post: {proposal.post_title}</p>}
    <p className="boundary-note">Author approval remains separate from moderator safety enforcement. Sandbox success is evidence only, not trust, approval, or Marketplace readiness.</p>
    <div className="button-row"><Link className="button-link" to={proposal.action_url}>{isTroubleshooting ? "Open proposed fix workbench" : "Open proposal in Coding Workbench"}</Link></div>
  </article>;
}

export default function SignalConsolePage() {
  const [data, setData] = useState<SignalConsoleData | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const refresh = useCallback(async () => {
    const result = await loadSignalConsole();
    setData(result);
    setMessages(result.warnings);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const signals = data?.signals ?? [];
  const groupedCounts = useMemo(() => signals.reduce<Record<string, number>>((counts, signal) => {
    const category = signalCategory(signal);
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {}), [signals]);
  const proposalActivity = data?.codeProposalActivity ?? [];
  const needsMyReview = data?.needsMyReview ?? [];
  const mySubmittedProposals = data?.mySubmittedProposals ?? [];
  const hasAnySignal = signals.length > 0 || proposalActivity.length > 0;

  async function readOne(id: string) {
    const warnings = await markNotificationRead(id);
    setMessages(warnings);
    await refresh();
  }

  async function readAll() {
    const warnings = await markAllNotificationsRead();
    setMessages(warnings);
    await refresh();
  }

  return <div className="page-stack commons-circle-page commons-signal-console">
    <PageHero eyebrow="Commons Circle" title="Signal Console">
      <p>Your private account-backed console for Coding Cornucopia proposals, Troubleshooting Grove proposed fixes, review outcomes, sandbox activity, followed thread updates, and other Commons signals.</p>
      <p>No private local Elysia memory, files, logs, vaults, credentials, or machine data appear here.</p>
    </PageHero>
    {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <div className="message" key={`${message}-${index}`}>{message}</div>)}</section>}
    <section className="commons-doctrine-grid">
      <WarningCallout title="Private account console"><p>Signals are visible only to the signed-in Website Account that owns them. Public profiles do not show this console.</p></WarningCallout>
      <WarningCallout title="Author approval boundary"><p>Coding Cornucopia proposals and Troubleshooting Grove proposed fixes can request code changes, but public code changes only after the original post author accepts the proposal.</p></WarningCallout>
      <WarningCallout title="Sandbox boundary"><p>Sandbox diagnostics are evidence for review. Successful runs do not create trust, Marketplace approval, or installability.</p></WarningCallout>
    </section>
    <section className="section-card">
      <div className="section-heading section-heading--inline"><div><p className="eyebrow">Website Account</p><h2>Signal access</h2></div><Link className="button-link" to="/commons-circle">Back to Commons Circle</Link></div>
      <AuthPanel
        onMessage={(message) => setMessages((current) => [...current, message])}
        onAuthChanged={refresh}
        copy={{
          eyebrow: "Website Account",
          title: data?.signedIn ? "Website Account active" : "Sign in to view private signals",
          description: "The Signal Console belongs to your public Website Account, not the private local Elysia core.",
          signedOutText: "No active website session.",
          confirmationPath: "/commons-circle/signals",
          confirmationCopy: "If email confirmation is enabled, open the confirmation link to return to the Signal Console."
        }}
      />
    </section>
    {data?.signedIn && <section className="section-card">
      <div className="section-heading section-heading--inline"><div><p className="eyebrow">Attention queue</p><h2>Signals that need review</h2></div><button type="button" disabled={!data.unreadCount} onClick={() => void readAll()}>Mark all read</button></div>
      <dl className="mini-facts"><div><dt>Unread</dt><dd>{data.unreadCount}</dd></div><div><dt>Coding proposals</dt><dd>{data.codeProposalCount}</dd></div>{Object.entries(groupedCounts).slice(0, 4).map(([category, count]) => <div key={category}><dt>{category}</dt><dd>{count}</dd></div>)}</dl>
      {!hasAnySignal && <p className="commons-empty-state">No signals yet. Code revision proposals, accepted/rejected outcomes, sandbox results, followed-thread updates, and review notices will appear here when account-backed events exist.</p>}
      <div className="section-heading"><p className="eyebrow">Coding Cornucopia proposals</p><h3>Needs my review</h3><p>Proposal activity is loaded directly from commune_code_revision_proposals, so same-user testing proposals still appear even when no notification row is created.</p></div>
      {!needsMyReview.length && <p className="commons-empty-state">No submitted or needs-changes Coding Cornucopia proposals are waiting on your author decision.</p>}
      <div className="commons-signal-list">{needsMyReview.map((proposal) => <ProposalSignalCard context="review" currentUserId={data.userId} key={`review-${proposal.id}`} proposal={proposal} />)}</div>
      <div className="section-heading"><p className="eyebrow">Coding Cornucopia proposals</p><h3>My submitted proposals</h3><p>Submitted, accepted, rejected, withdrawn, and needs-changes proposal records remain visible to the proposer without replacing public code.</p></div>
      {!mySubmittedProposals.length && <p className="commons-empty-state">You have not submitted any Coding Cornucopia revision proposals from this Website Account yet.</p>}
      <div className="commons-signal-list">{mySubmittedProposals.map((proposal) => <ProposalSignalCard context="submitted" currentUserId={data.userId} key={`submitted-${proposal.id}`} proposal={proposal} />)}</div>
      <div className="section-heading"><p className="eyebrow">Account notifications</p><h3>Existing notification rows</h3><p>User notification rows still appear here when account-backed systems create them.</p></div>
      {!signals.length && proposalActivity.length > 0 && <p className="commons-empty-state">No notification rows yet, but direct Coding Cornucopia proposal records are shown above.</p>}
      <div className="commons-signal-list">{signals.map((signal) => <SignalCard key={signal.id} signal={signal} onRead={(id) => void readOne(id)} />)}</div>
      <div className="section-heading"><p className="eyebrow">Coding Cornucopia proposals</p><h3>Recent Coding Cornucopia proposal activity</h3><p>Recent participant-visible proposal records across author review and submitted-by-me activity.</p></div>
      {!proposalActivity.length && <p className="commons-empty-state">No direct Coding Cornucopia proposal records are connected to this Website Account yet.</p>}
      <div className="commons-signal-list">{proposalActivity.map((proposal) => <ProposalSignalCard context="recent" currentUserId={data.userId} key={`recent-${proposal.id}`} proposal={proposal} />)}</div>
      <p className="boundary-note">For this pass, Coding Cornucopia proposal signals are the priority. Existing notification rows remain supported, and direct proposal records cover same-user testing or cases where a notification was intentionally not created.</p>
    </section>}
  </div>;
}
