import AdminReviewPanel from "../components/AdminReviewPanel";
import { useMarketplaceContext } from "./useMarketplaceContext";

export default function AdminPage() {
  const { profile, reviewQueue, pushMessage, demoMode } = useMarketplaceContext();
  return (
    <div className="admin-page page-card">
      <section className="section-card page-header-card">
        <p className="eyebrow">Admin Review</p>
        <h1>Review controls are placeholders until Supabase roles are configured.</h1>
        <p>
          This page previews the admin review room: approve, reject, request changes, assign trust tiers, mark security holds, and publish approved versions.
          Real authority requires Supabase profiles, RLS policies, and an admin role bootstrap.
        </p>
        {demoMode && <p className="demo-banner">Demo mode: controls explain review decisions but do not write privileged review state.</p>}
      </section>
      <AdminReviewPanel profile={profile} queue={reviewQueue} onMessage={pushMessage} />
    </div>
  );
}
