import WorkWithWorkspace from "../../shared/workWith/WorkWithWorkspace";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import {
  loadSignalConsole,
  type CodeProposalSignalPreview,
  type CodeProposalSignalStatus,
  type CommunityVoteSignalPreview,
  type ElysiaIterationShowcaseSignalPreview,
  type JobPostSignalPreview,
  type MarketplaceForgeSignalPreview,
  type OfficialUpdateSignalPreview,
  type RepositoryShowcaseSignalPreview,
  type ResearchNotesSignalPreview,
  type SignalConsoleData,
  type SignalDetailScope,
  type TroubleshootingSignalPreview,
  type WorkWithSignalPreview,
} from "./commonsCircleApi";

export type SignalSectionKey = SignalDetailScope;

const sectionCopy: Record<SignalSectionKey, { eyebrow: string; title: string; description: string }> = {
  "coding-proposals": { eyebrow: "Coding & Technical", title: "Coding proposal signals", description: "Participant-visible proposal activity and exact links back to the established Coding Workbench review routes." },
  troubleshooting: { eyebrow: "Coding & Technical", title: "Troubleshooting signals", description: "Account-connected issues, accepted fixes, public workarounds, and role-gated specialist follow-up." },
  "research-notes": { eyebrow: "Research & Work", title: "Research Notes signals", description: "Account-connected evidence discussions, citation follow-up, corrections, and role-gated source review." },
  "repository-showcases": { eyebrow: "Coding & Technical", title: "Repository Showcase signals", description: "Repository metadata activity kept separate from selected-artifact sandbox evidence and Marketplace approval." },
  "iteration-showcases": { eyebrow: "Coding & Technical", title: "Iteration Showcase signals", description: "Public progress and demonstration history kept separate from Official Updates, releases, and Marketplace readiness." },
  "job-posts": { eyebrow: "Research & Work", title: "Job Post signals", description: "Public opportunity-listing status and anti-scam history without exposing private Work With materials." },
  "voting-room": { eyebrow: "Stewardship & Official", title: "Community Voting Room signals", description: "Voting lifecycle and outcome history without turning a community vote into automatic site authority." },
  "official-updates": { eyebrow: "Stewardship & Official", title: "Official Update signals", description: "Brand-authoritative notice history kept separate from community posts, showcases, and proposals." },
  "sandbox-reviews": { eyebrow: "Coding & Technical", title: "Selected-artifact sandbox review signals", description: "Repository and iteration selected-artifact review evidence—not whole-project trust, installation, or approval." },
  "work-with": { eyebrow: "Research & Work", title: "Work With signals", description: "Private intake and requester status remain in Work With and Requests & Reviews; specialist review remains in Review Center." },
  "marketplace-forge": { eyebrow: "Research & Work", title: "Marketplace & Developer Forge signals", description: "Submission, publication, listing, validation, and economic outcomes retain their separate authoritative systems." },
};

function formatTime(value?: string | null) {
  if (!value) return "recent";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "time unavailable" : date.toLocaleString();
}

function statusLabel(value?: string | null) {
  return value ? value.replace(/_/g, " ") : "status unknown";
}

function proposalStatusLabel(status: CodeProposalSignalStatus) {
  return statusLabel(status);
}

function uniqueBy<T>(rows: T[], key: (row: T) => string) {
  return Array.from(new Map(rows.map((row) => [key(row), row])).values());
}

function excluding<T>(rows: T[], used: Set<string>, key: (row: T) => string) {
  return rows.filter((row) => !used.has(key(row)));
}

function SignalLane({ eyebrow, title, description, empty, count, children }: { eyebrow: string; title: string; description: string; empty: string; count: number; children: ReactNode }) {
  return <section className="section-card signal-detail-lane">
    <div className="section-heading"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>
    {count === 0 ? <p className="commons-empty-state">{empty}</p> : <div className="commons-signal-list">{children}</div>}
  </section>;
}

