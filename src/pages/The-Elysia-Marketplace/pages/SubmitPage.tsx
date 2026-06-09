import DeveloperSubmissionForm from "../components/DeveloperSubmissionForm";
import TrustBadge from "../components/TrustBadge";
import { useMarketplaceContext } from "./useMarketplaceContext";

export default function SubmitPage() {
  const { pushMessage, demoMode } = useMarketplaceContext();
  return (
    <div className="submit-page page-card">
      <section className="section-card submit-intro">
        <p className="eyebrow">Developer Portal</p>
        <h1>Submit add-ons through manifest review.</h1>
        <p>
          Publisher profiles, add-on manifests, security notes, and review state make submissions inspectable before anything is listed as safe.
        </p>
        {demoMode && <p className="demo-banner">Demo mode: Submit for Review validates locally and explains the flow, but does not create a Supabase submission yet.</p>}
        <div className="details-grid">
          <div><h3>Publisher profile</h3><p>Developer or organization identity, source links, and ownership live in Supabase later.</p></div>
          <div><h3>Review states</h3><div className="tag-row"><TrustBadge label="draft" /><TrustBadge label="submitted" /><TrustBadge label="needs changes" tone="warning" /><TrustBadge label="approved" tone="safe" /><TrustBadge label="security hold" tone="danger" /></div></div>
          <div><h3>Trust tiers</h3><p>Reviewers assign Official, Reviewed, Community, Unreviewed, Deprecated, or Blocked labels.</p></div>
        </div>
      </section>
      <DeveloperSubmissionForm onMessage={pushMessage} />
    </div>
  );
}
