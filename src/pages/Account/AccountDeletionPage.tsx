import { ELYSIA_ECOBOTICS_ONLINE_URL } from "../../config/siteUrls";
import PageHero from "../../shared/components/PageHero";
import PageMetadata from "../../shared/components/PageMetadata";
import WarningCallout from "../../shared/components/WarningCallout";
import AccountLifecycleRequestForm from "../../shared/participation/AccountLifecycleRequestForm";

export default function AccountDeletionPage() {
  return (
    <div className="page-stack account-recovery-page">
      <PageMetadata
        title="Request account deletion | Elysia Ecobotics Online"
        description="Request deletion and deactivation review for the shared Elysia public Website Account."
        canonicalUrl={`${ELYSIA_ECOBOTICS_ONLINE_URL}/account/delete`}
      />
      <PageHero eyebrow="Website Account" title="Account deletion and deactivation" brandMark="standard">
        <p>Deletion is a governed account-lifecycle process spanning one Auth identity, one Commons Profile, public contributions, attribution, and applicable retention duties. It is never implemented as a frontend-only delete button.</p>
      </PageHero>
      <section className="two-column account-recovery-layout">
        <AccountLifecycleRequestForm action="deletion" />
        <div className="page-stack">
          <WarningCallout title="Cooling period and revocation"><p>A submitted request enters a cooling period so mistaken or compromised-account requests can be investigated. New community participation may be restricted while the request is pending.</p></WarningCallout>
          <WarningCallout title="Attribution and narrow retention"><p>Published credits, signed winner agreements, copyright cases, safety evidence, fraud records, audit history, and legal holds may require deletion, anonymization, or limited retention under different rules.</p></WarningCallout>
          <WarningCallout title="Private Elysia stays separate"><p>This public-account workflow has no connection to private local Elysia memory, conversations, files, logs, credentials, prompts, runtime state, vault data, or machine data.</p></WarningCallout>
        </div>
      </section>
    </div>
  );
}