function ProposalSignalCard({ proposal, currentUserId, context }: { proposal: CodeProposalSignalPreview; currentUserId: string | null; context: "review" | "submitted" }) {
  const isAuthor = proposal.original_author_user_id === currentUserId;
  const isProposer = proposal.proposer_user_id === currentUserId;
  const isTroubleshooting = proposal.source_room === "troubleshooting_grove";
  const roleLabel = isAuthor && isProposer ? "You are both author and proposer" : isAuthor ? "Needs original-author decision" : isProposer ? "Submitted by you" : "Proposal participant";
  return <article className={`commons-signal-card${["submitted", "needs_changes"].includes(proposal.proposal_status) ? " commons-signal-card--unread" : ""}`}>
    <div className="addon-card__topline"><strong>{proposal.post_title || (isTroubleshooting ? "Troubleshooting proposed fix" : "Coding revision proposal")}</strong><span>{formatTime(proposal.submitted_at || proposal.created_at || proposal.updated_at)}</span></div>
    <div className="commons-signal-meta"><span>{isTroubleshooting ? "Troubleshooting proposed fix" : "Coding proposal"}</span><span>{proposalStatusLabel(proposal.proposal_status)}</span><span>{roleLabel}</span><span>{context === "review" ? "Author action" : "Your submission"}</span></div>
    <p>{context === "review" ? "Open the authoritative proposal route to review the proposed change." : "Track the proposal at its authoritative source; publication changes only through established author acceptance."}</p>
    <p className="boundary-note">Proposal code and private explanation are not duplicated in this signal summary. Author approval, moderator safety review, and sandbox evidence remain separate.</p>
    <Link className="button-link button-link--primary" to={proposal.action_url}>{isTroubleshooting ? "Open proposed fix workbench" : "Open proposal in Coding Workbench"}</Link>
  </article>;
}

function TroubleshootingSignalCard({ signal }: { signal: TroubleshootingSignalPreview }) {
  return <article className={`commons-signal-card${signal.role_context === "reviewer" ? " commons-signal-card--unread" : ""}`}>
    <div className="addon-card__topline"><strong>{signal.post_title || signal.affected_area || "Troubleshooting activity"}</strong><span>{formatTime(signal.updated_at || signal.accepted_at || signal.resolved_at || signal.created_at)}</span></div>
    <div className="commons-signal-meta"><span>Troubleshooting Grove</span><span>{statusLabel(signal.troubleshooting_status)}</span><span>{statusLabel(signal.issue_type)}</span><span>{signal.role_context === "reviewer" ? "Reviewer follow-up" : signal.role_context === "resolution" ? "Resolution history" : "Your issue"}</span></div>
    <p>{signal.accepted_summary || "Structured troubleshooting activity remains connected to its public issue and authoritative status."}</p>
    <p className="boundary-note">Accepted fixes preserve issue history. Sandbox diagnostics are evidence only.</p>
    <Link className="button-link" to={signal.action_url}>Open troubleshooting issue</Link>
  </article>;
}

function ResearchNotesSignalCard({ signal }: { signal: ResearchNotesSignalPreview }) {
  return <article className={`commons-signal-card${signal.role_context === "reviewer" || signal.role_context === "clarification" ? " commons-signal-card--unread" : ""}`}>
    <div className="addon-card__topline"><strong>{signal.research_question || signal.post_title || "Research Notes activity"}</strong><span>{formatTime(signal.updated_at || signal.corrected_at || signal.reviewed_at || signal.created_at)}</span></div>
    <div className="commons-signal-meta"><span>Research Notes</span><span>{statusLabel(signal.review_status)}</span><span>{statusLabel(signal.evidence_strength)}</span><span>{signal.domain || "domain not specified"}</span></div>
    <p>{signal.correction_note || "Evidence, observation, interpretation, uncertainty, and citation context remain distinct at the source."}</p>
    <p className="boundary-note">Research Notes are public evidence discussions, not Official Updates, certification, private research storage, or trust badges.</p>
    <Link className="button-link" to={signal.action_url}>Open Research Notes post</Link>
  </article>;
}

function RepositorySignalCard({ signal }: { signal: RepositoryShowcaseSignalPreview }) {
  return <article className={`commons-signal-card${signal.role_context === "reviewer" ? " commons-signal-card--unread" : ""}`}>
    <div className="addon-card__topline"><strong>{signal.project_name || "Repository Showcase activity"}</strong><span>{formatTime(signal.updated_at || signal.created_at)}</span></div>
    <div className="commons-signal-meta"><span>Repository Showcase</span><span>{statusLabel(signal.status)}</span><span>{statusLabel(signal.sandbox_review_status)}</span><span>{signal.role_context === "reviewer" ? "Staff review snapshot" : signal.role_context === "sandbox" ? "Selected-artifact evidence" : "Your showcase"}</span></div>
    <p>{signal.repository_url || "Repository metadata is available at the source."}</p>
    <p className="boundary-note">Selected-artifact review does not clone, install, build, trust, approve, or make a repository Marketplace-ready.</p>
    <Link className="button-link" to={signal.action_url}>{signal.sandbox_review_requested ? "Open selected-artifact review" : "Open Repository Showcase"}</Link>
  </article>;
}

