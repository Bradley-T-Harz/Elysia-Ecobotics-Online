import type { AddonManifest } from "../types";
import { permissionLabels, toneForRisk, toneForTrustTier, trustTierDescription, trustTierLabel } from "../lib/securityLabels";
import TrustBadge from "./TrustBadge";
import MarketplaceCommercePanel from "./MarketplaceCommercePanel";
import { canPrepareMarketplaceInstall, marketplaceListingLabel } from "../lib/listingTruth";

type AddonDetailsProps = {
  addon: AddonManifest | null;
  onPrepareInstall: (addonId: string) => void;
  onOpenLocalInstall: (addonId: string) => void;
};

export default function AddonDetails({ addon, onPrepareInstall, onOpenLocalInstall }: AddonDetailsProps) {
  if (!addon) {
    return <section className="details-panel muted-panel"><h2>Select an add-on</h2><p>Choose an add-on to inspect its manifest, dependencies, actions, and security labels.</p></section>;
  }
  const installAvailable = canPrepareMarketplaceInstall(addon);
  const liveReviewed = Boolean(addon.marketplace_listing_id);

  return (
    <section className="details-panel details-panel--full">
      <div className="details-hero">
        <div>
          <p className="eyebrow">Add-on Details</p>
          <h1>{addon.name}</h1>
          <p>{addon.description}</p>
        </div>
        <div className="detail-summary-card">
          <TrustBadge label={trustTierLabel(addon.trust_tier)} tone={toneForTrustTier(addon.trust_tier)} />
          <p>{trustTierDescription(addon.trust_tier)}</p>
        </div>
      </div>
      <div className="tag-row">
        <TrustBadge label={marketplaceListingLabel(addon)} tone={liveReviewed ? "safe" : addon.listing_stage === "official_candidate" ? "warning" : "neutral"} />
        <TrustBadge label={addon.signature_status === "signed" ? "Signed package" : "Unsigned or unverified package"} tone={addon.signature_status === "signed" ? "safe" : "warning"} />
        <TrustBadge label={addon.category} tone="neutral" />
        <TrustBadge label={addon.network_access ? "Network access declared" : "No network declared"} tone={addon.network_access ? "warning" : "safe"} />
        <TrustBadge label={addon.local_only ? "Local-only plan" : "External boundary"} tone={addon.local_only ? "safe" : "warning"} />
        <TrustBadge label={addon.security.local_file_access === "none" ? "No file access declared" : addon.security.local_file_access} tone={addon.security.local_file_access === "none" ? "safe" : "warning"} />
      </div>
      <p className="boundary-note">This website does not install this add-on locally. A package imported into Local Elysia is revalidated there before install-disabled staging or enablement, and this catalog record grants no local authority.</p>
      {addon.status === "revoked" && <p className="boundary-note">This listing or version is revoked, so Marketplace install intent is blocked. Revocation preserves evidence and does not delete private review history.</p>}
      {!installAvailable && <p className="boundary-note">This candidate/review record is not a public install listing. No install, package download, enablement, or authority is available from this page.</p>}
      <div className="details-grid details-grid--wide">
        <div><h3>Manifest summary</h3><p>ID: <code>{addon.id}</code></p><p>Version: {addon.version}</p><p>Publisher: {addon.publisher}</p></div>
        <div><h3>Source and license</h3><p>{addon.source_url ?? "Source not surfaced"}</p><p>{addon.homepage_url ?? "Homepage not surfaced"}</p><p>{addon.license ?? "License review required"}</p></div>
        <div><h3>Dependencies</h3>{addon.dependencies.length ? addon.dependencies.map((dependency) => <p key={`${dependency.ecosystem}:${dependency.package_name}`}>{dependency.ecosystem}: {dependency.package_name} {dependency.version_constraint ?? ""}</p>) : <p>No dependencies declared.</p>}</div>
        <div><h3>Actions</h3>{addon.actions.map((action) => <p key={action.action_key}>{action.action_label}: <TrustBadge label={action.risk_level} tone={toneForRisk(action.risk_level)} /></p>)}</div>
        <div><h3>Security posture</h3><p>Model accessible: {addon.security.model_accessible ? "Yes" : "No"}</p><p>Chat accessible: {addon.security.chat_accessible ? "Yes" : "No"}</p><p>Memory promotion: {addon.security.memory_promotion_allowed ? "Allowed" : "Not allowed"}</p></div>
        <div><h3>Outward boundary</h3><p>{addon.security.outward_sharing_risk ?? "No outward sharing risk surfaced."}</p></div>
      </div>
      <h3>Permission labels</h3>
      <div className="tag-row">{permissionLabels(addon).map((label) => <TrustBadge key={label} label={label} />)}</div>
      <details className="manifest-preview">
        <summary>View Manifest JSON</summary>
        <pre>{JSON.stringify(addon, null, 2)}</pre>
      </details>
      <MarketplaceCommercePanel addon={addon} />
      <div className="button-row">{installAvailable && <button type="button" className="button-primary" onClick={() => onPrepareInstall(addon.id)}>Review permissions</button>}{installAvailable && <button type="button" onClick={() => onOpenLocalInstall(addon.id)}>Prepare Local Install</button>}<a className="button-link" href="/catalog-preview.json" target="_blank" rel="noreferrer">View catalog preview JSON</a></div>
    </section>
  );
}
