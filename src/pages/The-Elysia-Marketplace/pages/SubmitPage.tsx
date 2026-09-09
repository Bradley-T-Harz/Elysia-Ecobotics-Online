import DeveloperSubmissionForm from "../components/DeveloperSubmissionForm";
import TrustBadge from "../components/TrustBadge";
import { useMarketplaceContext } from "./useMarketplaceContext";

export default function SubmitPage() {
  const { pushMessage, demoMode } = useMarketplaceContext();
  return (
    <div className="submit-page page-card">
      <section className="section-card submit-intro">
        <p className="eyebrow">Developer Portal</p>
        <h1>Submit complete add-on sources through governed review.</h1>
        <p>
          Import a package, source bundle, folder/repository, manifest, or Git URL metadata. Browser-first static inspection and explicit private transfer keep submission consequences visible.
        </p>
        {demoMode && <p className="demo-banner">Demo mode: source intake and validation run locally in the browser, but no remote review submission or public listing is created.</p>}
        <div className="details-grid">
          <div><h3>Publisher profile</h3><p>Choose an authorized publisher and record Creator / Organization attribution below. Developer identity, publisher management and independent review remain separate.</p></div>
          <div><h3>Review states</h3><div className="tag-row"><TrustBadge label="draft" /><TrustBadge label="pending review" /><TrustBadge label="needs changes" tone="warning" /><TrustBadge label="approved" tone="safe" /><TrustBadge label="security hold" tone="danger" /></div></div>
          <div><h3>Trust tiers</h3><p>Reviewers assign Official, Reviewed, Community, Unreviewed, Deprecated, or Blocked labels.</p></div>
        </div>
      </section>
      <DeveloperSubmissionForm onMessage={pushMessage} />
    </div>
  );
}