function IterationSignalCard({ signal }: { signal: ElysiaIterationShowcaseSignalPreview }) {
  const title = [signal.iteration_type || "Elysia Iteration Showcase", signal.version_build_label].filter(Boolean).join(" · ");
  return <article className={`commons-signal-card${signal.role_context === "reviewer" ? " commons-signal-card--unread" : ""}`}>
    <div className="addon-card__topline"><strong>{title}</strong><span>{formatTime(signal.updated_at || signal.created_at)}</span></div>
    <div className="commons-signal-meta"><span>Iteration Showcase</span><span>{statusLabel(signal.status)}</span><span>{statusLabel(signal.sandbox_review_status)}</span><span>{signal.role_context === "reviewer" ? "Staff review snapshot" : signal.role_context === "sandbox" ? "Selected-artifact evidence" : "Your showcase"}</span></div>
    <p>Public progress and demonstration context only—not an Official Update, release, compatibility proof, installability claim, or trust label.</p>
    <Link className="button-link" to={signal.action_url}>{signal.sandbox_review_requested ? "Open selected-artifact review" : "Open Iteration Showcase"}</Link>
  </article>;
}

function JobPostSignalCard({ signal }: { signal: JobPostSignalPreview }) {
  const title = [signal.role_title || "Job Post", signal.organization_project].filter(Boolean).join(" · ");
  return <article className={`commons-signal-card${signal.role_context === "reviewer" ? " commons-signal-card--unread" : ""}`}>
    <div className="addon-card__topline"><strong>{title}</strong><span>{formatTime(signal.updated_at || signal.created_at)}</span></div>
    <div className="commons-signal-meta"><span>Job Post</span><span>{statusLabel(signal.application_status)}</span><span>{statusLabel(signal.anti_scam_review_status)}</span><span>{statusLabel(signal.paid_volunteer_status)}</span></div>
    <p>{signal.public_correction_note || "Public listing status remains connected to its authoritative Job Post."}</p>
    <p className="boundary-note">Private applications, resumes, contact details, and Work With uploads never appear here.</p>
    <div className="button-row"><Link className="button-link" to={signal.action_url}>Open Job Post</Link><Link className="button-link" to="/work-with-elysia-ecobotics">Open Work With private intake</Link></div>
  </article>;
}

function WorkWithSignalCard({ signal }: { signal: WorkWithSignalPreview }) {
  return <article className="commons-signal-card">
    <div className="addon-card__topline"><strong>{signal.request_type ? `Work With · ${statusLabel(signal.request_type)}` : "Work With request"}</strong><span>{formatTime(signal.updated_at || signal.created_at)}</span></div>
    <div className="commons-signal-meta"><span>Private owner status</span><span>{statusLabel(signal.status)}</span>{signal.source_context && <span>{statusLabel(signal.source_context)}</span>}</div>
    <p>The request body, preferred contact, files, skills, and private links remain only in the protected Work With workflow.</p>
    <Link className="button-link" to={signal.action_url}>Track in Requests &amp; Reviews</Link>
  </article>;
}

function MarketplaceForgeSignalCard({ signal }: { signal: MarketplaceForgeSignalPreview }) {
  return <article className="commons-signal-card">
    <div className="addon-card__topline"><strong>Developer Forge submission</strong><span>{formatTime(signal.updated_at || signal.submitted_at)}</span></div>
    <div className="commons-signal-meta"><span>Forge</span><span>{statusLabel(signal.submission_status)}</span>{signal.listing_status && <span>Marketplace · {statusLabel(signal.listing_status)}</span>}</div>
    <p>Only safe submission and publication state appears here. Manifests, packages, contracts, payment, payout, and private review material remain in their authoritative systems.</p>
    <Link className="button-link" to={signal.action_url}>{signal.listing_status === "published" ? "Open published Marketplace listing" : "Open Developer Forge submissions"}</Link>
  </article>;
}

