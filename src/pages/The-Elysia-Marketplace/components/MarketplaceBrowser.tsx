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
        <p>Seed add-ons render without Supabase. When Supabase is configured, profiles, saved add-ons, submissions, and review queues use real RLS-governed Marketplace data.</p>
      </div>
      {addons.length === 0 ? (
        <div className="empty-state">No add-ons match this filter set.</div>
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
