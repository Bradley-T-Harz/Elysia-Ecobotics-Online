import { ELYSIA_ECOBOTICS_ONLINE_URL } from "../../config/siteUrls";
import AccountLifecycleRequestForm from "../../shared/participation/AccountLifecycleRequestForm";
import PageHero from "../../shared/components/PageHero";
import PageMetadata from "../../shared/components/PageMetadata";
import WarningCallout from "../../shared/components/WarningCallout";

export default function AccountDataExportPage() {
  return (
    <div className="page-stack account-recovery-page">
      <PageMetadata
        title="Request a community data export | Elysia Ecobotics Online"
        description="Request a portable export of shared Elysia public-community account data."
        canonicalUrl={`${ELYSIA_ECOBOTICS_ONLINE_URL}/account/export`}
      />
      <PageHero eyebrow="Website Account" title="Your public-community data" brandMark="standard">
        <p>Request an export tied to the one canonical Elysia Commons identity. The request is authenticated, rate-limited, human-verified, and recorded for accountable processing.</p>
      </PageHero>
      <section className="two-column account-recovery-layout">
        <AccountLifecycleRequestForm action="export" />
        <div className="page-stack">
          <WarningCallout title="One account, scoped export"><p>The export workflow covers shared public-account and community records; economic, safety, copyright, and legal-hold records may follow distinct access and retention rules.</p></WarningCallout>
          <WarningCallout title="Private Elysia is outside the system"><p>Private local Elysia never sends its memory, conversations, files, logs, credentials, prompts, runtime state, or machine data to this website, so those materials are not part of this export.</p></WarningCallout>
        </div>
      </section>
    </div>
  );
}