function CommunityVoteSignalCard({ signal }: { signal: CommunityVoteSignalPreview }) {
  return <article className={`commons-signal-card${["reviewer", "closing_soon"].includes(signal.role_context) ? " commons-signal-card--unread" : ""}`}>
    <div className="addon-card__topline"><strong>{signal.question || "Community Voting Room vote"}</strong><span>{formatTime(signal.updated_at || signal.closes_at || signal.opens_at || signal.created_at)}</span></div>
    <div className="commons-signal-meta"><span>Community Voting Room</span><span>{statusLabel(signal.vote_status)}</span><span>{statusLabel(signal.results_visibility)}</span><span>{statusLabel(signal.role_context)}</span></div>
    <p>{signal.admin_outcome_summary || "Community votes guide stewardship decisions; they do not automatically govern the site."}</p>
    <Link className="button-link" to={signal.action_url}>Open Community Voting Room post</Link>
  </article>;
}

function OfficialUpdateSignalCard({ signal }: { signal: OfficialUpdateSignalPreview }) {
  const title = [signal.brand_author_name || "Elysia Ecobotics Official", statusLabel(signal.update_type)].filter(Boolean).join(" · ");
  return <article className={`commons-signal-card${signal.role_context === "reviewer" ? " commons-signal-card--unread" : ""}`}>
    <div className="addon-card__topline"><strong>{title}</strong><span>{formatTime(signal.updated_at || signal.published_at)}</span></div>
    <div className="commons-signal-meta"><span>Official Update</span><span>{statusLabel(signal.official_status)}</span><span>{statusLabel(signal.severity)}</span>{signal.pinned && <span>pinned</span>}{signal.important && <span>important</span>}</div>
    <p>{signal.correction_note || "Brand-authoritative Official Update activity remains connected to its public source record."}</p>
    <p className="boundary-note">Community users cannot self-assign official publishing, review, proposal, or sandbox authority.</p>
    <Link className="button-link" to={signal.action_url}>Open Official Update</Link>
  </article>;
}

function StaffQueueNote({ canOpenReviewCenter }: { canOpenReviewCenter: boolean }) {
  return canOpenReviewCenter ? <p className="boundary-note">This is a read-oriented compatibility snapshot. Perform specialist decisions in <Link to="/admin/review">Review Center</Link>, where established role and source authorization are rechecked.</p> : null;
}

function DestinationCard({ eyebrow, title, children, links }: { eyebrow: string; title: string; children: ReactNode; links: Array<[string, string, boolean?]> }) {
  return <article className="section-card commons-account-room-card signal-destination-card">
    <p className="eyebrow">{eyebrow}</p><h2>{title}</h2><div>{children}</div>
    <div className="button-row">{links.map(([label, path, primary]) => <Link className={`button-link${primary ? " button-link--primary" : ""}`} to={path} key={path}>{label}</Link>)}</div>
  </article>;
}

