import { Link } from "react-router-dom";
import { ELYSIA_ECOBOTICS_ONLINE_URL } from "../../config/siteUrls";
import PageHero from "../../shared/components/PageHero";
import PageMetadata from "../../shared/components/PageMetadata";
import RequireMember from "../../shared/auth/RequireMember";

const sections = [
  { title: "Profile & Appearance", body: "Edit your private homebase appearance and canonical Commons Profile setup.", links: [["Profile setup", "/commons-circle/setup/profile"], ["Homebase appearance", "/commons-circle/settings/appearance"]] },
  { title: "Privacy & Public Profile", body: "Control Privacy Lanterns and the canonical public-profile publication preference.", links: [["Privacy Lanterns", "/commons-circle/settings/privacy"]] },
  { title: "Notifications & Communication", body: "Choose account notification preferences without mixing them into private-message settings.", links: [["Notification Preferences", "/commons-circle/settings/notifications"], ["Messaging settings", "/commons-circle/signals/inbox/settings"]] },
  { title: "Account & Security", body: "Security and lifecycle controls for the current shared Website Account.", security: true, links: [["Change Password", "/account/change-password"], ["Temporarily Deactivate Account", "/account/deactivate"], ["Permanently Delete Account", "/account/delete"]] },
  { title: "Data & Lifecycle", body: "Export your own data and review the governed account lifecycle.", links: [["Export Account Data", "/account/export"], ["Permanently Delete Account", "/account/delete"]] },
  { title: "Hosted Execution Allowance", body: "View remaining hosted-compute allowance, reservations, and recent measured usage.", links: [["View allowance", "/commons-circle/settings/hosted-execution"]] },
  { title: "Support & Billing", body: "Get account help and review contribution or billing support destinations.", links: [["Support & Billing", "/commons-circle/support-billing"], ["General support", "/support"]] },
] as const;

export default function AccountSettingsPage() {
  return <div className="page-stack account-settings-page">
    <PageMetadata title="Account & Profile Settings | Elysia Ecobotics Online" description="Private settings for the current Elysia Website Account and Commons Profile." canonicalUrl={`${ELYSIA_ECOBOTICS_ONLINE_URL}/commons-circle/settings`} />
    <PageHero eyebrow="Private Account Homebase" title="Account & Profile Settings" brandMark="standard"><p>Your private control center for profile appearance, privacy, notifications, security, data, lifecycle, support, and billing. These controls affect only the signed-in canonical account.</p></PageHero>
    <RequireMember label="Account & Profile Settings are private to the signed-in Website Account.">
      <section className="account-settings-grid" aria-label="Account and profile settings sections">
        {sections.map((section) => <article className="section-card account-settings-section" key={section.title}>
          <h2>{section.title}</h2><p>{section.body}</p>
          <div className="account-settings-links">{section.links.map(([label, to]) => <Link className={("security" in section && section.security) ? "account-security-control" : "button-link"} to={to} key={to}>{label}</Link>)}</div>
        </article>)}
      </section>
    </RequireMember>
  </div>;
}
