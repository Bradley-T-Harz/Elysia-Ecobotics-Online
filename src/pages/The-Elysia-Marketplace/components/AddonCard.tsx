import type { AddonManifest } from "../types";
import { permissionLabels, toneForTrustTier, trustTierLabel } from "../lib/securityLabels";
import TrustBadge from "./TrustBadge";

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
  return (
    <article className={`addon-card ${selected ? "addon-card--selected" : ""}`}>
      <div className="addon-card__topline">
        <TrustBadge label={trustTierLabel(addon.trust_tier)} tone={toneForTrustTier(addon.trust_tier)} />
        <TrustBadge label={addon.local_only ? "Local-only plan" : "Network boundary"} tone={addon.network_access ? "warning" : "safe"} />
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
        <button type="button" onClick={() => saved ? onRemoveAddon(addon.id) : onSaveAddon(addon.id)}>{saved ? "Remove from My Add-ons" : "Save to My Add-ons"}</button>
        <button type="button" className="button-primary" onClick={() => onPrepareInstall(addon.id)}>Prepare Install</button>
      </div>
    </article>
  );
}
