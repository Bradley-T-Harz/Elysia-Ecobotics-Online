import { Link } from "react-router-dom";
import { ELYSIA_ECOBOTICS_ONLINE_URL } from "../../config/siteUrls";
import PageHero from "../../shared/components/PageHero";
import PageMetadata from "../../shared/components/PageMetadata";
import WarningCallout from "../../shared/components/WarningCallout";
import AccountLifecycleRequestForm from "../../shared/participation/AccountLifecycleRequestForm";

export default function AccountDeletionPage() {
  return (
    <div className="page-stack account-recovery-page">
      <PageMetadata
        title="Permanently Delete Account | Elysia Ecobotics Online"
        description="Request permanent deletion through the governed shared Elysia Website Account lifecycle."
        canonicalUrl={`${ELYSIA_ECOBOTICS_ONLINE_URL}/account/delete`}
      />
      <PageHero eyebrow="Data & Lifecycle" title="Permanently Delete Account" brandMark="standard">
        <p>Permanent deletion is separate from temporary deactivation. It uses the governed account-lifecycle process spanning one Auth identity, the shared Online/Artisan account, one Commons Profile, contributions, attribution, economic readiness, and applicable retention duties.</p>
      </PageHero>
      <section className="two-column account-recovery-layout">
        <AccountLifecycleRequestForm action="deletion" />
        <div className="page-stack">
          <WarningCallout title="Cooling period and revocation"><p>A submitted request enters a cooling period so mistaken or compromised-account requests can be investigated. New community participation may be restricted while the request is pending.</p></WarningCallout>
          <WarningCallout title="Temporary pause is separate"><p>If you only want to step away, use <Link to="/account/deactivate">Temporarily Deactivate Account</Link>. Temporary deactivation preserves the account and does not start deletion cleanup.</p></WarningCallout>
          <WarningCallout title="Attribution and narrow retention"><p>Published credits, signed winner agreements, copyright cases, safety evidence, fraud records, audit history, and legal holds may require deletion, anonymization, or limited retention under different rules.</p></WarningCallout>
          <WarningCallout title="Private Elysia stays separate"><p>This public-account workflow has no connection to private local Elysia memory, conversations, files, logs, credentials, prompts, runtime state, vault data, or machine data.</p></WarningCallout>
        </div>
      </section>
    </div>
  );
}