function renderSection(section: SignalSectionKey, data: SignalConsoleData) {
  if (section === "coding-proposals") {
    const reviewIds = new Set(data.needsMyReview.map((row) => row.id));
    const submitted = data.mySubmittedProposals.filter((row) => !reviewIds.has(row.id));
    return <>
      <SignalLane eyebrow="Original-author actions" title="Proposals awaiting your decision" description="This direct-source lane remains as a parity fallback; the governed action also belongs in Inbox." empty="No submitted or needs-changes proposals are waiting on your author decision." count={data.needsMyReview.length}>{data.needsMyReview.map((row) => <ProposalSignalCard proposal={row} currentUserId={data.userId} context="review" key={row.id} />)}</SignalLane>
      <SignalLane eyebrow="Your source workflows" title="Proposals submitted by you" description="Submitted, accepted, rejected, withdrawn, and needs-changes status stays visible without replacing public code." empty="You have not submitted a coding proposal from this Website Account yet." count={submitted.length}>{submitted.map((row) => <ProposalSignalCard proposal={row} currentUserId={data.userId} context="submitted" key={row.id} />)}</SignalLane>
    </>;
  }

  if (section === "troubleshooting") {
    const resolutions = uniqueBy(data.troubleshootingResolutionActivity, (row) => row.id);
    const resolutionIds = new Set(resolutions.map((row) => row.id));
    const mine = excluding(data.myTroubleshootingIssues, resolutionIds, (row) => row.id);
    const used = new Set([...resolutionIds, ...mine.map((row) => row.id)]);
    const review = excluding(data.troubleshootingNeedingReview, used, (row) => row.id);
    return <>
      <SignalLane eyebrow="Your issues" title="Troubleshooting activity" description="Your open and in-progress structured issues remain connected to their public source threads." empty="You have no open structured Troubleshooting Grove activity." count={mine.length}>{mine.map((row) => <TroubleshootingSignalCard signal={row} key={row.id} />)}</SignalLane>
      <SignalLane eyebrow="Resolution history" title="Accepted fixes and workarounds" description="Resolved items are shown once here instead of being repeated across multiple signal lists." empty="No accepted fix or workaround history is connected to this account." count={resolutions.length}>{resolutions.map((row) => <TroubleshootingSignalCard signal={row} key={row.id} />)}</SignalLane>
      {data.canReviewCommune && <SignalLane eyebrow="Authorized staff" title="Troubleshooting review snapshot" description="Needs-information, in-progress, and fix-proposed items remain role-gated." empty="No Troubleshooting Grove rows are waiting in your reviewer queue." count={review.length}>{review.map((row) => <TroubleshootingSignalCard signal={row} key={row.id} />)}<StaffQueueNote canOpenReviewCenter={data.canOpenReviewCenter} /></SignalLane>}
    </>;
  }

  if (section === "research-notes") {
    const clarification = uniqueBy(data.researchClarificationActivity, (row) => row.id);
    const clarificationIds = new Set(clarification.map((row) => row.id));
    const mine = excluding(data.myResearchNotes, clarificationIds, (row) => row.id);
    const used = new Set([...clarificationIds, ...mine.map((row) => row.id)]);
    const review = excluding(data.researchNotesNeedingReview, used, (row) => row.id);
    return <>
      <SignalLane eyebrow="Your research" title="Research Notes activity" description="Account-owned evidence discussions remain connected to their authoritative public posts." empty="You have not submitted structured Research Notes from this account." count={mine.length}>{mine.map((row) => <ResearchNotesSignalCard signal={row} key={row.id} />)}</SignalLane>
      <SignalLane eyebrow="Evidence follow-up" title="Citation, source, and uncertainty activity" description="Clarification and correction items are shown once in this focused lane." empty="No citation, source, uncertainty, or correction follow-up is connected to this account." count={clarification.length}>{clarification.map((row) => <ResearchNotesSignalCard signal={row} key={row.id} />)}</SignalLane>
      {data.canReviewCommune && <SignalLane eyebrow="Authorized staff" title="Research Notes review snapshot" description="Citation, source, and overclaiming review remains specialist work." empty="No Research Notes rows are waiting in your reviewer queue." count={review.length}>{review.map((row) => <ResearchNotesSignalCard signal={row} key={row.id} />)}<StaffQueueNote canOpenReviewCenter={data.canOpenReviewCenter} /></SignalLane>}
    </>;
  }

  if (section === "repository-showcases") {
    const sandboxIds = new Set(data.repositorySandboxActivity.map((row) => row.id));
    const mine = excluding(data.myRepositoryShowcases, sandboxIds, (row) => row.id);
    const used = new Set(mine.map((row) => row.id));
    const review = excluding(data.repositoryShowcasesNeedingReview.filter((row) => !sandboxIds.has(row.id)), used, (row) => row.id);
    return <>
      <SignalLane eyebrow="Your showcases" title="Repository Showcase activity" description="Metadata-first repository activity stays here; selected-artifact review moves to its own focused room." empty="You have no Repository Showcase metadata activity outside selected-artifact review." count={mine.length}>{mine.map((row) => <RepositorySignalCard signal={row} key={row.id} />)}</SignalLane>
      {data.canReviewCommune && <SignalLane eyebrow="Authorized staff" title="Repository review snapshot" description="Pending and needs-information metadata remains role-gated and does not imply trust or compatibility." empty="No Repository Showcase rows are waiting in your reviewer queue." count={review.length}>{review.map((row) => <RepositorySignalCard signal={row} key={row.id} />)}<StaffQueueNote canOpenReviewCenter={data.canOpenReviewCenter} /></SignalLane>}
      <DestinationCard eyebrow="Separate evidence surface" title="Selected-artifact sandbox reviews" links={[["Open sandbox review signals", "/commons-circle/signals/sandbox-reviews", true]]}><p>Showcases with selected-artifact requests appear in the sandbox review room so the same record is not repeated here.</p></DestinationCard>
    </>;
  }

  if (section === "iteration-showcases") {
    const sandboxIds = new Set(data.iterationSandboxActivity.map((row) => row.id));
    const mine = excluding(data.myIterationShowcases, sandboxIds, (row) => row.id);
    const used = new Set(mine.map((row) => row.id));
    const review = excluding(data.iterationShowcasesNeedingReview.filter((row) => !sandboxIds.has(row.id)), used, (row) => row.id);
    return <>
      <SignalLane eyebrow="Your showcases" title="Iteration Showcase activity" description="Progress and demonstration posts stay separate from Official Updates, releases, and Marketplace approval." empty="You have no Iteration Showcase activity outside selected-artifact review." count={mine.length}>{mine.map((row) => <IterationSignalCard signal={row} key={row.id} />)}</SignalLane>
      {data.canReviewCommune && <SignalLane eyebrow="Authorized staff" title="Iteration review snapshot" description="Pending and needs-information iteration metadata remains role-gated." empty="No Iteration Showcase rows are waiting in your reviewer queue." count={review.length}>{review.map((row) => <IterationSignalCard signal={row} key={row.id} />)}<StaffQueueNote canOpenReviewCenter={data.canOpenReviewCenter} /></SignalLane>}
      <DestinationCard eyebrow="Separate evidence surface" title="Selected-artifact sandbox reviews" links={[["Open sandbox review signals", "/commons-circle/signals/sandbox-reviews", true]]}><p>Iterations with selected-artifact requests appear in the sandbox review room so the same record is not repeated here.</p></DestinationCard>
    </>;
  }

  if (section === "job-posts") {
    const status = uniqueBy(data.jobPostStatusActivity, (row) => row.id);
    const statusIds = new Set(status.map((row) => row.id));
    const mine = excluding(data.myJobPosts, statusIds, (row) => row.id);
    const used = new Set([...statusIds, ...mine.map((row) => row.id)]);
    const review = excluding(data.jobPostsNeedingReview, used, (row) => row.id);
    return <>
      <SignalLane eyebrow="Your public listings" title="Job Post activity" description="Your open listing records remain separate from private applications and Work With intake." empty="You have not submitted a structured Job Post from this account." count={mine.length}>{mine.map((row) => <JobPostSignalCard signal={row} key={row.id} />)}</SignalLane>
      <SignalLane eyebrow="Listing history" title="Filled, closed, clarification, and anti-scam outcomes" description="Status activity is shown once here with public-safe correction context." empty="No Job Post status outcomes are connected to this account." count={status.length}>{status.map((row) => <JobPostSignalCard signal={row} key={row.id} />)}</SignalLane>
      {data.canReviewCommune && <SignalLane eyebrow="Authorized staff" title="Job Post review snapshot" description="Approval and anti-scam work remains role-gated; hidden notes are not displayed." empty="No Job Post rows are waiting in your reviewer queue." count={review.length}>{review.map((row) => <JobPostSignalCard signal={row} key={row.id} />)}<StaffQueueNote canOpenReviewCenter={data.canOpenReviewCenter} /></SignalLane>}
    </>;
  }

  if (section === "sandbox-reviews") {
    const repository = uniqueBy(data.repositorySandboxActivity, (row) => row.id);
    const iterations = uniqueBy(data.iterationSandboxActivity, (row) => row.id);
    return <>
      <SignalLane eyebrow="Repository Showcase" title="Selected-artifact review activity" description="Only the selected artifact and its review status appear; no whole repository trust is inferred." empty="No Repository Showcase selected-artifact review is connected to this account." count={repository.length}>{repository.map((row) => <RepositorySignalCard signal={row} key={row.id} />)}</SignalLane>
      <SignalLane eyebrow="Iteration Showcase" title="Selected-artifact review activity" description="Only the selected artifact and its evidence state appear; no app, release, or repository approval is inferred." empty="No Iteration Showcase selected-artifact review is connected to this account." count={iterations.length}>{iterations.map((row) => <IterationSignalCard signal={row} key={row.id} />)}</SignalLane>
    </>;
  }

  if (section === "voting-room") {
    if (!data.canReviewCommune) return <DestinationCard eyebrow="Public stewardship" title="Community Voting Room" links={[["Open the Community Voting Room", "/commune/rooms/community-vote", true]]}><p>Ordinary accounts do not receive reviewer or administrator queue placeholders here. Public voting-room activity remains available in the Commune.</p></DestinationCard>;
    const lifecycle = uniqueBy(data.communityVoteLifecycleActivity, (row) => row.post_id);
    const lifecycleIds = new Set(lifecycle.map((row) => row.post_id));
    const mine = excluding(data.myCommunityVotes, lifecycleIds, (row) => row.post_id);
    const used = new Set([...lifecycleIds, ...mine.map((row) => row.post_id)]);
    const attention = excluding(data.communityVotesNeedingAttention, used, (row) => row.post_id);
    return <>
      <SignalLane eyebrow="Your stewardship records" title="Community votes you created" description="Admin-authored votes remain separate from Official Updates and do not automatically govern the site." empty="No Community Voting Room votes are connected to your authorized account." count={mine.length}>{mine.map((row) => <CommunityVoteSignalCard signal={row} key={row.post_id} />)}</SignalLane>
      <SignalLane eyebrow="Lifecycle history" title="Voting outcomes and Official Update links" description="Outcome, archive, and manual Official Update link history is shown once here." empty="No Community Voting Room lifecycle history is connected to this account." count={lifecycle.length}>{lifecycle.map((row) => <CommunityVoteSignalCard signal={row} key={row.post_id} />)}</SignalLane>
      <SignalLane eyebrow="Authorized staff" title="Voting stewardship snapshot" description="Closing and closed votes remain role-gated specialist work." empty="No Community Voting Room votes need your stewardship attention." count={attention.length}>{attention.map((row) => <CommunityVoteSignalCard signal={row} key={row.post_id} />)}<StaffQueueNote canOpenReviewCenter={data.canOpenReviewCenter} /></SignalLane>
    </>;
  }

  if (section === "official-updates") {
    if (!data.canReviewCommune) return <DestinationCard eyebrow="Brand-authoritative records" title="Official Updates" links={[["Open public Official Updates", "/commune/rooms/official-updates", true]]}><p>Ordinary accounts do not receive administrator or reviewer queue placeholders here. Public notices remain available in their established Commune room.</p></DestinationCard>;
    const attention = uniqueBy(data.officialUpdatesNeedingAttention, (row) => row.id);
    const attentionIds = new Set(attention.map((row) => row.id));
    const mine = excluding(data.myOfficialUpdates, attentionIds, (row) => row.id);
    return <>
      <SignalLane eyebrow="Your authorized notices" title="Official Updates you authored" description="Admin-authored notice history remains brand-authoritative and source-controlled." empty="No Official Update records are connected to your authorized account." count={mine.length}>{mine.map((row) => <OfficialUpdateSignalCard signal={row} key={row.id} />)}</SignalLane>
      <SignalLane eyebrow="Authorized staff" title="Critical Official Update snapshot" description="Urgent, critical, corrected, retracted, and monitoring states remain role-gated." empty="No Official Update lifecycle rows need your attention." count={attention.length}>{attention.map((row) => <OfficialUpdateSignalCard signal={row} key={row.id} />)}<StaffQueueNote canOpenReviewCenter={data.canOpenReviewCenter} /></SignalLane>
    </>;
  }

  if (section === "work-with") {
    const links: Array<[string, string, boolean?]> = [["Open Work With private intake", "/work-with-elysia-ecobotics", true], ["Track my Work With requests", "/commons-circle/signals/requests-reviews?domain=work_with"]];
    if (data.canOpenReviewCenter) links.push(["Open role-gated Review Center", "/admin/review/work-with"]);
    return <>
      <WorkWithWorkspace />
      <DestinationCard eyebrow="Private intake boundary" title="Work With remains authoritative" links={links}><p>Requested account actions belong in Inbox, informational outcomes belong in Notifications, submitted status belongs in Requests &amp; Reviews, and staff decisions remain in Review Center.</p></DestinationCard>
    </>;
  }

  const marketplaceLinks: Array<[string, string, boolean?]> = [["Open Developer Forge submissions", "/developer-forge/submissions", true], ["Open Marketplace account", "/marketplace/account"], ["Open Marketplace notifications", "/commons-circle/signals/notifications?filter=marketplace"]];
  if (data.canOpenReviewCenter) marketplaceLinks.push(["Open role-gated Marketplace review", "/admin/review/marketplace"]);
  return <>
    <section className="section-card"><p className="eyebrow">Exact owner count</p><h2>{data.marketplaceForgeTotal} Forge submission{data.marketplaceForgeTotal === 1 ? "" : "s"}</h2><p>{data.marketplaceForgeHasMore ? "Showing the 40 most recently updated submissions. Open Developer Forge for complete history." : "All submission status rows currently visible to this account are shown below."}</p></section>
    <SignalLane eyebrow="Your source-backed status" title="Forge and Marketplace activity" description="Safe submission and publication state comes from the current account’s authoritative Forge and visible Marketplace records." empty="No Developer Forge submissions are connected to this Website Account." count={data.marketplaceForgeActivity.length}>{data.marketplaceForgeActivity.map((row) => <MarketplaceForgeSignalCard signal={row} key={row.id} />)}</SignalLane>
    <DestinationCard eyebrow="Separate contracts preserved" title="Marketplace & Developer Forge outcomes" links={marketplaceLinks}><p>Forge validation, Marketplace review and publication, listings, purchases, licenses, payouts, and economic restrictions remain distinct. Each button returns to its authoritative surface.</p></DestinationCard>
  </>;
}

