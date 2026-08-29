import type { AddonManifest } from "../types";
import { permissionLabels, toneForTrustTier, trustTierLabel } from "../lib/securityLabels";
import TrustBadge from "./TrustBadge";
import { canPrepareMarketplaceInstall, marketplaceListingLabel, marketplaceSignatureLabel } from "../lib/listingTruth";

type AddonCardProps = {
  addon: AddonManifest;
  selected: boolean;
  saved: boolean;
  onSelect: (addonId: string) => void;
  onSaveAddon: (addonId: string) => void;
  onRemoveAddon: (addonId: string) => void;
  onPrepareInstall: (addonId: string) => void;
};

export default function AddonCard({ addon, selected, saved, onSelect, onSaveAddon, onRemoveAddon, onPrepareInstall }: AddonCardProps) {
  const installAvailable = canPrepareMarketplaceInstall(addon);
  const liveReviewed = Boolean(addon.marketplace_listing_id);
  const officialDownload = addon.listing_stage === "official_release" ? addon.package_url : undefined;
  return (
    <article className={`addon-card ${selected ? "addon-card--selected" : ""}`}>
      <div className="addon-card__topline">
        <TrustBadge label={marketplaceListingLabel(addon)} tone={liveReviewed || addon.listing_stage === "official_release" ? "safe" : addon.listing_stage === "official_candidate" ? "warning" : "neutral"} />
        <TrustBadge label={trustTierLabel(addon.trust_tier)} tone={toneForTrustTier(addon.trust_tier)} />
        <TrustBadge label={marketplaceSignatureLabel(addon)} tone={addon.signature_status === "signed" || addon.signature_status === "release_manifest_signed" ? "safe" : "warning"} />
        <TrustBadge label={addon.local_only ? "Local-only plan" : "Network boundary"} tone={addon.network_access ? "warning" : "safe"} />
        {addon.status === "revoked" && <TrustBadge label="Revoked" tone="danger" />}
      </div>
      <h3>{addon.name}</h3>
      <p>{addon.summary}</p>
      <dl className="mini-facts">
        <div><dt>Publisher</dt><dd>{addon.publisher}</dd></div>
        <div><dt>Category</dt><dd>{addon.category}</dd></div>
        <div><dt>Version</dt><dd>{addon.version}</dd></div>
        <div><dt>Deps/actions</dt><dd>{addon.dependencies.length}/{addon.actions.length}</dd></div>
      </dl>
      <div className="tag-row">
        {permissionLabels(addon).slice(0, 3).map((label) => <TrustBadge key={label} label={label} tone="neutral" />)}
      </div>
      <div className="button-row">
        <button type="button" onClick={() => onSelect(addon.id)}>View Details</button>
        {officialDownload && <a className="button-link button-link--primary" href={officialDownload}>Download Codev VSIX</a>}
        {installAvailable && <button type="button" onClick={() => saved ? onRemoveAddon(addon.id) : onSaveAddon(addon.id)}>{saved ? "Remove from My Add-ons" : "Save to My Add-ons"}</button>}
        {!officialDownload && <button type="button" className="button-primary" disabled={!installAvailable} onClick={() => onPrepareInstall(addon.id)}>{installAvailable ? "Prepare Install Review" : addon.listing_stage === "official_candidate" ? "Candidate · not installable" : "Install unavailable"}</button>}
      </div>
      {officialDownload ? <p className="boundary-note">This is the exact official VSIX download. The Website does not install it, create a local install intent, approve a repository, or grant Codev authority. Verify its SHA-256 before installation: <code>{addon.package_sha256}</code>.</p> : !installAvailable && <p className="boundary-note">This listing is metadata only. It cannot create an install intent, download package code, or grant local authority.</p>}
      {addon.status === "revoked" && <p className="boundary-note">Revoked listings cannot create install intents. Local Elysia remains final authority for any previously downloaded package.</p>}
    </article>
  );
}
