import type { AddonManifest } from "../types";
import AddonCard from "./AddonCard";

type MarketplaceBrowserProps = {
  addons: AddonManifest[];
  totalCount: number;
  selectedAddonId: string | null;
  onSelectAddon: (addonId: string) => void;
  onPrepareInstall: (addonId: string) => void;
  onSaveAddon: (addonId: string) => void;
};

export default function MarketplaceBrowser({ addons, totalCount, selectedAddonId, onSelectAddon, onPrepareInstall, onSaveAddon }: MarketplaceBrowserProps) {
  return (
    <div className="browser-panel">
      <div className="section-heading section-heading--inline">
        <div>
          <p className="eyebrow">Browse Add-ons</p>
          <h2>{addons.length} visible / {totalCount} total</h2>
        </div>
        <p>Seed add-ons render without Supabase. Supabase later powers saved add-ons, profiles, submissions, and review.</p>
      </div>
      {addons.length === 0 ? (
        <div className="empty-state">No add-ons match this filter set.</div>
      ) : (
        <div className="addon-grid">
          {addons.map((addon) => (
            <AddonCard key={addon.id} addon={addon} selected={addon.id === selectedAddonId} onSelect={onSelectAddon} onPrepareInstall={onPrepareInstall} onSaveAddon={onSaveAddon} />
          ))}
        </div>
      )}
    </div>
  );
}
