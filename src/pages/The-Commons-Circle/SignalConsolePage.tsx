import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { loadSignalConsole, markAllNotificationsRead, markNotificationRead, type CodeProposalSignalPreview, type CodeProposalSignalStatus, type ElysiaIterationShowcaseSignalPreview, type NotificationPreview, type OfficialUpdateSignalPreview, type RepositoryShowcaseSignalPreview, type SignalConsoleData } from "./commonsCircleApi";

function signalCategory(signal: NotificationPreview) {
  const text = `${signal.notification_type ?? ""} ${signal.source_type ?? ""}`;
  if (/official_update|official_security|official_notice/i.test(text)) return "Official Update";
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

function repositoryStatusLabel(status?: string | null) {
  return status ? status.replace(/_/g, " ") : "status unknown";
}

function repositorySignalTime(signal: RepositoryShowcaseSignalPreview) {
  return signal.updated_at || signal.created_at || null;
}

function RepositorySignalCard({ signal, context }: { signal: RepositoryShowcaseSignalPreview; context: "mine" | "review" | "sandbox" | "recent" }) {
  const created = repositorySignalTime(signal);
  const title = signal.project_name || "Repository Showcase activity";
  const roleLabel = signal.role_context === "reviewer" ? "Reviewer/moderator queue" : signal.role_context === "sandbox" ? "Selected-artifact sandbox activity" : "My repository showcase";
  return <article className={["commons-signal-card", context === "review" ? "commons-signal-card--unread" : ""].filter(Boolean).join(" ")}>
    <div className="addon-card__topline"><strong>{title}</strong><span>{created ? new Date(created).toLocaleString() : "recent"}</span></div>
    <div className="commons-signal-meta"><span>Repository Showcase</span><span>{repositoryStatusLabel(signal.status)}</span><span>{repositoryStatusLabel(signal.sandbox_review_status)}</span><span>{roleLabel}</span></div>
    <p>{signal.repository_url || "Repository URL not loaded in this signal."}</p>
    <p className="boundary-note">Repository Showcase is metadata-first. Selected-artifact sandbox review is evidence only; it does not clone, install, build, trust, approve, or make a repository Marketplace-ready.</p>
    <div className="button-row"><Link className="button-link" to={signal.action_url}>{signal.sandbox_review_requested ? "Open selected-artifact sandbox review" : "Open Repository Showcase"}</Link></div>
  </article>;
}

function iterationSignalTime(signal: ElysiaIterationShowcaseSignalPreview) {
  return signal.updated_at || signal.created_at || null;
}

function IterationSignalCard({ signal, context }: { signal: ElysiaIterationShowcaseSignalPreview; context: "mine" | "review" | "sandbox" | "recent" }) {
  const created = iterationSignalTime(signal);
  const title = [signal.iteration_type || "Elysia Iteration Showcase", signal.version_build_label].filter(Boolean).join(" · ");
  const roleLabel = signal.role_context === "reviewer" ? "Reviewer/moderator queue" : signal.role_context === "sandbox" ? "Selected-artifact sandbox activity" : "My iteration showcase";
  return <article className={["commons-signal-card", context === "review" ? "commons-signal-card--unread" : ""].filter(Boolean).join(" ")}>
    <div className="addon-card__topline"><strong>{title}</strong><span>{created ? new Date(created).toLocaleString() : "recent"}</span></div>
    <div className="commons-signal-meta"><span>Elysia Iteration Showcase</span><span>{repositoryStatusLabel(signal.status)}</span><span>{repositoryStatusLabel(signal.sandbox_review_status)}</span><span>{roleLabel}</span></div>
    <p>Public progress/demo context only. This is not an Official Update, Developer Forge approval, Marketplace readiness, production readiness, compatibility proof, installability claim, or trust label.</p>
    <p className="boundary-note">Selected-artifact sandbox review can inspect a pasted artifact/snippet/config/manifest. It does not clone, install, build, run, trust, or approve a whole repository or iteration.</p>
    <div className="button-row"><Link className="button-link" to={signal.action_url}>{signal.sandbox_review_requested ? "Open selected-artifact sandbox review" : "Open Elysia Iteration Showcase"}</Link></div>
  </article>;
}

function officialStatusLabel(status?: string | null) {
  return status ? status.replace(/_/g, " ") : "status unknown";
}

function officialUpdateTime(signal: OfficialUpdateSignalPreview) {
  return signal.updated_at || signal.published_at || null;
}

function OfficialUpdateSignalCard({ signal, context }: { signal: OfficialUpdateSignalPreview; context: "mine" | "attention" | "recent" }) {
  const created = officialUpdateTime(signal);
  const title = [signal.brand_author_name || "Elysia Ecobotics Official", signal.update_type?.replace(/_/g, " ")].filter(Boolean).join(" · ");
  const roleLabel = signal.role_context === "reviewer" ? "Reviewer/admin attention" : "My official update";
  return <article className={["commons-signal-card", context === "attention" ? "commons-signal-card--unread" : ""].filter(Boolean).join(" ")}>
    <div className="addon-card__topline"><strong>{title}</strong><span>{created ? new Date(created).toLocaleString() : "recent"}</span></div>
    <div className="commons-signal-meta"><span>Official Update</span><span>{officialStatusLabel(signal.official_status)}</span><span>{officialStatusLabel(signal.severity)}</span><span>{roleLabel}</span>{signal.pinned && <span>pinned</span>}{signal.important && <span>important</span>}</div>
    <p>{signal.correction_note || "Brand-authoritative Official Update activity is connected to this Website Account."}</p>
    <p className="boundary-note">Official Updates are admin-only public records. Community users cannot submit, self-assign, impersonate, propose edits, run sandbox checks, or use a Coding Workbench for official code.</p>
    <p className="boundary-note">Official Update remains separate from Elysia Iteration Showcase, Repository Showcase, Developer Forge approval, and Marketplace readiness.</p>
    <div className="button-row"><Link className="button-link" to={signal.action_url}>Open Official Update</Link></div>
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
  const repositoryShowcaseActivity = data?.repositoryShowcaseActivity ?? [];
  const myRepositoryShowcases = data?.myRepositoryShowcases ?? [];
  const repositoryShowcasesNeedingReview = data?.repositoryShowcasesNeedingReview ?? [];
  const repositorySandboxActivity = data?.repositorySandboxActivity ?? [];
  const iterationShowcaseActivity = data?.iterationShowcaseActivity ?? [];
  const myIterationShowcases = data?.myIterationShowcases ?? [];
  const iterationShowcasesNeedingReview = data?.iterationShowcasesNeedingReview ?? [];
  const iterationSandboxActivity = data?.iterationSandboxActivity ?? [];
  const officialUpdateActivity = data?.officialUpdateActivity ?? [];
  const myOfficialUpdates = data?.myOfficialUpdates ?? [];
  const officialUpdatesNeedingAttention = data?.officialUpdatesNeedingAttention ?? [];
  const hasAnySignal = signals.length > 0 || proposalActivity.length > 0 || repositoryShowcaseActivity.length > 0 || iterationShowcaseActivity.length > 0 || officialUpdateActivity.length > 0;

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
      <p>Your private account-backed console for Coding Cornucopia proposals, Troubleshooting Grove proposed fixes, Repository Showcase metadata, Elysia Iteration Showcase progress posts, review outcomes, sandbox activity, followed thread updates, and other Commons signals.</p>
      <p>No private local Elysia memory, files, logs, vaults, credentials, or machine data appear here.</p>
    </PageHero>
    {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <div className="message" key={`${message}-${index}`}>{message}</div>)}</section>}
    <section className="commons-doctrine-grid">
      <WarningCallout title="Private account console"><p>Signals are visible only to the signed-in Website Account that owns them. Public profiles do not show this console.</p></WarningCallout>
      <WarningCallout title="Author approval boundary"><p>Coding Cornucopia proposals and Troubleshooting Grove proposed fixes can request code changes, but public code changes only after the original post author accepts the proposal.</p></WarningCallout>
      <WarningCallout title="Sandbox boundary"><p>Sandbox diagnostics are evidence for review. Successful runs do not create trust, Marketplace approval, or installability.</p></WarningCallout>
      <WarningCallout title="Official authority boundary"><p>Official Update signals are brand-authoritative and admin-only. They do not create community edit rights, code workbenches, sandbox execution, or Marketplace approval.</p></WarningCallout>
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
      <dl className="mini-facts"><div><dt>Unread</dt><dd>{data.unreadCount}</dd></div><div><dt>Coding proposals</dt><dd>{data.codeProposalCount}</dd></div><div><dt>Repository showcases</dt><dd>{data.repositoryShowcaseCount}</dd></div><div><dt>Iteration showcases</dt><dd>{data.iterationShowcaseCount}</dd></div><div><dt>Official updates</dt><dd>{data.officialUpdateCount}</dd></div>{Object.entries(groupedCounts).slice(0, 4).map(([category, count]) => <div key={category}><dt>{category}</dt><dd>{count}</dd></div>)}</dl>
      {!hasAnySignal && <p className="commons-empty-state">No signals yet. Code revision proposals, Repository Showcase submissions, Elysia Iteration Showcase progress posts, Official Update lifecycle activity, selected-artifact sandbox reviews, accepted/rejected outcomes, sandbox results, followed-thread updates, and review notices will appear here when account-backed events exist.</p>}
      <div className="section-heading"><p className="eyebrow">Coding Cornucopia proposals</p><h3>Needs my review</h3><p>Proposal activity is loaded directly from commune_code_revision_proposals, so same-user testing proposals still appear even when no notification row is created.</p></div>
      {!needsMyReview.length && <p className="commons-empty-state">No submitted or needs-changes Coding Cornucopia proposals are waiting on your author decision.</p>}
      <div className="commons-signal-list">{needsMyReview.map((proposal) => <ProposalSignalCard context="review" currentUserId={data.userId} key={`review-${proposal.id}`} proposal={proposal} />)}</div>
      <div className="section-heading"><p className="eyebrow">Coding Cornucopia proposals</p><h3>My submitted proposals</h3><p>Submitted, accepted, rejected, withdrawn, and needs-changes proposal records remain visible to the proposer without replacing public code.</p></div>
      {!mySubmittedProposals.length && <p className="commons-empty-state">You have not submitted any Coding Cornucopia revision proposals from this Website Account yet.</p>}
      <div className="commons-signal-list">{mySubmittedProposals.map((proposal) => <ProposalSignalCard context="submitted" currentUserId={data.userId} key={`submitted-${proposal.id}`} proposal={proposal} />)}</div>
      <div className="section-heading"><p className="eyebrow">Repository Showcase activity</p><h3>My repository showcases</h3><p>Repository Showcase activity is loaded directly from commune_repository_showcases, so local metadata submissions and selected-artifact sandbox requests can appear even before notification rows exist.</p></div>
      {!myRepositoryShowcases.length && <p className="commons-empty-state">You have not submitted Repository Showcase metadata from this Website Account yet.</p>}
      <div className="commons-signal-list">{myRepositoryShowcases.map((signal) => <RepositorySignalCard context="mine" key={`mine-repo-${signal.id}`} signal={signal} />)}</div>
      <div className="section-heading"><p className="eyebrow">Repository Showcase review</p><h3>Repository showcases needing review</h3><p>Authorized Commune reviewers can see pending, in-review, and needs-information Repository Showcase rows without treating them as safe, compatible, licensed, or installable.</p></div>
      {!repositoryShowcasesNeedingReview.length && <p className="commons-empty-state">No Repository Showcase metadata rows are waiting in your reviewer queue.</p>}
      <div className="commons-signal-list">{repositoryShowcasesNeedingReview.map((signal) => <RepositorySignalCard context="review" key={`review-repo-${signal.id}`} signal={signal} />)}</div>
      <div className="section-heading"><p className="eyebrow">Repository Showcase sandbox</p><h3>Selected-artifact sandbox review activity</h3><p>These signals link to the Repository Showcase selected-artifact review route. They do not run or approve whole repositories.</p></div>
      {!repositorySandboxActivity.length && <p className="commons-empty-state">No Repository Showcase selected-artifact sandbox review activity is connected to this Website Account yet.</p>}
      <div className="commons-signal-list">{repositorySandboxActivity.map((signal) => <RepositorySignalCard context="sandbox" key={`sandbox-repo-${signal.role_context}-${signal.id}`} signal={signal} />)}</div>
      <div className="section-heading"><p className="eyebrow">Elysia Iteration Showcase activity</p><h3>My iteration showcases</h3><p>Elysia Iteration Showcase activity is loaded directly from commune_iteration_showcases so public progress posts and selected-artifact review requests can appear even before notification rows exist.</p></div>
      {!myIterationShowcases.length && <p className="commons-empty-state">You have not submitted Elysia Iteration Showcase progress posts from this Website Account yet.</p>}
      <div className="commons-signal-list">{myIterationShowcases.map((signal) => <IterationSignalCard context="mine" key={`mine-iteration-${signal.id}`} signal={signal} />)}</div>
      <div className="section-heading"><p className="eyebrow">Elysia Iteration Showcase review</p><h3>Iterations needing review</h3><p>Authorized Commune reviewers can see pending, in-review, and needs-information iteration metadata without treating it as official, compatible, installable, or Marketplace-ready.</p></div>
      {!iterationShowcasesNeedingReview.length && <p className="commons-empty-state">No Elysia Iteration Showcase metadata rows are waiting in your reviewer queue.</p>}
      <div className="commons-signal-list">{iterationShowcasesNeedingReview.map((signal) => <IterationSignalCard context="review" key={`review-iteration-${signal.id}`} signal={signal} />)}</div>
      <div className="section-heading"><p className="eyebrow">Elysia Iteration Showcase sandbox</p><h3>Selected-artifact sandbox review activity</h3><p>These signals link to the Elysia Iteration Showcase selected-artifact review route. They do not run or approve whole repositories, apps, or releases.</p></div>
      {!iterationSandboxActivity.length && <p className="commons-empty-state">No Elysia Iteration Showcase selected-artifact sandbox review activity is connected to this Website Account yet.</p>}
      <div className="commons-signal-list">{iterationSandboxActivity.map((signal) => <IterationSignalCard context="sandbox" key={`sandbox-iteration-${signal.role_context}-${signal.id}`} signal={signal} />)}</div>
      <div className="section-heading"><p className="eyebrow">Official Update activity</p><h3>My official updates</h3><p>Official Update activity is loaded directly from commune_official_updates so admin-authored notices, corrections, retractions, pins, and comment locks can appear even before notification rows exist.</p></div>
      {!myOfficialUpdates.length && <p className="commons-empty-state">No Official Update records are connected to your admin Website Account yet.</p>}
      <div className="commons-signal-list">{myOfficialUpdates.map((signal) => <OfficialUpdateSignalCard context="mine" key={`mine-official-${signal.id}`} signal={signal} />)}</div>
      <div className="section-heading"><p className="eyebrow">Official Update attention</p><h3>Critical official notices</h3><p>Authorized Commune reviewers and admins can see urgent, critical, monitoring, corrected, and retracted Official Updates without giving community users publishing authority.</p></div>
      {!officialUpdatesNeedingAttention.length && <p className="commons-empty-state">No urgent Official Update lifecycle rows are waiting in your admin/reviewer attention queue.</p>}
      <div className="commons-signal-list">{officialUpdatesNeedingAttention.map((signal) => <OfficialUpdateSignalCard context="attention" key={`attention-official-${signal.id}`} signal={signal} />)}</div>
      <div className="section-heading"><p className="eyebrow">Account notifications</p><h3>Existing notification rows</h3><p>User notification rows still appear here when account-backed systems create them.</p></div>
      {!signals.length && (proposalActivity.length > 0 || repositoryShowcaseActivity.length > 0 || iterationShowcaseActivity.length > 0 || officialUpdateActivity.length > 0) && <p className="commons-empty-state">No notification rows yet, but direct Coding Cornucopia proposal records, Repository Showcase activity, Elysia Iteration Showcase activity, and Official Update lifecycle activity are shown above.</p>}
      <div className="commons-signal-list">{signals.map((signal) => <SignalCard key={signal.id} signal={signal} onRead={(id) => void readOne(id)} />)}</div>
      <div className="section-heading"><p className="eyebrow">Coding Cornucopia proposals</p><h3>Recent Coding Cornucopia proposal activity</h3><p>Recent participant-visible proposal records across author review and submitted-by-me activity.</p></div>
      {!proposalActivity.length && <p className="commons-empty-state">No direct Coding Cornucopia proposal records are connected to this Website Account yet.</p>}
      <div className="commons-signal-list">{proposalActivity.map((proposal) => <ProposalSignalCard context="recent" currentUserId={data.userId} key={`recent-${proposal.id}`} proposal={proposal} />)}</div>
      <div className="section-heading"><p className="eyebrow">Official Update activity</p><h3>Recent official lifecycle activity</h3><p>Recent admin-visible Official Update records across my notices and critical lifecycle events.</p></div>
      {!officialUpdateActivity.length && <p className="commons-empty-state">No direct Official Update lifecycle records are connected to this Website Account yet.</p>}
      <div className="commons-signal-list">{officialUpdateActivity.map((signal) => <OfficialUpdateSignalCard context="recent" key={`recent-official-${signal.role_context}-${signal.id}`} signal={signal} />)}</div>
      <p className="boundary-note">Coding Cornucopia proposal signals, Repository Showcase activity, Elysia Iteration Showcase activity, and Official Update lifecycle activity are loaded from direct records where useful. Existing notification rows remain supported, and direct records cover same-user testing or cases where a notification was intentionally not created.</p>
    </section>}
  </div>;
}