export default function SignalDetailPage({ section }: { section: SignalSectionKey }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [data, setData] = useState<SignalConsoleData | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const copy = sectionCopy[section];
  const pageSearch = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    return next.toString() ? `?${next.toString()}` : "";
  };

  const refresh = useCallback(async () => {
    const result = await loadSignalConsole(section, page);
    setData(result);
    setMessages(result.warnings);
  }, [page, section]);

  useEffect(() => { void refresh(); }, [refresh]);

  return <div className="page-stack commons-circle-page commons-signal-console commons-signal-detail-page">
    <PageHero eyebrow={copy.eyebrow} title={copy.title}>
      <p>{copy.description}</p>
      <p>Direct-source activity is retained here for compatibility and history. Informational event rows live in Notifications, account actions live in Inbox, submitted workflows live in Requests &amp; Reviews, and specialist decisions remain in Review Center.</p>
      <p>Each source-backed lane shows one 40-row page and reports exact source totals. Owner/participant activity remains separate from authorized reviewer or staff activity.</p>
    </PageHero>

    {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <p className="message" key={`${message}-${index}`}>{message}</p>)}</section>}

    <section className="section-card signal-detail-navigation">
      <div className="section-heading section-heading--inline"><div><p className="eyebrow">Focused signal room</p><h2>{copy.title}</h2></div><Link className="button-link button-link--primary" to="/commons-circle/signals">Back to Signals</Link></div>
      <div className="button-row"><Link className="button-link" to="/commons-circle/signals/inbox">Inbox &amp; Private Messages</Link><Link className="button-link" to="/commons-circle/signals/notifications">Notifications</Link><Link className="button-link" to="/commons-circle/signals/requests-reviews">Requests &amp; Reviews</Link>{data?.canOpenReviewCenter && <Link className="button-link" to="/admin/review">Review Center</Link>}</div>
    </section>

    <section className="section-card">
      <div className="section-heading"><p className="eyebrow">Website Account</p><h2>Private source access</h2></div>
      <AuthPanel
        onMessage={(message) => setMessages((current) => [message, ...current].slice(0, 6))}
        onAuthChanged={refresh}
        copy={{
          eyebrow: "Website Account",
          title: data?.signedIn ? "Website Account active" : "Sign in to view account-connected domain activity",
          description: "Source records remain protected by their existing participant, author, reviewer, moderator, and administrator rules.",
          signedOutText: "No active website session.",
          confirmationPath: `${location.pathname}${location.search}`,
          confirmationCopy: "If email confirmation is enabled, open the confirmation link to return to this signal room.",
        }}
      />
    </section>

    {data?.signedIn && <section className="section-card">
      <p className="eyebrow">Exact scoped totals</p>
      <dl className="mini-facts"><div><dt>Account-connected source rows</dt><dd>{data.signalOwnerTotal}</dd></div>{data.canReviewCommune && <div><dt>Authorized reviewer rows</dt><dd>{data.signalReviewerTotal}</dd></div>}<div><dt>Current page</dt><dd>{data.signalPage}</dd></div><div><dt>Rows per lane</dt><dd>{data.signalPageSize}</dd></div></dl>
      <p className="boundary-note">A row may appear in both account and reviewer totals when an authorized reviewer also owns it; the lanes represent different authority contexts.</p>
    </section>}

    {data?.signedIn && renderSection(section, data)}

    {data?.signedIn && (data.signalHasPrevious || data.signalHasNext) && <nav className="section-card button-row" aria-label="Signal room pagination">
      {data.signalHasPrevious && <Link className="button-link" to={{ pathname: location.pathname, search: pageSearch(data.signalPage - 1), hash: location.hash }}>Previous page</Link>}
      <span className="boundary-note">Page {data.signalPage}</span>
      {data.signalHasNext && <Link className="button-link button-link--primary" to={{ pathname: location.pathname, search: pageSearch(data.signalPage + 1), hash: location.hash }}>Next page</Link>}
    </nav>}

    {data?.signedIn && <WarningCallout title="Compatibility and authority"><p>No item on this page grants source authority. Detailed sections were reorganized, not deleted; direct-source states remain available while the new Inbox, Notifications, Requests &amp; Reviews, and Review Center surfaces prove production parity.</p></WarningCallout>}
  </div>;
}
