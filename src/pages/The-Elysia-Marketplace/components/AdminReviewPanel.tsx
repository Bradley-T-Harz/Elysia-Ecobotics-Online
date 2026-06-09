import type { AddonSubmission, MarketplaceProfile } from "../types";

type AdminReviewPanelProps = {
  profile: MarketplaceProfile | null;
  queue: AddonSubmission[];
  onMessage: (message: string) => void;
};

export default function AdminReviewPanel({ profile, queue, onMessage }: AdminReviewPanelProps) {
  if (!profile?.is_admin) {
    return (
      <section className="admin-card">
        <p className="eyebrow">Admin Review</p>
        <h2>Admin role required</h2>
        <p>Sign in with a Marketplace profile that has an admin role to view the real review queue. Normal member accounts do not receive review controls.</p>
      </section>
    );
  }

  return (
    <section className="admin-card">
      <p className="eyebrow">Admin Review</p>
      <h2>Review queue</h2>
      <p className="boundary-note">This browser UI can show the queue for admin profiles, but privileged approve/reject writes remain planned until the Supabase admin-review workflow is finalized. No community submission is auto-approved.</p>
      {queue.length === 0 ? <p>No submitted add-ons are waiting in the current review queue.</p> : null}
      {queue.map((submission) => (
        <article className="review-item" key={submission.id}>
          <h3>{submission.addon_name}</h3>
          <p>{submission.summary}</p>
          <p>Status: {submission.review_status}</p>
          <div className="button-row">
            <button type="button" disabled>Approve, planned</button>
            <button type="button" disabled>Reject, planned</button>
            <button type="button" disabled>Request changes, planned</button>
            <button type="button" onClick={() => onMessage("Admin review writes are intentionally disabled in this website pass. Use Supabase-admin-reviewed workflow later; do not use service-role keys in the browser.")}>Why disabled?</button>
          </div>
        </article>
      ))}
    </section>
  );
}
