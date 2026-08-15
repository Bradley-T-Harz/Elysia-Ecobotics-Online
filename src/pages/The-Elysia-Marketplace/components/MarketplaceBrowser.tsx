import type { AddonManifest } from "../types";
import AddonCard from "./AddonCard";

type MarketplaceBrowserProps = {
  addons: AddonManifest[];
  totalCount: number;
  selectedAddonId: string | null;
  savedAddonIds: string[];
  onSelectAddon: (addonId: string) => void;
  onPrepareInstall: (addonId: string) => void;
  onSaveAddon: (addonId: string) => void;
  onRemoveAddon: (addonId: string) => void;
};

export default function MarketplaceBrowser({ addons, totalCount, selectedAddonId, savedAddonIds, onSelectAddon, onPrepareInstall, onSaveAddon, onRemoveAddon }: MarketplaceBrowserProps) {
  return (
    <div className="browser-panel">
      <div className="section-heading section-heading--inline">
        <div>
          <p className="eyebrow">Browse Add-ons</p>
          <h2>{addons.length} visible / {totalCount} total</h2>
        </div>
        <p>Reviewed public listings come from the governed Marketplace catalog. Local fallback content is limited to clearly labeled, non-installable official candidates.</p>
      </div>
      {addons.length === 0 ? (
        <div className="empty-state">No reviewed public add-ons match this view. An honest empty catalog is shown instead of core dependencies or nonfunctional examples.</div>
      ) : (
        <div className="addon-grid">
          {addons.map((addon) => (
            <AddonCard
              key={addon.id}
              addon={addon}
              selected={addon.id === selectedAddonId}
              saved={savedAddonIds.includes(addon.id)}
              onSelect={onSelectAddon}
              onPrepareInstall={onPrepareInstall}
              onSaveAddon={onSaveAddon}
              onRemoveAddon={onRemoveAddon}
            />
          ))}
        </div>
      )}
    </div>
  );
}
