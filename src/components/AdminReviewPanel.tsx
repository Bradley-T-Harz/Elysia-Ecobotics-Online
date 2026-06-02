import type { AddonSubmission, MarketplaceProfile } from "../types";

type AdminReviewPanelProps = {
  profile: MarketplaceProfile | null;
  queue: AddonSubmission[];
  onMessage: (message: string) => void;
};

export default function AdminReviewPanel({ profile, queue, onMessage }: AdminReviewPanelProps) {
  if (!profile?.is_admin) {
    return <section className="admin-card"><p className="eyebrow">Admin Review</p><h2>Admin only</h2><p>Review controls appear only for admin profiles. In demo mode, the demo profile is admin so the queue can be previewed.</p></section>;
  }

  return (
    <section className="admin-card">
      <p className="eyebrow">Admin Review</p>
      <h2>Review queue</h2>
      {queue.map((submission) => (
        <article className="review-item" key={submission.id}>
          <h3>{submission.addon_name}</h3>
          <p>{submission.summary}</p>
          <p>Status: {submission.review_status}</p>
          <div className="button-row"><button type="button" onClick={() => onMessage("Demo: approval requires Supabase admin policy.")}>Approve</button><button type="button" onClick={() => onMessage("Demo: rejection requires Supabase admin policy.")}>Reject</button><button type="button" onClick={() => onMessage("Demo: needs-changes note queued.")}>Request changes</button></div>
        </article>
      ))}
    </section>
  );
}
