import AdminReviewPanel from "../components/AdminReviewPanel";
import { useMarketplaceContext } from "./useMarketplaceContext";

export default function AdminPage() {
  const { profile, reviewQueue, pushMessage, demoMode } = useMarketplaceContext();
  return (
    <div className="admin-page page-card">
      <section className="section-card page-header-card">
        <p className="eyebrow">Admin Review</p>
        <h1>Admin review is role-gated and write actions are planned.</h1>
        <p>
          This page can show the review queue only for Marketplace admin profiles. Approve, reject, request changes, trust-tier assignment, security holds, and publishing remain disabled here until the privileged review workflow is implemented without browser service-role secrets.
        </p>
        {demoMode && <p className="demo-banner">Demo mode: review state is preview-only and cannot write privileged approval decisions.</p>}
      </section>
      <AdminReviewPanel profile={profile} queue={reviewQueue} onMessage={pushMessage} />
    </div>
  );
}
